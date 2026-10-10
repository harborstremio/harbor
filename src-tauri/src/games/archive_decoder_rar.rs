//! UnRAR only decodes to the existing bounded pipe. The parent owns every write.
use super::{protocol as wire, Result, MAX_ENTRIES, MAX_EXPANDED};
use std::{
    io::Write,
    path::{Path, PathBuf},
    ptr,
};
use unrar_sys as rar;
use zeroize::Zeroizing;

fn wide(value: &str) -> Vec<rar::WCHAR> {
    #[cfg(windows)]
    let value = value.encode_utf16().map(|v| v as rar::WCHAR).collect();
    #[cfg(not(windows))]
    let value = value.chars().map(|v| v as rar::WCHAR).collect();
    value
}
fn name(value: &[rar::WCHAR]) -> Result<String> {
    let end = value.iter().position(|v| *v == 0).ok_or("archive_path")?;
    // The legacy DLL name field truncates at 1023 characters. Never publish a
    // potentially truncated identity, even when its prefix looks safe.
    if end == 0 || end >= value.len() - 1 {
        return Err("archive_path");
    }
    #[cfg(windows)]
    let text = String::from_utf16(&value[..end]).map_err(|_| "archive_path")?;
    #[cfg(not(windows))]
    let text = value[..end]
        .iter()
        .map(|v| char::from_u32(*v as u32).ok_or("archive_path"))
        .collect::<Result<String>>()?;
    Ok(text.replace('\\', "/"))
}
fn code(value: i32, encrypted: bool) -> &'static str {
    match value {
        rar::ERAR_MISSING_PASSWORD => "archive_encrypted",
        rar::ERAR_BAD_PASSWORD => "archive_password",
        rar::ERAR_NO_MEMORY | 25 => "archive_limit", // ERAR_LARGE_DICT in the current DLL
        rar::ERAR_BAD_DATA if encrypted => "archive_password_or_checksum",
        rar::ERAR_BAD_DATA => "archive_checksum",
        rar::ERAR_UNKNOWN_FORMAT => "archive_compression",
        rar::ERAR_EOPEN | rar::ERAR_EREAD => "archive_read",
        rar::ERAR_EREFERENCE => "archive_links",
        _ => "archive_format",
    }
}
struct Callback<'a> {
    output: &'a mut dyn Write,
    password: Option<Zeroizing<Vec<rar::WCHAR>>>,
    remaining: u64,
    receiving: bool,
    failure: Option<&'static str>,
    volumes: &'a [PathBuf],
    volume: usize,
    ansi_notification: bool,
}
impl Callback<'_> {
    unsafe fn volume(&mut self, first: rar::LPARAM, second: rar::LPARAM) -> Result<()> {
        if first == 0 {
            return Err("archive_parts");
        }
        if second == rar::RAR_VOL_ASK {
            return Err("archive_missing_part");
        }
        if second != rar::RAR_VOL_NOTIFY {
            return Err("archive_parts");
        }
        let pointer = first as *const rar::WCHAR;
        let mut value = Vec::new();
        for index in 0..8192 {
            let character = *pointer.add(index);
            if character == 0 {
                break;
            }
            value.push(character);
        }
        if value.is_empty() || value.len() >= 8192 {
            return Err("archive_path");
        }
        #[cfg(windows)]
        let value = String::from_utf16(&value).map_err(|_| "archive_path")?;
        #[cfg(not(windows))]
        let value = value
            .into_iter()
            .map(|v| char::from_u32(v as u32).ok_or("archive_path"))
            .collect::<Result<String>>()?;
        let candidate = Path::new(&value);
        // Upstream opens/checks the next header before NOTIFY. Accept no payload
        // from an unexpected path, and never answer ASK with another location.
        super::super::metadata(candidate)?;
        let candidate = candidate
            .canonicalize()
            .map_err(|_| "archive_missing_part")?;
        if self.volumes.get(self.volume + 1) != Some(&candidate) {
            return Err("archive_parts");
        }
        self.volume += 1;
        self.ansi_notification = true;
        Ok(())
    }
    fn result(&self, value: i32, encrypted: bool) -> Result<()> {
        if let Some(error) = self.failure {
            return Err(error);
        }
        if value == rar::ERAR_SUCCESS {
            Ok(())
        } else {
            Err(code(value, encrypted))
        }
    }
    unsafe fn receive(
        &mut self,
        message: u32,
        first: rar::LPARAM,
        second: rar::LPARAM,
    ) -> Result<()> {
        match message {
            rar::UCM_PROCESSDATA => {
                if !self.receiving || second < 0 || first == 0 {
                    return Err("archive_format");
                }
                let length = second as usize;
                self.remaining = self
                    .remaining
                    .checked_sub(length as u64)
                    .ok_or("archive_limit")?;
                // UnRAR owns this callback buffer for the duration of the call.
                // Never retain it or allocate a whole expanded file.
                let bytes = std::slice::from_raw_parts(first as *const u8, length);
                for chunk in bytes.chunks(wire::CHUNK) {
                    wire::write_frame(&mut self.output, wire::DATA, chunk)
                        .map_err(|_| "archive_write")?;
                }
            }
            rar::UCM_NEEDPASSWORDW => {
                let password = self.password.as_ref().ok_or("archive_encrypted")?;
                if first == 0 || second <= 0 || password.len() >= second as usize {
                    return Err("archive_password");
                }
                let target = first as *mut rar::WCHAR;
                ptr::copy_nonoverlapping(password.as_ptr(), target, password.len());
                *target.add(password.len()) = 0;
            }
            rar::UCM_NEEDPASSWORD => return Err("archive_password"),
            rar::UCM_CHANGEVOLUMEW => self.volume(first, second)?,
            rar::UCM_CHANGEVOLUME => {
                // The current DLL sends the ANSI notification immediately after
                // its authoritative wide-path notification. Avoid lossy decoding.
                if second != rar::RAR_VOL_NOTIFY || !std::mem::take(&mut self.ansi_notification) {
                    return Err(if second == rar::RAR_VOL_ASK {
                        "archive_missing_part"
                    } else {
                        "archive_parts"
                    });
                }
            }
            // UCM_LARGEDICT is present in the pinned C++ API, not its Rust constants.
            5 => return Err("archive_limit"),
            _ => return Err("archive_format"),
        }
        Ok(())
    }
}
extern "C" fn callback(
    message: rar::UINT,
    user: rar::LPARAM,
    first: rar::LPARAM,
    second: rar::LPARAM,
) -> i32 {
    if user == 0 {
        return -1;
    }
    // The synchronous DLL call retains this stack context until it returns.
    // No Rust panic may unwind through the C++ callback boundary.
    let state = unsafe { &mut *(user as *mut Callback<'_>) };
    if state.failure.is_some() {
        return -1;
    }
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| unsafe {
        state.receive(message, first, second)
    }));
    match result {
        Ok(Ok(())) => 1,
        Ok(Err(error)) => {
            state.failure = Some(error);
            -1
        }
        Err(_) => {
            state.failure = Some("archive_format");
            -1
        }
    }
}
struct Handle(*const rar::Handle);
impl Drop for Handle {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe {
                rar::RARCloseArchive(self.0);
            }
        }
    }
}
fn entry(header: &rar::HeaderDataEx) -> Result<wire::Entry> {
    if header.flags & rar::RHDF_SPLITBEFORE != 0 {
        return Err("archive_missing_part");
    }
    let directory = header.flags & rar::RHDF_DIRECTORY != 0;
    // The DLL normalizes Unix hosts to 3 for both RAR4 and RAR5.
    let mode = if header.host_os == 3 {
        header.file_attr
    } else {
        0
    };
    if header.redir_type != 0
        || ![0, 0o100000, 0o040000].contains(&(mode & 0o170000))
        || (header.host_os != 3 && header.file_attr & 0x400 != 0)
    {
        return Err("archive_links");
    }
    let bytes = (u64::from(header.unp_size_high) << 32) | u64::from(header.unp_size);
    let filename = header.filename_w;
    let path = name(&filename)?;
    if bytes > MAX_EXPANDED
        || (directory && bytes != 0)
        || path.len() > 2048
        || u64::from(header.dict_size) * 1024 > 256 * 1024 * 1024
    {
        return Err("archive_limit");
    }
    Ok(wire::Entry {
        path,
        bytes,
        directory,
        mode,
    })
}
pub(super) fn run(
    path: &Path,
    parts: &[PathBuf],
    password: Option<&str>,
    extract: bool,
    output: &mut impl Write,
) -> Result<()> {
    if password.is_some_and(|value| value.contains('\0')) {
        return Err("archive_password");
    }
    let mut state = Callback {
        output,
        password: password.map(|v| Zeroizing::new(wide(v))),
        remaining: 0,
        receiving: false,
        failure: None,
        volumes: parts,
        volume: 0,
        ansi_notification: false,
    };
    #[cfg(any(target_os = "linux", target_os = "netbsd"))]
    let source =
        std::ffi::CString::new(path.to_str().ok_or("archive_path")?).map_err(|_| "archive_path")?;
    #[cfg(not(any(target_os = "linux", target_os = "netbsd")))]
    let source = {
        let mut v = wide(path.to_str().ok_or("archive_path")?);
        v.push(0);
        v
    };
    let mut options = rar::OpenArchiveDataEx::new(
        source.as_ptr(),
        if extract {
            rar::RAR_OM_EXTRACT
        } else {
            rar::RAR_OM_LIST
        },
    );
    options.callback = Some(callback);
    options.user_data = (&mut state as *mut Callback<'_>) as rar::LPARAM;
    let handle = Handle(unsafe { rar::RAROpenArchiveEx(&mut options) });
    state.result(options.open_result as i32, password.is_some())?;
    if handle.0.is_null() {
        return Err("archive_format");
    }
    if options.flags & rar::ROADF_VOLUME != 0 && options.flags & rar::ROADF_FIRSTVOLUME == 0 {
        return Err("archive_missing_part");
    }
    if parts.len() > 1 && options.flags & rar::ROADF_VOLUME == 0 {
        return Err("archive_parts");
    }
    let (mut count, mut total) = (0usize, 0u64);
    loop {
        let mut header = rar::HeaderDataEx::default();
        let result = unsafe { rar::RARReadHeaderEx(handle.0, &mut header) };
        if result == rar::ERAR_END_ARCHIVE && state.failure.is_none() {
            break;
        }
        let encrypted =
            header.flags & rar::RHDF_ENCRYPTED != 0 || options.flags & rar::ROADF_ENCHEADERS != 0;
        state.result(result, encrypted)?;
        if encrypted && password.is_none() {
            return Err("archive_encrypted");
        }
        let item = entry(&header)?;
        count += 1;
        total = total.checked_add(item.bytes).ok_or("archive_limit")?;
        if count > MAX_ENTRIES || total > MAX_EXPANDED {
            return Err("archive_limit");
        }
        let encoded = serde_json::to_vec(&item).map_err(|_| "archive_format")?;
        wire::write_frame(&mut state.output, wire::ENTRY, &encoded).map_err(|_| "archive_write")?;
        state.remaining = item.bytes;
        state.receiving = extract;
        // TEST verifies file checksums and emits PROCESSDATA, without opening a
        // destination. EXTRACT is deliberately never used in this worker.
        let result = unsafe {
            rar::RARProcessFileW(
                handle.0,
                if extract {
                    rar::RAR_TEST
                } else {
                    rar::RAR_SKIP
                },
                ptr::null(),
                ptr::null(),
            )
        };
        state.receiving = false;
        state.result(result, encrypted)?;
        if extract {
            if state.remaining != 0 {
                return Err("archive_checksum");
            }
            wire::write_frame(&mut state.output, wire::END_ENTRY, &[])
                .map_err(|_| "archive_write")?;
        }
    }
    if state.volume + 1 != parts.len() {
        return Err("archive_parts");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn header() -> rar::HeaderDataEx {
        let mut value = rar::HeaderDataEx::default();
        let mut filename = [0; 1024];
        filename[..8].copy_from_slice(&wide("game.dat"));
        value.filename_w = filename;
        value.unp_size = 20;
        value
    }
    #[test]
    fn rejects_rar_special_files_large_dictionaries_and_truncated_names() {
        let mut value = header();
        value.redir_type = 4;
        assert_eq!(entry(&value).err(), Some("archive_links"));
        value = header();
        value.host_os = 3;
        value.file_attr = 0o120777;
        assert_eq!(entry(&value).err(), Some("archive_links"));
        value = header();
        value.dict_size = 256 * 1024 + 1;
        assert_eq!(entry(&value).err(), Some("archive_limit"));
        value = header();
        value.unp_size_high = 65;
        assert_eq!(entry(&value).err(), Some("archive_limit"));
        value = header();
        value.filename_w = [97; 1024];
        assert_eq!(entry(&value).err(), Some("archive_path"));
    }
}
