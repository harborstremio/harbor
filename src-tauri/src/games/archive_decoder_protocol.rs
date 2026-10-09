use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use zeroize::Zeroize;
use zeroize::Zeroizing;

pub const ARG: &str = "--harbor-archive-decoder-v1";
pub const MAGIC: &[u8] = b"HARBOR-ARCHIVE-1\n";
pub const CHUNK: usize = 256 * 1024;
pub const META: usize = 16 * 1024;
const REQUEST_MAX: usize = 1024 * 1024;
pub const ENTRY: u8 = 1;
pub const DATA: u8 = 2;
pub const END_ENTRY: u8 = 3;
pub const DONE: u8 = 4;
pub const ERROR: u8 = 5;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub source: String,
    pub parts: Vec<String>,
    pub extract: bool,
    pub password: Option<String>,
}
impl Drop for Request {
    fn drop(&mut self) {
        if let Some(password) = self.password.as_mut() {
            password.zeroize();
        }
    }
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Entry {
    pub path: String,
    pub bytes: u64,
    pub directory: bool,
    pub mode: u32,
}
pub struct Frame {
    pub kind: u8,
    pub bytes: Vec<u8>,
}
fn bound(kind: u8) -> std::io::Result<usize> {
    match kind {
        ENTRY => Ok(META),
        DATA => Ok(CHUNK),
        ERROR => Ok(64),
        END_ENTRY | DONE => Ok(0),
        _ => Err(std::io::Error::other("archive_protocol")),
    }
}
pub fn write_frame(output: &mut impl Write, kind: u8, bytes: &[u8]) -> std::io::Result<()> {
    if bytes.len() > bound(kind)? {
        return Err(std::io::Error::other("archive_protocol"));
    }
    output.write_all(&[kind])?;
    output.write_all(&(bytes.len() as u32).to_le_bytes())?;
    output.write_all(bytes)
}
pub fn read_frame(input: &mut impl Read) -> std::io::Result<Frame> {
    let mut header = [0; 5];
    input.read_exact(&mut header)?;
    let length = u32::from_le_bytes(header[1..].try_into().unwrap()) as usize;
    if length > bound(header[0])? {
        return Err(std::io::Error::other("archive_protocol"));
    }
    let mut bytes = vec![0; length];
    input.read_exact(&mut bytes)?;
    Ok(Frame {
        kind: header[0],
        bytes,
    })
}
pub fn write_request(output: &mut impl Write, request: &Request) -> std::io::Result<()> {
    let bytes = Zeroizing::new(serde_json::to_vec(request)?);
    if bytes.len() > REQUEST_MAX {
        return Err(std::io::Error::other("archive_protocol"));
    }
    output.write_all(&(bytes.len() as u32).to_le_bytes())?;
    output.write_all(&bytes)
}
pub fn read_request(input: &mut impl Read) -> std::io::Result<Request> {
    let mut header = [0; 4];
    input.read_exact(&mut header)?;
    let length = u32::from_le_bytes(header) as usize;
    if length > REQUEST_MAX {
        return Err(std::io::Error::other("archive_protocol"));
    }
    let mut bytes = Zeroizing::new(vec![0; length]);
    input.read_exact(&mut bytes)?;
    serde_json::from_slice(&bytes).map_err(std::io::Error::other)
}
pub fn read_magic(input: &mut impl Read) -> std::io::Result<()> {
    // Test executables may print a small harness preamble. Never collect arbitrary stdout.
    let mut matched = 0;
    for _ in 0..4096 {
        let mut byte = [0];
        input.read_exact(&mut byte)?;
        if byte[0] == MAGIC[matched] {
            matched += 1;
        } else {
            matched = usize::from(byte[0] == MAGIC[0]);
        }
        if matched == MAGIC.len() {
            return Ok(());
        }
    }
    Err(std::io::Error::other("archive_protocol"))
}
