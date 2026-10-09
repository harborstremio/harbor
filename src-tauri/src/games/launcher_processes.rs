//! Read-only process identities. Never inject, terminate, or infer identity from a PID alone.
use serde::{Deserialize, Serialize};
use std::{collections::BTreeSet, path::Path};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(super) struct Process {
    pub pid: u32,
    pub created: u64,
    pub path: String,
}
#[derive(Default)]
pub(super) struct Sample {
    pub processes: Vec<Process>,
    pub inaccessible: BTreeSet<u32>,
}
pub(super) fn path_key(path: &Path) -> String {
    path.to_string_lossy()
        .trim_start_matches(r"\\?\")
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_lowercase()
}

#[cfg(windows)]
pub(super) fn sample() -> Result<Sample, &'static str> {
    use std::ffi::c_void;
    type Handle = *mut c_void;
    #[repr(C)]
    #[derive(Default)]
    struct Time {
        low: u32,
        high: u32,
    }
    #[repr(C)]
    struct Entry {
        size: u32,
        usage: u32,
        pid: u32,
        heap: usize,
        module: u32,
        threads: u32,
        parent: u32,
        priority: i32,
        flags: u32,
        executable: [u16; 260],
    }
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn OpenProcess(access: u32, inherit: i32, pid: u32) -> Handle;
        fn CloseHandle(handle: Handle) -> i32;
        fn GetProcessTimes(
            handle: Handle,
            created: *mut Time,
            exited: *mut Time,
            kernel: *mut Time,
            user: *mut Time,
        ) -> i32;
        fn QueryFullProcessImageNameW(
            handle: Handle,
            flags: u32,
            name: *mut u16,
            length: *mut u32,
        ) -> i32;
        fn CreateToolhelp32Snapshot(flags: u32, pid: u32) -> Handle;
        fn Process32FirstW(snapshot: Handle, entry: *mut Entry) -> i32;
        fn Process32NextW(snapshot: Handle, entry: *mut Entry) -> i32;
    }
    struct Owned(Handle);
    impl Drop for Owned {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.0);
            }
        }
    }
    let raw = unsafe { CreateToolhelp32Snapshot(2, 0) };
    if raw.is_null() || raw as isize == -1 {
        return Err("launcher_observation_failed");
    }
    let snapshot = Owned(raw);
    let mut entry: Entry = unsafe { std::mem::zeroed() };
    entry.size = std::mem::size_of::<Entry>() as u32;
    let mut result = Sample::default();
    let mut available = unsafe { Process32FirstW(snapshot.0, &mut entry) } != 0;
    let mut count = 0;
    while available {
        count += 1;
        if count > 16384 {
            return Err("launcher_observation_failed");
        }
        let raw = unsafe { OpenProcess(0x1000, 0, entry.pid) };
        if raw.is_null() {
            result.inaccessible.insert(entry.pid);
        } else {
            let handle = Owned(raw);
            let (mut created, mut exited, mut kernel, mut user) = (
                Time::default(),
                Time::default(),
                Time::default(),
                Time::default(),
            );
            let mut buffer = vec![0u16; 32768];
            let mut length = buffer.len() as u32;
            if unsafe {
                GetProcessTimes(handle.0, &mut created, &mut exited, &mut kernel, &mut user)
            } != 0
                && exited.low == 0
                && exited.high == 0
                && unsafe {
                    QueryFullProcessImageNameW(handle.0, 0, buffer.as_mut_ptr(), &mut length)
                } != 0
            {
                let path = String::from_utf16_lossy(&buffer[..length as usize]);
                // Canonicalize to prevent a junction inside an install from claiming another game.
                if let Ok(path) = std::fs::canonicalize(path) {
                    result.processes.push(Process {
                        pid: entry.pid,
                        created: ((created.high as u64) << 32) | created.low as u64,
                        path: path_key(&path),
                    });
                } else {
                    result.inaccessible.insert(entry.pid);
                }
            } else {
                result.inaccessible.insert(entry.pid);
            }
        }
        available = unsafe { Process32NextW(snapshot.0, &mut entry) } != 0;
    }
    Ok(result)
}
#[cfg(not(windows))]
pub(super) fn sample() -> Result<Sample, &'static str> {
    Err("launcher_platform_unsupported")
}
