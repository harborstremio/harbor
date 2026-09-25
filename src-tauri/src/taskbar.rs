#![cfg(target_os = "windows")]

use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU32, Ordering};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter, Manager};
use windows::core::PCWSTR;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};
use windows::Win32::UI::Shell::{
    DefSubclassProc, ITaskbarList3, SetWindowSubclass, TaskbarList, THUMBBUTTON, THUMBBUTTONMASK,
    THBF_ENABLED, THBN_CLICKED, THB_FLAGS, THB_ICON, THB_TOOLTIP,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateIconFromResourceEx, PostMessageW, RegisterWindowMessageW, HICON, LR_DEFAULTCOLOR, WM_APP,
    WM_COMMAND,
};

const SUBCLASS_ID: usize = 0x4842_5442;
const WM_SYNC: u32 = WM_APP + 0x42;
const NEVER_APPLIED: u32 = u32::MAX;
pub const EVENT: &str = "harbor://taskbar-button";

const ID_FAV: u32 = 1;
const ID_BACK: u32 = 2;
const ID_PREV: u32 = 3;
const ID_TOGGLE: u32 = 4;
const ID_NEXT: u32 = 5;
const ID_FWD: u32 = 6;
const ID_MUTE: u32 = 7;

const ICO_FAV: &[u8] = include_bytes!("../icons/thumbbar/fav.ico");
const ICO_BACK: &[u8] = include_bytes!("../icons/thumbbar/back.ico");
const ICO_PREV: &[u8] = include_bytes!("../icons/thumbbar/prev.ico");
const ICO_PLAY: &[u8] = include_bytes!("../icons/thumbbar/play.ico");
const ICO_PAUSE: &[u8] = include_bytes!("../icons/thumbbar/pause.ico");
const ICO_NEXT: &[u8] = include_bytes!("../icons/thumbbar/next.ico");
const ICO_FWD: &[u8] = include_bytes!("../icons/thumbbar/fwd.ico");
const ICO_MUTE: &[u8] = include_bytes!("../icons/thumbbar/mute.ico");

static HANDLE: OnceLock<AppHandle> = OnceLock::new();
static HWND_RAW: AtomicIsize = AtomicIsize::new(0);
static ADDED: AtomicBool = AtomicBool::new(false);
static BUTTON_CREATED_MSG: AtomicU32 = AtomicU32::new(0);
static WANT_PLAYING: AtomicBool = AtomicBool::new(false);
static WANT_LIKED: AtomicBool = AtomicBool::new(false);
static APPLIED: AtomicU32 = AtomicU32::new(NEVER_APPLIED);

struct Bar(ITaskbarList3);
unsafe impl Send for Bar {}
unsafe impl Sync for Bar {}
static BAR: OnceLock<Bar> = OnceLock::new();

struct Icons([HICON; 8]);
unsafe impl Send for Icons {}
unsafe impl Sync for Icons {}
static ICONS: OnceLock<Icons> = OnceLock::new();

/// An .ico is a 6 byte ICONDIR then one 16 byte ICONDIRENTRY per image, and the
/// entry's trailing dword is where that image starts. Reading it beats assuming
/// 22, which only holds for a single image file.
fn icon(bytes: &'static [u8]) -> HICON {
    if bytes.len() < 22 {
        return HICON::default();
    }
    let offset = u32::from_le_bytes([bytes[18], bytes[19], bytes[20], bytes[21]]) as usize;
    let start = if offset > 0 && offset < bytes.len() { offset } else { 22 };
    unsafe {
        CreateIconFromResourceEx(&bytes[start..], true, 0x0003_0000, 16, 16, LR_DEFAULTCOLOR)
            .unwrap_or_default()
    }
}

fn icons() -> &'static Icons {
    ICONS.get_or_init(|| {
        Icons([
            icon(ICO_FAV),
            icon(ICO_BACK),
            icon(ICO_PREV),
            icon(ICO_PLAY),
            icon(ICO_PAUSE),
            icon(ICO_NEXT),
            icon(ICO_FWD),
            icon(ICO_MUTE),
        ])
    })
}

fn utf16(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

fn label(text: &str) -> [u16; 260] {
    let mut buf = [0u16; 260];
    for (slot, unit) in buf.iter_mut().zip(text.encode_utf16().take(259)) {
        *slot = unit;
    }
    buf
}

fn button(id: u32, ico: HICON, tip: &str) -> THUMBBUTTON {
    THUMBBUTTON {
        dwMask: THUMBBUTTONMASK(THB_ICON.0 | THB_TOOLTIP.0 | THB_FLAGS.0),
        iId: id,
        iBitmap: 0,
        hIcon: ico,
        szTip: label(tip),
        dwFlags: THBF_ENABLED,
    }
}

fn buttons(playing: bool, liked: bool) -> [THUMBBUTTON; 7] {
    let ico = icons();
    [
        button(ID_FAV, ico.0[0], if liked { "Remove from liked" } else { "Like" }),
        button(ID_BACK, ico.0[1], "Back 30 seconds"),
        button(ID_PREV, ico.0[2], "Previous"),
        button(
            ID_TOGGLE,
            if playing { ico.0[4] } else { ico.0[3] },
            if playing { "Pause" } else { "Play" },
        ),
        button(ID_NEXT, ico.0[5], "Next"),
        button(ID_FWD, ico.0[6], "Forward 30 seconds"),
        button(ID_MUTE, ico.0[7], "Mute"),
    ]
}

/// Must run on the thread that owns the window: that is the apartment the
/// ITaskbarList3 was created in, and the only place the shell accepts it.
fn apply() {
    let Some(bar) = BAR.get() else {
        return;
    };
    let raw = HWND_RAW.load(Ordering::Relaxed);
    if raw == 0 {
        return;
    }
    let hwnd = HWND(raw as *mut std::ffi::c_void);
    let playing = WANT_PLAYING.load(Ordering::Relaxed);
    let liked = WANT_LIKED.load(Ordering::Relaxed);
    let stamp = u32::from(playing) | (u32::from(liked) << 1);
    let added = ADDED.load(Ordering::Relaxed);
    if added && APPLIED.load(Ordering::Relaxed) == stamp {
        return;
    }
    let set = buttons(playing, liked);
    unsafe {
        if added {
            if bar.0.ThumbBarUpdateButtons(hwnd, &set).is_ok() {
                APPLIED.store(stamp, Ordering::Relaxed);
            }
        } else if bar.0.ThumbBarAddButtons(hwnd, &set).is_ok() {
            ADDED.store(true, Ordering::Relaxed);
            APPLIED.store(stamp, Ordering::Relaxed);
        }
    }
}

unsafe extern "system" fn subclass_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    _data: usize,
) -> LRESULT {
    if msg == WM_SYNC {
        apply();
        return LRESULT(0);
    }
    // The shell only takes buttons once it has made the taskbar button, and it
    // says so with this message. Harbor's window starts hidden, so at setup there
    // is nothing to attach to and every add before this point is rejected.
    let created = BUTTON_CREATED_MSG.load(Ordering::Relaxed);
    if created != 0 && msg == created {
        ADDED.store(false, Ordering::Relaxed);
        APPLIED.store(NEVER_APPLIED, Ordering::Relaxed);
        apply();
    }
    if msg == WM_COMMAND {
        let high = ((wparam.0 >> 16) & 0xffff) as u32;
        if high == THBN_CLICKED {
            let action = match (wparam.0 & 0xffff) as u32 {
                ID_FAV => Some("like"),
                ID_BACK => Some("back"),
                ID_PREV => Some("previous"),
                ID_TOGGLE => Some("toggle"),
                ID_NEXT => Some("next"),
                ID_FWD => Some("forward"),
                ID_MUTE => Some("mute"),
                _ => None,
            };
            if let Some(action) = action {
                if let Some(app) = HANDLE.get() {
                    let _ = app.emit(EVENT, action);
                }
                return LRESULT(0);
            }
        }
    }
    DefSubclassProc(hwnd, msg, wparam, lparam)
}

pub fn init(app: &AppHandle) {
    let _ = HANDLE.set(app.clone());
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(handle) = window.hwnd() else {
        return;
    };
    HWND_RAW.store(handle.0 as isize, Ordering::Relaxed);
    unsafe {
        let name = utf16("TaskbarButtonCreated");
        BUTTON_CREATED_MSG.store(
            RegisterWindowMessageW(PCWSTR(name.as_ptr())),
            Ordering::Relaxed,
        );
        let _ = SetWindowSubclass(handle, Some(subclass_proc), SUBCLASS_ID, 0);
        match CoCreateInstance::<_, ITaskbarList3>(&TaskbarList, None, CLSCTX_ALL) {
            Ok(bar) => {
                if bar.HrInit().is_ok() {
                    let _ = BAR.set(Bar(bar));
                    apply();
                }
            }
            Err(error) => eprintln!("[harbor::taskbar] taskbar list unavailable: {error}"),
        }
    }
}

/// Safe from any thread: it parks the wanted state and hands the COM work to the
/// window's own thread.
pub fn update(playing: bool, liked: bool) {
    WANT_PLAYING.store(playing, Ordering::Relaxed);
    WANT_LIKED.store(liked, Ordering::Relaxed);
    let raw = HWND_RAW.load(Ordering::Relaxed);
    if raw == 0 {
        return;
    }
    unsafe {
        let _ = PostMessageW(
            Some(HWND(raw as *mut std::ffi::c_void)),
            WM_SYNC,
            WPARAM(0),
            LPARAM(0),
        );
    }
}

/// The video player knows nothing about the music like state, so it leaves it
/// where the music page last put it instead of stamping it false.
pub fn set_playing(playing: bool) {
    update(playing, WANT_LIKED.load(Ordering::Relaxed));
}
