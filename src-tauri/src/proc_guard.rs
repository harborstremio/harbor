use tokio::process::{Child, Command};

pub fn init() {
    #[cfg(windows)]
    win::init();
}

pub fn configure_command(cmd: &mut Command) {
    #[cfg(target_os = "linux")]
    unsafe {
        cmd.pre_exec(|| {
            unsafe { libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL) };
            Ok(())
        });
    }
    #[cfg(not(target_os = "linux"))]
    let _ = cmd;
}

pub fn adopt(child: &Child) {
    #[cfg(windows)]
    if let Some(handle) = child.raw_handle() {
        win::assign(handle as isize);
    }
    #[cfg(not(windows))]
    let _ = child;
}

pub fn reap_orphans() {
    reap_platform();
}

#[cfg(windows)]
fn reap_platform() {
    use std::os::windows::process::CommandExt;
    let script = "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessId -ne $PID -and $_.Name -like 'mpv*' -and ($_.CommandLine -like '*harbor-thumbs-*' -or $_.CommandLine -like '*harbor-mv-*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(0x0800_0000)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .output();
}

#[cfg(not(windows))]
fn reap_platform() {
    for signature in ["harbor-thumbs-", "harbor-mv-"] {
        let _ = std::process::Command::new("pkill")
            .args(["-9", "-f", signature])
            .output();
    }
}

#[cfg(windows)]
mod win {
    use std::sync::OnceLock;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    struct Job(HANDLE);
    unsafe impl Send for Job {}
    unsafe impl Sync for Job {}

    static JOB: OnceLock<Option<Job>> = OnceLock::new();

    pub fn init() {
        JOB.get_or_init(create);
    }

    fn create() -> Option<Job> {
        unsafe {
            let job = CreateJobObjectW(None, PCWSTR::null()).ok()?;
            let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const core::ffi::c_void,
                core::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
            .is_err()
            {
                let _ = CloseHandle(job);
                return None;
            }
            Some(Job(job))
        }
    }

    pub fn assign(raw: isize) {
        if raw == 0 {
            return;
        }
        let Some(Some(job)) = JOB.get() else {
            return;
        };
        unsafe {
            let _ = AssignProcessToJobObject(job.0, HANDLE(raw as *mut core::ffi::c_void));
        }
    }
}
