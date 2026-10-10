use super::{canceled, relative, ArchiveEntry, Result, Work, MAX_ENTRIES, MAX_EXPANDED};
use std::{
    collections::{HashMap, HashSet},
    io::Read,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::mpsc::{self, Receiver, RecvTimeoutError},
    thread::JoinHandle,
    time::{Duration, Instant},
};
#[path = "archive_decoder_limits.rs"]
mod limits;
#[path = "archive_decoder_protocol.rs"]
mod protocol;
#[path = "archive_decoder_rar.rs"]
mod rar;
#[path = "archive_split_reader.rs"]
mod split;
#[path = "archive_decoder_disc.rs"]
mod disc;
pub(super) use split::Reader as SplitReader;
pub(super) fn is_disc(file: &mut std::fs::File) -> Result<bool> {
    disc::kind(file).map(|kind| kind.is_some())
}
#[path = "archive_decoder_worker.rs"]
mod worker;
const WAIT: Duration = Duration::from_secs(120);

fn error(value: &[u8]) -> &'static str {
    match value {
        b"archive_encrypted" => "archive_encrypted",
        b"archive_password" => "archive_password",
        b"archive_password_or_checksum" => "archive_password_or_checksum",
        b"archive_limit" => "archive_limit",
        b"archive_path" => "archive_path",
        b"archive_links" => "archive_links",
        b"archive_checksum" => "archive_checksum",
        b"archive_compression" => "archive_compression",
        b"archive_changed" => "archive_changed",
        b"archive_read" => "archive_read",
        b"archive_format" => "archive_format",
        b"archive_multipart" => "archive_multipart",
        b"archive_missing_part" => "archive_missing_part",
        b"archive_parts" => "archive_parts",
        _ => "archive_decoder",
    }
}
struct Decoder {
    child: Child,
    _limits: limits::Limits,
    frames: Option<Receiver<Result<protocol::Frame>>>,
    reader: Option<JoinHandle<()>>,
}
impl Drop for Decoder {
    fn drop(&mut self) {
        // Release a producer waiting on the bounded queue, then its OS pipe.
        self.frames.take();
        let _ = self.child.kill();
        let _ = self.child.wait();
        if let Some(reader) = self.reader.take() {
            let _ = reader.join();
        }
    }
}
impl Decoder {
    fn open(path: &Path, parts: &[PathBuf], password: Option<&str>, extract: bool) -> Result<Self> {
        let mut command = Command::new(std::env::current_exe().map_err(|_| "archive_decoder")?);
        #[cfg(not(test))]
        command.arg(protocol::ARG);
        #[cfg(test)]
        {
            // Invoke the exact ignored entry point in this production-module test binary.
            let module = module_path!().split_once("::").unwrap().1;
            command.args([
                format!("{module}::tests::worker_entry"),
                "--exact".into(),
                "--ignored".into(),
                "--nocapture".into(),
            ]);
        }
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        limits::configure(&mut command);
        let mut child = command.spawn().map_err(|_| "archive_decoder")?;
        let cap = match limits::Limits::attach(&child) {
            Ok(cap) => cap,
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("archive_decoder");
            }
        };
        let mut decoder = Self {
            child,
            _limits: cap,
            frames: None,
            reader: None,
        };
        let mut stdout = decoder.child.stdout.take().ok_or("archive_decoder")?;
        let (send, receive) = mpsc::sync_channel(2);
        decoder.frames = Some(receive);
        decoder.reader = Some(
            std::thread::Builder::new()
                .name("archive-pipe".into())
                .spawn(move || {
                    if protocol::read_magic(&mut stdout).is_err() {
                        let _ = send.send(Err("archive_decoder"));
                        return;
                    }
                    loop {
                        let frame =
                            protocol::read_frame(&mut stdout).map_err(|_| "archive_decoder");
                        let terminal = frame.as_ref().map_or(true, |frame| {
                            [protocol::DONE, protocol::ERROR].contains(&frame.kind)
                        });
                        if send.send(frame).is_err() || terminal {
                            break;
                        }
                    }
                })
                .map_err(|_| "archive_decoder")?,
        );
        let mut stdin = decoder.child.stdin.take().ok_or("archive_decoder")?;
        let request = protocol::Request {
            source: path.to_string_lossy().into(),
            parts: parts
                .iter()
                .map(|path| path.to_string_lossy().into())
                .collect(),
            extract,
            password: password.map(String::from),
        };
        protocol::write_request(&mut stdin, &request).map_err(|_| "archive_decoder")?;
        drop(stdin);
        Ok(decoder)
    }
    fn next(&mut self, work: &Work) -> Result<protocol::Frame> {
        let deadline = Instant::now() + WAIT;
        loop {
            canceled(work)?;
            match self
                .frames
                .as_ref()
                .ok_or("archive_decoder")?
                .recv_timeout(Duration::from_millis(50))
            {
                Ok(Ok(frame)) if frame.kind == protocol::ERROR => return Err(error(&frame.bytes)),
                Ok(frame) => return frame,
                Err(RecvTimeoutError::Timeout) if Instant::now() < deadline => {}
                _ => return Err("archive_decoder"),
            }
        }
    }
    fn finish(&mut self, work: &Work) -> Result<()> {
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            canceled(work)?;
            match self.child.try_wait().map_err(|_| "archive_decoder")? {
                Some(status) => {
                    return if status.success() {
                        Ok(())
                    } else {
                        Err("archive_decoder")
                    }
                }
                None if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(10)),
                _ => return Err("archive_decoder"),
            }
        }
    }
}
fn metadata(frame: protocol::Frame) -> Result<(ArchiveEntry, u32)> {
    if frame.kind != protocol::ENTRY {
        return Err("archive_decoder");
    }
    let entry: protocol::Entry =
        serde_json::from_slice(&frame.bytes).map_err(|_| "archive_decoder")?;
    let path = relative(&entry.path, entry.directory)?;
    if entry.bytes > MAX_EXPANDED || (entry.directory && entry.bytes != 0) {
        return Err("archive_limit");
    }
    if ![0, 0o100000, 0o040000].contains(&(entry.mode & 0o170000)) {
        return Err("archive_links");
    }
    Ok((
        ArchiveEntry {
            path,
            bytes: entry.bytes,
            directory: entry.directory,
        },
        entry.mode,
    ))
}
pub(super) fn inventory(
    path: &Path,
    parts: &[PathBuf],
    password: Option<&str>,
    work: &Work,
) -> Result<Vec<ArchiveEntry>> {
    let mut decoder = Decoder::open(path, parts, password, false)?;
    let mut entries = Vec::new();
    let (mut identities, mut parents) = (HashMap::new(), HashSet::new());
    let (mut expanded, mut metadata_bytes) = (0u64, 0usize);
    loop {
        let frame = decoder.next(work)?;
        if frame.kind == protocol::DONE {
            decoder.finish(work)?;
            break;
        }
        metadata_bytes = metadata_bytes
            .checked_add(frame.bytes.len())
            .ok_or("archive_limit")?;
        if entries.len() >= MAX_ENTRIES || metadata_bytes > 64 * 1024 * 1024 {
            return Err("archive_limit");
        }
        let (entry, _) = metadata(frame)?;
        let identity = entry.path.to_lowercase();
        if identities
            .insert(identity.clone(), entry.directory)
            .is_some()
        {
            return Err("archive_collision");
        }
        let mut parent = identity.as_str();
        while let Some((next, _)) = parent.rsplit_once('/') {
            parents.insert(next.to_owned());
            parent = next;
        }
        expanded = expanded.checked_add(entry.bytes).ok_or("archive_limit")?;
        if expanded > MAX_EXPANDED {
            return Err("archive_limit");
        }
        entries.push(entry);
    }
    if entries.is_empty() {
        return Err("archive_format");
    }
    if identities
        .iter()
        .any(|(path, directory)| !directory && parents.contains(path))
    {
        return Err("archive_collision");
    }
    Ok(entries)
}
struct EntryReader<'a> {
    decoder: &'a mut Decoder,
    work: &'a Work,
    buffer: Vec<u8>,
    offset: usize,
    ended: bool,
    failure: Option<&'static str>,
}
impl Read for EntryReader<'_> {
    fn read(&mut self, output: &mut [u8]) -> std::io::Result<usize> {
        if output.is_empty() {
            return Ok(0);
        }
        if self.ended {
            return Ok(0);
        }
        if self.offset == self.buffer.len() {
            match self.decoder.next(self.work) {
                Ok(frame) if frame.kind == protocol::DATA && !frame.bytes.is_empty() => {
                    self.buffer = frame.bytes;
                    self.offset = 0;
                }
                Ok(frame) if frame.kind == protocol::END_ENTRY => {
                    self.ended = true;
                    return Ok(0);
                }
                result => {
                    self.failure = Some(result.err().unwrap_or("archive_decoder"));
                    return Err(std::io::Error::other(self.failure.unwrap()));
                }
            }
        }
        let count = output.len().min(self.buffer.len() - self.offset);
        output[..count].copy_from_slice(&self.buffer[self.offset..self.offset + count]);
        self.offset += count;
        Ok(count)
    }
}
pub(super) fn visit(
    path: &Path,
    parts: &[PathBuf],
    password: Option<&str>,
    entries: &[ArchiveEntry],
    work: &Work,
    mut visit: impl FnMut(&ArchiveEntry, &mut dyn Read, u32) -> Result<()>,
) -> Result<()> {
    let mut decoder = Decoder::open(path, parts, password, true)?;
    let expected: HashMap<_, _> = entries
        .iter()
        .map(|entry| (entry.path.as_str(), entry))
        .collect();
    let mut seen = HashSet::new();
    loop {
        let frame = decoder.next(work)?;
        if frame.kind == protocol::DONE {
            if seen.len() != expected.len() {
                return Err("archive_changed");
            }
            return decoder.finish(work);
        }
        let (entry, mode) = metadata(frame)?;
        let Some(reviewed) = expected.get(entry.path.as_str()) else {
            return Err("archive_changed");
        };
        if reviewed.bytes != entry.bytes
            || reviewed.directory != entry.directory
            || !seen.insert(entry.path.clone())
        {
            return Err("archive_changed");
        }
        let mut reader = EntryReader {
            decoder: &mut decoder,
            work,
            buffer: Vec::new(),
            offset: 0,
            ended: false,
            failure: None,
        };
        let result = visit(&entry, &mut reader, mode);
        if let Some(error) = reader.failure {
            return Err(error);
        }
        result?;
        if !reader.ended {
            // A directory callback has no content to consume, but still requires its terminator.
            let mut byte = [0];
            let count = reader
                .read(&mut byte)
                .map_err(|_| reader.failure.unwrap_or("archive_decoder"))?;
            if count != 0 {
                return Err("archive_checksum");
            }
        }
    }
}
pub(super) fn try_run_worker() -> bool {
    if !std::env::args_os().skip(1).any(|arg| arg == protocol::ARG) {
        return false;
    }
    std::process::exit(worker::main());
}
#[cfg(test)]
#[path = "archive_decoder_rar_tests.rs"]
mod rar_tests;
#[cfg(test)]
#[path = "archive_decoder_tests.rs"]
mod tests;
#[cfg(test)]
#[path = "archive_decoder_disc_tests.rs"]
mod disc_tests;
