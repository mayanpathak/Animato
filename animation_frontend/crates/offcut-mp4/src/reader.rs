//! Where the bytes of a file come from, and a cursor over bytes already read.

use offcut_types::Bytes;

use crate::{ContainerError, IoError};

/// A file that can be read at any offset. In the browser it is a synchronous
/// OPFS handle; in a test it is [`MemReader`].
pub trait RandomAccess {
    fn len(&self) -> Bytes;
    fn read_at(&mut self, offset: Bytes, buf: &mut [u8]) -> Result<(), IoError>;

    /// Not in TS §15.1: clippy asks for it beside `len`. An implementation
    /// does not write it.
    fn is_empty(&self) -> bool {
        self.len().get() == 0
    }
}

/// A file held in memory. For tests only.
pub struct MemReader(pub Vec<u8>);

impl RandomAccess for MemReader {
    fn len(&self) -> Bytes {
        Bytes::new(self.0.len() as u64)
    }

    fn read_at(&mut self, offset: Bytes, buf: &mut [u8]) -> Result<(), IoError> {
        let start = usize::try_from(offset.get()).map_err(|_| IoError::OutOfBounds)?;
        let end = start.checked_add(buf.len()).ok_or(IoError::OutOfBounds)?;
        let source = self.0.get(start..end).ok_or(IoError::OutOfBounds)?;
        buf.copy_from_slice(source);
        Ok(())
    }
}

/// Reads big-endian fields from bytes already in memory. A read past the end
/// is [`ContainerError::Truncated`]; nothing here can panic.
pub struct Cursor<'a> {
    bytes: &'a [u8],
}

impl<'a> Cursor<'a> {
    pub fn new(bytes: &'a [u8]) -> Self {
        Self { bytes }
    }

    pub fn remaining(&self) -> usize {
        self.bytes.len()
    }

    pub fn take(&mut self, n: usize) -> Result<&'a [u8], ContainerError> {
        let (head, tail) = self
            .bytes
            .split_at_checked(n)
            .ok_or(ContainerError::Truncated)?;
        self.bytes = tail;
        Ok(head)
    }

    pub fn skip(&mut self, n: usize) -> Result<(), ContainerError> {
        self.take(n).map(|_| ())
    }

    fn array<const N: usize>(&mut self) -> Result<[u8; N], ContainerError> {
        <[u8; N]>::try_from(self.take(N)?).map_err(|_| ContainerError::Truncated)
    }

    pub fn u8(&mut self) -> Result<u8, ContainerError> {
        self.array().map(u8::from_be_bytes)
    }

    pub fn u16(&mut self) -> Result<u16, ContainerError> {
        self.array().map(u16::from_be_bytes)
    }

    pub fn u32(&mut self) -> Result<u32, ContainerError> {
        self.array().map(u32::from_be_bytes)
    }

    pub fn u64(&mut self) -> Result<u64, ContainerError> {
        self.array().map(u64::from_be_bytes)
    }

    pub fn i32(&mut self) -> Result<i32, ContainerError> {
        self.array().map(i32::from_be_bytes)
    }

    pub fn i64(&mut self) -> Result<i64, ContainerError> {
        self.array().map(i64::from_be_bytes)
    }

    /// A four-character code, such as a box type.
    pub fn fourcc(&mut self) -> Result<[u8; 4], ContainerError> {
        self.array()
    }
}
