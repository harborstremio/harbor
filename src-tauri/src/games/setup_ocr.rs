//! Optional on-device OCR for a verified installer's painted labels.
//! One worker for the whole application; no desktop capture or retained image files.
use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{mpsc, Arc, Mutex, OnceLock},
    time::{Duration, Instant},
};
use windows::{
    core::Interface,
    Graphics::{
        Capture::{Direct3D11CaptureFramePool, GraphicsCaptureItem},
        DirectX::{Direct3D11::IDirect3DDevice, DirectXPixelFormat},
        Imaging::SoftwareBitmap,
    },
    Storage::Streams::{Buffer, DataReader},
    Win32::{
        Foundation::{HMODULE, HWND},
        Graphics::{
            Direct3D::D3D_DRIVER_TYPE_HARDWARE,
            Direct3D11::{
                D3D11CreateDevice, ID3D11Device, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
                D3D11_SDK_VERSION,
            },
            Dxgi::IDXGIDevice,
        },
        System::{
            Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED},
            WinRT::{
                Direct3D11::CreateDirect3D11DeviceFromDXGIDevice,
                Graphics::Capture::IGraphicsCaptureItemInterop,
            },
        },
    },
};

const FRESH: Duration = Duration::from_secs(8);
const CADENCE: Duration = Duration::from_secs(5);
const MAX_PIXELS: i64 = 2_000_000;

#[derive(Clone, Debug, Default)]
pub(super) struct Reading {
    pub file: Option<String>,
    pub elapsed: Option<u64>,
    pub remaining: Option<u64>,
    pub verification: Option<super::SetupVerification>,
    pub observed_at: u64,
}
struct Completed {
    reading: Reading,
    at: Instant,
    cost: Duration,
    key: (usize, u32, u64, Kind),
}
#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Kind {
    Inno,
    QuickSfv,
}
#[derive(Clone)]
pub(super) struct Target {
    pub window: usize,
    pub pid: u32,
    pub created: u64,
    pub destination: PathBuf,
    pub kind: Kind,
    pub text_band: Option<(u32, u32)>,
}
struct Request {
    target: Target,
    expires: Instant,
    output: Arc<Mutex<Option<Completed>>>,
}
pub(super) struct Client {
    output: Arc<Mutex<Option<Completed>>>,
    last_request: Instant,
    previous: Option<(Reading, Instant)>,
    last_received: Option<Instant>,
    accepted: Option<(Reading, Instant)>,
    cadence: Duration,
    key: Option<(usize, u32, u64, Kind)>,
}
impl Client {
    pub(super) fn new() -> Self {
        Self {
            output: Arc::new(Mutex::new(None)),
            last_request: Instant::now() - CADENCE,
            previous: None,
            last_received: None,
            accepted: None,
            cadence: CADENCE,
            key: None,
        }
    }
    pub(super) fn available() -> bool {
        executable().is_some()
    }
    pub(super) fn sample(&mut self, target: Target, interested: bool) -> Option<Reading> {
        let now = Instant::now();
        let key = (target.window, target.pid, target.created, target.kind);
        if self.key != Some(key) {
            self.key = Some(key);
            self.previous = None;
            self.accepted = None;
        }
        if interested && self.last_request.elapsed() >= self.cadence {
            if let Some(sender) = worker() {
                let request = Request {
                    target,
                    expires: now + FRESH,
                    output: Arc::clone(&self.output),
                };
                if sender.try_send(request).is_ok() {
                    self.last_request = now;
                }
            }
        }
        if let Ok(output) = self.output.lock() {
            if let Some(completed) = output
                .as_ref()
                .filter(|v| v.key == key && Some(v.at) != self.last_received)
            {
                self.last_received = Some(completed.at);
                let empty = completed.reading.file.is_none()
                    && completed.reading.elapsed.is_none()
                    && completed.reading.remaining.is_none()
                    && completed.reading.verification.is_none();
                self.cadence = if empty || completed.cost > Duration::from_millis(750) {
                    Duration::from_secs(15)
                } else {
                    CADENCE
                };
                let mut accepted = Reading {
                    observed_at: completed.reading.observed_at,
                    ..Default::default()
                };
                if let Some((old, old_at)) = self.previous.as_ref() {
                    let gap = completed.at.duration_since(*old_at).as_secs();
                    if gap <= 20 {
                        if old.file == completed.reading.file {
                            accepted.file = completed.reading.file.clone();
                        }
                        if let (Some(a), Some(b)) = (old.elapsed, completed.reading.elapsed) {
                            if b >= a && b - a <= gap + 4 {
                                accepted.elapsed = Some(b);
                            }
                        }
                        if let (Some(a), Some(b)) = (old.remaining, completed.reading.remaining) {
                            // ETA may change, but an isolated OCR digit error must not jump hours.
                            if a.abs_diff(b) <= 120 + gap * 4 {
                                accepted.remaining = Some(b);
                            }
                        }
                        if let (Some(a), Some(b)) =
                            (&old.verification, &completed.reading.verification)
                        {
                            if a.total_files == b.total_files
                                && a.checked_files <= b.checked_files
                                && a.bad_files <= b.bad_files
                                && a.missing_files <= b.missing_files
                            {
                                accepted.verification = Some(b.clone());
                            }
                        }
                    }
                }
                self.previous = Some((completed.reading.clone(), completed.at));
                self.accepted = Some((accepted, completed.at));
            }
        }
        self.accepted
            .as_ref()
            .filter(|(_, at)| interested && at.elapsed() < FRESH)
            .map(|(value, _)| value.clone())
    }
}

fn executable() -> Option<&'static PathBuf> {
    static PATH: OnceLock<Option<PathBuf>> = OnceLock::new();
    PATH.get_or_init(|| {
        // Never search the downloaded installer folder or execute a catalog-supplied tool.
        ["ProgramW6432", "ProgramFiles"]
            .iter()
            .filter_map(std::env::var_os)
            .map(|root| PathBuf::from(root).join("Tesseract-OCR/tesseract.exe"))
            .find(|path| path.is_file())
    })
    .as_ref()
}
fn worker() -> Option<&'static mpsc::SyncSender<Request>> {
    static WORKER: OnceLock<Option<mpsc::SyncSender<Request>>> = OnceLock::new();
    WORKER
        .get_or_init(|| {
            let (send, receive) = mpsc::sync_channel::<Request>(1);
            std::thread::Builder::new()
                .name("harbor-installer-ocr".into())
                .spawn(move || {
                    #[link(name = "kernel32")]
                    unsafe extern "system" {
                        fn GetCurrentThread() -> *mut std::ffi::c_void;
                        fn SetThreadPriority(thread: *mut std::ffi::c_void, priority: i32) -> i32;
                    }
                    unsafe {
                        SetThreadPriority(GetCurrentThread(), -1);
                    }
                    let mut last = Instant::now() - CADENCE;
                    while let Ok(request) = receive.recv() {
                        // All jobs share this budget, including multiple visible setup dialogs.
                        while last.elapsed() < CADENCE && Instant::now() < request.expires {
                            std::thread::sleep(Duration::from_millis(25));
                        }
                        if Instant::now() >= request.expires
                            || !super::progress::valid_ocr_target(&request.target)
                        {
                            continue;
                        }
                        last = Instant::now();
                        let started = Instant::now();
                        let reading = capture(&request.target)
                            .and_then(|image| recognize(&image))
                            .map(|tsv| {
                                parse_tsv(&tsv, &request.target.destination, request.target.kind)
                            })
                            .unwrap_or_default();
                        if Instant::now() >= request.expires
                            || !super::progress::valid_ocr_target(&request.target)
                        {
                            continue;
                        }
                        if let Ok(mut output) = request.output.lock() {
                            *output = Some(Completed {
                                reading,
                                at: Instant::now(),
                                cost: started.elapsed(),
                                key: (
                                    request.target.window,
                                    request.target.pid,
                                    request.target.created,
                                    request.target.kind,
                                ),
                            });
                        }
                    }
                })
                .ok()
                .map(|_| send)
        })
        .as_ref()
}

struct CaptureSession(
    windows::Graphics::Capture::GraphicsCaptureSession,
    Direct3D11CaptureFramePool,
);
impl Drop for CaptureSession {
    fn drop(&mut self) {
        let _ = self.0.Close();
        let _ = self.1.Close();
    }
}
fn capture(target: &Target) -> Option<Vec<u8>> {
    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED).ok().ok()?;
    }
    struct Apartment;
    impl Drop for Apartment {
        fn drop(&mut self) {
            unsafe {
                CoUninitialize();
            }
        }
    }
    let _apartment = Apartment;
    let mut device: Option<ID3D11Device> = None;
    unsafe {
        D3D11CreateDevice(
            None,
            D3D_DRIVER_TYPE_HARDWARE,
            HMODULE::default(),
            D3D11_CREATE_DEVICE_BGRA_SUPPORT,
            None,
            D3D11_SDK_VERSION,
            Some(&mut device),
            None,
            None,
        )
        .ok()?;
    }
    let dxgi: IDXGIDevice = device?.cast().ok()?;
    let direct: IDirect3DDevice = unsafe { CreateDirect3D11DeviceFromDXGIDevice(&dxgi) }
        .ok()?
        .cast()
        .ok()?;
    let interop =
        windows::core::factory::<GraphicsCaptureItem, IGraphicsCaptureItemInterop>().ok()?;
    let item: GraphicsCaptureItem =
        unsafe { interop.CreateForWindow(HWND(target.window as _)) }.ok()?;
    let size = item.Size().ok()?;
    if size.Width <= 0
        || size.Height <= 0
        || i64::from(size.Width) * i64::from(size.Height) > MAX_PIXELS
    {
        return None;
    }
    let pool = Direct3D11CaptureFramePool::CreateFreeThreaded(
        &direct,
        DirectXPixelFormat::B8G8R8A8UIntNormalized,
        1,
        size,
    )
    .ok()?;
    let session = CaptureSession(pool.CreateCaptureSession(&item).ok()?, pool);
    session.0.StartCapture().ok()?;
    let deadline = Instant::now() + Duration::from_millis(700);
    let frame = loop {
        if let Ok(frame) = session.1.TryGetNextFrame() {
            break frame;
        }
        if Instant::now() >= deadline {
            return None;
        }
        std::thread::sleep(Duration::from_millis(15));
    };
    if !super::progress::valid_ocr_target(target) {
        return None;
    }
    let operation = SoftwareBitmap::CreateCopyFromSurfaceAsync(&frame.Surface().ok()?).ok()?;
    while operation.Status().ok()?.0 == 0 {
        if Instant::now() >= deadline {
            let _ = operation.Cancel();
            return None;
        }
        std::thread::sleep(Duration::from_millis(5));
    }
    let bitmap = operation.GetResults().ok()?;
    drop(session); // The single-window capture ends before CPU recognition starts.
    let width = bitmap.PixelWidth().ok()? as u32;
    let height = bitmap.PixelHeight().ok()? as u32;
    if width == 0 || height == 0 || u64::from(width) * u64::from(height) > MAX_PIXELS as u64 {
        let _ = bitmap.Close();
        return None;
    }
    let buffer = Buffer::Create(width.checked_mul(height)?.checked_mul(4)?).ok()?;
    bitmap.CopyToBuffer(&buffer).ok()?;
    let mut pixels = vec![0u8; (width * height * 4) as usize];
    DataReader::FromBuffer(&buffer)
        .ok()?
        .ReadBytes(&mut pixels)
        .ok()?;
    let _ = bitmap.Close();
    crop_text(&pixels, width, height, target.kind, target.text_band)
}

fn crop_text(
    pixels: &[u8],
    width: u32,
    height: u32,
    kind: Kind,
    band: Option<(u32, u32)>,
) -> Option<Vec<u8>> {
    // Conservative Inno text band: excludes art, buttons and the rest of the screen.
    // Layout-specific fields are accepted only after their printed labels are read.
    let (top, crop_height) = if kind == Kind::Inno {
        (height / 4, height / 3)
    } else {
        band?
    };
    if top.checked_add(crop_height)? > height {
        return None;
    }
    let scale = if kind == Kind::QuickSfv && width <= 1000 {
        4
    } else if width <= 700 {
        3
    } else {
        2
    };
    let padding = 12;
    let out_width = width.checked_mul(scale)?.checked_add(padding * 2)?;
    let out_height = crop_height.checked_mul(scale)?.checked_add(padding * 2)?;
    if out_width * out_height > 1_200_000 {
        return None;
    }
    let mut image = format!("P6\n{out_width} {out_height}\n255\n").into_bytes();
    image.reserve((out_width * out_height * 3) as usize);
    for y in 0..out_height {
        for x in 0..out_width {
            if x < padding || y < padding || x >= out_width - padding || y >= out_height - padding {
                image.extend_from_slice(&[255; 3]);
                continue;
            }
            let sample = |sx: u32, sy: u32| -> Option<f64> {
                // The captured QuickSFV frame has a one-pixel vertical border
                // touching its first label. Exclude the frame, not text glyphs.
                if kind == Kind::QuickSfv && (sx == 0 || sx >= width - 1) {
                    return Some(240.0);
                }
                let source = ((sy.min(height - 1) * width + sx.min(width - 1)) * 4) as usize;
                let pixel = pixels.get(source..source + 3)?;
                Some(
                    (29.0 * f64::from(pixel[0])
                        + 150.0 * f64::from(pixel[1])
                        + 77.0 * f64::from(pixel[2]))
                        / 256.0,
                )
            };
            let sx = ((x - padding) as f64 + 0.5) / f64::from(scale) - 0.5;
            let sy = ((y - padding) as f64 + 0.5) / f64::from(scale) - 0.5 + f64::from(top);
            let left = sx.max(0.0).floor() as u32;
            let upper = sy.max(0.0).floor() as u32;
            let fx = sx.max(0.0).fract();
            let fy = sy.max(0.0).fract();
            let grey = ((sample(left, upper)? * (1.0 - fx) + sample(left + 1, upper)? * fx)
                * (1.0 - fy)
                + (sample(left, upper + 1)? * (1.0 - fx) + sample(left + 1, upper + 1)? * fx) * fy)
                .round() as u8;
            image.extend_from_slice(&[grey; 3]);
        }
    }
    Some(image)
}

fn recognize(image: &[u8]) -> Option<String> {
    use std::os::windows::process::CommandExt;
    let mut process = Command::new(executable()?)
        .args(["stdin", "stdout", "--psm", "6", "-l", "eng", "tsv"])
        .env("OMP_THREAD_LIMIT", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .creation_flags(0x08000000 | 0x00004000)
        .spawn()
        .ok()?; // no window, below-normal priority
    let mut input = process.stdin.take()?;
    let image = image.to_vec();
    let writer = std::thread::spawn(move || input.write_all(&image));
    let mut output = process.stdout.take()?;
    let reader = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = output.by_ref().take(64 * 1024).read_to_string(&mut text);
        text
    });
    let deadline = Instant::now() + Duration::from_millis(1500);
    let success = loop {
        match process.try_wait() {
            Ok(Some(status)) => break status.success(),
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(15)),
            _ => {
                let _ = process.kill();
                let _ = process.wait();
                break false;
            }
        }
    };
    let _ = writer.join();
    let text = reader.join().ok()?;
    success.then_some(text)
}

#[derive(Default)]
struct Line {
    words: Vec<(String, f32)>,
    y: u32,
}
fn clock(text: &str) -> Option<u64> {
    let values: Vec<_> = text
        .split(':')
        .map(str::parse::<u64>)
        .collect::<Result<_, _>>()
        .ok()?;
    match values.as_slice() {
        [h, m, s] if *h < 1000 && *m < 60 && *s < 60 => Some(h * 3600 + m * 60 + s),
        _ => None,
    }
}
fn labeled_clock(words: &[(String, f32)], labels: &[&[&str]]) -> Option<u64> {
    for label in labels {
        for start in 0..words.len().saturating_sub(label.len()) {
            if words[start..start + label.len()].iter().zip(*label).all(
                |((word, confidence), label)| {
                    *confidence >= 70.0 && word.trim_end_matches(':').eq_ignore_ascii_case(label)
                },
            ) {
                let (word, confidence) = &words[start + label.len()];
                if *confidence >= 85.0 {
                    return clock(word);
                }
            }
        }
    }
    None
}
fn parse_tsv(tsv: &str, destination: &Path, kind: Kind) -> Reading {
    let mut lines: HashMap<(u32, u32, u32), Line> = HashMap::new();
    for row in tsv.lines().take(300) {
        let fields: Vec<_> = row.splitn(12, '\t').collect();
        if fields.len() != 12 || fields[0] != "5" || fields[11].len() > 400 {
            continue;
        }
        let numbers: Option<Vec<u32>> = fields[1..10].iter().map(|v| v.parse().ok()).collect();
        let Some(numbers) = numbers else {
            continue;
        };
        let Ok(confidence) = fields[10].parse::<f32>() else {
            continue;
        };
        let line = lines
            .entry((numbers[1], numbers[2], numbers[3]))
            .or_default();
        line.y = numbers[6];
        line.words.push((fields[11].to_owned(), confidence));
    }
    let mut rows: Vec<_> = lines.into_values().collect();
    rows.sort_by_key(|line| line.y);
    let mut result = Reading {
        observed_at: super::now(),
        ..Default::default()
    };
    let mut summary = String::new();
    let mut file_lookups = 0;
    for line in rows {
        let text = line
            .words
            .iter()
            .map(|(word, _)| word.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        let lower = text.to_ascii_lowercase();
        if kind == Kind::QuickSfv {
            // Only the printed summary, never a per-file percentage or a list row.
            if ["completed files", "ok:", "bad:", "missing:"]
                .iter()
                .any(|label| lower.contains(label))
            {
                // Low-confidence per-file percentages are irrelevant. Critical
                // labels/counts still have to survive intact for the parser.
                summary.push_str(
                    &line
                        .words
                        .iter()
                        .map(|(word, confidence)| {
                            if *confidence >= 80.0 {
                                word.to_ascii_lowercase()
                            } else {
                                "?".into()
                            }
                        })
                        .collect::<Vec<_>>()
                        .join(" "),
                );
                summary.push(' ');
            }
            continue;
        }
        result.elapsed = labeled_clock(&line.words, &[&["elapsed", "time"], &["time", "elapsed"]])
            .or(result.elapsed);
        result.remaining = labeled_clock(
            &line.words,
            &[
                &["time", "left"],
                &["time", "remaining"],
                &["remaining", "time"],
            ],
        )
        .or(result.remaining);
        if file_lookups < 4
            && !text.contains(':')
            && text.contains('.')
            && !text.contains("...")
            && text.len() <= 300
        {
            // OCR path repairs are limited to a known separator/glyph confusion and
            // a real destination file; arbitrary digit substitutions are not accepted.
            file_lookups += 1;
            result.file = resolve_file(destination, &text).or(result.file);
        }
    }
    if kind == Kind::QuickSfv {
        result.verification = verification_summary(&summary);
    }
    result
}

fn verification_summary(text: &str) -> Option<super::SetupVerification> {
    fn number(text: &str) -> Option<u64> {
        text.trim_start()
            .chars()
            .take_while(char::is_ascii_digit)
            .collect::<String>()
            .parse()
            .ok()
    }
    fn after(text: &str, label: &str) -> Option<u64> {
        number(text.split_once(label)?.1)
    }
    let completed = text.split_once("completed files:")?.1.trim_start();
    let checked_files = number(completed)?;
    let total_files = number(completed.split_once('/')?.1)?;
    let bad_files = after(text, "bad:")?;
    let missing_files = after(text, "missing:")?;
    let ok_files = after(text, "ok:")?;
    if total_files == 0
        || total_files > 10_000_000
        || checked_files > total_files
        || ok_files
            .checked_add(bad_files)?
            .checked_add(missing_files)?
            != checked_files
    {
        return None;
    }
    Some(super::SetupVerification {
        checked_files,
        total_files,
        bad_files,
        missing_files,
    })
}
fn resolve_file(root: &Path, text: &str) -> Option<String> {
    let root = super::plain_path(root).ok()?;
    let mut directory = root.clone();
    let mut relative = PathBuf::new();
    let mut remaining = text.trim_matches([' ', '\'', '"']).to_ascii_lowercase();
    for _ in 0..6 {
        let guarded = super::plain_path(&directory).ok()?;
        if !guarded.starts_with(&root) {
            return None;
        }
        let entries: Vec<_> = fs::read_dir(&guarded)
            .ok()?
            .take(513)
            .collect::<Result<_, _>>()
            .ok()?;
        if entries.len() > 512 {
            return None;
        }
        let mut exact = None;
        let mut next = None;
        for entry in entries {
            let metadata = fs::symlink_metadata(entry.path()).ok()?;
            if super::linked(&metadata) {
                continue;
            }
            let name = entry.file_name().to_string_lossy().into_owned();
            let lower = name.to_ascii_lowercase();
            if metadata.is_file() && remaining == lower {
                if exact.is_some() {
                    return None;
                }
                exact = Some(name.clone());
            }
            if metadata.is_dir() && remaining.starts_with(&lower) {
                if next.is_some() {
                    return None;
                }
                next = Some((name, lower.len()));
            }
        }
        if let Some(name) = exact {
            return Some(relative.join(name).to_string_lossy().into_owned());
        }
        let (name, length) = next?;
        let suffix = &remaining[length..];
        remaining = if let Some(rest) = suffix.strip_prefix('v') {
            // Tesseract reads the sequence "\\l" as V in this Inno layout.
            format!("l{rest}")
        } else {
            suffix.trim_start_matches(['\\', '/']).to_owned()
        };
        directory.push(&name);
        relative.push(name);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn repeated_readings_expire_with_visibility_and_do_not_cross_windows() {
        let target = Target {
            window: 12,
            pid: 34,
            created: 56,
            destination: PathBuf::new(),
            kind: Kind::QuickSfv,
            text_band: None,
        };
        let key = (target.window, target.pid, target.created, target.kind);
        let value = Reading {
            verification: Some(super::super::SetupVerification {
                checked_files: 36,
                total_files: 303,
                bad_files: 0,
                missing_files: 0,
            }),
            ..Default::default()
        };
        let mut client = Client::new();
        client.last_request = Instant::now();
        *client.output.lock().unwrap() = Some(Completed {
            reading: value.clone(),
            at: Instant::now() - Duration::from_secs(2),
            cost: Duration::ZERO,
            key,
        });
        assert!(client
            .sample(target.clone(), true)
            .unwrap()
            .verification
            .is_none());
        *client.output.lock().unwrap() = Some(Completed {
            reading: value,
            at: Instant::now(),
            cost: Duration::ZERO,
            key,
        });
        assert_eq!(
            client
                .sample(target.clone(), true)
                .unwrap()
                .verification
                .unwrap()
                .checked_files,
            36
        );
        assert!(client.sample(target.clone(), false).is_none());
        client.accepted.as_mut().unwrap().1 = Instant::now() - FRESH;
        assert!(client.sample(target.clone(), true).is_none());
        let mut other = target;
        other.window += 1;
        assert!(client.sample(other, true).is_none());
    }
    fn tsv(lines: &[&str]) -> String {
        lines
            .iter()
            .enumerate()
            .flat_map(|(line, text)| {
                text.split_whitespace()
                    .enumerate()
                    .map(move |(word, text)| {
                        format!(
                            "5\t1\t1\t1\t{}\t{}\t{}\t{}\t40\t20\t96\t{text}\n",
                            line + 1,
                            word + 1,
                            word * 50,
                            line * 30
                        )
                    })
            })
            .collect()
    }
    #[test]
    fn clocks_use_their_own_labels_even_on_one_line() {
        let result = parse_tsv(
            &tsv(&["Elapsed time: 01:08:45 Time left: 00:17:27"]),
            Path::new("X:/missing"),
            Kind::Inno,
        );
        assert_eq!(result.elapsed, Some(4125));
        assert_eq!(result.remaining, Some(1047));
        let unlabeled = parse_tsv(
            &tsv(&["74.1% 01:08:45"]),
            Path::new("X:/missing"),
            Kind::Inno,
        );
        assert!(unlabeled.elapsed.is_none() && unlabeled.remaining.is_none());
    }
    #[test]
    fn checker_summary_is_not_per_file_progress() {
        let result = parse_tsv(
            &tsv(&[
                "Completed Files: 36/303 (File:7%) Bad: 0",
                "Ok: 36 Missing: 0",
            ]),
            Path::new("X:/missing"),
            Kind::QuickSfv,
        );
        let counts = result.verification.unwrap();
        assert_eq!(counts.checked_files, 36);
        assert_eq!(counts.total_files, 303);
        let noisy_file = tsv(&[
            "Completed Files: 36/303 (File:7%) Bad: 0",
            "Ok: 36 Missing: 0",
        ])
        .replace("\t96\t(File:7%)", "\t25\t(File:7%)");
        assert_eq!(
            parse_tsv(&noisy_file, Path::new("X:/missing"), Kind::QuickSfv)
                .verification
                .unwrap()
                .checked_files,
            36
        );
        assert!(
            verification_summary("completed files: 37/303 (file:7%) ok:36 bad:0 missing:0")
                .is_none()
        );
        assert!(verification_summary("completed files: 304/303 ok:304 bad:0 missing:0").is_none());
        assert_eq!(
            verification_summary("completed files: 303/303 ok:301 bad:1 missing:1")
                .unwrap()
                .bad_files,
            1
        );
    }
    #[test]
    fn low_confidence_fields_are_not_reported() {
        let result = parse_tsv(
            &tsv(&["Elapsed time: 01:08:45 Time left: 00:17:27"])
                .replace("\t96\t00:17:27", "\t25\t00:17:27"),
            Path::new("X:/missing"),
            Kind::Inno,
        );
        assert_eq!(result.elapsed, Some(4125));
        assert!(result.remaining.is_none());
    }
    #[test]
    fn path_repair_never_guesses_numbered_files_or_truncated_directories() {
        let root = std::env::temp_dir().join(format!(
            "harbor-ocr-{}-{}",
            std::process::id(),
            super::super::now()
        ));
        let data = root.join("Game_Data");
        fs::create_dir_all(&data).unwrap();
        fs::write(data.join("level8.resS"), b"").unwrap();
        fs::write(data.join("level7.resS"), b"").unwrap();
        assert_eq!(
            resolve_file(&root, "Game_DataVevel8.ress"),
            Some("Game_Data\\level8.resS".into())
        );
        assert!(resolve_file(&root, "Game_Data\\level9.resS").is_none());
        assert!(resolve_file(&root, "..\\outside.exe").is_none());
        for i in 0..513 {
            fs::write(data.join(format!("extra{i}")), b"").unwrap();
        }
        assert!(resolve_file(&root, "Game_Data\\level8.resS").is_none());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    #[ignore = "requires a local read-only BGRA capture supplied by HARBOREVIDENCE"]
    fn recognizes_actual_checker_capture() {
        let source = fs::read(std::env::var_os("HARBOREVIDENCE").expect("capture path")).unwrap();
        let width = u32::from_le_bytes(source[0..4].try_into().unwrap());
        let height = u32::from_le_bytes(source[4..8].try_into().unwrap());
        let started = Instant::now();
        let image = crop_text(&source[8..], width, height, Kind::QuickSfv, Some((51, 34))).unwrap();
        if let Some(output) = std::env::var_os("HARBOR_OCR_PPM") {
            fs::write(output, &image).unwrap();
        }
        let text = recognize(&image).expect("installed engine");
        if let Some(output) = std::env::var_os("HARBOR_OCR_TSV") {
            fs::write(output, &text).unwrap();
        }
        let result = parse_tsv(&text, Path::new("W:/AI-Workspace-Codex"), Kind::QuickSfv);
        eprintln!(
            "actual captured header OCR: {:?}; total {}ms",
            result.verification,
            started.elapsed().as_millis()
        );
        assert_eq!(
            result.verification,
            Some(super::super::SetupVerification {
                checked_files: 38,
                total_files: 303,
                bad_files: 0,
                missing_files: 0
            })
        );
    }
}
