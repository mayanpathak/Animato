//! A length in milliseconds is a `DurMs`. Neither a bare integer nor a
//! position on the timeline may be passed where one is expected.

use offcut_types::{DurMs, TimeMs};

fn wait(_length: DurMs) {}

fn main() {
    wait(5_000_u32);
    wait(TimeMs::new(5_000));
}
