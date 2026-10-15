//! The boxes the muxer writes: one writer per box, and nothing else. Each
//! returns the bytes of a whole box. No `udta`, no title, no location and no
//! rotation is ever written, and every time stamp in a box is 0.

/// A run of samples of one track that lie one after the other in `mdat`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Chunk {
    pub(crate) offset: u64,
    pub(crate) samples: u32,
}

const IDENTITY: [i32; 9] = [0x1_0000, 0, 0, 0, 0x1_0000, 0, 0, 0, 0x4000_0000];

/// A count or a length as the 32 bits a box stores. No table of a file this
/// crate can write is that long; a longer one would stop at the reserve first.
fn count(len: usize) -> u32 {
    u32::try_from(len).unwrap_or(u32::MAX)
}

/// A box with a 32-bit size.
pub(crate) fn boxed(kind: &[u8; 4], body: &[u8]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(body.len().saturating_add(8));
    bytes.extend_from_slice(&count(body.len().saturating_add(8)).to_be_bytes());
    bytes.extend_from_slice(kind);
    bytes.extend_from_slice(body);
    bytes
}

/// A box whose body starts with a version and flags.
fn full(kind: &[u8; 4], version_flags: u32, fields: &[u8]) -> Vec<u8> {
    let mut body = version_flags.to_be_bytes().to_vec();
    body.extend_from_slice(fields);
    boxed(kind, &body)
}

/// A box that holds other boxes.
pub(crate) fn container(kind: &[u8; 4], children: &[Vec<u8>]) -> Vec<u8> {
    boxed(kind, &children.concat())
}

fn words(fields: &[u32]) -> Vec<u8> {
    fields
        .iter()
        .flat_map(|field| field.to_be_bytes())
        .collect()
}

pub(crate) fn ftyp() -> Vec<u8> {
    boxed(b"ftyp", b"isom\0\0\0\0isommp42")
}

/// The header of a `free` box of `size` bytes, header included.
pub(crate) fn free_header(size: u32) -> [u8; 8] {
    let mut header = [0u8; 8];
    let (len, kind) = header.split_at_mut(4);
    len.copy_from_slice(&size.to_be_bytes());
    kind.copy_from_slice(b"free");
    header
}

/// The header of an `mdat` box of `size` bytes, header included, with the
/// size in the 64-bit field: the box may pass 4 GiB without a change of layout.
pub(crate) fn mdat_header(size: u64) -> [u8; 16] {
    let mut header = [0u8; 16];
    let (head, large) = header.split_at_mut(8);
    let (one, kind) = head.split_at_mut(4);
    one.copy_from_slice(&1u32.to_be_bytes());
    kind.copy_from_slice(b"mdat");
    large.copy_from_slice(&size.to_be_bytes());
    header
}

/// `duration` is in ticks of `timescale`.
pub(crate) fn mvhd(timescale: u32, duration: u32, next_track_id: u32) -> Vec<u8> {
    let mut fields = words(&[0, 0, timescale, duration, 0x1_0000]);
    fields.extend_from_slice(&[0x01, 0x00]); // volume
    fields.extend_from_slice(&[0; 10]);
    fields.extend(IDENTITY.iter().flat_map(|value| value.to_be_bytes()));
    fields.extend_from_slice(&[0; 24]);
    fields.extend_from_slice(&next_track_id.to_be_bytes());
    full(b"mvhd", 0, &fields)
}

/// `duration` is in ticks of the movie timescale. A video track has a size;
/// an audio track has a volume.
pub(crate) fn tkhd(id: u32, duration: u32, size: Option<(u16, u16)>) -> Vec<u8> {
    let mut fields = words(&[0, 0, id, 0, duration, 0, 0]);
    fields.extend_from_slice(&[0; 4]); // layer, alternate group
    fields.extend_from_slice(if size.is_some() { &[0, 0] } else { &[1, 0] });
    fields.extend_from_slice(&[0; 2]);
    fields.extend(IDENTITY.iter().flat_map(|value| value.to_be_bytes()));
    let (width, height) = size.unwrap_or((0, 0));
    fields.extend_from_slice(&words(&[u32::from(width) << 16, u32::from(height) << 16]));
    // Enabled, and part of the movie.
    full(b"tkhd", 3, &fields)
}

/// One edit: the track is shown from `media_time`, in ticks of its own
/// timescale, for `segment_duration` ticks of the movie timescale.
pub(crate) fn edts(segment_duration: u32, media_time: u32) -> Vec<u8> {
    let elst = full(
        b"elst",
        0,
        &words(&[1, segment_duration, media_time, 0x1_0000]),
    );
    container(b"edts", &[elst])
}

/// `duration` is in ticks of `timescale`. The language is undetermined.
pub(crate) fn mdhd(timescale: u32, duration: u32) -> Vec<u8> {
    let mut fields = words(&[0, 0, timescale, duration]);
    fields.extend_from_slice(&[0x55, 0xC4, 0, 0]);
    full(b"mdhd", 0, &fields)
}

/// `handler` is `vide` or `soun`. The name is empty.
fn hdlr(handler: &[u8; 4]) -> Vec<u8> {
    let mut fields = vec![0u8; 4];
    fields.extend_from_slice(handler);
    fields.extend_from_slice(&[0; 13]);
    full(b"hdlr", 0, &fields)
}

fn vmhd() -> Vec<u8> {
    full(b"vmhd", 1, &[0; 8])
}

fn smhd() -> Vec<u8> {
    full(b"smhd", 0, &[0; 4])
}

/// The samples are in this file.
fn dinf() -> Vec<u8> {
    let url = full(b"url ", 1, &[]);
    let dref = full(b"dref", 0, &[words(&[1]), url].concat());
    container(b"dinf", &[dref])
}

/// An `avc1` sample entry around the `avcC` payload.
pub(crate) fn stsd_video(width: u16, height: u16, avcc: &[u8]) -> Vec<u8> {
    let mut entry = vec![0u8; 6];
    entry.extend_from_slice(&1u16.to_be_bytes()); // data reference index
    entry.extend_from_slice(&[0; 16]);
    entry.extend_from_slice(&width.to_be_bytes());
    entry.extend_from_slice(&height.to_be_bytes());
    entry.extend_from_slice(&words(&[0x0048_0000, 0x0048_0000, 0])); // 72 dpi
    entry.extend_from_slice(&1u16.to_be_bytes()); // frames per sample
    entry.extend_from_slice(&[0; 32]); // compressor name
    entry.extend_from_slice(&[0x00, 0x18, 0xFF, 0xFF]); // depth, no colour table
    entry.extend_from_slice(&boxed(b"avcC", avcc));
    full(b"stsd", 0, &[words(&[1]), boxed(b"avc1", &entry)].concat())
}

/// An `mp4a` sample entry around an `esds` that holds the `AudioSpecificConfig`.
pub(crate) fn stsd_audio(sample_rate: u32, channels: u16, asc: &[u8]) -> Vec<u8> {
    let mut entry = vec![0u8; 6];
    entry.extend_from_slice(&1u16.to_be_bytes()); // data reference index
    entry.extend_from_slice(&[0; 8]); // version 0, revision, vendor
    entry.extend_from_slice(&channels.to_be_bytes());
    entry.extend_from_slice(&[0, 16, 0, 0, 0, 0]); // sample size, compression id, packet size
    entry.extend_from_slice(&(sample_rate << 16).to_be_bytes());
    entry.extend_from_slice(&esds(asc));
    full(b"stsd", 0, &[words(&[1]), boxed(b"mp4a", &entry)].concat())
}

/// A descriptor of an elementary stream: its tag, its length in groups of 7
/// bits, and its content.
fn descriptor(tag: u8, content: &[u8]) -> Vec<u8> {
    let len = count(content.len());
    let mut bytes = vec![tag];
    for shift in [21u32, 14, 7] {
        if len >> shift != 0 {
            bytes.push(0x80 | ((len >> shift) & 0x7F) as u8);
        }
    }
    bytes.push((len & 0x7F) as u8);
    bytes.extend_from_slice(content);
    bytes
}

/// MPEG-4 audio (object type 0x40) with its decoder configuration.
fn esds(asc: &[u8]) -> Vec<u8> {
    let mut decoder = vec![0x40, 0x15];
    decoder.extend_from_slice(&[0; 11]); // buffer size, largest and average bit rate
    decoder.extend_from_slice(&descriptor(0x05, asc));
    let mut stream = vec![0u8; 3]; // id, flags
    stream.extend_from_slice(&descriptor(0x04, &decoder));
    stream.extend_from_slice(&descriptor(0x06, &[0x02]));
    full(b"esds", 0, &descriptor(0x03, &stream))
}

/// `runs` are (sample count, duration of each of them in the media timescale).
fn stts(runs: &[(u32, u32)]) -> Vec<u8> {
    let mut fields = words(&[count(runs.len())]);
    fields.extend(runs.iter().flat_map(|&(run, delta)| words(&[run, delta])));
    full(b"stts", 0, &fields)
}

/// The numbers, from 1, of the samples a decoder can start at.
fn stss(sync: &[u32]) -> Vec<u8> {
    let mut fields = words(&[count(sync.len())]);
    fields.extend_from_slice(&words(sync));
    full(b"stss", 0, &fields)
}

/// One record where the number of samples in a chunk changes.
fn stsc(chunks: &[Chunk]) -> Vec<u8> {
    let mut records = Vec::new();
    let mut entries = 0u32;
    let mut per_chunk = None;
    for (number, chunk) in (1u32..).zip(chunks) {
        if per_chunk != Some(chunk.samples) {
            records.extend_from_slice(&words(&[number, chunk.samples, 1]));
            entries = entries.saturating_add(1);
            per_chunk = Some(chunk.samples);
        }
    }
    full(b"stsc", 0, &[words(&[entries]), records].concat())
}

fn stsz(sizes: &[u32]) -> Vec<u8> {
    let mut fields = words(&[0, count(sizes.len())]);
    fields.extend_from_slice(&words(sizes));
    full(b"stsz", 0, &fields)
}

/// Where each chunk starts, as a 64-bit offset from the start of the file.
fn co64(chunks: &[Chunk]) -> Vec<u8> {
    let mut fields = words(&[count(chunks.len())]);
    fields.extend(chunks.iter().flat_map(|chunk| chunk.offset.to_be_bytes()));
    full(b"co64", 0, &fields)
}

/// The sample tables of a track, after its sample description. `sync` is
/// given for video: the numbers, from 1, of the keyframes.
pub(crate) fn stbl(
    stsd: Vec<u8>,
    runs: &[(u32, u32)],
    sync: Option<&[u32]>,
    sizes: &[u32],
    chunks: &[Chunk],
) -> Vec<u8> {
    let mut tables = vec![stsd, stts(runs)];
    tables.extend(sync.map(stss));
    tables.extend([stsc(chunks), stsz(sizes), co64(chunks)]);
    container(b"stbl", &tables)
}

/// A track's media: its header, its handler, and its tables under the media
/// header of its kind.
pub(crate) fn mdia(mdhd: Vec<u8>, handler: &[u8; 4], stbl: Vec<u8>) -> Vec<u8> {
    let media_header = if handler == b"vide" { vmhd() } else { smhd() };
    let minf = container(b"minf", &[media_header, dinf(), stbl]);
    container(b"mdia", &[mdhd, hdlr(handler), minf])
}

/// A track. The edit, when there is one, comes after the track header.
pub(crate) fn trak(tkhd: Vec<u8>, edts: Option<Vec<u8>>, mdia: Vec<u8>) -> Vec<u8> {
    let mut children = vec![tkhd];
    children.extend(edts);
    children.push(mdia);
    container(b"trak", &children)
}
