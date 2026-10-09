//! Independently implemented BPS/IPS/UPS transforms. Inputs are immutable; only a new buffer is produced.
//! Format references: byuu's public-domain BPS specification and ZeroSoft's IPS specification.
use std::sync::OnceLock;

pub const MAX_BYTES: usize = 256 * 1024 * 1024;
pub type PatchResult<T> = Result<T, &'static str>;

pub struct PatchedGame {
    pub bytes: Vec<u8>,
    pub format: &'static str,
    pub checksums_verified: bool,
    pub metadata: String,
}

pub fn crc32(bytes: &[u8]) -> u32 {
    static TABLE: OnceLock<[u32; 256]> = OnceLock::new();
    let table = TABLE.get_or_init(|| {
        let mut table = [0u32; 256];
        for (i, value) in table.iter_mut().enumerate() {
            let mut crc = i as u32;
            for _ in 0..8 {
                crc = (crc >> 1) ^ if crc & 1 != 0 { 0xedb8_8320 } else { 0 };
            }
            *value = crc;
        }
        table
    });
    !bytes.iter().fold(!0u32, |crc, byte| {
        table[((crc ^ u32::from(*byte)) & 255) as usize] ^ (crc >> 8)
    })
}

struct Reader<'a> {
    data: &'a [u8],
    at: usize,
}
impl<'a> Reader<'a> {
    fn take(&mut self, length: usize) -> PatchResult<&'a [u8]> {
        let end = self.at.checked_add(length).ok_or("patch_invalid")?;
        let data = self.data.get(self.at..end).ok_or("patch_truncated")?;
        self.at = end;
        Ok(data)
    }
    fn byte(&mut self) -> PatchResult<u8> {
        Ok(self.take(1)?[0])
    }
    fn number(&mut self) -> PatchResult<usize> {
        let (mut value, mut place) = (0usize, 1usize);
        for _ in 0..10 {
            let byte = self.byte()?;
            value = value
                .checked_add(
                    usize::from(byte & 127)
                        .checked_mul(place)
                        .ok_or("patch_invalid")?,
                )
                .ok_or("patch_invalid")?;
            if byte & 128 != 0 {
                return Ok(value);
            }
            place = place.checked_mul(128).ok_or("patch_invalid")?;
            value = value.checked_add(place).ok_or("patch_invalid")?;
        }
        Err("patch_invalid")
    }
    fn big_endian(&mut self, length: usize) -> PatchResult<usize> {
        Ok(self
            .take(length)?
            .iter()
            .fold(0usize, |value, byte| (value << 8) | usize::from(*byte)))
    }
}

pub fn apply(source: &[u8], patch: &[u8]) -> PatchResult<PatchedGame> {
    if source.len() > MAX_BYTES || patch.len() > MAX_BYTES {
        return Err("patch_too_large");
    }
    if patch.starts_with(b"BPS1") {
        apply_bps(source, patch)
    } else if patch.starts_with(b"UPS1") {
        apply_ups(source, patch)
    } else if patch.starts_with(b"PATCH") {
        apply_ips(source, patch)
    } else {
        Err("patch_unsupported")
    }
}

fn bounded_end(start: usize, length: usize, limit: usize) -> PatchResult<usize> {
    let end = start.checked_add(length).ok_or("patch_invalid")?;
    if end > limit {
        return Err("patch_out_of_bounds");
    }
    Ok(end)
}
fn relative(previous: usize, value: usize) -> PatchResult<usize> {
    if value & 1 == 0 {
        previous.checked_add(value >> 1)
    } else {
        previous.checked_sub(value >> 1)
    }
    .ok_or("patch_out_of_bounds")
}
fn apply_bps(source: &[u8], patch: &[u8]) -> PatchResult<PatchedGame> {
    if patch.len() < 19 {
        return Err("patch_truncated");
    }
    let footer = patch.len() - 12;
    let checksum = |at: usize| u32::from_le_bytes(patch[at..at + 4].try_into().unwrap());
    if crc32(&patch[..patch.len() - 4]) != checksum(patch.len() - 4) {
        return Err("patch_checksum_mismatch");
    }
    if crc32(source) != checksum(footer) {
        return Err("patch_source_mismatch");
    }
    let mut reader = Reader {
        data: &patch[..footer],
        at: 4,
    };
    let source_size = reader.number()?;
    let target_size = reader.number()?;
    if source_size != source.len() {
        return Err("patch_source_mismatch");
    }
    if target_size > MAX_BYTES {
        return Err("patch_too_large");
    }
    let metadata_size = reader.number()?;
    let metadata = reader.take(metadata_size)?;
    // Metadata is inert text, never XML-evaluated or treated as file paths/instructions.
    let metadata = String::from_utf8_lossy(&metadata[..metadata.len().min(4096)]).into_owned();
    let mut output = Vec::new();
    output
        .try_reserve_exact(target_size)
        .map_err(|_| "patch_too_large")?;
    let (mut source_cursor, mut target_cursor) = (0usize, 0usize);
    while reader.at < footer {
        let command = reader.number()?;
        let length = (command >> 2).checked_add(1).ok_or("patch_invalid")?;
        bounded_end(output.len(), length, target_size)?;
        match command & 3 {
            0 => {
                let end = bounded_end(output.len(), length, source.len())?;
                output.extend_from_slice(&source[output.len()..end]);
            }
            1 => output.extend_from_slice(reader.take(length)?),
            2 => {
                source_cursor = relative(source_cursor, reader.number()?)?;
                let end = bounded_end(source_cursor, length, source.len())?;
                output.extend_from_slice(&source[source_cursor..end]);
                source_cursor = end;
            }
            3 => {
                target_cursor = relative(target_cursor, reader.number()?)?;
                // Read and append progressively: overlapping TargetCopy is the format's RLE.
                for _ in 0..length {
                    let value = *output.get(target_cursor).ok_or("patch_out_of_bounds")?;
                    output.push(value);
                    target_cursor += 1;
                }
            }
            _ => unreachable!(),
        }
    }
    if output.len() != target_size {
        return Err("patch_target_size");
    }
    if crc32(&output) != checksum(footer + 4) {
        return Err("patch_target_mismatch");
    }
    Ok(PatchedGame {
        bytes: output,
        format: "BPS",
        checksums_verified: true,
        metadata,
    })
}

// UPS stores relative runs of XOR bytes, terminated by an unchanged byte.
// Format reference: https://www.romhacking.net/documents/392/
// Validate all three CRCs; never offer an unchecked or automatic reverse patch.
fn apply_ups(source: &[u8], patch: &[u8]) -> PatchResult<PatchedGame> {
    if patch.len() < 18 { return Err("patch_truncated"); }
    let footer = patch.len() - 12;
    let checksum = |at: usize| u32::from_le_bytes(patch[at..at + 4].try_into().unwrap());
    if crc32(&patch[..patch.len() - 4]) != checksum(patch.len() - 4) { return Err("patch_checksum_mismatch"); }
    let mut reader = Reader { data: &patch[..footer], at: 4 };
    let source_size = reader.number()?;
    let target_size = reader.number()?;
    if source_size != source.len() || crc32(source) != checksum(footer) { return Err("patch_source_mismatch"); }
    if target_size > MAX_BYTES { return Err("patch_too_large"); }
    let mut output = Vec::new();
    output.try_reserve_exact(target_size).map_err(|_| "patch_too_large")?;
    output.resize(target_size, 0);
    let shared = source.len().min(target_size);
    output[..shared].copy_from_slice(&source[..shared]);
    let limit = source.len().max(target_size);
    let mut cursor = 0usize;
    while reader.at < footer {
        cursor = bounded_end(cursor, reader.number()?, limit)?;
        loop {
            let xor = reader.byte()?;
            if xor == 0 {
                // A run ending at EOF still includes its zero terminator.
                cursor = cursor.checked_add(1).ok_or("patch_out_of_bounds")?;
                break;
            }
            if cursor >= limit { return Err("patch_out_of_bounds"); }
            let value = source.get(cursor).copied().unwrap_or(0) ^ xor;
            if let Some(byte) = output.get_mut(cursor) { *byte = value; }
            else if value != 0 { return Err("patch_target_mismatch"); }
            cursor += 1;
        }
    }
    if crc32(&output) != checksum(footer + 4) { return Err("patch_target_mismatch"); }
    Ok(PatchedGame { bytes: output, format: "UPS", checksums_verified: true, metadata: String::new() })
}

fn apply_ips(source: &[u8], patch: &[u8]) -> PatchResult<PatchedGame> {
    let mut reader = Reader { data: patch, at: 5 };
    let mut output = source.to_vec();
    let mut bytes_written = 0usize;
    loop {
        let offset_bytes = reader.take(3)?;
        if offset_bytes == b"EOF" {
            break;
        }
        let offset = offset_bytes
            .iter()
            .fold(0usize, |value, byte| (value << 8) | usize::from(*byte));
        let length = reader.big_endian(2)?;
        if length > 0 {
            bytes_written = bounded_end(bytes_written, length, MAX_BYTES * 4)?;
            let data = reader.take(length)?;
            let end = bounded_end(offset, length, MAX_BYTES)?;
            if end > output.len() {
                output.resize(end, 0);
            }
            output[offset..end].copy_from_slice(data);
        } else {
            let length = reader.big_endian(2)?;
            if length == 0 {
                return Err("patch_invalid");
            }
            bytes_written = bounded_end(bytes_written, length, MAX_BYTES * 4)?;
            let value = reader.byte()?;
            let end = bounded_end(offset, length, MAX_BYTES)?;
            if end > output.len() {
                output.resize(end, 0);
            }
            output[offset..end].fill(value);
        }
    }
    match patch.len() - reader.at {
        0 => (),
        3 => {
            let length = reader.big_endian(3)?;
            output.resize(length, 0);
        }
        _ => return Err("patch_trailing_data"),
    }
    Ok(PatchedGame {
        bytes: output,
        format: "IPS",
        checksums_verified: false,
        metadata: String::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn number(mut value: usize, to: &mut Vec<u8>) {
        loop {
            let byte = (value & 127) as u8;
            value >>= 7;
            if value == 0 {
                to.push(byte | 128);
                break;
            }
            to.push(byte);
            value -= 1;
        }
    }
    fn bps(source: &[u8], target: &[u8], operations: &[u8]) -> Vec<u8> {
        let mut patch = b"BPS1".to_vec();
        number(source.len(), &mut patch);
        number(target.len(), &mut patch);
        number(0, &mut patch);
        patch.extend_from_slice(operations);
        patch.extend_from_slice(&crc32(source).to_le_bytes());
        patch.extend_from_slice(&crc32(target).to_le_bytes());
        patch.extend_from_slice(&crc32(&patch).to_le_bytes());
        patch
    }
    #[test]
    fn standard_crc() {
        assert_eq!(crc32(b"123456789"), 0xcbf4_3926);
    }
    #[test]
    fn bps_all_actions_and_overlapping_copy() {
        // SourceRead "ab", TargetRead "X", SourceCopy "ef", then overlap-copy "XXXXX".
        let patch = bps(
            b"abcdef",
            b"abXefXXXXX",
            &[0x84, 0x81, b'X', 0x86, 0x88, 0x83, 0x84, 0x8f, 0x84],
        );
        assert_eq!(apply(b"abcdef", &patch).unwrap().bytes, b"abXefXXXXX");
    }
    #[test]
    fn bps_negative_relative_offsets() {
        let patch = bps(b"abcd", b"cdab", &[0x86, 0x84, 0x86, 0x89]);
        assert_eq!(apply(b"abcd", &patch).unwrap().bytes, b"cdab");
    }
    #[test]
    fn rejects_wrong_source_corruption_and_invalid_ranges() {
        let mut patch = bps(b"abc", b"abc", &[0x88]);
        assert_eq!(apply(b"xyz", &patch).err(), Some("patch_source_mismatch"));
        patch[6] ^= 1;
        assert_eq!(apply(b"abc", &patch).err(), Some("patch_checksum_mismatch"));
        let bad_copy = bps(b"", b"x", &[0x83, 0x80]);
        assert_eq!(apply(b"", &bad_copy).err(), Some("patch_out_of_bounds"));
        let bad_target = bps(b"abc", b"xyz", &[0x88]);
        assert_eq!(
            apply(b"abc", &bad_target).err(),
            Some("patch_target_mismatch")
        );
    }
    #[test]
    fn ips_literal_run_growth_and_truncation() {
        let source = b"abcdef";
        let patch = b"PATCH\x00\x00\x01\x00\x02XY\x00\x00\x07\x00\x00\x00\x03ZEOF";
        assert_eq!(apply(source, patch).unwrap().bytes, b"aXYdef\0ZZZ");
        let mut short = patch.to_vec();
        short.extend_from_slice(&[0, 0, 4]);
        assert_eq!(apply(source, &short).unwrap().bytes, b"aXYd");
        assert_eq!(source, b"abcdef");
    }
    #[test]
    fn ips_rejects_truncation_and_extra_payload() {
        assert_eq!(
            apply(b"a", b"PATCH\0\0\0\0\x04x").err(),
            Some("patch_truncated")
        );
        assert_eq!(
            apply(b"a", b"PATCHEOFjunk").err(),
            Some("patch_trailing_data")
        );
        assert_eq!(
            apply(b"a", b"PATCH\0\0\0\0\0\0\0xEOF").err(),
            Some("patch_invalid")
        );
    }
    #[test]
    fn ups_grows_shrinks_and_preserves_source() {
        let source = b"abc";
        let make = |source: &[u8], target: &[u8], ops: &[u8]| {
            let mut patch = b"UPS1".to_vec();
            number(source.len(), &mut patch); number(target.len(), &mut patch);
            patch.extend_from_slice(ops);
            patch.extend_from_slice(&crc32(source).to_le_bytes());
            patch.extend_from_slice(&crc32(target).to_le_bytes());
            patch.extend_from_slice(&crc32(&patch).to_le_bytes()); patch
        };
        let grown = make(source, b"aXcde", &[0x81, b'b' ^ b'X', 0, 0x80, b'd', b'e', 0]);
        let result = apply(source, &grown).unwrap();
        assert_eq!(result.bytes, b"aXcde"); assert_eq!(result.format, "UPS"); assert!(result.checksums_verified);
        assert_eq!(source, b"abc");
        let shrunk = make(b"abcde", b"ab", &[0x82, b'c', b'd', b'e', 0]);
        assert_eq!(apply(b"abcde", &shrunk).unwrap().bytes, b"ab");
        assert_eq!(apply(b"xyz", &grown).err(), Some("patch_source_mismatch"));
        let mut corrupt = grown.clone(); corrupt[7] ^= 1;
        assert_eq!(apply(source, &corrupt).err(), Some("patch_checksum_mismatch"));
        let bad_target = make(source, b"zzz", &[]);
        assert_eq!(apply(source, &bad_target).err(), Some("patch_target_mismatch"));
        let unterminated = make(source, b"abc", &[0x80, 1]);
        assert_eq!(apply(source, &unterminated).err(), Some("patch_truncated"));
        let out_of_bounds = make(source, b"abc", &[0x83, 1, 0]);
        assert_eq!(apply(source, &out_of_bounds).err(), Some("patch_out_of_bounds"));
        let unchanged = make(source, b"abc", &[]);
        assert_eq!(apply(source, &unchanged).unwrap().bytes, source);
    }
    #[test]
    fn ups_rejects_oversized_declared_output_before_allocation() {
        let mut patch = b"UPS1".to_vec();
        number(1, &mut patch); number(MAX_BYTES + 1, &mut patch);
        patch.extend_from_slice(&crc32(b"a").to_le_bytes());
        patch.extend_from_slice(&0u32.to_le_bytes());
        patch.extend_from_slice(&crc32(&patch).to_le_bytes());
        assert_eq!(apply(b"a", &patch).err(), Some("patch_too_large"));
    }
    #[test]
    fn malformed_inputs_never_panic_or_escape_size_limit() {
        let mut seed = 7u32;
        for size in 0..200 {
            let mut data = vec![0u8; size];
            for byte in &mut data {
                seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                *byte = (seed >> 16) as u8;
            }
            for prefix in [b"BPS1".as_slice(), b"PATCH".as_slice(), b"UPS1".as_slice()] {
                let mut patch = prefix.to_vec();
                patch.extend_from_slice(&data);
                assert!(std::panic::catch_unwind(|| apply(b"hello", &patch)).is_ok());
            }
        }
    }
}
