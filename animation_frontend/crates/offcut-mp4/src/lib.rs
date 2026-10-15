//! MP4 and MOV: the structure of a file, read through [`reader::RandomAccess`]
//! and written through [`mux::MuxSink`]. Nothing here decodes or encodes a
//! sample, and no file is read or held whole.

pub mod boxes;
pub mod demux;
pub mod mux;
mod mux_boxes;
pub mod probe;
pub mod reader;
pub mod sample_table;
pub mod sps;
pub mod validate;

use thiserror::Error;

/// A failure of the bytes behind a reader or a sink.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum IoError {
    #[error("read failed")]
    Read,
    #[error("write failed")]
    Write,
    #[error("offset past the end")]
    OutOfBounds,
}

/// Why a file cannot be read as an MP4 or MOV. A name is the box that
/// failed, never content of the file.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum ContainerError {
    /// No `ftyp`, `moov`, `mdat`, `free`, `wide` or `skip` box at offset 0.
    #[error("not an ISO base media file")]
    NotIsoBmff,
    /// A `moof` box, or `mvex` inside `moov`.
    #[error("fragmented file")]
    Fragmented,
    /// A box or a table runs past the end of the file.
    #[error("truncated")]
    Truncated,
    #[error("malformed {0}")]
    Malformed(&'static str),
    /// A structure this version does not read.
    #[error("unsupported {0}")]
    Unsupported(&'static str),
    #[error(transparent)]
    Io(#[from] IoError),
}

/// Why a file cannot be written.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Error)]
pub enum MuxError {
    #[error(transparent)]
    Io(#[from] IoError),
    #[error("bad configuration: {0}")]
    BadConfig(&'static str),
    #[error("sample out of order")]
    OutOfOrder,
    #[error("moov larger than the space reserved for it")]
    MoovOverflow,
}
