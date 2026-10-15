//! The sample tables of one track: a reader for each table box, and from the
//! tables to the samples: where each lies in the file, when it is decoded
//! and shown, and how the edit list shifts the track.

use offcut_types::Bytes;

use crate::ContainerError;
use crate::boxes::{BoxHeader, load};
use crate::reader::{Cursor, RandomAccess};

/// A track with more samples than this is not expanded (v2implementation
/// D-60). 90 s at 60 fps is 5,400 video samples; 90 s of AAC is 4,219 frames.
pub const MAX_RESOLVED_SAMPLES: u32 = 20_000;

/// One sample. Times are in the media timescale, before the edit list.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Sample {
    pub offset: Bytes,
    pub size: u32,
    pub dts: i64,
    pub pts: i64,
    pub duration: u32,
    pub keyframe: bool,
}

/// One track, resolved. `edit_offset` is what to subtract from a `pts` to
/// get the time the edit list presents it at; `presented` is how long the
/// track is shown. Both are in the media timescale. A track left unresolved
/// has no `samples`; everything else is still filled.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TrackTable {
    pub timescale: u32,
    pub sample_count: u32,
    pub resolved: bool,
    pub samples: Vec<Sample>,
    pub edit_offset: i64,
    pub presented: i64,
}

/// The tables of one track as its boxes hold them. `timescale` is from
/// `mdhd`, `movie_timescale` from `mvhd`; an absent `ctts` or `elst` is an
/// empty list, an absent `stss` is `None`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RawTables {
    pub timescale: u32,
    pub movie_timescale: u32,
    pub file_len: Bytes,
    pub stts: Vec<(u32, u32)>,
    pub ctts: Vec<(u32, i64)>,
    pub stsc: Vec<StscEntry>,
    pub stsz: Stsz,
    pub chunk_offsets: Vec<u64>,
    pub stss: Option<Vec<u32>>,
    pub elst: Vec<Edit>,
}

pub fn resolve(t: &RawTables) -> Result<TrackTable, ContainerError> {
    let sample_count = t.stsz.sample_count;
    // A longer track is too long, or one this version does not accept. Which
    // of the two is for `validate_probe` to say, so this is not an error.
    let resolved = sample_count <= MAX_RESOLVED_SAMPLES;
    let mut samples = Vec::new();
    if resolved {
        samples = timed_samples(t)?;
        place(t, &mut samples)?;
        if let Some(sync) = &t.stss {
            mark_keyframes(sync, &mut samples);
        }
    }
    let (edit_offset, presented) = edits(t)?;
    Ok(TrackTable {
        timescale: t.timescale,
        sample_count,
        resolved,
        samples,
        edit_offset,
        presented,
    })
}

/// Steps 1 and 2: a duration, a decode time and a presentation time per sample.
fn timed_samples(t: &RawTables) -> Result<Vec<Sample>, ContainerError> {
    let count = t.stsz.sample_count;
    let in_runs: u64 = t.stts.iter().map(|&(run, _)| u64::from(run)).sum();
    if in_runs != u64::from(count) {
        return Err(ContainerError::Malformed("stts"));
    }
    let mut samples = Vec::with_capacity(count as usize);
    let mut dts = 0i64;
    for &(run, delta) in &t.stts {
        for _ in 0..run {
            // Without `stss` every sample is a keyframe: audio, and intra-only video.
            samples.push(Sample {
                offset: Bytes::new(0),
                size: 0,
                dts,
                pts: dts,
                duration: delta,
                keyframe: true,
            });
            dts = dts.saturating_add(i64::from(delta));
        }
    }

    let mut next = samples.iter_mut();
    'runs: for &(run, offset) in &t.ctts {
        for _ in 0..run {
            match next.next() {
                Some(sample) => sample.pts = sample.dts.saturating_add(offset),
                None => break 'runs,
            }
        }
    }
    Ok(samples)
}

/// Step 3: the file offset and the size of each sample, chunk by chunk.
fn place(t: &RawTables, samples: &mut [Sample]) -> Result<(), ContainerError> {
    let listed = t.stsz.sample_size == 0;
    if listed && t.stsz.sizes.len() != samples.len() {
        return Err(ContainerError::Malformed("stsz"));
    }
    let mut sizes = t.stsz.sizes.iter();
    let mut entries = t.stsc.iter().peekable();
    let mut per_chunk = 0u32;
    let mut next = samples.iter_mut().peekable();

    for (chunk, &chunk_offset) in (1u64..).zip(&t.chunk_offsets) {
        if next.peek().is_none() {
            break;
        }
        while let Some(entry) = entries.next_if(|entry| u64::from(entry.first_chunk) <= chunk) {
            per_chunk = entry.samples_per_chunk;
        }
        let mut offset = chunk_offset;
        for _ in 0..per_chunk {
            let Some(sample) = next.next() else { break };
            let size = if listed {
                sizes.next().copied().unwrap_or(0)
            } else {
                t.stsz.sample_size
            };
            let end = offset
                .checked_add(u64::from(size))
                .ok_or(ContainerError::Truncated)?;
            if end > t.file_len.get() {
                return Err(ContainerError::Truncated);
            }
            sample.offset = Bytes::new(offset);
            sample.size = size;
            offset = end;
        }
    }
    // The chunks ran out before the samples did.
    if next.peek().is_some() {
        return Err(ContainerError::Malformed("stsc"));
    }
    Ok(())
}

/// Step 4: with `stss`, only the samples it numbers (from 1) are keyframes.
fn mark_keyframes(sync: &[u32], samples: &mut [Sample]) {
    for sample in samples.iter_mut() {
        sample.keyframe = false;
    }
    for &number in sync {
        let index = usize::try_from(number)
            .ok()
            .and_then(|number| number.checked_sub(1));
        if let Some(sample) = index.and_then(|index| samples.get_mut(index)) {
            sample.keyframe = true;
        }
    }
}

/// Step 5: the edit list. Returns `(edit_offset, presented)`. It needs the
/// runs of `stts` only, so it is also right for a track left unresolved.
fn edits(t: &RawTables) -> Result<(i64, i64), ContainerError> {
    let mut media_duration = 0u64;
    for &(run, delta) in &t.stts {
        media_duration = media_duration
            .checked_add(u64::from(run) * u64::from(delta))
            .ok_or(ContainerError::Malformed("stts"))?;
    }
    let media_duration =
        i64::try_from(media_duration).map_err(|_| ContainerError::Malformed("stts"))?;

    // Ticks of the movie timescale as ticks of the media timescale, to the nearest.
    let to_media = |movie_ticks: u64| -> Result<i64, ContainerError> {
        if t.movie_timescale == 0 {
            return Err(ContainerError::Malformed("mvhd"));
        }
        let per = u128::from(t.movie_timescale);
        let ticks = (u128::from(movie_ticks) * u128::from(t.timescale) + per / 2) / per;
        i64::try_from(ticks).map_err(|_| ContainerError::Malformed("elst"))
    };
    // An edit of length 0 shows the media from its start time to its end.
    let shown = |media: &Edit| -> Result<i64, ContainerError> {
        if media.segment_duration == 0 {
            Ok(media_duration.saturating_sub(media.media_time).max(0))
        } else {
            to_media(media.segment_duration)
        }
    };

    match t.elst.as_slice() {
        [] => Ok((0, media_duration)),
        [media] if media.media_time >= 0 => Ok((media.media_time, shown(media)?)),
        [empty, media] if empty.media_time == -1 && media.media_time >= 0 => {
            let lead = to_media(empty.segment_duration)?;
            Ok((media.media_time.saturating_sub(lead), shown(media)?))
        }
        _ => Err(ContainerError::Unsupported("elst")),
    }
}

// --- The table boxes ---------------------------------------------------------------

/// What the reader of a table box returns: its records, in file order.
pub type Table<T> = Result<Vec<T>, ContainerError>;

/// The records of a table box: `count` records of `entry_len` bytes, after a
/// head of `head_len` bytes that ends with the count.
fn load_table<R: RandomAccess>(
    r: &mut R,
    h: &BoxHeader,
    name: &'static str,
    head_len: u64,
    entry_len: u64,
) -> Result<(u32, Vec<u8>), ContainerError> {
    let head = load(r, h, head_len)?;
    if head.len() as u64 != head_len {
        return Err(ContainerError::Malformed(name));
    }
    let mut cur = Cursor::new(&head);
    cur.skip(head.len().saturating_sub(4))?;
    let count = cur.u32()?;
    // The bound: a table cannot hold more records than its box has room for.
    let room = h.body_len().saturating_sub(head_len) / entry_len.max(1);
    if u64::from(count) > room {
        return Err(ContainerError::Malformed(name));
    }
    let len = usize::try_from(u64::from(count).saturating_mul(entry_len))
        .map_err(|_| ContainerError::Malformed(name))?;
    let mut records = vec![0u8; len];
    r.read_at(
        Bytes::new(h.body.get().saturating_add(head_len)),
        &mut records,
    )?;
    Ok((count, records))
}

/// Reads each record of a table with `read`.
fn records<T>(
    count: u32,
    bytes: &[u8],
    mut read: impl FnMut(&mut Cursor<'_>) -> Result<T, ContainerError>,
) -> Result<Vec<T>, ContainerError> {
    let mut cur = Cursor::new(bytes);
    (0..count).map(|_| read(&mut cur)).collect()
}

/// The version of a full box, from its first byte.
fn version<R: RandomAccess>(r: &mut R, h: &BoxHeader) -> Result<u8, ContainerError> {
    Cursor::new(&load(r, h, 1)?).u8()
}

/// Runs of (sample count, duration of each sample in the media timescale).
pub fn read_stts(r: &mut impl RandomAccess, h: &BoxHeader) -> Table<(u32, u32)> {
    let (count, bytes) = load_table(r, h, "stts", 8, 8)?;
    records(count, &bytes, |cur| Ok((cur.u32()?, cur.u32()?)))
}

/// Runs of (sample count, offset from decode time to presentation time).
/// Version 0 stores the offset unsigned, version 1 signed.
pub fn read_ctts(r: &mut impl RandomAccess, h: &BoxHeader) -> Table<(u32, i64)> {
    let signed = version(r, h)? != 0;
    let (count, bytes) = load_table(r, h, "ctts", 8, 8)?;
    records(count, &bytes, |cur| {
        let run = cur.u32()?;
        let offset = if signed {
            i64::from(cur.i32()?)
        } else {
            i64::from(cur.u32()?)
        };
        Ok((run, offset))
    })
}

/// From chunk `first_chunk` (counted from 1) on, each chunk holds this many samples.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct StscEntry {
    pub first_chunk: u32,
    pub samples_per_chunk: u32,
}

pub fn read_stsc(r: &mut impl RandomAccess, h: &BoxHeader) -> Table<StscEntry> {
    let (count, bytes) = load_table(r, h, "stsc", 8, 12)?;
    records(count, &bytes, |cur| {
        let entry = StscEntry {
            first_chunk: cur.u32()?,
            samples_per_chunk: cur.u32()?,
        };
        cur.skip(4)?; // sample description index
        Ok(entry)
    })
}

/// `sample_size` is the size of every sample, or 0 when `sizes` lists them.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Stsz {
    pub sample_size: u32,
    pub sample_count: u32,
    pub sizes: Vec<u32>,
}

/// The size table is read only when it has at most `max_table` records: a
/// longer track is never expanded (`sample_table::MAX_RESOLVED_SAMPLES`),
/// and its count is all that is needed.
pub fn read_stsz<R: RandomAccess>(
    r: &mut R,
    h: &BoxHeader,
    max_table: u32,
) -> Result<Stsz, ContainerError> {
    let head = load(r, h, 12)?;
    let mut cur = Cursor::new(&head);
    cur.skip(4)?;
    let (sample_size, sample_count) = (cur.u32()?, cur.u32()?);
    let sizes = if sample_size == 0 && sample_count <= max_table {
        let (count, bytes) = load_table(r, h, "stsz", 12, 4)?;
        records(count, &bytes, |cur| cur.u32())?
    } else {
        Vec::new()
    };
    Ok(Stsz {
        sample_size,
        sample_count,
        sizes,
    })
}

/// The file offset of each chunk, from `stco`.
pub fn read_stco(r: &mut impl RandomAccess, h: &BoxHeader) -> Table<u64> {
    let (count, bytes) = load_table(r, h, "stco", 8, 4)?;
    records(count, &bytes, |cur| cur.u32().map(u64::from))
}

/// The file offset of each chunk, from `co64`.
pub fn read_co64(r: &mut impl RandomAccess, h: &BoxHeader) -> Table<u64> {
    let (count, bytes) = load_table(r, h, "co64", 8, 8)?;
    records(count, &bytes, |cur| cur.u64())
}

/// The numbers of the sync samples, counted from 1.
pub fn read_stss(r: &mut impl RandomAccess, h: &BoxHeader) -> Table<u32> {
    let (count, bytes) = load_table(r, h, "stss", 8, 4)?;
    records(count, &bytes, |cur| cur.u32())
}

/// One edit: `segment_duration` in the movie timescale, `media_time` in the
/// media timescale. A `media_time` of -1 is an empty edit.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Edit {
    pub segment_duration: u64,
    pub media_time: i64,
}

pub fn read_elst(r: &mut impl RandomAccess, h: &BoxHeader) -> Table<Edit> {
    let wide = version(r, h)? == 1;
    let (count, bytes) = load_table(r, h, "elst", 8, if wide { 20 } else { 12 })?;
    records(count, &bytes, |cur| {
        let edit = if wide {
            Edit {
                segment_duration: cur.u64()?,
                media_time: cur.i64()?,
            }
        } else {
            Edit {
                segment_duration: u64::from(cur.u32()?),
                media_time: i64::from(cur.i32()?),
            }
        };
        cur.skip(4)?; // media rate
        Ok(edit)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::boxes::read_header;
    use crate::reader::{MemReader, RandomAccess};

    /// `count` samples of 10 bytes in one chunk at offset 0, at 30 fps in a
    /// timescale of 30,000; no `ctts`, no `stss`, no edit list.
    fn track(count: u32) -> RawTables {
        RawTables {
            timescale: 30_000,
            movie_timescale: 1_000,
            file_len: Bytes::new(1_000_000),
            stts: vec![(count, 1_000)],
            ctts: Vec::new(),
            stsc: vec![StscEntry {
                first_chunk: 1,
                samples_per_chunk: count,
            }],
            stsz: Stsz {
                sample_size: 10,
                sample_count: count,
                sizes: Vec::new(),
            },
            chunk_offsets: vec![0],
            stss: None,
            elst: Vec::new(),
        }
    }

    #[test]
    fn stts_counts_that_do_not_sum_to_the_stsz_count_are_malformed() {
        let mut t = track(4);
        t.stts = vec![(3, 1_000)];
        assert_eq!(resolve(&t), Err(ContainerError::Malformed("stts")));

        t.stts = vec![(1, 1_000), (3, 2_000)];
        let table = resolve(&t).unwrap();
        assert_eq!(
            table.samples.iter().map(|s| s.dts).collect::<Vec<_>>(),
            [0, 1_000, 3_000, 5_000]
        );
        assert_eq!(
            table
                .samples
                .iter()
                .map(|s| s.offset.get())
                .collect::<Vec<_>>(),
            [0, 10, 20, 30]
        );
        assert_eq!(table.presented, 7_000);
    }

    #[test]
    fn ctts_version_1_with_a_negative_offset_puts_pts_before_dts() {
        // A `ctts` box of version 1: one sample at -1,000, then two at +2,000.
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&32u32.to_be_bytes());
        bytes.extend_from_slice(b"ctts");
        bytes.extend_from_slice(&[1, 0, 0, 0]);
        bytes.extend_from_slice(&2u32.to_be_bytes());
        bytes.extend_from_slice(&1u32.to_be_bytes());
        bytes.extend_from_slice(&(-1_000i32).to_be_bytes());
        bytes.extend_from_slice(&2u32.to_be_bytes());
        bytes.extend_from_slice(&2_000i32.to_be_bytes());
        let mut reader = MemReader(bytes);
        let limit = reader.len();
        let header = read_header(&mut reader, Bytes::new(0), limit).unwrap();

        let mut t = track(3);
        t.ctts = read_ctts(&mut reader, &header).unwrap();
        let table = resolve(&t).unwrap();
        let first = table.samples.first().unwrap();
        assert!(first.pts < first.dts);
        assert_eq!(
            table
                .samples
                .iter()
                .map(|s| s.pts - s.dts)
                .collect::<Vec<_>>(),
            [-1_000, 2_000, 2_000]
        );
    }

    #[test]
    fn without_stss_every_sample_is_a_keyframe() {
        let mut t = track(5);
        assert!(resolve(&t).unwrap().samples.iter().all(|s| s.keyframe));

        // With it, only the samples it numbers; a number past the end is ignored.
        t.stss = Some(vec![1, 4, 9]);
        let keyframes: Vec<bool> = resolve(&t)
            .unwrap()
            .samples
            .iter()
            .map(|s| s.keyframe)
            .collect();
        assert_eq!(keyframes, [true, false, false, true, false]);
    }

    #[test]
    fn one_media_edit_of_two_frames_presents_the_first_frame_at_zero() {
        // Every frame is shown two frames after it is decoded, and the edit
        // starts the track at that point: the usual shape with B-frames.
        let mut t = track(3);
        t.ctts = vec![(3, 2_000)];
        t.elst = vec![Edit {
            segment_duration: 100,
            media_time: 2_000,
        }];
        let table = resolve(&t).unwrap();
        assert_eq!(table.samples.first().unwrap().pts - table.edit_offset, 0);
        assert_eq!(table.presented, 3_000); // 100 ms in a timescale of 30,000

        // A leading empty edit of 50 ms starts the track that much later.
        t.elst.insert(
            0,
            Edit {
                segment_duration: 50,
                media_time: -1,
            },
        );
        assert_eq!(resolve(&t).unwrap().edit_offset, 2_000 - 1_500);
    }

    #[test]
    fn two_media_edits_are_unsupported() {
        let mut t = track(3);
        t.elst = vec![
            Edit {
                segment_duration: 50,
                media_time: 0,
            },
            Edit {
                segment_duration: 50,
                media_time: 2_000,
            },
        ];
        assert_eq!(resolve(&t), Err(ContainerError::Unsupported("elst")));
    }
}
