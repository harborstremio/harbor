use std::{fs, path::Path};

pub fn ensure_regular(path: &Path) -> Result<Option<u64>, &'static str> {
    match fs::symlink_metadata(path) {
        Ok(meta) if meta.is_file() && !meta.file_type().is_symlink() => Ok(Some(meta.len())),
        Ok(_) => Err("transfer_destination"),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("transfer_read"),
    }
}
/// Publish without ever replacing an existing destination, including a symlink.
pub fn publish(part: &Path, dest: &Path) -> Result<(), &'static str> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        #[link(name = "kernel32")]
        extern "system" {
            fn MoveFileExW(existing: *const u16, new: *const u16, flags: u32) -> i32;
        }
        let from = part
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<_>>();
        let to = dest
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<_>>();
        // WRITE_THROUGH only. REPLACE_EXISTING is intentionally absent.
        if unsafe { MoveFileExW(from.as_ptr(), to.as_ptr(), 8) } == 0 {
            return Err(if dest.try_exists().unwrap_or(false) {
                "transfer_exists"
            } else {
                "transfer_publish"
            });
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        fs::hard_link(part, dest).map_err(|_| {
            if dest.symlink_metadata().is_ok() {
                "transfer_exists"
            } else {
                "transfer_publish"
            }
        })?;
        let _ = fs::remove_file(part);
        Ok(())
    }
}
pub fn free_bytes(path: &Path) -> Option<u64> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        #[link(name = "kernel32")]
        extern "system" {
            fn GetDiskFreeSpaceExW(
                path: *const u16,
                available: *mut u64,
                total: *mut u64,
                free: *mut u64,
            ) -> i32;
        }
        let name = path
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<_>>();
        let mut available = 0;
        (unsafe {
            GetDiskFreeSpaceExW(
                name.as_ptr(),
                &mut available,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            )
        } != 0)
            .then_some(available)
    }
    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStrExt;
        let name = std::ffi::CString::new(path.as_os_str().as_bytes()).ok()?;
        let mut value = std::mem::MaybeUninit::<libc::statvfs>::uninit();
        if unsafe { libc::statvfs(name.as_ptr(), value.as_mut_ptr()) } != 0 {
            return None;
        }
        let value = unsafe { value.assume_init() };
        (value.f_bavail as u64).checked_mul(value.f_frsize as u64)
    }
    #[cfg(not(any(unix, target_os = "windows")))]
    {
        let _ = path;
        None
    }
}
