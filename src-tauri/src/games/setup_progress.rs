//! Read-only, bounded telemetry from a tracked Windows installer and its descendants.
use super::SetupProgress;
use std::{
    collections::HashSet,
    ffi::c_void,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

type Handle = *mut c_void;
type Window = *mut c_void;
#[repr(C)]
#[derive(Default)]
struct Point {
    x: i32,
    y: i32,
}
#[repr(C)]
#[derive(Default)]
struct Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}
#[link(name = "dwmapi")]
unsafe extern "system" {
    fn DwmGetWindowAttribute(window: Window, attribute: u32, value: *mut c_void, size: u32) -> i32;
}
const QUERY: u32 = 0x1000;
const SYNCHRONIZE: u32 = 0x100000;
const MAX_PROCESSES: usize = 32;
const MAX_CONTROLS: usize = 160;
const SAMPLE_BUDGET: Duration = Duration::from_millis(250);

#[repr(C)]
#[derive(Default, Clone, Copy)]
struct FileTime {
    low: u32,
    high: u32,
}
impl FileTime {
    fn value(self) -> u64 {
        (u64::from(self.high) << 32) | u64::from(self.low)
    }
}
#[repr(C)]
#[derive(Default)]
struct IoCounters {
    read_ops: u64,
    write_ops: u64,
    other_ops: u64,
    read_bytes: u64,
    write_bytes: u64,
    other_bytes: u64,
}
#[repr(C)]
struct ProcessEntry {
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
    fn GetProcessId(handle: Handle) -> u32;
    fn GetExitCodeProcess(handle: Handle, code: *mut u32) -> i32;
    fn GetProcessTimes(
        handle: Handle,
        created: *mut FileTime,
        exited: *mut FileTime,
        kernel: *mut FileTime,
        user: *mut FileTime,
    ) -> i32;
    fn GetProcessIoCounters(handle: Handle, counters: *mut IoCounters) -> i32;
    fn QueryFullProcessImageNameW(
        handle: Handle,
        flags: u32,
        name: *mut u16,
        length: *mut u32,
    ) -> i32;
    fn WaitForSingleObject(handle: Handle, timeout: u32) -> u32;
    fn CreateToolhelp32Snapshot(flags: u32, pid: u32) -> Handle;
    fn Process32FirstW(snapshot: Handle, entry: *mut ProcessEntry) -> i32;
    fn Process32NextW(snapshot: Handle, entry: *mut ProcessEntry) -> i32;
    fn GetSystemTimeAsFileTime(time: *mut FileTime);
}
#[link(name = "user32")]
unsafe extern "system" {
    fn EnumWindows(callback: unsafe extern "system" fn(Window, isize) -> i32, data: isize) -> i32;
    fn EnumChildWindows(
        window: Window,
        callback: unsafe extern "system" fn(Window, isize) -> i32,
        data: isize,
    ) -> i32;
    fn GetWindowThreadProcessId(window: Window, pid: *mut u32) -> u32;
    fn GetClassNameW(window: Window, name: *mut u16, length: i32) -> i32;
    fn GetWindowLongW(window: Window, index: i32) -> i32;
    fn GetParent(window: Window) -> Window;
    fn IsWindowVisible(window: Window) -> i32;
    fn IsIconic(window: Window) -> i32;
    fn ClientToScreen(window: Window, point: *mut Point) -> i32;
    fn GetDpiForWindow(window: Window) -> u32;
    fn SendMessageTimeoutW(
        window: Window,
        message: u32,
        wparam: usize,
        lparam: isize,
        flags: u32,
        timeout: u32,
        result: *mut usize,
    ) -> isize;
    fn ShowWindowAsync(window: Window, command: i32) -> i32;
    fn SetForegroundWindow(window: Window) -> i32;
}

struct OwnedHandle(usize);
impl OwnedHandle {
    fn raw(&self) -> Handle {
        self.0 as Handle
    }
}
impl Drop for OwnedHandle {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.raw());
        }
    }
}
fn owned(handle: Handle) -> Option<OwnedHandle> {
    if handle.is_null() || handle as isize == -1 {
        None
    } else {
        Some(OwnedHandle(handle as usize))
    }
}
fn times(handle: Handle) -> Option<(u64, u64)> {
    let (mut created, mut exited, mut kernel, mut user) = (
        FileTime::default(),
        FileTime::default(),
        FileTime::default(),
        FileTime::default(),
    );
    (unsafe { GetProcessTimes(handle, &mut created, &mut exited, &mut kernel, &mut user) } != 0)
        .then_some((created.value(), exited.value()))
}
fn image_path(handle: Handle) -> Option<String> {
    let mut buffer = vec![0u16; 32768];
    let mut length = buffer.len() as u32;
    (unsafe { QueryFullProcessImageNameW(handle, 0, buffer.as_mut_ptr(), &mut length) } != 0)
        .then(|| String::from_utf16_lossy(&buffer[..length as usize]))
}
fn normalize_path(path: &str) -> String {
    path.trim_start_matches(r"\\?\")
        .replace('/', "\\")
        .to_lowercase()
}

struct Tracked {
    handle: OwnedHandle,
    pid: u32,
    created: u64,
    image: String,
    previous_write: Option<(u64, Instant)>,
}
impl Tracked {
    fn identity(&self) -> super::resume::Identity {
        super::resume::Identity { pid: self.pid, created: self.created, image: self.image.clone() }
    }
    fn open(pid: u32) -> Option<Self> {
        let handle = owned(unsafe { OpenProcess(QUERY | SYNCHRONIZE, 0, pid) })?;
        let created = times(handle.raw())?.0;
        let image = image_path(handle.raw())?;
        if image.is_empty() {
            return None;
        }
        Some(Self {
            handle,
            pid,
            created,
            image,
            previous_write: None,
        })
    }
    fn alive(&self) -> bool {
        (unsafe { WaitForSingleObject(self.handle.raw(), 0) }) == 258
    }
}

pub(super) struct Monitor {
    processes: Vec<Tracked>,
    root: super::resume::Identity,
    root_exit_code: Option<u32>,
    recovered: bool,
    installer_pids: HashSet<u32>,
    destination: PathBuf,
    ocr: super::ocr::Client,
    observed_until: Instant,
    last_discovery: Instant,
    checker_seen: bool,
    verification: Option<super::SetupVerification>,
    root_exit_checked: bool,
    discovery_complete: bool,
}
impl Monitor {
    pub(super) fn new(process: usize, installer: &Path, destination: &Path) -> Option<Self> {
        let pid = unsafe { GetProcessId(process as Handle) };
        let root = Tracked::open(pid)?;
        if root.created != times(process as Handle)?.0
            || normalize_path(&root.image) != normalize_path(&installer.to_string_lossy())
        {
            return None;
        }
        Some(Self {
            root: root.identity(),
            root_exit_code: None,
            recovered: false,
            processes: vec![root],
            installer_pids: HashSet::new(),
            destination: destination.to_owned(),
            ocr: super::ocr::Client::new(),
            observed_until: Instant::now(),
            last_discovery: Instant::now() - Duration::from_secs(1),
            checker_seen: false,
            verification: None,
            root_exit_checked: false,
            discovery_complete: false,
        })
    }

    pub(super) fn restore(saved: &super::resume::State, installer: &Path, destination: &Path) -> Option<Self> {
        let root = saved.processes.first()?;
        let mut pids = HashSet::new();
        if saved.processes.len() > MAX_PROCESSES
            || normalize_path(&root.image) != normalize_path(&installer.to_string_lossy())
            || saved.processes.iter().any(|identity| identity.pid == 0 || identity.created == 0
                || identity.image.len() > 32768 || !Path::new(&identity.image).is_absolute()
                || identity.image.chars().any(char::is_control) || !pids.insert(identity.pid))
            || saved.verification.as_ref().is_some_and(|value| value.total_files == 0
                || value.checked_files > value.total_files || value.bad_files > value.total_files
                || value.missing_files > value.total_files)
        {
            return None;
        }
        let processes: Vec<_> = saved.processes.iter().filter_map(|identity| {
            let process = Tracked::open(identity.pid)?;
            (process.created == identity.created
                && normalize_path(&process.image) == normalize_path(&identity.image)).then_some(process)
        }).collect();
        if !processes.iter().any(Tracked::alive) {
            return None;
        }
        Some(Self {
            processes,
            root: root.clone(),
            root_exit_code: saved.root_exit_code,
            recovered: true,
            installer_pids: HashSet::new(),
            destination: destination.to_owned(),
            ocr: super::ocr::Client::new(),
            observed_until: Instant::now(),
            last_discovery: Instant::now() - Duration::from_secs(1),
            checker_seen: saved.checker_seen,
            verification: saved.verification.clone(),
            root_exit_checked: false,
            discovery_complete: false,
        })
    }

    pub(super) fn checkpoint(&mut self, destination_identity: Option<(u64, u64)>) -> super::resume::State {
        if let Some(root) = self.processes.iter().find(|process| process.pid == self.root.pid) {
            if unsafe { WaitForSingleObject(root.handle.raw(), 0) } == 0 {
                let mut code = 0;
                if unsafe { GetExitCodeProcess(root.handle.raw(), &mut code) } != 0 {
                    self.root_exit_code = Some(code);
                }
            }
        }
        super::resume::State {
            processes: std::iter::once(self.root.clone()).chain(self.processes.iter()
                .filter(|process| process.pid != self.root.pid).map(Tracked::identity)).collect(),
            root_exit_code: self.root_exit_code,
            destination_identity,
            checker_seen: self.checker_seen,
            // Partial counts change too often to sync the full history on each
            // sample. Retain only conclusive results, plus checker presence.
            verification: self.verification.as_ref().filter(|value| value.bad_files > 0
                || value.missing_files > 0 || value.checked_files == value.total_files).cloned(),
        }
    }

    pub(super) fn any_running(&mut self) -> bool {
        self.discover();
        self.processes.iter().any(Tracked::alive)
    }

    fn at_limit(&self) -> bool {
        self.processes.len() + usize::from(!self.processes.iter().any(|process| process.pid == self.root.pid)) >= MAX_PROCESSES
    }

    fn discover(&mut self) {
        if self.last_discovery.elapsed() < Duration::from_secs(1) {
            return;
        }
        self.discovery_complete = false;
        if self.at_limit() {
            return;
        }
        self.last_discovery = Instant::now();
        let mut snapshot_time = FileTime::default();
        unsafe {
            GetSystemTimeAsFileTime(&mut snapshot_time);
        }
        let Some(snapshot) = owned(unsafe { CreateToolhelp32Snapshot(2, 0) }) else {
            return;
        };
        let mut entry: ProcessEntry = unsafe { std::mem::zeroed() };
        entry.size = std::mem::size_of::<ProcessEntry>() as u32;
        let mut entries = Vec::new();
        let mut available = unsafe { Process32FirstW(snapshot.raw(), &mut entry) } != 0;
        while available && entries.len() < 8192 {
            entries.push((entry.pid, entry.parent));
            available = unsafe { Process32NextW(snapshot.raw(), &mut entry) } != 0;
        }
        self.discovery_complete = !available;
        for _ in 0..8 {
            let before = self.processes.len();
            for &(pid, parent_id) in &entries {
                if self.at_limit() {
                    break;
                }
                if self.processes.iter().any(|p| p.pid == pid) {
                    continue;
                }
                let Some(parent) = self.processes.iter().find(|p| p.pid == parent_id) else {
                    continue;
                };
                let Some((parent_start, parent_end)) = times(parent.handle.raw()) else {
                    self.discovery_complete = false;
                    continue;
                };
                let Some(child) = Tracked::open(pid) else {
                    self.discovery_complete = false;
                    continue;
                };
                if !child.alive() {
                    continue;
                }
                // Held parent handles prevent PID reuse. Reject a stale snapshot/new process,
                // or a child born outside the verified parent's lifetime.
                if child.created < parent_start
                    || child.created > snapshot_time.value()
                    || (parent_end != 0 && child.created > parent_end)
                {
                    continue;
                }
                self.processes.push(child);
            }
            if self.processes.len() == before {
                break;
            }
        }
    }

    pub(super) fn sample(&mut self, observed_at: u64) -> SetupProgress {
        self.discover();
        let pids = self.live_pids();
        let controls = collect(&pids);
        self.installer_pids = controls.installer_pids.clone();
        let values: Vec<_> = controls
            .values
            .into_iter()
            .filter(|c| controls.installer_pids.contains(&c.pid))
            .collect();
        let mut progress = parse_controls(&values, observed_at);
        if let Some((_, title)) = controls.checker.as_ref() {
            self.checker_seen = true;
            progress = SetupProgress {
                stage: super::SetupStage::Checking,
                observed_at,
                current_file: checker_file(title),
                ..Default::default()
            };
        } else if self.checker_seen {
            progress = SetupProgress {
                stage: super::SetupStage::Checking,
                observed_at,
                ..Default::default()
            };
        }
        let observed_window = controls
            .checker
            .as_ref()
            .map(|(window, _)| (*window, super::ocr::Kind::QuickSfv))
            .or_else(|| {
                controls
                    .wizard
                    .map(|window| (window, super::ocr::Kind::Inno))
            });
        progress.can_reveal = observed_window.is_some();
        if let Some((window, kind)) = observed_window {
            let mut pid = 0;
            unsafe {
                GetWindowThreadProcessId(window as Window, &mut pid);
            }
            if let Some(process) = self.processes.iter().find(|p| p.pid == pid && p.alive()) {
                let target = super::ocr::Target {
                    window,
                    pid,
                    created: process.created,
                    destination: self.destination.clone(),
                    kind,
                    text_band: checker_text_band(window),
                };
                progress.can_observe = super::ocr::Client::available() && valid_ocr_target(&target);
                if let Some(reading) = self.ocr.sample(
                    target,
                    progress.can_observe && Instant::now() < self.observed_until,
                ) {
                    if progress.current_file.is_none() {
                        progress.current_file = reading.file;
                    }
                    if progress.elapsed_seconds.is_none() {
                        progress.elapsed_seconds = reading.elapsed;
                    }
                    if progress.remaining_seconds.is_none() {
                        progress.remaining_seconds = reading.remaining;
                    }
                    if let Some(verification) = reading.verification {
                        self.verification = Some(verification.clone());
                        progress.verification = Some(verification);
                    }
                }
            }
        }
        let sample_time = Instant::now();
        let mut rate = 0.0;
        let mut complete = !self.processes.is_empty() && self.processes.len() < MAX_PROCESSES;
        for process in &mut self.processes {
            let mut counters = IoCounters::default();
            if unsafe { GetProcessIoCounters(process.handle.raw(), &mut counters) } == 0 {
                complete = false;
                process.previous_write = None;
                continue;
            }
            if let Some((previous, last_time)) = process.previous_write {
                let elapsed = sample_time.duration_since(last_time).as_secs_f64();
                if elapsed > 0.0 && counters.write_bytes >= previous {
                    rate += (counters.write_bytes - previous) as f64 / elapsed;
                } else {
                    complete = false;
                }
            } else {
                complete = false;
            }
            process.previous_write = Some((counters.write_bytes, sample_time));
        }
        if complete && rate.is_finite() {
            progress.io_bytes_per_second = Some(rate);
        }
        progress
    }

    pub(super) fn children_running(&mut self) -> bool {
        // A bootstrap can exit between samples, after spawning its real installer.
        // Its first exit observation must bypass the normal snapshot throttle.
        if !self.root_exit_checked {
            self.root_exit_checked = true;
            self.last_discovery = Instant::now() - Duration::from_secs(1);
        }
        self.discover();
        self.processes.iter().any(|process| process.pid != self.root.pid && process.alive())
    }

    pub(super) fn verification_result(&self) -> Option<&'static str> {
        if self.verification.as_ref().is_some_and(|value| value.bad_files > 0 || value.missing_files > 0) {
            return Some("setup_verification");
        }
        if !self.discovery_complete || self.at_limit() {
            return Some("setup_read");
        }
        if !self.checker_seen {
            return self.recovered.then_some("setup_read");
        }
        match &self.verification {
            Some(value) if value.bad_files > 0 || value.missing_files > 0 => {
                Some("setup_verification")
            }
            Some(value) if value.checked_files == value.total_files => self.recovered.then_some("setup_read"),
            _ => Some("setup_verification_unknown"),
        }
    }

    fn live_pids(&self) -> HashSet<u32> {
        self.processes
            .iter()
            .filter(|p| p.alive())
            .map(|p| p.pid)
            .collect()
    }

    pub(super) fn audio_targets(&self) -> HashSet<u32> {
        self.live_pids()
            .intersection(&self.installer_pids)
            .copied()
            .collect()
    }

    pub(super) fn observe(&mut self) {
        self.observed_until = Instant::now() + Duration::from_secs(8);
    }

    pub(super) fn reveal(&mut self) -> bool {
        self.discover();
        let pids = self.live_pids();
        let controls = collect(&pids);
        let Some(window) = controls
            .checker
            .map(|(window, _)| window)
            .or(controls.wizard)
        else {
            return false;
        };
        let mut pid = 0;
        unsafe {
            GetWindowThreadProcessId(window as Window, &mut pid);
        }
        if !self.processes.iter().any(|p| p.pid == pid && p.alive()) {
            return false;
        }
        // Explicit user action only. Never invoke the executable a second time.
        unsafe {
            ShowWindowAsync(window as Window, 9) != 0 && SetForegroundWindow(window as Window) != 0
        }
    }
}

pub(super) fn valid_ocr_target(target: &super::ocr::Target) -> bool {
    let window = target.window as Window;
    let mut pid = 0;
    unsafe {
        GetWindowThreadProcessId(window, &mut pid);
    }
    let expected = match target.kind {
        super::ocr::Kind::Inno => "TWizardForm",
        super::ocr::Kind::QuickSfv => "QSFV_MAIN",
    };
    if pid != target.pid
        || class_name(window) != expected
        || unsafe { IsWindowVisible(window) } == 0
        || unsafe { IsIconic(window) } != 0
    {
        return false;
    }
    Tracked::open(pid).is_some_and(|process| process.alive() && process.created == target.created)
}

fn checker_file(title: &str) -> Option<String> {
    let file = title
        .strip_prefix("Checking ")?
        .trim_end_matches("...")
        .trim();
    (!file.is_empty() && file.len() <= 400 && !file.chars().any(char::is_control))
        .then(|| file.to_owned())
}

fn checker_text_band(window: usize) -> Option<(u32, u32)> {
    let window = window as Window;
    let mut frame = Rect::default();
    let mut client = Point::default();
    if unsafe {
        DwmGetWindowAttribute(
            window,
            9,
            &mut frame as *mut _ as _,
            std::mem::size_of::<Rect>() as u32,
        )
    } < 0
        || unsafe { ClientToScreen(window, &mut client) } == 0
    {
        return None;
    }
    let dpi = unsafe { GetDpiForWindow(window) };
    let top = u32::try_from(client.y.checked_sub(frame.top)?).ok()?;
    // QuickSFV draws two 16-DIP summary lines above its actual list control.
    (dpi >= 96 && dpi <= 768).then_some((top, 34 * dpi / 96))
}

#[derive(Default)]
struct Control {
    pid: u32,
    class: String,
    text: String,
    percent: Option<f64>,
}
struct Controls<'a> {
    pids: &'a HashSet<u32>,
    started: Instant,
    visited: usize,
    values: Vec<Control>,
    wizard: Option<usize>,
    checker: Option<(usize, String)>,
    installer_pids: HashSet<u32>,
    current_form: usize,
}
fn text(window: Window) -> Option<String> {
    let mut buffer = [0u16; 512];
    let mut length = 0;
    let ok = unsafe {
        SendMessageTimeoutW(
            window,
            13,
            buffer.len(),
            buffer.as_mut_ptr() as isize,
            0x23,
            20,
            &mut length,
        )
    };
    (ok != 0 && length < buffer.len())
        .then(|| String::from_utf16_lossy(&buffer[..length.min(buffer.len() - 1)]))
}
fn message(window: Window, message: u32, argument: usize) -> Option<usize> {
    let mut value = 0;
    (unsafe { SendMessageTimeoutW(window, message, argument, 0, 0x23, 20, &mut value) } != 0)
        .then_some(value)
}
fn class_name(window: Window) -> String {
    let mut name = [0u16; 128];
    let length = unsafe { GetClassNameW(window, name.as_mut_ptr(), name.len() as i32) };
    String::from_utf16_lossy(&name[..length.max(0) as usize])
}
unsafe extern "system" fn child(window: Window, data: isize) -> i32 {
    let state = unsafe { &mut *(data as *mut Controls<'_>) };
    state.visited += 1;
    if state.visited > MAX_CONTROLS || state.started.elapsed() >= SAMPLE_BUDGET {
        return 0;
    }
    let mut pid = 0;
    unsafe {
        GetWindowThreadProcessId(window, &mut pid);
    }
    if !state.pids.contains(&pid) || !visible_page(window, state.current_form) {
        return 1;
    }
    let class = class_name(window);
    if class == "TNewStaticText" || class == "Static" {
        if let Some(text) = text(window) {
            state.values.push(Control {
                pid,
                class,
                text,
                percent: None,
            });
        }
    } else if class == "TNewProgressBar" || class == "msctls_progress32" {
        if unsafe { GetWindowLongW(window, -16) } & 8 != 0 {
            return 1;
        } // marquee
        let percent = (|| {
            let low = message(window, 0x407, 1)?;
            let high = message(window, 0x407, 0)?;
            let position = message(window, 0x408, 0)?;
            (high > low && position >= low && position <= high)
                .then(|| (position - low) as f64 / (high - low) as f64 * 100.0)
        })();
        state.values.push(Control {
            pid,
            class,
            percent,
            text: String::new(),
        });
    }
    1
}
unsafe extern "system" fn top(window: Window, data: isize) -> i32 {
    let state = unsafe { &mut *(data as *mut Controls<'_>) };
    if state.started.elapsed() >= SAMPLE_BUDGET {
        return 0;
    }
    let mut pid = 0;
    unsafe {
        GetWindowThreadProcessId(window, &mut pid);
    }
    if !state.pids.contains(&pid) {
        return 1;
    }
    let class = class_name(window);
    if class == "TWizardForm" {
        state.wizard = Some(window as usize);
        state.current_form = window as usize;
        state.installer_pids.insert(pid);
        // Only recognized Inno forms are inspected; unrelated child-app UI is not read.
        unsafe {
            EnumChildWindows(window, child, data);
        }
    } else if class == "QSFV_MAIN" {
        if let Some(title) = text(window) {
            state.checker = Some((window as usize, title));
        }
    } else if class == "TApplication" {
        if let Some(text) = text(window) {
            state.values.push(Control {
                pid,
                class,
                text,
                percent: None,
            });
        }
    }
    1
}
fn collect(pids: &HashSet<u32>) -> Controls<'_> {
    let mut state = Controls {
        pids,
        started: Instant::now(),
        visited: 0,
        values: Vec::new(),
        wizard: None,
        checker: None,
        installer_pids: HashSet::new(),
        current_form: 0,
    };
    unsafe {
        EnumWindows(top, &mut state as *mut _ as isize);
    }
    state
}
fn visible_page(mut window: Window, form: usize) -> bool {
    // /VERYSILENT can hide the form itself. Still restrict reads to its active page;
    // inactive notebook pages may retain stale progress bars and labels.
    for _ in 0..20 {
        if window as usize == form {
            return true;
        }
        if window.is_null() || unsafe { GetWindowLongW(window, -16) } & 0x10000000 == 0 {
            return false;
        }
        window = unsafe { GetParent(window) };
    }
    false
}
fn caption_percent(text: &str) -> Option<f64> {
    let (number, _) = text.trim().split_once('%')?;
    if !number
        .chars()
        .all(|c| c.is_ascii_digit() || c == '.' || c == ',')
    {
        return None;
    }
    let value: f64 = number.replace(',', ".").parse().ok()?;
    (value.is_finite() && (0.0..=100.0).contains(&value)).then_some(value)
}
fn clock(text: &str) -> Option<u64> {
    let parts: Vec<_> = text
        .trim()
        .split(':')
        .map(str::parse::<u64>)
        .collect::<Result<_, _>>()
        .ok()?;
    match parts.as_slice() {
        [hours, minutes, seconds] if *hours < 1000 && *minutes < 60 && *seconds < 60 => {
            Some(hours * 3600 + minutes * 60 + seconds)
        }
        [minutes, seconds] if *minutes < 1000 && *seconds < 60 => Some(minutes * 60 + seconds),
        _ => None,
    }
}
fn parse_controls(controls: &[Control], observed_at: u64) -> SetupProgress {
    let mut result = SetupProgress {
        observed_at,
        ..Default::default()
    };
    let captions: Vec<_> = controls
        .iter()
        .filter(|c| c.class == "TApplication")
        .filter_map(|c| caption_percent(&c.text))
        .collect();
    let gauges: Vec<_> = controls.iter().filter_map(|c| c.percent).collect();
    // Multiple different gauges can be per-file and total progress; don't pick arbitrarily.
    result.percent = if captions.len() == 1 {
        Some(captions[0])
    } else if captions.is_empty() && gauges.len() == 1 {
        Some(gauges[0])
    } else {
        None
    };
    for control in controls.iter().filter(|c| c.class != "TApplication") {
        let text = control.text.trim();
        let lower = text.to_ascii_lowercase();
        if matches!(
            lower.trim_end_matches('.'),
            "unpacking" | "extracting" | "verifying" | "installing"
        ) && (result.phase.is_none() || lower != "installing")
        {
            result.phase = Some(text.to_owned());
        }
        if let Some((label, value)) = text.split_once(':') {
            match label.trim().to_ascii_lowercase().as_str() {
                "elapsed time" | "time elapsed" => result.elapsed_seconds = clock(value),
                "time left" | "remaining time" | "time remaining" => {
                    result.remaining_seconds = clock(value)
                }
                "unpacking" | "extracting" | "file" | "current file"
                    if !value.trim().is_empty() && value.len() <= 400 =>
                {
                    result.current_file = Some(value.trim().to_owned())
                }
                _ => {}
            }
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn checker_filename_and_completion_require_verified_results() {
        assert_eq!(
            checker_file("Checking ..\\Game_Data\\level1.resS..."),
            Some("..\\Game_Data\\level1.resS".into())
        );
        assert_eq!(checker_file("Completed Files: 36/303 (File:7%)"), None);
        let mut monitor = Monitor {
            processes: vec![],
            root: super::super::resume::Identity { pid: 0, created: 0, image: String::new() },
            root_exit_code: None,
            recovered: false,
            installer_pids: HashSet::new(),
            destination: PathBuf::new(),
            ocr: super::super::ocr::Client::new(),
            observed_until: Instant::now(),
            last_discovery: Instant::now(),
            checker_seen: true,
            verification: None,
            root_exit_checked: false,
            discovery_complete: true,
        };
        assert_eq!(
            monitor.verification_result(),
            Some("setup_verification_unknown")
        );
        monitor.verification = Some(super::super::SetupVerification {
            checked_files: 36,
            total_files: 303,
            bad_files: 0,
            missing_files: 0,
        });
        assert_eq!(
            monitor.verification_result(),
            Some("setup_verification_unknown")
        );
        monitor.verification.as_mut().unwrap().checked_files = 303;
        assert_eq!(monitor.verification_result(), None);
        monitor.verification.as_mut().unwrap().missing_files = 1;
        assert_eq!(monitor.verification_result(), Some("setup_verification"));
    }
    #[test]
    fn reads_actual_caption_without_guessing_its_unlabeled_clock() {
        let result = parse_controls(
            &[Control {
                class: "TApplication".into(),
                text: "29.8%   00:22:59".into(),
                ..Default::default()
            }],
            123,
        );
        assert_eq!(result.percent, Some(29.8));
        assert_eq!(result.remaining_seconds, None);
        assert_eq!(result.elapsed_seconds, None);
        assert_eq!(result.observed_at, 123);
    }
    #[test]
    fn requires_explicit_file_and_clock_labels_and_rejects_ambiguous_gauges() {
        let labels = [
            "Unpacking...",
            "Current file: 27.fgpack",
            "Elapsed time: 00:10:08",
            "Time left: 00:22:59",
        ];
        let mut controls: Vec<_> = labels
            .iter()
            .map(|text| Control {
                class: "TNewStaticText".into(),
                text: text.to_string(),
                ..Default::default()
            })
            .collect();
        controls.push(Control {
            percent: Some(29.8),
            ..Default::default()
        });
        controls.push(Control {
            percent: Some(78.0),
            ..Default::default()
        });
        let result = parse_controls(&controls, 1);
        assert_eq!(result.percent, None);
        assert_eq!(result.phase.as_deref(), Some("Unpacking..."));
        assert_eq!(result.current_file.as_deref(), Some("27.fgpack"));
        assert_eq!(result.elapsed_seconds, Some(608));
        assert_eq!(result.remaining_seconds, Some(1379));
        assert_eq!(caption_percent("101%"), None);
        assert_eq!(caption_percent("Nivalis 29%"), None);
        assert_eq!(clock("00:90:03"), None);
    }
}
