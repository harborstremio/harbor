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
    CreateIconFromResourceEx, DestroyIcon, GetSystemMetrics, PostMessageW, RegisterWindowMessageW,
    SendMessageW, HICON, ICON_BIG, ICON_SMALL, LR_DEFAULTCOLOR, SM_CXICON, SM_CXSMICON, WM_APP,
    WM_COMMAND, WM_SETICON,
};

const SUBCLASS_ID: usize = 0x4842_5442;
const WM_SYNC: u32 = WM_APP + 0x42;
const WM_ART: u32 = WM_APP + 0x43;
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
const ICO_SOUND: &[u8] = include_bytes!("../icons/thumbbar/sound.ico");
const ICO_FAV_OFF: &[u8] = include_bytes!("../icons/thumbbar/fav-off.ico");

static HANDLE: OnceLock<AppHandle> = OnceLock::new();
static HWND_RAW: AtomicIsize = AtomicIsize::new(0);
static ADDED: AtomicBool = AtomicBool::new(false);
static BUTTON_CREATED_MSG: AtomicU32 = AtomicU32::new(0);
static WANT_PLAYING: AtomicBool = AtomicBool::new(false);
static WANT_LIKED: AtomicBool = AtomicBool::new(false);
static WANT_MUTED: AtomicBool = AtomicBool::new(false);
static APPLIED: AtomicU32 = AtomicU32::new(NEVER_APPLIED);
static NEXT_SMALL: AtomicIsize = AtomicIsize::new(-1);
static NEXT_BIG: AtomicIsize = AtomicIsize::new(-1);
static OWNED_SMALL: AtomicIsize = AtomicIsize::new(0);
static OWNED_BIG: AtomicIsize = AtomicIsize::new(0);

struct Bar(ITaskbarList3);
unsafe impl Send for Bar {}
unsafe impl Sync for Bar {}
static BAR: OnceLock<Bar> = OnceLock::new();

struct Icons([HICON; 10]);
unsafe impl Send for Icons {}
unsafe impl Sync for Icons {}
static ICONS: OnceLock<Icons> = OnceLock::new();

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
            icon(ICO_SOUND),
            icon(ICO_FAV_OFF),
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

fn buttons(playing: bool, liked: bool, muted: bool) -> [THUMBBUTTON; 7] {
    let ico = icons();
    [
        button(
            ID_FAV,
            if liked { ico.0[0] } else { ico.0[9] },
            if liked { "Remove from liked" } else { "Like" },
        ),
        button(ID_BACK, ico.0[1], "Back 30 seconds"),
        button(ID_PREV, ico.0[2], "Previous"),
        button(
            ID_TOGGLE,
            if playing { ico.0[4] } else { ico.0[3] },
            if playing { "Pause" } else { "Play" },
        ),
        button(ID_NEXT, ico.0[5], "Next"),
        button(ID_FWD, ico.0[6], "Forward 30 seconds"),
        button(
            ID_MUTE,
            if muted { ico.0[7] } else { ico.0[8] },
            if muted { "Unmute" } else { "Mute" },
        ),
    ]
}

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
    let muted = WANT_MUTED.load(Ordering::Relaxed);
    let stamp = u32::from(playing) | (u32::from(liked) << 1) | (u32::from(muted) << 2);
    let added = ADDED.load(Ordering::Relaxed);
    if added && APPLIED.load(Ordering::Relaxed) == stamp {
        return;
    }
    let set = buttons(playing, liked, muted);
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
    if msg == WM_ART {
        apply_art(hwnd);
        return LRESULT(0);
    }
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

pub fn update(playing: bool, liked: bool, muted: bool) {
    WANT_PLAYING.store(playing, Ordering::Relaxed);
    WANT_LIKED.store(liked, Ordering::Relaxed);
    WANT_MUTED.store(muted, Ordering::Relaxed);
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

pub fn set_playing(playing: bool) {
    update(
        playing,
        WANT_LIKED.load(Ordering::Relaxed),
        WANT_MUTED.load(Ordering::Relaxed),
    );
}

fn hicon_from_rgba(rgba: &[u8], size: u32) -> Option<HICON> {
    let side = size as usize;
    if rgba.len() < side * side * 4 {
        return None;
    }
    let mask_stride = size.div_ceil(32) as usize * 4;
    let mut dib = Vec::with_capacity(40 + side * side * 4 + mask_stride * side);
    dib.extend_from_slice(&40u32.to_le_bytes());
    dib.extend_from_slice(&(size as i32).to_le_bytes());
    dib.extend_from_slice(&(size as i32 * 2).to_le_bytes());
    dib.extend_from_slice(&1u16.to_le_bytes());
    dib.extend_from_slice(&32u16.to_le_bytes());
    dib.extend_from_slice(&[0u8; 24]);
    for y in (0..side).rev() {
        for x in 0..side {
            let at = (y * side + x) * 4;
            dib.extend_from_slice(&[rgba[at + 2], rgba[at + 1], rgba[at], rgba[at + 3]]);
        }
    }
    dib.resize(dib.len() + mask_stride * side, 0);
    unsafe {
        CreateIconFromResourceEx(
            &dib,
            true,
            0x0003_0000,
            size as i32,
            size as i32,
            LR_DEFAULTCOLOR,
        )
        .ok()
    }
}

fn swap(slot: &AtomicIsize, next: HICON) -> HICON {
    HICON(slot.swap(next.0 as isize, Ordering::Relaxed) as *mut std::ffi::c_void)
}

fn apply_art(hwnd: HWND) {
    for (slot, which, owned) in [
        (&NEXT_SMALL, ICON_SMALL, &OWNED_SMALL),
        (&NEXT_BIG, ICON_BIG, &OWNED_BIG),
    ] {
        let pending = slot.swap(-1, Ordering::Relaxed);
        if pending == -1 {
            continue;
        }
        let icon = HICON(pending as *mut std::ffi::c_void);
        unsafe {
            SendMessageW(
                hwnd,
                WM_SETICON,
                Some(WPARAM(which as usize)),
                Some(LPARAM(pending)),
            );
        }
        let previous = swap(owned, icon);
        if !previous.is_invalid() {
            unsafe {
                let _ = DestroyIcon(previous);
            }
        }
    }
}

fn post_art(small: Option<HICON>, big: Option<HICON>) {
    let raw = HWND_RAW.load(Ordering::Relaxed);
    if raw == 0 {
        return;
    }
    if let Some(icon) = small {
        NEXT_SMALL.store(icon.0 as isize, Ordering::Relaxed);
    }
    if let Some(icon) = big {
        NEXT_BIG.store(icon.0 as isize, Ordering::Relaxed);
    }
    unsafe {
        let _ = PostMessageW(
            Some(HWND(raw as *mut std::ffi::c_void)),
            WM_ART,
            WPARAM(0),
            LPARAM(0),
        );
    }
}

fn icon_sizes() -> (u32, u32) {
    let (small, big) = unsafe {
        (
            GetSystemMetrics(SM_CXSMICON).max(16) as u32,
            GetSystemMetrics(SM_CXICON).max(32) as u32,
        )
    };
    (small.max(32), big.max(64))
}

pub fn set_artwork(url: Option<String>, app_icon: bool) {
    let wanted = url.filter(|value| value.starts_with("https://")).filter(|_| app_icon);
    let Some(url) = wanted else {
        post_art(Some(HICON::default()), Some(HICON::default()));
        return;
    };
    let (small_px, big_px) = icon_sizes();
    tauri::async_runtime::spawn(async move {
        let Ok(response) = reqwest::get(&url).await else {
            return;
        };
        let Ok(bytes) = response.bytes().await else {
            return;
        };
        let Ok(decoded) = image::load_from_memory(&bytes) else {
            return;
        };
        let scaled = decoded.resize_exact(small_px, small_px, image::imageops::FilterType::Lanczos3);
        let small = hicon_from_rgba(scaled.to_rgba8().as_raw(), small_px);
        let big = if app_icon {
            let large = decoded.resize_exact(big_px, big_px, image::imageops::FilterType::Lanczos3);
            hicon_from_rgba(large.to_rgba8().as_raw(), big_px)
        } else {
            None
        };
        if small.is_some() || big.is_some() {
            post_art(small, big);
        }
    });
}
