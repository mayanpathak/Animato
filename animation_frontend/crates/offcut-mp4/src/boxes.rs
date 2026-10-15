//! Boxes: the header of any box, the children of a container, and a typed
//! reader for each header box and for the sample description. The readers of
//! the sample tables are in `sample_table.rs`. Every count that comes from
//! the file is bounded by the bytes that could hold it before memory is asked for.

use offcut_types::Bytes;

use crate::ContainerError;
use crate::reader::{Cursor, RandomAccess};

/// The deepest path [`descend`] follows (v2implementation D-60).
pub const MAX_DEPTH: usize = 16;
/// The most children one container may hold (D-60).
pub const MAX_CHILDREN: usize = 4_096;
/// The most bytes of an `avcC` or `esds` box. A real one is under 1 kB.
const MAX_DESCRIPTOR: u64 = 1 << 20;

/// Where a box lies in the file. `start` is its first byte, `body` the first
/// byte after its header, `end` the first byte after the box.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BoxHeader {
    pub kind: [u8; 4],
    pub start: Bytes,
    pub body: Bytes,
    pub end: Bytes,
}

impl BoxHeader {
    pub fn body_len(&self) -> u64 {
        self.end.get().saturating_sub(self.body.get())
    }
}

/// Reads the header of the box at `at`. The box must end at or before `limit`.
pub fn read_header<R: RandomAccess>(
    r: &mut R,
    at: Bytes,
    limit: Bytes,
) -> Result<BoxHeader, ContainerError> {
    let start = at.get();
    let limit = limit.get().min(r.len().get());
    if start.checked_add(8).is_none_or(|end| end > limit) {
        return Err(ContainerError::Truncated);
    }
    let mut head = [0u8; 8];
    r.read_at(at, &mut head)?;
    let mut cur = Cursor::new(&head);
    let size32 = cur.u32()?;
    let kind = cur.fourcc()?;

    let (header_len, size) = match size32 {
        // The size is in the 64-bit field that follows the type.
        1 => {
            if start.checked_add(16).is_none_or(|end| end > limit) {
                return Err(ContainerError::Truncated);
            }
            let mut large = [0u8; 8];
            r.read_at(Bytes::new(start.saturating_add(8)), &mut large)?;
            (16, u64::from_be_bytes(large))
        }
        // The box runs to the end of what holds it.
        0 => (8, limit.saturating_sub(start)),
        size => (8, u64::from(size)),
    };
    let end = start.checked_add(size).ok_or(ContainerError::Truncated)?;
    if size < header_len || end > limit {
        return Err(ContainerError::Truncated);
    }
    Ok(BoxHeader {
        kind,
        start: at,
        body: Bytes::new(start.saturating_add(header_len)),
        end: Bytes::new(end),
    })
}

/// The boxes directly inside `parent`, in file order. A box of an unknown
/// type is listed like any other; the caller skips what it does not read.
pub fn children<R: RandomAccess>(
    r: &mut R,
    parent: &BoxHeader,
) -> Result<Vec<BoxHeader>, ContainerError> {
    let mut found = Vec::new();
    let mut at = parent.body.get();
    // Fewer than 8 bytes cannot hold a box: padding, or a QuickTime terminator.
    while parent.end.get().saturating_sub(at) >= 8 {
        if found.len() == MAX_CHILDREN {
            return Err(ContainerError::Malformed("children"));
        }
        let header = read_header(r, Bytes::new(at), parent.end)?;
        at = header.end.get();
        found.push(header);
    }
    Ok(found)
}

/// The first box of this type directly inside `parent`.
pub fn child(
    r: &mut impl RandomAccess,
    parent: &BoxHeader,
    kind: &[u8; 4],
) -> Result<Option<BoxHeader>, ContainerError> {
    Ok(children(r, parent)?
        .into_iter()
        .find(|header| &header.kind == kind))
}

/// Follows `path` down from `top`, one box type per level; `None` when a
/// level is absent. Every nested read in this crate goes through here, so
/// no file can make the reader go deeper than [`MAX_DEPTH`].
pub fn descend(
    r: &mut impl RandomAccess,
    top: &BoxHeader,
    path: &[[u8; 4]],
) -> Result<Option<BoxHeader>, ContainerError> {
    if path.len() > MAX_DEPTH {
        return Err(ContainerError::Malformed("depth"));
    }
    let mut at = *top;
    for kind in path {
        match child(r, &at, kind)? {
            Some(next) => at = next,
            None => return Ok(None),
        }
    }
    Ok(Some(at))
}

/// The first `want` bytes of a box body, or all of it when it is shorter.
pub(crate) fn load<R: RandomAccess>(
    r: &mut R,
    h: &BoxHeader,
    want: u64,
) -> Result<Vec<u8>, ContainerError> {
    let len = usize::try_from(h.body_len().min(want)).map_err(|_| ContainerError::Truncated)?;
    let mut bytes = vec![0u8; len];
    r.read_at(h.body, &mut bytes)?;
    Ok(bytes)
}

// --- Header boxes ----------------------------------------------------------------

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Ftyp {
    pub major: [u8; 4],
    pub compatible: Vec<[u8; 4]>,
}

pub fn read_ftyp<R: RandomAccess>(r: &mut R, h: &BoxHeader) -> Result<Ftyp, ContainerError> {
    let bytes = load(r, h, 8 + 4 * 64)?;
    let mut cur = Cursor::new(&bytes);
    let major = cur.fourcc()?;
    cur.skip(4)?; // minor version
    let mut compatible = Vec::new();
    while cur.remaining() >= 4 {
        compatible.push(cur.fourcc()?);
    }
    Ok(Ftyp { major, compatible })
}

/// What `mvhd` and `mdhd` both say: ticks per second, and a length in ticks.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TimeHeader {
    pub timescale: u32,
    pub duration: u64,
}

fn read_time_header<R: RandomAccess>(
    r: &mut R,
    h: &BoxHeader,
    name: &'static str,
) -> Result<TimeHeader, ContainerError> {
    let bytes = load(r, h, 32)?;
    let mut cur = Cursor::new(&bytes);
    match cur.u32()? >> 24 {
        0 => {
            cur.skip(8)?; // creation and modification time
            Ok(TimeHeader {
                timescale: cur.u32()?,
                duration: u64::from(cur.u32()?),
            })
        }
        1 => {
            cur.skip(16)?;
            Ok(TimeHeader {
                timescale: cur.u32()?,
                duration: cur.u64()?,
            })
        }
        _ => Err(ContainerError::Malformed(name)),
    }
}

pub fn read_mvhd<R: RandomAccess>(r: &mut R, h: &BoxHeader) -> Result<TimeHeader, ContainerError> {
    read_time_header(r, h, "mvhd")
}

pub fn read_mdhd<R: RandomAccess>(r: &mut R, h: &BoxHeader) -> Result<TimeHeader, ContainerError> {
    read_time_header(r, h, "mdhd")
}

/// `flags` bit 0 is "track enabled". `matrix` is the nine values as stored;
/// `width` and `height` are 16.16 fixed point.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Tkhd {
    pub flags: u32,
    pub matrix: [i32; 9],
    pub width: u32,
    pub height: u32,
}

pub fn read_tkhd<R: RandomAccess>(r: &mut R, h: &BoxHeader) -> Result<Tkhd, ContainerError> {
    let bytes = load(r, h, 96)?;
    let mut cur = Cursor::new(&bytes);
    let version_flags = cur.u32()?;
    // Times, track id, reserved, duration; then reserved, layer, group, volume, reserved.
    match version_flags >> 24 {
        0 => cur.skip(20 + 16)?,
        1 => cur.skip(32 + 16)?,
        _ => return Err(ContainerError::Malformed("tkhd")),
    }
    let mut matrix = [0i32; 9];
    for value in &mut matrix {
        *value = cur.i32()?;
    }
    Ok(Tkhd {
        flags: version_flags & 0x00FF_FFFF,
        matrix,
        width: cur.u32()?,
        height: cur.u32()?,
    })
}

/// The handler type: `vide`, `soun`, or something this crate does not read.
pub fn read_hdlr<R: RandomAccess>(r: &mut R, h: &BoxHeader) -> Result<[u8; 4], ContainerError> {
    let bytes = load(r, h, 12)?;
    let mut cur = Cursor::new(&bytes);
    cur.skip(8)?; // version, flags, pre_defined
    cur.fourcc()
}

// --- The sample description ------------------------------------------------------

/// The first sample entry of a track. The size is filled for a `vide` track,
/// the channel count and rate for a `soun` track. `config` is the raw `avcC`
/// payload, or the `AudioSpecificConfig` from `esds`; `object_type` is the
/// object type indication of `esds` (0x40 is AAC).
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct SampleEntry {
    pub fourcc: [u8; 4],
    pub width: u16,
    pub height: u16,
    pub channels: u32,
    pub sample_rate: u32,
    pub object_type: Option<u8>,
    pub config: Option<Vec<u8>>,
}

/// `handler` is the track's handler type, which says how to read the entry.
pub fn read_stsd<R: RandomAccess>(
    r: &mut R,
    h: &BoxHeader,
    handler: &[u8; 4],
) -> Result<SampleEntry, ContainerError> {
    // Version, flags and the entry count come before the first entry.
    let entry = read_header(r, Bytes::new(h.body.get().saturating_add(8)), h.end)?;
    let fields = load(r, &entry, 78)?;
    let mut cur = Cursor::new(&fields);
    let mut out = SampleEntry {
        fourcc: entry.kind,
        ..SampleEntry::default()
    };
    cur.skip(8)?; // reserved, data reference index

    let fields_len = match handler {
        b"vide" => {
            cur.skip(16)?;
            out.width = cur.u16()?;
            out.height = cur.u16()?;
            78
        }
        b"soun" => {
            let version = cur.u16()?;
            cur.skip(6)?; // revision, vendor
            if version == 2 {
                // The QuickTime layout with a 64-bit rate.
                cur.skip(16)?;
                out.sample_rate = f64::from_bits(cur.u64()?) as u32;
                out.channels = cur.u32()?;
                64
            } else {
                out.channels = u32::from(cur.u16()?);
                cur.skip(6)?; // sample size, compression id, packet size
                out.sample_rate = cur.u32()? >> 16;
                if version == 1 { 44 } else { 28 }
            }
        }
        _ => return Ok(out),
    };

    let inner = BoxHeader {
        body: Bytes::new(
            entry
                .body
                .get()
                .saturating_add(fields_len)
                .min(entry.end.get()),
        ),
        ..entry
    };
    if handler == b"vide" {
        if let Some(avcc) = child(r, &inner, b"avcC")? {
            out.config = Some(load_descriptor(r, &avcc, "avcC")?);
        }
        return Ok(out);
    }
    // QuickTime puts `esds` one level down, in `wave`.
    let esds = match child(r, &inner, b"esds")? {
        Some(found) => Some(found),
        None => descend(r, &inner, &[*b"wave", *b"esds"])?,
    };
    if let Some(esds) = esds {
        let bytes = load_descriptor(r, &esds, "esds")?;
        let (object_type, config) =
            parse_esds(&bytes).map_err(|_| ContainerError::Malformed("esds"))?;
        out.object_type = Some(object_type);
        out.config = config;
    }
    Ok(out)
}

fn load_descriptor<R: RandomAccess>(
    r: &mut R,
    h: &BoxHeader,
    name: &'static str,
) -> Result<Vec<u8>, ContainerError> {
    if h.body_len() > MAX_DESCRIPTOR {
        return Err(ContainerError::Malformed(name));
    }
    load(r, h, MAX_DESCRIPTOR)
}

/// The object type indication and, when present, the decoder specific info.
fn parse_esds(bytes: &[u8]) -> Result<(u8, Option<Vec<u8>>), ContainerError> {
    /// A descriptor's tag and its length, which is 7 bits per byte.
    fn descriptor(cur: &mut Cursor<'_>) -> Result<(u8, usize), ContainerError> {
        let tag = cur.u8()?;
        let mut len = 0usize;
        for _ in 0..4 {
            let byte = cur.u8()?;
            len = (len << 7) | usize::from(byte & 0x7F);
            if byte & 0x80 == 0 {
                break;
            }
        }
        Ok((tag, len))
    }

    let mut cur = Cursor::new(bytes);
    cur.skip(4)?; // version, flags
    if descriptor(&mut cur)?.0 != 0x03 {
        return Err(ContainerError::Malformed("esds"));
    }
    cur.skip(2)?; // ES_ID
    let flags = cur.u8()?;
    if flags & 0x80 != 0 {
        cur.skip(2)?; // depends on another stream
    }
    if flags & 0x40 != 0 {
        let url_len = cur.u8()?;
        cur.skip(usize::from(url_len))?;
    }
    if flags & 0x20 != 0 {
        cur.skip(2)?; // clock reference stream
    }
    if descriptor(&mut cur)?.0 != 0x04 {
        return Err(ContainerError::Malformed("esds"));
    }
    let object_type = cur.u8()?;
    cur.skip(12)?; // stream type, buffer size, two bitrates
    if cur.remaining() == 0 {
        return Ok((object_type, None));
    }
    let (tag, len) = descriptor(&mut cur)?;
    let config = if tag == 0x05 {
        Some(cur.take(len)?.to_vec())
    } else {
        None
    };
    Ok((object_type, config))
}

#[cfg(test)]
mod tests {
    use proptest::prelude::*;

    use super::*;
    use crate::reader::MemReader;
    use crate::sample_table::{read_elst, read_stsz};

    /// A box with a 32-bit size.
    fn boxed(kind: &[u8; 4], body: &[u8]) -> Vec<u8> {
        let mut bytes = (body.len() as u32 + 8).to_be_bytes().to_vec();
        bytes.extend_from_slice(kind);
        bytes.extend_from_slice(body);
        bytes
    }

    fn header_at(bytes: &[u8], at: u64, limit: u64) -> Result<BoxHeader, ContainerError> {
        read_header(
            &mut MemReader(bytes.to_vec()),
            Bytes::new(at),
            Bytes::new(limit),
        )
    }

    #[test]
    fn a_header_with_a_32_bit_size_a_64_bit_size_and_size_0() {
        // Three boxes in a row: 12 bytes, 20 bytes, and one that runs to the end.
        let mut file = boxed(b"free", &[1, 2, 3, 4]);
        file.extend_from_slice(&1u32.to_be_bytes());
        file.extend_from_slice(b"wide");
        file.extend_from_slice(&20u64.to_be_bytes());
        file.extend_from_slice(&[5, 6, 7, 8]);
        file.extend_from_slice(&0u32.to_be_bytes());
        file.extend_from_slice(b"mdat");
        file.extend_from_slice(&[9; 10]);
        let len = file.len() as u64;

        let small = header_at(&file, 0, len).unwrap();
        assert_eq!(
            (&small.kind, small.body.get(), small.end.get()),
            (b"free", 8, 12)
        );
        let large = header_at(&file, 12, len).unwrap();
        assert_eq!(
            (&large.kind, large.body.get(), large.end.get()),
            (b"wide", 28, 32)
        );
        let open = header_at(&file, 32, len).unwrap();
        assert_eq!(
            (&open.kind, open.body.get(), open.end.get()),
            (b"mdat", 40, 50)
        );
        assert_eq!(open.body_len(), 10);

        // The same three, as the children of a container.
        let parent = boxed(b"moov", &file);
        let mut reader = MemReader(parent);
        let top = read_header(&mut reader, Bytes::new(0), Bytes::new(len + 8)).unwrap();
        let kinds: Vec<[u8; 4]> = children(&mut reader, &top)
            .unwrap()
            .iter()
            .map(|h| h.kind)
            .collect();
        assert_eq!(kinds, [*b"free", *b"wide", *b"mdat"]);
        assert_eq!(
            descend(&mut reader, &top, &[*b"wide"])
                .unwrap()
                .map(|h| h.start.get()),
            Some(20)
        );
        assert_eq!(descend(&mut reader, &top, &[*b"trak"]).unwrap(), None);
        assert_eq!(
            descend(&mut reader, &top, &[*b"free"; MAX_DEPTH + 1]),
            Err(ContainerError::Malformed("depth"))
        );
    }

    #[test]
    fn a_box_that_ends_past_the_limit_is_truncated() {
        let file = boxed(b"moov", &[0; 24]);
        // The box is whole, but the limit is inside it.
        assert_eq!(header_at(&file, 0, 16), Err(ContainerError::Truncated));
        // The file ends inside the box.
        assert_eq!(
            header_at(&file[..20], 0, 32),
            Err(ContainerError::Truncated)
        );
        // A size smaller than the header, and a header cut short.
        assert_eq!(
            header_at(&[0, 0, 0, 4, b'f', b'r', b'e', b'e'], 0, 8),
            Err(ContainerError::Truncated)
        );
        assert_eq!(header_at(&file[..6], 0, 6), Err(ContainerError::Truncated));
        // A 64-bit size that runs past the end of all memory.
        let mut huge = 1u32.to_be_bytes().to_vec();
        huge.extend_from_slice(b"mdat");
        huge.extend_from_slice(&u64::MAX.to_be_bytes());
        assert_eq!(header_at(&huge, 0, 16), Err(ContainerError::Truncated));
        // More children than one container may hold.
        let crowded = boxed(b"moov", &boxed(b"free", &[]).repeat(MAX_CHILDREN + 1));
        let mut reader = MemReader(crowded);
        let limit = reader.len();
        let top = read_header(&mut reader, Bytes::new(0), limit).unwrap();
        assert_eq!(
            children(&mut reader, &top),
            Err(ContainerError::Malformed("children"))
        );

        // Any bytes at all: no panic, and a header that is returned lies inside the limit.
        proptest!(|(bytes in proptest::collection::vec(any::<u8>(), 0..96), at in 0u64..100, limit in 0u64..120)| {
            let mut reader = MemReader(bytes.clone());
            if let Ok(header) = read_header(&mut reader, Bytes::new(at), Bytes::new(limit)) {
                prop_assert!(header.start.get() == at && header.start < header.body);
                prop_assert!(header.body <= header.end && header.end.get() <= limit.min(bytes.len() as u64));
                let _ = children(&mut reader, &header);
                let _ = read_stsd(&mut reader, &header, b"soun");
                let _ = read_stsz(&mut reader, &header, 16);
                let _ = read_elst(&mut reader, &header);
                let _ = read_tkhd(&mut reader, &header);
            }
        });
    }
}
