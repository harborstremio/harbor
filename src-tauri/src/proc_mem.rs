use serde::Serialize;

#[derive(Serialize, Default, Clone, Copy)]
pub struct ProcMem {
    #[serde(rename = "harborRss")]
    pub harbor_rss: u64,
    #[serde(rename = "webviewRss")]
    pub webview_rss: u64,
    pub total: u64,
    #[serde(rename = "totalPhys")]
    pub total_phys: u64,
}

#[cfg(target_os = "linux")]
#[derive(Debug)]
struct LinuxProcess {
    pid: u32,
    parent: u32,
    name: String,
    rss: u64,
}

#[cfg(target_os = "linux")]
const PROCESS_DISCOVERY_INTERVAL: std::time::Duration = std::time::Duration::from_secs(30);
#[cfg(target_os = "linux")]
const EMPTY_PROCESS_RETRY_INTERVAL: std::time::Duration = std::time::Duration::from_secs(2);

#[cfg(target_os = "linux")]
#[derive(Default)]
struct LinuxSampler {
    webkit_pids: Vec<u32>,
    last_discovery: Option<std::time::Instant>,
}

#[cfg(target_os = "linux")]
static LINUX_SAMPLER: std::sync::OnceLock<std::sync::Mutex<LinuxSampler>> =
    std::sync::OnceLock::new();
#[cfg(target_os = "linux")]
static LINUX_TOTAL_PHYS: std::sync::OnceLock<u64> = std::sync::OnceLock::new();

#[cfg(target_os = "linux")]
fn parse_kib_field(contents: &str, field: &str) -> Option<u64> {
    contents.lines().find_map(|line| {
        let (key, value) = line.split_once(':')?;
        if key != field {
            return None;
        }
        value
            .split_whitespace()
            .next()?
            .parse::<u64>()
            .ok()
            .map(|kib| kib.saturating_mul(1024))
    })
}

#[cfg(target_os = "linux")]
fn parse_linux_status(pid: u32, contents: &str) -> Option<LinuxProcess> {
    let mut name = None;
    let mut parent = None;
    for line in contents.lines() {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        match key {
            "Name" => name = Some(value.trim().to_owned()),
            "PPid" => parent = value.trim().parse::<u32>().ok(),
            _ => {}
        }
    }
    Some(LinuxProcess {
        pid,
        parent: parent?,
        name: name?,
        rss: parse_kib_field(contents, "VmRSS").unwrap_or(0),
    })
}

#[cfg(target_os = "linux")]
fn read_linux_process(pid: u32) -> Option<LinuxProcess> {
    let contents = std::fs::read_to_string(format!("/proc/{pid}/status")).ok()?;
    parse_linux_status(pid, &contents)
}

#[cfg(target_os = "linux")]
fn linux_processes() -> Vec<LinuxProcess> {
    let Ok(entries) = std::fs::read_dir("/proc") else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter_map(|entry| entry.file_name().to_string_lossy().parse::<u32>().ok())
        .filter_map(read_linux_process)
        .collect()
}

#[cfg(target_os = "linux")]
fn descendant_pids(processes: &[LinuxProcess], root: u32) -> std::collections::HashSet<u32> {
    use std::collections::HashSet;

    // WebKit helpers can sit below sandbox/launcher processes, so walk the full
    // descendant tree instead of considering direct children only.
    let mut descendants = HashSet::from([root]);
    loop {
        let mut changed = false;
        for process in processes {
            if descendants.contains(&process.parent) && descendants.insert(process.pid) {
                changed = true;
            }
        }
        if !changed {
            break;
        }
    }
    descendants
}

#[cfg(target_os = "linux")]
fn is_webkit_process(process: &LinuxProcess) -> bool {
    process.name.to_ascii_lowercase().starts_with("webkit")
}

#[cfg(target_os = "linux")]
fn discover_webkit_processes(harbor_pid: u32) -> Vec<LinuxProcess> {
    let processes = linux_processes();
    let descendants = descendant_pids(&processes, harbor_pid);
    processes
        .into_iter()
        .filter(|process| {
            process.pid != harbor_pid
                && descendants.contains(&process.pid)
                && is_webkit_process(process)
        })
        .collect()
}

#[cfg(target_os = "linux")]
fn linux_total_phys() -> u64 {
    *LINUX_TOTAL_PHYS.get_or_init(|| {
        std::fs::read_to_string("/proc/meminfo")
            .ok()
            .and_then(|contents| parse_kib_field(&contents, "MemTotal"))
            .unwrap_or(0)
    })
}

#[cfg(target_os = "linux")]
fn discovery_due(sampler: &LinuxSampler, now: std::time::Instant) -> bool {
    let interval = if sampler.webkit_pids.is_empty() {
        EMPTY_PROCESS_RETRY_INTERVAL
    } else {
        PROCESS_DISCOVERY_INTERVAL
    };
    match sampler.last_discovery {
        None => true,
        Some(last) => now.saturating_duration_since(last) >= interval,
    }
}

#[cfg(target_os = "linux")]
fn refresh_webkit_processes(
    sampler: &mut LinuxSampler,
    harbor_pid: u32,
    now: std::time::Instant,
) -> u64 {
    let webkit = discover_webkit_processes(harbor_pid);
    sampler.webkit_pids = webkit.iter().map(|process| process.pid).collect();
    sampler.last_discovery = Some(now);
    webkit
        .iter()
        .fold(0u64, |total, process| total.saturating_add(process.rss))
}

#[cfg(target_os = "linux")]
fn read_linux() -> ProcMem {
    let harbor_pid = std::process::id();
    let harbor_rss = read_linux_process(harbor_pid).map_or(0, |process| process.rss);
    let now = std::time::Instant::now();
    let sampler = LINUX_SAMPLER.get_or_init(|| std::sync::Mutex::new(LinuxSampler::default()));
    let mut sampler = sampler
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());

    let webview_rss = if discovery_due(&sampler, now) {
        refresh_webkit_processes(&mut sampler, harbor_pid, now)
    } else {
        let cached: Vec<_> = sampler
            .webkit_pids
            .iter()
            .filter_map(|pid| read_linux_process(*pid))
            .filter(is_webkit_process)
            .collect();
        // A helper exited or was replaced. Refresh immediately rather than
        // reporting a stale value until the next discovery interval.
        if cached.len() != sampler.webkit_pids.len() {
            refresh_webkit_processes(&mut sampler, harbor_pid, now)
        } else {
            cached
                .iter()
                .fold(0u64, |total, process| total.saturating_add(process.rss))
        }
    };

    ProcMem {
        harbor_rss,
        webview_rss,
        total: harbor_rss.saturating_add(webview_rss),
        total_phys: linux_total_phys(),
    }
}

#[cfg(windows)]
fn working_set(pid: u32) -> u64 {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::ProcessStatus::{K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
    unsafe {
        let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return 0;
        };
        let mut counters: PROCESS_MEMORY_COUNTERS = std::mem::zeroed();
        let mut rss = 0u64;
        if K32GetProcessMemoryInfo(
            handle,
            &mut counters,
            std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32,
        )
        .as_bool()
        {
            rss = counters.WorkingSetSize as u64;
        }
        let _ = CloseHandle(handle);
        rss
    }
}

#[cfg(windows)]
fn exe_name(name: &[u16; 260]) -> String {
    let end = name.iter().position(|&c| c == 0).unwrap_or(name.len());
    String::from_utf16_lossy(&name[..end]).to_lowercase()
}

#[cfg(windows)]
fn read() -> ProcMem {
    use std::collections::HashSet;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
    use windows::Win32::System::Threading::GetCurrentProcessId;

    let mut out = ProcMem::default();
    let harbor_pid = unsafe { GetCurrentProcessId() };
    out.harbor_rss = working_set(harbor_pid);

    unsafe {
        let mut status: MEMORYSTATUSEX = std::mem::zeroed();
        status.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
        if GlobalMemoryStatusEx(&mut status).is_ok() {
            out.total_phys = status.ullTotalPhys;
        }
    }

    let snapshot = match unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) } {
        Ok(h) => h,
        Err(_) => {
            out.total = out.harbor_rss + out.webview_rss;
            return out;
        }
    };

    let mut procs: Vec<(u32, u32, String)> = Vec::new();
    unsafe {
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                procs.push((
                    entry.th32ProcessID,
                    entry.th32ParentProcessID,
                    exe_name(&entry.szExeFile),
                ));
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
    }

    let mut tree: HashSet<u32> = HashSet::new();
    tree.insert(harbor_pid);
    loop {
        let mut added = false;
        for (pid, parent, _) in &procs {
            if tree.contains(parent) && !tree.contains(pid) {
                tree.insert(*pid);
                added = true;
            }
        }
        if !added {
            break;
        }
    }

    for (pid, _, name) in &procs {
        if *pid == harbor_pid {
            continue;
        }
        if tree.contains(pid) && name.contains("webview") {
            out.webview_rss += working_set(*pid);
        }
    }

    out.total = out.harbor_rss + out.webview_rss;
    out
}

#[cfg(target_os = "macos")]
extern "C" {
    // Private libproc SPI used by Activity Monitor to attribute XPC helper
    // processes (WKWebView helpers are parented to launchd, so a plain
    // descendant walk cannot find them).
    fn responsibility_get_pid_responsible_for_pid(pid: std::ffi::c_int) -> std::ffi::c_int;
}

#[cfg(target_os = "macos")]
fn macos_rss(pid: i32) -> u64 {
    unsafe {
        let mut info: libc::proc_taskinfo = std::mem::zeroed();
        let size = std::mem::size_of::<libc::proc_taskinfo>() as i32;
        let rc = libc::proc_pidinfo(
            pid,
            libc::PROC_PIDTASKINFO,
            0,
            &mut info as *mut _ as *mut std::ffi::c_void,
            size,
        );
        if rc == size {
            info.pti_resident_size
        } else {
            0
        }
    }
}

#[cfg(target_os = "macos")]
fn macos_total_phys() -> u64 {
    unsafe {
        let mut value: u64 = 0;
        let mut len = std::mem::size_of::<u64>();
        let rc = libc::sysctlbyname(
            b"hw.memsize\0".as_ptr() as *const std::ffi::c_char,
            &mut value as *mut _ as *mut std::ffi::c_void,
            &mut len,
            std::ptr::null_mut(),
            0,
        );
        if rc == 0 {
            value
        } else {
            0
        }
    }
}

#[cfg(target_os = "macos")]
fn read_macos() -> ProcMem {
    let mut out = ProcMem {
        total_phys: macos_total_phys(),
        ..ProcMem::default()
    };
    let self_pid = std::process::id() as i32;
    out.harbor_rss = macos_rss(self_pid);

    unsafe {
        let mut count = libc::proc_listallpids(std::ptr::null_mut(), 0);
        if count <= 0 {
            out.total = out.harbor_rss;
            return out;
        }
        let mut pids: Vec<i32> = vec![0; count as usize];
        let buf_bytes = count * std::mem::size_of::<i32>() as i32;
        count = libc::proc_listallpids(pids.as_mut_ptr() as *mut std::ffi::c_void, buf_bytes);
        if count <= 0 {
            out.total = out.harbor_rss;
            return out;
        }
        pids.truncate(count as usize);
        for pid in pids {
            if pid == self_pid {
                continue;
            }
            if responsibility_get_pid_responsible_for_pid(pid) != self_pid {
                continue;
            }
            let mut info: libc::proc_bsdinfo = std::mem::zeroed();
            let size = std::mem::size_of::<libc::proc_bsdinfo>() as i32;
            let rc = libc::proc_pidinfo(
                pid,
                libc::PROC_PIDTBSDINFO,
                0,
                &mut info as *mut _ as *mut std::ffi::c_void,
                size,
            );
            if rc != size {
                continue;
            }
            let name_bytes: Vec<u8> = info
                .pbi_name
                .iter()
                .take_while(|&&c| c != 0)
                .map(|&c| c as u8)
                .collect();
            let name = String::from_utf8_lossy(&name_bytes).to_ascii_lowercase();
            if name.contains("webkit") {
                out.webview_rss += macos_rss(pid);
            }
        }
    }
    out.total = out.harbor_rss + out.webview_rss;
    out
}

#[tauri::command]
pub async fn harbor_process_memory() -> ProcMem {
    #[cfg(windows)]
    {
        read()
    }
    #[cfg(target_os = "linux")]
    {
        tokio::task::spawn_blocking(read_linux)
            .await
            .unwrap_or_default()
    }
    #[cfg(target_os = "macos")]
    {
        tokio::task::spawn_blocking(read_macos)
            .await
            .unwrap_or_default()
    }
    #[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
    {
        ProcMem::default()
    }
}

#[cfg(all(test, target_os = "macos"))]
mod macos_tests {
    #[test]
    fn reads_own_rss_and_total_phys() {
        let m = super::read_macos();
        assert!(m.harbor_rss > 0, "own rss should be reported");
        assert!(m.total_phys > 0, "physical memory should be reported");
        assert!(m.total >= m.harbor_rss);
    }
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::{descendant_pids, parse_kib_field, parse_linux_status, read_linux, LinuxProcess};

    const STATUS: &str =
        "Name:\tWebKitWebProces\nState:\tS (sleeping)\nPid:\t42\nPPid:\t7\nVmRSS:\t12345 kB\n";

    #[test]
    fn parses_linux_process_status() {
        let process = parse_linux_status(42, STATUS).expect("valid status");
        assert_eq!(process.pid, 42);
        assert_eq!(process.parent, 7);
        assert_eq!(process.name, "WebKitWebProces");
        assert_eq!(process.rss, 12_345 * 1024);
    }

    #[test]
    fn parses_meminfo_values_as_bytes() {
        let meminfo = "MemTotal:       32768000 kB\nMemAvailable:   12000000 kB\n";
        assert_eq!(
            parse_kib_field(meminfo, "MemTotal"),
            Some(32_768_000 * 1024)
        );
        assert_eq!(parse_kib_field(meminfo, "Missing"), None);
    }

    #[test]
    fn finds_the_full_descendant_tree() {
        let processes = vec![
            LinuxProcess {
                pid: 2,
                parent: 1,
                name: "launcher".into(),
                rss: 0,
            },
            LinuxProcess {
                pid: 3,
                parent: 2,
                name: "WebKitWebProces".into(),
                rss: 0,
            },
            LinuxProcess {
                pid: 4,
                parent: 99,
                name: "WebKitWebProces".into(),
                rss: 0,
            },
        ];
        let descendants = descendant_pids(&processes, 1);
        assert!(descendants.contains(&1));
        assert!(descendants.contains(&2));
        assert!(descendants.contains(&3));
        assert!(!descendants.contains(&4));
    }

    #[test]
    fn reads_current_process_and_physical_memory() {
        let memory = read_linux();
        assert!(memory.harbor_rss > 0);
        assert!(memory.total >= memory.harbor_rss);
        assert!(memory.total_phys > 0);
    }
}
