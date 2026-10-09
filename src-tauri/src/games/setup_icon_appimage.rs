//! Optional bounded SquashFS icon reading. The AppImage runtime is never executed or mounted.
#[cfg(target_os = "linux")]
use std::path::Path;
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
};

fn number(bytes: &[u8], offset: usize, size: usize, little: bool) -> Option<u64> {
    let bytes = bytes.get(offset..offset.checked_add(size)?)?;
    Some(if little {
        bytes
            .iter()
            .rev()
            .fold(0, |value, byte| (value << 8) | u64::from(*byte))
    } else {
        bytes
            .iter()
            .fold(0, |value, byte| (value << 8) | u64::from(*byte))
    })
}

fn payload(file: &mut File) -> Option<u64> {
    let length = file.metadata().ok()?.len();
    let mut header = [0u8; 64];
    file.seek(SeekFrom::Start(0)).ok()?;
    file.read_exact(&mut header).ok()?;
    if &header[..4] != b"\x7fELF" || &header[8..11] != b"AI\x02" || ![1, 2].contains(&header[5]) {
        return None;
    }
    let little = header[5] == 1;
    let (table, entry_size, count, expected) = match header[4] {
        1 => (
            number(&header, 32, 4, little)?,
            number(&header, 46, 2, little)?,
            number(&header, 48, 2, little)?,
            40,
        ),
        2 => (
            number(&header, 40, 8, little)?,
            number(&header, 58, 2, little)?,
            number(&header, 60, 2, little)?,
            64,
        ),
        _ => return None,
    };
    if count == 0 || count > 512 || entry_size != expected || table > 64 * 1024 * 1024 {
        return None;
    }
    let size = entry_size.checked_mul(count)?;
    let mut end = table.checked_add(size)?;
    if end > length {
        return None;
    }
    let mut sections = vec![0; size as usize];
    file.seek(SeekFrom::Start(table)).ok()?;
    file.read_exact(&mut sections).ok()?;
    for section in sections.chunks_exact(entry_size as usize) {
        if number(section, 4, 4, little)? == 8 {
            continue;
        } // SHT_NOBITS has no file payload.
        let (offset, size) = if header[4] == 1 {
            (
                number(section, 16, 4, little)?,
                number(section, 20, 4, little)?,
            )
        } else {
            (
                number(section, 24, 8, little)?,
                number(section, 32, 8, little)?,
            )
        };
        end = end.max(offset.checked_add(size)?);
    }
    if end > 64 * 1024 * 1024 || end.checked_add(96)? > length {
        return None;
    }
    let mut squash = [0u8; 96];
    file.seek(SeekFrom::Start(end)).ok()?;
    file.read_exact(&mut squash).ok()?;
    if &squash[..4] != b"hsqs"
        || number(&squash, 28, 2, true)? != 4
        || number(&squash, 12, 4, true)? > 1024 * 1024
        || number(&squash, 40, 8, true)? > length - end
    {
        return None;
    }
    Some(end)
}

#[cfg(target_os = "linux")]
pub(super) fn extract(path: &Path) -> Option<image::RgbaImage> {
    use std::{
        fs,
        io::ErrorKind,
        os::{
            fd::AsRawFd,
            unix::{fs::MetadataExt, process::CommandExt},
        },
        process::{Child, Command, Stdio},
        time::{Duration, Instant},
    };
    let offset = payload(&mut File::open(path).ok()?)?;
    // Do not search user-controlled PATH entries or install a helper implicitly.
    let tool = ["/usr/bin/unsquashfs", "/bin/unsquashfs"]
        .into_iter()
        .find_map(|path| {
            let path = fs::canonicalize(path).ok()?;
            let meta = fs::metadata(&path).ok()?;
            (meta.is_file()
                && meta.uid() == 0
                && meta.mode() & 0o022 == 0
                && meta.mode() & 0o111 != 0)
                .then_some(path)
        })?;
    let mut command = Command::new(tool);
    command
        .args([
            "-processors",
            "1",
            "-mem",
            "16M",
            "-no-progress",
            "-cat",
            "-offset",
        ])
        .arg(offset.to_string())
        .arg(path)
        .arg(".DirIcon")
        .env_clear()
        .env("LC_ALL", "C")
        .env("PATH", "/usr/bin:/bin")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    unsafe {
        command.pre_exec(|| {
            for (resource, value) in [
                (libc::RLIMIT_AS, 256 * 1024 * 1024),
                (libc::RLIMIT_CPU, 2),
                (libc::RLIMIT_FSIZE, 0),
                (libc::RLIMIT_NOFILE, 64),
            ] {
                let limit = libc::rlimit {
                    rlim_cur: value,
                    rlim_max: value,
                };
                if libc::setrlimit(resource, &limit) != 0 {
                    return Err(std::io::Error::last_os_error());
                }
            }
            Ok(())
        });
    }
    struct Running(Child);
    impl Drop for Running {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }
    let mut child = Running(command.spawn().ok()?);
    let mut output = child.0.stdout.take()?;
    let descriptor = output.as_raw_fd();
    let flags = unsafe { libc::fcntl(descriptor, libc::F_GETFL) };
    if flags < 0 || unsafe { libc::fcntl(descriptor, libc::F_SETFL, flags | libc::O_NONBLOCK) } < 0
    {
        return None;
    }
    let deadline = Instant::now() + Duration::from_secs(3);
    let mut bytes = Vec::new();
    let mut buffer = [0u8; 16384];
    let mut finished = false;
    loop {
        match output.read(&mut buffer) {
            Ok(0) => {
                if finished {
                    break;
                }
            }
            Ok(count) => {
                if bytes.len().checked_add(count)? > super::decode::MAX_ASSET_BYTES {
                    return None;
                }
                bytes.extend_from_slice(&buffer[..count]);
            }
            Err(error) if error.kind() == ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(10));
            }
            Err(_) => return None,
        }
        if let Some(status) = child.0.try_wait().ok()? {
            if !status.success() {
                return None;
            }
            finished = true;
        }
        if Instant::now() >= deadline {
            return None;
        }
        if !finished {
            std::thread::sleep(Duration::from_millis(10));
        }
    }
    super::decode::asset(&bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, path::PathBuf};
    #[test]
    fn payload_offset_is_read_from_bounded_elf_tables_without_running_the_file() {
        let mut bytes = vec![0u8; 224];
        bytes[..4].copy_from_slice(b"\x7fELF");
        bytes[4] = 2;
        bytes[5] = 1;
        bytes[8..11].copy_from_slice(b"AI\x02");
        bytes[40..48].copy_from_slice(&64u64.to_le_bytes());
        bytes[58..60].copy_from_slice(&64u16.to_le_bytes());
        bytes[60..62].copy_from_slice(&1u16.to_le_bytes());
        bytes[128..132].copy_from_slice(b"hsqs");
        bytes[140..144].copy_from_slice(&131072u32.to_le_bytes());
        bytes[156..158].copy_from_slice(&4u16.to_le_bytes());
        bytes[168..176].copy_from_slice(&96u64.to_le_bytes());
        let base = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        fs::create_dir_all(&base).unwrap();
        let path = base.join(format!("icon-appimage-{}.fixture", uuid::Uuid::new_v4()));
        fs::write(&path, &bytes).unwrap();
        assert_eq!(payload(&mut File::open(&path).unwrap()), Some(128));
        bytes[40..48].copy_from_slice(&u64::MAX.to_le_bytes());
        fs::write(&path, &bytes).unwrap();
        assert!(payload(&mut File::open(&path).unwrap()).is_none());
        fs::remove_file(path).unwrap();
    }
}
