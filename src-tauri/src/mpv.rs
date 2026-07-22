use std::collections::HashMap;
use std::ffi::CString;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use libmpv2::events::{Event, EventContext, PropertyData};
use libmpv2::mpv_node::MpvNode;
use libmpv2::{Format, Mpv, MpvInitializer};

fn mpv_argv_command(mpv: &Mpv, argv: &[&str]) -> Result<(), String> {
    let cstrings: Vec<CString> = argv
        .iter()
        .map(|s| CString::new(*s).map_err(|e| format!("cstring: {}", e)))
        .collect::<Result<Vec<_>, _>>()?;
    let mut ptrs: Vec<*const std::os::raw::c_char> = cstrings.iter().map(|c| c.as_ptr()).collect();
    ptrs.push(std::ptr::null());
    let rc = unsafe { libmpv2_sys::mpv_command(mpv.ctx.as_ptr(), ptrs.as_mut_ptr()) };
    if rc < 0 {
        return Err(format!("mpv_command rc={}", rc));
    }
    Ok(())
}
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::Manager;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct MpvProbe {
    pub available: bool,
    pub binary: Option<String>,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MpvStartArgs {
    pub url: String,
    pub start_at_sec: Option<f64>,
    pub subtitles: Option<Vec<MpvSub>>,
    pub anime4k: Option<bool>,
    pub hdr_to_sdr: Option<bool>,
    pub rtx_hdr: Option<bool>,
    pub embed: Option<bool>,
    pub anime4k_shaders: Option<Vec<String>>,
    pub d3d11_flip: Option<bool>,
    pub mac_edr: Option<bool>,
    pub is_live: Option<bool>,
    pub headers: Option<HashMap<String, String>>,
    pub extra_options: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MpvGeometry {
    pub css_left: f64,
    pub css_top: f64,
    pub css_width: f64,
    pub css_height: f64,
    pub css_view_w: f64,
    pub css_view_h: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
#[cfg_attr(not(any(windows, test)), allow(dead_code))]
pub(crate) struct NativeMpvRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[cfg_attr(not(any(windows, test)), allow(dead_code))]
pub(crate) fn map_css_geometry(
    css: &MpvGeometry,
    native_width: f64,
    native_height: f64,
) -> NativeMpvRect {
    let full_surface = NativeMpvRect {
        x: 0.0,
        y: 0.0,
        width: native_width,
        height: native_height,
    };
    if !css.css_left.is_finite()
        || !css.css_top.is_finite()
        || !css.css_width.is_finite()
        || !css.css_height.is_finite()
        || !css.css_view_w.is_finite()
        || !css.css_view_h.is_finite()
        || css.css_width <= 0.0
        || css.css_height <= 0.0
        || css.css_view_w <= 0.0
        || css.css_view_h <= 0.0
    {
        return full_surface;
    }

    let scale_x = native_width / css.css_view_w;
    let scale_y = native_height / css.css_view_h;
    let mut x = css.css_left * scale_x;
    let mut y = css.css_top * scale_y;
    let mut width = css.css_width * scale_x;
    let mut height = css.css_height * scale_y;

    if css.css_left.abs() <= 2.0 {
        width += x;
        x = 0.0;
    }
    if css.css_top.abs() <= 2.0 {
        height += y;
        y = 0.0;
    }
    if css.css_left + css.css_width >= css.css_view_w - 2.0 {
        width = native_width - x;
    }
    if css.css_top + css.css_height >= css.css_view_h - 2.0 {
        height = native_height - y;
    }

    x = x.clamp(0.0, (native_width - 1.0).max(0.0));
    y = y.clamp(0.0, (native_height - 1.0).max(0.0));
    width = width.clamp(1.0, (native_width - x).max(1.0));
    height = height.clamp(1.0, (native_height - y).max(1.0));

    NativeMpvRect {
        x,
        y,
        width,
        height,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MpvSub {
    pub url: String,
    pub lang: Option<String>,
}

pub struct MpvState {
    inner: Arc<Mutex<Option<MpvSession>>>,
}

struct MpvSession {
    mpv: Arc<Mpv>,
    #[cfg(any(windows, target_os = "linux"))]
    embedded: bool,
}

impl MpvState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
        }
    }
}

const OBSERVED_PROPS: &[(&str, u64, PropertyKind)] = &[
    ("time-pos", 1, PropertyKind::Double),
    ("duration", 2, PropertyKind::Double),
    ("pause", 3, PropertyKind::Flag),
    ("eof-reached", 4, PropertyKind::Flag),
    ("track-list", 5, PropertyKind::Node),
    ("volume", 6, PropertyKind::Double),
    ("mute", 7, PropertyKind::Flag),
    ("chapter-list", 8, PropertyKind::Node),
    ("sub-delay", 9, PropertyKind::Double),
    ("audio-delay", 10, PropertyKind::Double),
    ("sub-text", 11, PropertyKind::String),
    ("sub-start", 12, PropertyKind::Double),
    ("af", 13, PropertyKind::String),
    ("dwidth", 14, PropertyKind::Int64),
    ("dheight", 15, PropertyKind::Int64),
    ("video-params/gamma", 16, PropertyKind::String),
    ("demuxer-cache-duration", 17, PropertyKind::Double),
    ("paused-for-cache", 18, PropertyKind::Flag),
];

#[derive(Clone, Copy)]
enum PropertyKind {
    Double,
    Flag,
    Int64,
    String,
    Node,
}

impl PropertyKind {
    fn fmt(&self) -> Format {
        match self {
            PropertyKind::Double => Format::Double,
            PropertyKind::Flag => Format::Flag,
            PropertyKind::Int64 => Format::Int64,
            PropertyKind::String => Format::String,
            PropertyKind::Node => Format::Node,
        }
    }
}

#[cfg(unix)]
fn force_c_numeric_locale() {
    unsafe {
        libc::setlocale(libc::LC_NUMERIC, b"C\0".as_ptr() as *const libc::c_char);
    }
}

#[cfg(not(unix))]
fn force_c_numeric_locale() {}

#[tauri::command]
pub async fn mpv_probe(_app: AppHandle) -> MpvProbe {
    force_c_numeric_locale();
    match Mpv::new() {
        Ok(mpv) => {
            let version = mpv
                .get_property::<String>("mpv-version")
                .ok()
                .or_else(|| Some("libmpv (embedded)".to_string()));
            MpvProbe {
                available: true,
                binary: Some("embedded libmpv".into()),
                version,
                error: None,
            }
        }
        Err(e) => MpvProbe {
            available: false,
            binary: None,
            version: None,
            error: Some(format!("libmpv init failed: {}", e)),
        },
    }
}

pub(crate) fn supports_vapoursynth_filter() -> bool {
    force_c_numeric_locale();
    Mpv::new()
        .and_then(|mpv| mpv.set_property("vf", "vapoursynth"))
        .is_ok()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioDevice {
    pub name: String,
    pub description: String,
}

fn read_audio_devices(mpv: &Mpv) -> Vec<AudioDevice> {
    let node = match mpv.get_property::<MpvNode>("audio-device-list") {
        Ok(n) => n,
        Err(_) => return Vec::new(),
    };
    let mut out = Vec::new();
    if let Some(arr) = node.array() {
        for item in arr {
            let mut name = String::new();
            let mut description = String::new();
            if let Some(map) = item.map() {
                for (k, v) in map {
                    match k.as_str() {
                        "name" => name = v.str().unwrap_or_default().to_string(),
                        "description" => description = v.str().unwrap_or_default().to_string(),
                        _ => {}
                    }
                }
            }
            if !name.is_empty() && name != "auto" {
                out.push(AudioDevice { name, description });
            }
        }
    }
    out
}

#[tauri::command]
pub async fn mpv_audio_devices(state: State<'_, MpvState>) -> Result<Vec<AudioDevice>, String> {
    let existing = {
        let g = state.inner.lock().await;
        g.as_ref().map(|s| s.mpv.clone())
    };
    if let Some(mpv) = existing {
        return Ok(read_audio_devices(&mpv));
    }
    force_c_numeric_locale();
    let mpv = Mpv::new().map_err(|e| format!("mpv init: {}", e))?;
    Ok(read_audio_devices(&mpv))
}

fn apply_pre_init(
    init: &MpvInitializer,
    args: &MpvStartArgs,
    embed_hwnd: Option<&str>,
) -> Result<(), String> {
    let rtx_hdr = cfg!(windows) && args.rtx_hdr.unwrap_or(false);
    // Property sets here are best-effort. Some builds of mpv (e.g. Flatpak's
    // meson build without Lua) omit optional properties like `osc`. Treat
    // PROPERTY_NOT_FOUND as non-fatal so the player still initializes.
    let set = |k: &str, v: &str| {
        if let Err(e) = init.set_property(k, v) {
            eprintln!("[harbor::mpv] pre-init skip {}={}: {}", k, v, e);
        }
    };
    set("title", "Harbor");
    set("audio-client-name", "Harbor");
    set("terminal", "no");
    set("msg-level", "all=warn,vo=v,d3d11=v,gpu=v,win32=v");
    let mut user_agent = "VLC/3.0.20 LibVLC/3.0.20".to_string();
    let mut header_fields: Vec<String> = Vec::new();
    if let Some(headers) = &args.headers {
        for (k, v) in headers {
            if k.eq_ignore_ascii_case("user-agent") {
                user_agent = v.clone();
            } else {
                header_fields.push(format!("{}: {}", k, v));
            }
        }
    }
    set("user-agent", &user_agent);
    if !header_fields.is_empty() {
        set("http-header-fields", &header_fields.join(","));
    }
    let on_mac_embed = cfg!(target_os = "macos") && embed_hwnd.is_some();
    if on_mac_embed {
        set("hwdec", "videotoolbox-copy");
        set("force-window", "no");
    } else if cfg!(target_os = "linux") {
        set("hwdec", "auto-safe");
        if args.embed.unwrap_or(false) {
            set("force-window", "no");
        } else {
            set("force-window", "yes");
        }
    } else if cfg!(windows) {
        set("hwdec", if rtx_hdr { "d3d11va" } else { "auto" });
        set("force-window", "immediate");
    } else {
        set("hwdec", "auto");
        set("force-window", "immediate");
    }
    if args.embed.unwrap_or(false) && (cfg!(target_os = "macos") || cfg!(target_os = "linux")) {
        // libmpv normally wakes the render callback ahead of the target
        // presentation time and blocks inside render() until that time. Both
        // platform render APIs run on the application UI thread, so that wait
        // also stalls the WebKit overlay. Wake at the target time instead.
        set("video-timing-offset", "0");
    }
    set("input-default-bindings", "no");
    set("input-media-keys", "no");
    set("input-cursor", "no");
    // `osc` is provided by mpv's optional on-screen-controller script. Some
    // libmpv builds, including the Flatpak build, do not ship that script, so
    // its option is unavailable. Harbor supplies its own controls either way.
    let _ = set("osc", "no");
    set("osd-level", "0");
    set("cursor-autohide", "200");
    set("volume-max", "600");
    let _ = init.set_property("background-color", "#000000");
    let _ = init.set_property("background", "color");
    let _ = init.set_property("media-controls", "yes");

    if let Some(hwnd) = embed_hwnd {
        #[cfg(windows)]
        {
            let hwnd_i64: i64 = hwnd
                .parse()
                .map_err(|e| format!("parse wid {}: {}", hwnd, e))?;
            init.set_property("wid", hwnd_i64)
                .map_err(|e| format!("set wid={}: {}", hwnd_i64, e))?;
            if args.d3d11_flip.unwrap_or(false) && args.hdr_to_sdr.unwrap_or(false) {
                set("d3d11-flip", "no");
            }
        }
        #[cfg(not(windows))]
        {
            let _ = hwnd;
        }
    } else if !args.embed.unwrap_or(false) {
        set("ontop", "yes");
        set("border", "no");
    }

    let opt = |k: &str, v: &str| {
        let _ = init.set_property(k, v);
    };
    if args.hdr_to_sdr.unwrap_or(false) && !rtx_hdr {
        opt("tone-mapping", "spline");
        opt("gamut-mapping-mode", "perceptual");
        opt("hdr-compute-peak", "yes");
        opt("hdr-contrast-recovery", "0.30");
        opt("hdr-peak-percentile", "99.995");
        opt("dither-depth", "auto");
        opt("target-trc", "bt.1886");
        opt("target-prim", "bt.709");
        #[cfg(any(windows, target_os = "macos"))]
        opt("target-colorspace-hint", "yes");
    } else {
        #[cfg(windows)]
        {
            opt("target-colorspace-hint", "yes");
            if embed_hwnd.is_some() || rtx_hdr {
                opt("gpu-api", "d3d11");
            }
        }
        #[cfg(target_os = "macos")]
        {
            opt("target-colorspace-hint", "yes");
        }
    }

    if let Some(shaders) = &args.anime4k_shaders {
        let cleaned: Vec<&str> = shaders
            .iter()
            .filter(|s| !s.is_empty())
            .map(|s| s.as_str())
            .collect();
        if !cleaned.is_empty() {
            let sep = if cfg!(windows) { ";" } else { ":" };
            let joined = cleaned.join(sep);
            opt("glsl-shaders", &joined);
        }
    }

    if let Some(start) = args.start_at_sec {
        if start > 0.0 {
            set("start", &format!("{}", start));
        }
    }
    Ok(())
}

fn apply_extra_mpv_options(mpv: &Mpv, raw: &str) {
    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with("//") {
            continue;
        }
        let (key, value) = if let Some((k, v)) = line.split_once('=') {
            (k.trim(), v.trim())
        } else if let Some((k, v)) = line.split_once(char::is_whitespace) {
            (k.trim(), v.trim())
        } else {
            (line, "yes")
        };
        let key = key.trim_start_matches("--").trim();
        if key.is_empty() {
            continue;
        }
        match mpv.set_property(key, value) {
            Ok(()) => eprintln!("[harbor::mpv] extra option set {}={}", key, value),
            Err(e) => eprintln!(
                "[harbor::mpv] extra option {}={} rejected: {:?}",
                key, value, e
            ),
        }
    }
}

#[tauri::command]
pub async fn mpv_start(
    app: AppHandle,
    state: State<'_, MpvState>,
    args: MpvStartArgs,
) -> Result<(), String> {
    let mut g = state.inner.lock().await;
    if let Some(prev) = g.take() {
        #[cfg(target_os = "macos")]
        {
            let (tx, rx) = std::sync::mpsc::sync_channel::<()>(1);
            let _ = app.run_on_main_thread(move || {
                let _ = crate::mpv_render_mac::uninstall();
                let _ = prev.mpv.command("quit", &[]);
                drop(prev);
                let _ = tx.send(());
            });
            let _ = rx.recv_timeout(std::time::Duration::from_millis(4000));
        }
        #[cfg(target_os = "linux")]
        {
            let (tx, rx) = std::sync::mpsc::sync_channel::<()>(1);
            let _ = app.run_on_main_thread(move || {
                let _ = crate::mpv_render_linux::uninstall();
                let _ = prev.mpv.command("quit", &[]);
                drop(prev);
                let _ = tx.send(());
            });
            let _ = rx.recv_timeout(std::time::Duration::from_millis(4000));
        }
        #[cfg(all(not(target_os = "macos"), not(target_os = "linux")))]
        {
            let _ = prev.mpv.command("quit", &[]);
            drop(prev);
        }
    }

    let want_embed = args.embed.unwrap_or(false);
    let embed_hwnd = if want_embed {
        get_main_hwnd_str(&app)
    } else {
        None
    };
    eprintln!(
        "[harbor::mpv] start url={} want_embed={} embed_hwnd={:?}",
        args.url, want_embed, embed_hwnd
    );
    let embed_hwnd_for_init = embed_hwnd.clone();
    let args_for_init = args.clone();
    let init_err: Arc<std::sync::Mutex<Option<String>>> = Arc::new(std::sync::Mutex::new(None));
    let init_err_cap = init_err.clone();

    force_c_numeric_locale();
    let mpv = Mpv::with_initializer(move |init| {
        if let Err(e) = apply_pre_init(&init, &args_for_init, embed_hwnd_for_init.as_deref()) {
            eprintln!("[harbor::mpv] pre-init failed: {}", e);
            if let Ok(mut g) = init_err_cap.lock() {
                *g = Some(e);
            }
            return Err(libmpv2::Error::Raw(-1));
        }
        Ok(())
    })
    .map_err(|e| {
        let msg = if let Ok(g) = init_err.lock() {
            g.clone().unwrap_or_else(|| format!("mpv init: {}", e))
        } else {
            format!("mpv init: {}", e)
        };
        eprintln!("[harbor::mpv] init error: {}", msg);
        msg
    })?;

    unsafe {
        let level = std::ffi::CString::new("warn").unwrap();
        libmpv2_sys::mpv_request_log_messages(mpv.ctx.as_ptr(), level.as_ptr());
    }
    {
        use tauri::Manager;
        if let Ok(dir) = app.path().app_data_dir() {
            let _ = std::fs::create_dir_all(&dir);
            let logp = dir.join("harbor-mpv.log");
            let _ = mpv.set_property("log-file", logp.to_string_lossy().as_ref());
        }
    }
    let use_render_api = (cfg!(target_os = "macos") || cfg!(target_os = "linux")) && want_embed;
    if !use_render_api {
        if let Err(e) = mpv.set_property("vo", "gpu-next,") {
            eprintln!("[harbor::mpv] vo set FAILED: {:?}", e);
        }
    } else {
        if let Err(e) = mpv.set_property("vo", "libmpv") {
            eprintln!("[harbor::mpv] vo=libmpv FAILED: {:?}", e);
        }
        let _ = mpv.set_property("force-window", "no");
    }

    #[cfg(target_os = "macos")]
    if use_render_api {
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "main window missing for render API install".to_string())?;
        let ns_window_ptr = window
            .ns_window()
            .map_err(|e| format!("ns_window: {:?}", e))? as i64;
        let mpv_ctx_addr: usize = mpv.ctx.as_ptr() as usize;
        let mac_edr = args.mac_edr.unwrap_or(false);
        let (tx, rx) = std::sync::mpsc::sync_channel::<Result<(), String>>(1);
        let _ = app.run_on_main_thread(move || {
            let res = match std::ptr::NonNull::new(mpv_ctx_addr as *mut libmpv2_sys::mpv_handle) {
                Some(p) => crate::mpv_render_mac::install(p, ns_window_ptr, mac_edr),
                None => Err("null mpv ctx".into()),
            };
            let _ = tx.send(res);
        });
        match rx.recv_timeout(std::time::Duration::from_millis(3000)) {
            Ok(Ok(())) => eprintln!("[harbor::mpv_mac] install OK"),
            Ok(Err(e)) => {
                eprintln!("[harbor::mpv_mac] install failed: {}", e);
                return Err(format!("mac render install: {}", e));
            }
            Err(e) => {
                eprintln!("[harbor::mpv_mac] install timed out: {:?}", e);
                return Err("mac render install timeout".into());
            }
        }
    }

    #[cfg(target_os = "linux")]
    if use_render_api {
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "main window missing for render API install".to_string())?;
        let mpv_ctx_addr: usize = mpv.ctx.as_ptr() as usize;
        let (tx, rx) = std::sync::mpsc::sync_channel::<Result<(), String>>(1);
        let _ = app.run_on_main_thread(move || {
            let res = (|| {
                let p = std::ptr::NonNull::new(mpv_ctx_addr as *mut libmpv2_sys::mpv_handle)
                    .ok_or_else(|| "null mpv ctx".to_string())?;
                crate::mpv_render_linux::prepare(p)?;
                let gtk_window = window
                    .gtk_window()
                    .map_err(|e| format!("gtk_window: {:?}", e))?;
                let vbox = window
                    .default_vbox()
                    .map_err(|e| format!("default_vbox: {:?}", e))?;
                crate::mpv_render_linux::install(&gtk_window, &vbox)
            })();
            let _ = tx.send(res);
        });
        match rx.recv_timeout(std::time::Duration::from_millis(3000)) {
            Ok(Ok(())) => eprintln!("[harbor::mpv_linux] install OK"),
            Ok(Err(e)) => {
                eprintln!("[harbor::mpv_linux] install failed: {}", e);
                return Err(format!("linux render install: {}", e));
            }
            Err(e) => {
                eprintln!("[harbor::mpv_linux] install timed out: {:?}", e);
                return Err("linux render install timeout".into());
            }
        }
    }
    let is_live = args.is_live.unwrap_or(false);
    if is_live {
        let _ = mpv.set_property("cache", "yes");
        let _ = mpv.set_property("cache-secs", "30");
        let _ = mpv.set_property("cache-pause", "yes");
        let _ = mpv.set_property("cache-pause-initial", "no");
        let _ = mpv.set_property("demuxer-max-bytes", "64MiB");
        let _ = mpv.set_property("demuxer-max-back-bytes", "16MiB");
        let _ = mpv.set_property("demuxer-readahead-secs", "20");
        let _ = mpv.set_property("network-timeout", "60");
        let _ = mpv.set_property(
            "stream-lavf-o",
            "reconnect=1,reconnect_streamed=1,reconnect_delay_max=5,reconnect_on_network_error=1",
        );
        let _ = mpv.set_property("stream-buffer-size", "16MiB");
    } else {
        let _ = mpv.set_property("cache", "yes");
        let _ = mpv.set_property("cache-secs", "300");
        let _ = mpv.set_property("cache-pause", "yes");
        let _ = mpv.set_property("demuxer-max-bytes", "512MiB");
        let _ = mpv.set_property("demuxer-max-back-bytes", "64MiB");
        let _ = mpv.set_property("demuxer-readahead-secs", "300");
        if let Ok(base) = app.path().app_cache_dir() {
            let dvr = base.join("mpv-cache");
            let _ = std::fs::create_dir_all(&dvr);
            if let Some(s) = dvr.to_str() {
                let _ = mpv.set_property("cache-dir", s);
            }
        }
        let _ = mpv.set_property("cache-on-disk", "yes");
        let _ = mpv.set_property("network-timeout", "600");
        let _ = mpv.set_property(
            "stream-lavf-o",
            "reconnect=1,reconnect_streamed=1,reconnect_delay_max=10,reconnect_on_network_error=1",
        );
        let _ = mpv.set_property("stream-buffer-size", "32MiB");
    }
    if want_embed {
        let _ = mpv.set_property("sub-visibility", "no");
        let _ = mpv.set_property("secondary-sub-visibility", "no");
    }

    if let Some(fonts) = crate::fonts::locate_fonts_dir(&app) {
        if let Some(s) = fonts.to_str() {
            let _ = mpv.set_property("sub-fonts-dir", s);
        }
    }
    let _ = mpv.set_property("sub-font-provider", "auto");
    let _ = mpv.set_property("sub-font", "Noto Sans JP");
    let _ = mpv.set_property("embeddedfonts", "yes");

    if let Some(subs) = &args.subtitles {
        for s in subs {
            let _ = mpv_argv_command(&mpv, &["sub-add", &s.url, "auto"]);
        }
    }

    if let Some(extra) = args.extra_options.as_deref() {
        apply_extra_mpv_options(&mpv, extra);
    }

    if is_live {
        for (k, v) in [
            ("scale", "bilinear"),
            ("dscale", "bilinear"),
            ("cscale", "bilinear"),
            ("dither", "no"),
            ("deband", "no"),
            ("correct-downscaling", "no"),
            ("linear-downscaling", "no"),
            ("sigmoid-upscaling", "no"),
            ("hdr-compute-peak", "no"),
            ("interpolation", "no"),
        ] {
            let _ = mpv.set_property(k, v);
        }
    }

    let mpv_arc = Arc::new(mpv);

    let event_ctx = EventContext::new(mpv_arc.ctx);
    for (name, id, kind) in OBSERVED_PROPS {
        if let Err(e) = event_ctx.observe_property(name, kind.fmt(), *id) {
            eprintln!("[mpv] observe {} failed: {}", name, e);
        }
    }
    spawn_event_loop(
        app.clone(),
        mpv_arc.clone(),
        event_ctx,
        want_embed,
        args.mac_edr.unwrap_or(false),
    );

    let start_at_sec = args.start_at_sec.filter(|start| *start > 0.0);
    let start_option = start_at_sec.map(|start| format!("start={start}"));
    let mut load_args = vec!["loadfile", args.url.as_str(), "replace", "0"];
    if let Some(start_option) = start_option.as_deref() {
        load_args.push(start_option);
    }
    eprintln!(
        "[harbor::mpv] loadfile {} start_at_sec={:?}",
        args.url, start_at_sec
    );
    mpv_argv_command(&*mpv_arc, &load_args).map_err(|e| {
        eprintln!("[harbor::mpv] loadfile FAILED: {}", e);
        format!("loadfile: {}", e)
    })?;
    eprintln!("[harbor::mpv] loadfile OK");

    *g = Some(MpvSession {
        mpv: mpv_arc,
        #[cfg(windows)]
        embedded: embed_hwnd.is_some(),
        #[cfg(target_os = "linux")]
        embedded: use_render_api,
    });
    drop(g);

    #[cfg(windows)]
    if want_embed {
        // Reveal video under the UI only while embedded playback is active.
        crate::webview_helpers::apply_transparency(&app, "main");
    }

    #[cfg(not(windows))]
    let _ = embed_hwnd;
    Ok(())
}

#[cfg(windows)]
fn reassert_hdr_colorspace(mpv: &Arc<Mpv>) {
    let _ = mpv.set_property("target-peak", "10000");
    std::thread::sleep(Duration::from_millis(60));
    let _ = mpv.set_property("target-peak", "auto");
}

#[cfg(target_os = "macos")]
fn apply_mac_edr(app: &AppHandle, mpv: &Arc<Mpv>, active: bool) {
    let primaries = mpv
        .get_property::<String>("video-params/primaries")
        .unwrap_or_default();
    let bt2020 = primaries == "bt.2020";
    if active {
        let _ = mpv.set_property("icc-profile-auto", "no");
        let _ = mpv.set_property("target-prim", if bt2020 { "bt.2020" } else { "display-p3" });
        let _ = mpv.set_property("target-trc", "pq");
        let _ = mpv.set_property("target-peak", "auto");
    } else {
        let _ = mpv.set_property("target-trc", "auto");
        let _ = mpv.set_property("target-prim", "auto");
        let _ = mpv.set_property("target-peak", "auto");
    }
    let _ = app.run_on_main_thread(move || {
        crate::mpv_render_mac::set_hdr_active(active, bt2020);
    });
}

const MPV_EVENT_MAX_CONSECUTIVE_ERRORS: u32 = 12;

#[derive(Default)]
struct EventErrorBackoff {
    consecutive: u32,
}

impl EventErrorBackoff {
    fn reset(&mut self) {
        self.consecutive = 0;
    }

    fn next_delay(&mut self) -> Option<Duration> {
        self.consecutive = self.consecutive.saturating_add(1);
        if self.consecutive >= MPV_EVENT_MAX_CONSECUTIVE_ERRORS {
            return None;
        }
        let shift = self.consecutive.saturating_sub(1).min(5);
        Some(Duration::from_millis((40_u64 << shift).min(1_000)))
    }
}

fn record_event_poll_success(backoff: &mut EventErrorBackoff) {
    backoff.reset();
}

fn spawn_event_loop(
    app: AppHandle,
    mpv_keepalive: Arc<Mpv>,
    mut ctx: EventContext,
    embedded: bool,
    mac_edr: bool,
) {
    std::thread::spawn(move || {
        let mut last_timepos: Option<std::time::Instant> = None;
        #[cfg(windows)]
        let reassert_gen = Arc::new(std::sync::atomic::AtomicU64::new(0));
        #[cfg(not(windows))]
        let _ = embedded;
        #[cfg(not(target_os = "macos"))]
        let _ = mac_edr;
        let mut error_backoff = EventErrorBackoff::default();
        loop {
            let res = ctx.wait_event(0.5);
            match res {
                Some(Ok(event)) => {
                    record_event_poll_success(&mut error_backoff);
                    let mut shutdown = false;
                    if matches!(event, Event::Shutdown) {
                        shutdown = true;
                    }
                    if let Event::EndFile(reason) = &event {
                        eprintln!("[harbor::mpv] end-file reason={:?}", reason);
                    }
                    if let Event::PropertyChange { name, .. } = &event {
                        if *name == "time-pos" {
                            let now = std::time::Instant::now();
                            if let Some(prev) = last_timepos {
                                if now.duration_since(prev).as_millis() < 200 {
                                    continue;
                                }
                            }
                            last_timepos = Some(now);
                        }
                    }
                    #[cfg(windows)]
                    if embedded {
                        if let Event::PropertyChange { name, .. } = &event {
                            if *name == "video-params/gamma" {
                                let gen = reassert_gen
                                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed)
                                    + 1;
                                let gen_arc = reassert_gen.clone();
                                let mpv2 = mpv_keepalive.clone();
                                let app3 = app.clone();
                                std::thread::spawn(move || {
                                    std::thread::sleep(Duration::from_millis(250));
                                    if gen_arc.load(std::sync::atomic::Ordering::Relaxed) != gen {
                                        return;
                                    }
                                    let gamma = mpv2
                                        .get_property::<String>("video-params/gamma")
                                        .unwrap_or_default();
                                    if gamma != "pq" && gamma != "hlg" {
                                        return;
                                    }
                                    let hdr = app3
                                        .get_webview_window("main")
                                        .and_then(|w| w.hwnd().ok())
                                        .map(|h| monitor_hdr_active(h.0 as isize))
                                        .unwrap_or(false);
                                    if hdr {
                                        reassert_hdr_colorspace(&mpv2);
                                    }
                                });
                            }
                        }
                    }
                    #[cfg(target_os = "macos")]
                    if mac_edr {
                        if let Event::PropertyChange { name, .. } = &event {
                            if *name == "video-params/gamma" {
                                let gamma = mpv_keepalive
                                    .get_property::<String>("video-params/gamma")
                                    .unwrap_or_default();
                                let active = gamma == "pq" || gamma == "hlg";
                                apply_mac_edr(&app, &mpv_keepalive, active);
                            }
                        }
                    }
                    let payload = event_to_payload(event);
                    if let Some(p) = payload {
                        let _ = app.emit("mpv://event", p);
                    }
                    if shutdown {
                        break;
                    }
                }
                Some(Err(e)) => {
                    let delay = error_backoff.next_delay();
                    if error_backoff.consecutive == 1 || error_backoff.consecutive.is_power_of_two()
                    {
                        eprintln!(
                            "[mpv] event error (consecutive={}): {}",
                            error_backoff.consecutive, e
                        );
                    }
                    if matches!(e, libmpv2::Error::Raw(-13 | -16)) {
                        let _ = app.emit(
                            "mpv://event",
                            json!({ "event": "end-file", "reason": "error" }),
                        );
                    }
                    match delay {
                        Some(delay) => std::thread::sleep(delay),
                        None => {
                            let _ = app.emit(
                                "mpv://event",
                                json!({
                                    "event": "player-failure",
                                    "reason": "persistent-event-errors",
                                }),
                            );
                            break;
                        }
                    }
                }
                None => record_event_poll_success(&mut error_backoff),
            }
        }
        drop(mpv_keepalive);
    });
}

fn event_to_payload(event: Event) -> Option<Value> {
    match event {
        Event::PropertyChange { name, change, .. } => {
            let data = match change {
                PropertyData::Str(s) => Value::String(s.to_string()),
                PropertyData::OsdStr(s) => Value::String(s.to_string()),
                PropertyData::Flag(b) => Value::Bool(b),
                PropertyData::Int64(i) => json!(i),
                PropertyData::Double(f) => json!(f),
                PropertyData::Node(n) => mpv_node_to_json(n),
            };
            Some(json!({ "event": "property-change", "name": name, "data": data }))
        }
        Event::EndFile(reason) => {
            let reason = match reason {
                0 => "eof",
                2 => "stop",
                3 => "quit",
                4 => "error",
                5 => "redirect",
                _ => "other",
            };
            Some(json!({ "event": "end-file", "reason": reason }))
        }
        Event::FileLoaded => Some(json!({ "event": "file-loaded" })),
        Event::PlaybackRestart => Some(json!({ "event": "playback-restart" })),
        Event::Seek => Some(json!({ "event": "seek" })),
        Event::Shutdown => Some(json!({ "event": "shutdown" })),
        Event::LogMessage {
            prefix,
            level,
            text,
            ..
        } => Some(json!({ "event": "log", "prefix": prefix, "level": level, "text": text })),
        _ => None,
    }
}

fn mpv_node_to_json(node: MpvNode) -> Value {
    match node {
        MpvNode::None => Value::Null,
        MpvNode::String(s) => Value::String(s),
        MpvNode::Flag(b) => Value::Bool(b),
        MpvNode::Int64(i) => json!(i),
        MpvNode::Double(f) => json!(f),
        MpvNode::ArrayIter(it) => Value::Array(it.map(mpv_node_to_json).collect()),
        MpvNode::MapIter(it) => {
            let mut obj = serde_json::Map::new();
            for (k, v) in it {
                obj.insert(k, mpv_node_to_json(v));
            }
            Value::Object(obj)
        }
    }
}

#[tauri::command]
pub async fn mpv_command(state: State<'_, MpvState>, cmd: Vec<Value>) -> Result<(), String> {
    let mpv = {
        let g = state.inner.lock().await;
        g.as_ref()
            .map(|s| s.mpv.clone())
            .ok_or_else(|| "mpv not started".to_string())?
    };
    if cmd.is_empty() {
        return Err("empty command".into());
    }
    let head = cmd[0]
        .as_str()
        .ok_or_else(|| "first arg must be string".to_string())?;
    if !MPV_ALLOWED_COMMANDS.contains(&head) {
        return Err(format!("mpv command not allowed: {}", head));
    }
    let tail: Vec<String> = cmd[1..].iter().map(value_to_arg).collect();
    let mut argv: Vec<&str> = Vec::with_capacity(tail.len() + 1);
    argv.push(head);
    for s in &tail {
        argv.push(s.as_str());
    }
    mpv_argv_command(&mpv, &argv)
}

const MPV_ALLOWED_COMMANDS: &[&str] = &[
    "af",
    "vf",
    "seek",
    "stop",
    "frame-step",
    "frame-back-step",
    "loadfile",
];

fn mpv_property_blocked(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    const BLOCKED: &[&str] = &[
        "script",
        "input-",
        "load-scripts",
        "ytdl-raw",
        "screenshot-directory",
        "screenshot-template",
        "sub-add",
    ];
    BLOCKED.iter().any(|b| n.starts_with(b))
}

fn value_to_arg(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Bool(b) => {
            if *b {
                "yes".into()
            } else {
                "no".into()
            }
        }
        Value::Number(n) => n.to_string(),
        Value::Null => String::new(),
        _ => v.to_string(),
    }
}

#[tauri::command]
pub async fn mpv_set_property(
    state: State<'_, MpvState>,
    name: String,
    value: Value,
) -> Result<(), String> {
    let mpv = {
        let g = state.inner.lock().await;
        g.as_ref()
            .map(|s| s.mpv.clone())
            .ok_or_else(|| "mpv not started".to_string())?
    };
    if mpv_property_blocked(&name) {
        return Err(format!("mpv property not allowed: {}", name));
    }
    let str_val = value_to_arg(&value);
    mpv.set_property(&name, str_val.as_str())
        .map_err(|e| format!("set {}: {}", name, e))
}

#[tauri::command]
pub async fn mpv_get_property(state: State<'_, MpvState>, name: String) -> Result<Value, String> {
    let mpv = {
        let g = state.inner.lock().await;
        g.as_ref()
            .map(|s| s.mpv.clone())
            .ok_or_else(|| "mpv not started".to_string())?
    };
    let s = mpv
        .get_property::<String>(&name)
        .map_err(|e| format!("get {}: {}", name, e))?;
    Ok(match s.parse::<f64>() {
        Ok(n) if n.is_finite() => serde_json::json!(n),
        _ => Value::String(s),
    })
}

#[tauri::command]
pub async fn mpv_set_geometry(
    app: AppHandle,
    _state: State<'_, MpvState>,
    geom: MpvGeometry,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        let embedded = {
            let g = _state.inner.lock().await;
            g.as_ref().map(|s| s.embedded).unwrap_or(false)
        };
        if embedded {
            return position_embedded_mpv_child(&app, geom);
        }
    }
    #[cfg(target_os = "macos")]
    {
        let (tx, rx) = std::sync::mpsc::sync_channel(1);
        app.run_on_main_thread(move || {
            let _ = tx.send(crate::mpv_render_mac::resize_to(geom));
        })
        .map_err(|error| format!("failed to schedule macOS mpv resize: {error}"))?;
        return rx
            .recv_timeout(std::time::Duration::from_millis(300))
            .map_err(|error| format!("timed out waiting for macOS mpv resize: {error}"))?;
    }
    #[cfg(target_os = "linux")]
    {
        let embedded = {
            let g = _state.inner.lock().await;
            g.as_ref().map(|s| s.embedded).unwrap_or(false)
        };
        if embedded {
            // GLArea fills the full window via GTK expand flags, so
            // geometry tracking is redundant. We still dispatch to the
            // main thread as a rendering tickle for the GLArea.
            let _ = app.run_on_main_thread(move || {
                let _ = crate::mpv_render_linux::resize_to(geom);
            });
            return Ok(());
        }
    }
    #[cfg(all(not(windows), not(target_os = "macos")))]
    let _ = app;

    #[cfg(not(target_os = "macos"))]
    {
        let mpv = {
            let g = _state.inner.lock().await;
            g.as_ref()
                .map(|s| s.mpv.clone())
                .ok_or_else(|| "mpv not started".to_string())?
        };
        let geo = format!(
            "{}x{}+{}+{}",
            geom.css_width as i32,
            geom.css_height as i32,
            geom.css_left as i32,
            geom.css_top as i32
        );
        mpv.set_property("geometry", geo.as_str())
            .map_err(|e| format!("geometry: {}", e))
    }
}

#[tauri::command]
pub fn mpv_export_log(app: AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let src = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("harbor-mpv.log");
    if !src.exists() {
        return Err("No player log yet. Play something first, then export.".into());
    }
    let dl = app.path().download_dir().map_err(|e| e.to_string())?;
    let dst = dl.join("harbor-mpv-log.txt");
    std::fs::copy(&src, &dst).map_err(|e| format!("copy: {}", e))?;
    Ok(dst.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn mpv_force_below(_app: AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        if MPV_HDR_STAGE.load(std::sync::atomic::Ordering::Relaxed)
            && _app
                .get_webview_window(crate::hdr_overlay::HDR_OVERLAY_LABEL)
                .is_some()
        {
            return Ok(());
        }
        use windows::Win32::Foundation::{HWND, LPARAM};
        use windows::Win32::UI::WindowsAndMessaging::{
            EnumChildWindows, GetClassNameW, SetWindowPos, HWND_BOTTOM, SWP_NOACTIVATE, SWP_NOMOVE,
            SWP_NOSIZE,
        };
        let window = _app
            .get_webview_window("main")
            .ok_or_else(|| "main window missing".to_string())?;
        let parent_hwnd = window.hwnd().map_err(|e| format!("hwnd: {}", e))?;

        struct EnumState {
            mpv_hwnds: Vec<isize>,
        }
        let mut state = EnumState {
            mpv_hwnds: Vec::new(),
        };
        let state_ptr = &mut state as *mut EnumState;

        unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> windows::core::BOOL {
            let mut class_buf = [0u16; 256];
            let class_len = GetClassNameW(hwnd, &mut class_buf);
            let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);
            let s = lparam.0 as *mut EnumState;
            if class_name == "mpv" || class_name.starts_with("mpv ") {
                (*s).mpv_hwnds.push(hwnd.0 as isize);
            }
            windows::core::BOOL(1)
        }

        unsafe {
            let _ = EnumChildWindows(
                Some(parent_hwnd),
                Some(enum_proc),
                LPARAM(state_ptr as isize),
            );
            for h in state.mpv_hwnds {
                let _ = SetWindowPos(
                    HWND(h as *mut _),
                    Some(HWND_BOTTOM),
                    0,
                    0,
                    0,
                    0,
                    SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE,
                );
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn mpv_set_hdr_stage(_app: AppHandle, active: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        MPV_HDR_STAGE.store(active, std::sync::atomic::Ordering::Relaxed);
        if let Ok(mut guard) = MPV_POS_LAST_RECT.lock() {
            *guard = None;
        }
    }
    #[cfg(not(windows))]
    let _ = active;
    Ok(())
}

#[tauri::command]
pub async fn display_hdr_active(_app: AppHandle) -> Result<bool, String> {
    #[cfg(windows)]
    {
        use tauri::Manager;
        let window = match _app.get_webview_window("main") {
            Some(w) => w,
            None => return Ok(false),
        };
        let hwnd = match window.hwnd() {
            Ok(h) => h,
            Err(_) => return Ok(false),
        };
        return Ok(monitor_hdr_active(hwnd.0 as isize));
    }
    #[cfg(not(windows))]
    {
        Ok(false)
    }
}

#[cfg(windows)]
fn monitor_hdr_active(hwnd_raw: isize) -> bool {
    use windows::core::Interface;
    use windows::Win32::Foundation::{HWND, RECT};
    use windows::Win32::Graphics::Dxgi::Common::DXGI_COLOR_SPACE_RGB_FULL_G2084_NONE_P2020;
    use windows::Win32::Graphics::Dxgi::{
        CreateDXGIFactory1, IDXGIFactory1, IDXGIOutput6, DXGI_ERROR_NOT_FOUND,
    };
    use windows::Win32::Graphics::Gdi::{MonitorFromWindow, MONITOR_DEFAULTTONEAREST};
    use windows::Win32::UI::WindowsAndMessaging::GetWindowRect;

    let hwnd = HWND(hwnd_raw as *mut _);
    let target_monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
    let mut win_rect = RECT::default();
    let have_win_rect = unsafe { GetWindowRect(hwnd, &mut win_rect).is_ok() };

    let factory: IDXGIFactory1 = match unsafe { CreateDXGIFactory1() } {
        Ok(f) => f,
        Err(_) => return false,
    };

    let mut adapter_idx = 0u32;
    loop {
        let adapter = match unsafe { factory.EnumAdapters1(adapter_idx) } {
            Ok(a) => a,
            Err(e) if e.code() == DXGI_ERROR_NOT_FOUND => break,
            Err(_) => break,
        };
        adapter_idx += 1;

        let mut output_idx = 0u32;
        loop {
            let output = match unsafe { adapter.EnumOutputs(output_idx) } {
                Ok(o) => o,
                Err(_) => break,
            };
            output_idx += 1;

            let output6: IDXGIOutput6 = match output.cast() {
                Ok(o) => o,
                Err(_) => continue,
            };
            let desc = match unsafe { output6.GetDesc1() } {
                Ok(d) => d,
                Err(_) => continue,
            };

            let monitor_matches = !target_monitor.is_invalid()
                && desc.Monitor.0 as isize == target_monitor.0 as isize;
            let rect_matches = have_win_rect && {
                let d = desc.DesktopCoordinates;
                let cx = (win_rect.left + win_rect.right) / 2;
                let cy = (win_rect.top + win_rect.bottom) / 2;
                cx >= d.left && cx < d.right && cy >= d.top && cy < d.bottom
            };
            if monitor_matches || rect_matches {
                return desc.ColorSpace == DXGI_COLOR_SPACE_RGB_FULL_G2084_NONE_P2020;
            }
        }
    }
    false
}

#[tauri::command]
pub async fn mpv_save_screenshot(
    state: State<'_, MpvState>,
    path: String,
) -> Result<String, String> {
    let mpv = {
        let g = state.inner.lock().await;
        g.as_ref()
            .map(|s| s.mpv.clone())
            .ok_or_else(|| "mpv not started".to_string())?
    };
    if let Some(parent) = std::path::Path::new(&path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = mpv.set_property("screenshot-format", "png");
    let _ = mpv.set_property("screenshot-png-compression", "3");
    let _ = mpv.set_property("screenshot-sw", "yes");
    mpv_argv_command(&mpv, &["screenshot-to-file", path.as_str(), "video"])
        .map_err(|e| format!("screenshot-to-file: {}", e))?;
    let target = std::path::Path::new(&path).to_path_buf();
    let mut waited = 0u64;
    while waited < 3000 {
        if target.exists() {
            if let Ok(meta) = std::fs::metadata(&target) {
                if meta.len() > 0 {
                    return Ok(path);
                }
            }
        }
        tokio::time::sleep(Duration::from_millis(40)).await;
        waited += 40;
    }
    Err("screenshot did not finish writing".to_string())
}

struct GifSession {
    dir: PathBuf,
    stop: Arc<std::sync::atomic::AtomicBool>,
    handle: tokio::task::JoinHandle<()>,
    captured_ms: Arc<std::sync::atomic::AtomicU64>,
}

static GIF_SESSION: std::sync::OnceLock<std::sync::Mutex<Option<GifSession>>> =
    std::sync::OnceLock::new();

fn gif_slot() -> &'static std::sync::Mutex<Option<GifSession>> {
    GIF_SESSION.get_or_init(|| std::sync::Mutex::new(None))
}

const GIF_FRAME_INTERVAL_MS: u64 = 50;
const GIF_MAX_FRAMES: u32 = 600;
const GIF_FALLBACK_FPS: f64 = 12.0;

#[derive(Serialize)]
pub struct GifResult {
    path: String,
    frames: u32,
}

#[tauri::command]
pub async fn mpv_gif_start(state: State<'_, MpvState>) -> Result<(), String> {
    let mpv = {
        let g = state.inner.lock().await;
        g.as_ref()
            .map(|s| s.mpv.clone())
            .ok_or_else(|| "mpv not started".to_string())?
    };
    {
        let g = gif_slot().lock().map_err(|e| format!("gif lock: {}", e))?;
        if g.is_some() {
            return Err("already recording".into());
        }
    }
    let dir = std::env::temp_dir().join(format!("harbor-gif-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&dir).map_err(|e| format!("create temp dir: {}", e))?;
    let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let stop_task = stop.clone();
    let dir_task = dir.clone();
    let captured_ms = Arc::new(std::sync::atomic::AtomicU64::new(0));
    let captured_task = captured_ms.clone();
    let handle = tokio::spawn(async move {
        let started = std::time::Instant::now();
        let _ = mpv.set_property("screenshot-format", "jpg");
        let _ = mpv.set_property("screenshot-jpeg-quality", "92");
        let _ = mpv.set_property("screenshot-sw", "yes");
        let mut frame: u32 = 0;
        while !stop_task.load(std::sync::atomic::Ordering::Relaxed) && frame < GIF_MAX_FRAMES {
            let path = dir_task.join(format!("f{:05}.jpg", frame));
            let p = path.to_string_lossy().to_string();
            if mpv_argv_command(&mpv, &["screenshot-to-file", p.as_str(), "video"]).is_ok() {
                frame += 1;
                captured_task.store(
                    started.elapsed().as_millis() as u64,
                    std::sync::atomic::Ordering::Relaxed,
                );
            }
            tokio::time::sleep(Duration::from_millis(GIF_FRAME_INTERVAL_MS)).await;
        }
    });
    *gif_slot().lock().map_err(|e| format!("gif lock: {}", e))? = Some(GifSession {
        dir,
        stop,
        handle,
        captured_ms,
    });
    Ok(())
}

#[tauri::command]
pub async fn mpv_gif_abort() -> Result<(), String> {
    let session = {
        gif_slot()
            .lock()
            .map_err(|e| format!("gif lock: {}", e))?
            .take()
    };
    if let Some(session) = session {
        session
            .stop
            .store(true, std::sync::atomic::Ordering::Relaxed);
        let _ = session.handle.await;
        let _ = std::fs::remove_dir_all(&session.dir);
    }
    Ok(())
}

#[tauri::command]
pub async fn mpv_gif_stop(out_path: String) -> Result<GifResult, String> {
    let session = {
        gif_slot()
            .lock()
            .map_err(|e| format!("gif lock: {}", e))?
            .take()
    };
    let Some(session) = session else {
        return Err("not recording".into());
    };
    session
        .stop
        .store(true, std::sync::atomic::Ordering::Relaxed);
    let _ = session.handle.await;
    tokio::time::sleep(Duration::from_millis(300)).await;

    let mut frames: Vec<PathBuf> = std::fs::read_dir(&session.dir)
        .map_err(|e| format!("read temp dir: {}", e))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().and_then(|x| x.to_str()) == Some("jpg"))
        .collect();
    frames.sort();
    if frames.is_empty() {
        let _ = std::fs::remove_dir_all(&session.dir);
        return Err("no frames captured".into());
    }

    let window_ms = session
        .captured_ms
        .load(std::sync::atomic::Ordering::Relaxed);
    let n = frames.len() as f64;
    let fps = if n >= 2.0 && window_ms >= 200 {
        (n / (window_ms as f64 / 1000.0)).clamp(2.0, 30.0)
    } else {
        GIF_FALLBACK_FPS
    };
    let dur = 1.0_f64 / fps;

    let ffmpeg = crate::transcode::locate_ffmpeg().ok_or_else(|| "ffmpeg not found".to_string())?;

    let list_path = session.dir.join("frames.txt");
    let mut list = String::new();
    for f in &frames {
        let name = f.file_name().and_then(|n| n.to_str()).unwrap_or_default();
        list.push_str(&format!("file '{}'\nduration {:.4}\n", name, dur));
    }
    if let Some(last) = frames.last() {
        let name = last
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default();
        list.push_str(&format!("file '{}'\n", name));
    }
    std::fs::write(&list_path, list).map_err(|e| format!("write list: {}", e))?;

    if let Some(parent) = std::path::Path::new(&out_path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let palette = session.dir.join("palette.png");
    let list_str = list_path.to_string_lossy().to_string();
    let palette_str = palette.to_string_lossy().to_string();
    let vf_pal = format!(
        "fps={:.3},scale=640:-2:flags=lanczos,palettegen=stats_mode=diff",
        fps
    );
    let lavfi = format!(
        "fps={:.3},scale=640:-2:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3",
        fps
    );

    let pass1 = run_gif_ffmpeg(
        &ffmpeg,
        &[
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            &list_str,
            "-vf",
            &vf_pal,
            &palette_str,
        ],
    )
    .await;
    if let Err(e) = pass1 {
        let _ = std::fs::remove_dir_all(&session.dir);
        return Err(format!("palettegen: {}", e));
    }
    let pass2 = run_gif_ffmpeg(
        &ffmpeg,
        &[
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            &list_str,
            "-i",
            &palette_str,
            "-lavfi",
            &lavfi,
            out_path.as_str(),
        ],
    )
    .await;
    let _ = std::fs::remove_dir_all(&session.dir);
    if let Err(e) = pass2 {
        return Err(format!("paletteuse: {}", e));
    }
    Ok(GifResult {
        path: out_path,
        frames: frames.len() as u32,
    })
}

async fn run_gif_ffmpeg(ffmpeg: &std::path::Path, args: &[&str]) -> Result<(), String> {
    let mut cmd = tokio::process::Command::new(ffmpeg);
    cmd.args(args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);
    let status = cmd
        .status()
        .await
        .map_err(|e| format!("spawn ffmpeg: {}", e))?;
    if !status.success() {
        return Err(format!("ffmpeg exit {:?}", status.code()));
    }
    Ok(())
}

#[derive(Serialize)]
pub struct ClipResult {
    path: String,
    duration: f64,
}

#[tauri::command]
pub async fn mpv_clip_save(
    state: State<'_, MpvState>,
    with_subs: bool,
    before_sec: f64,
    out_path: String,
) -> Result<ClipResult, String> {
    let mpv = {
        let g = state.inner.lock().await;
        g.as_ref()
            .map(|s| s.mpv.clone())
            .ok_or_else(|| "mpv not started".to_string())?
    };
    let src = mpv
        .get_property::<String>("path")
        .map_err(|e| format!("no source path: {}", e))?;
    let pos: f64 = mpv
        .get_property::<String>("time-pos")
        .map_err(|e| format!("no position: {}", e))?
        .trim()
        .parse()
        .map_err(|_| "bad position".to_string())?;
    let start = (pos - before_sec).max(0.0);
    let dur = pos - start;
    if dur < 0.5 {
        return Err("not enough playback to clip yet".into());
    }

    let sub_external = if with_subs {
        mpv.get_property::<String>("current-tracks/sub/external-filename")
            .ok()
            .filter(|s| !s.trim().is_empty())
    } else {
        None
    };
    let sub_id = if with_subs {
        mpv.get_property::<String>("sid")
            .ok()
            .filter(|s| s.trim() != "no" && !s.trim().is_empty())
    } else {
        None
    };

    let mpv_bin = crate::thumbs::locate_mpv().ok_or_else(|| "mpv binary not found".to_string())?;
    if let Some(parent) = std::path::Path::new(&out_path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::remove_file(&out_path);

    let mut cmd = tokio::process::Command::new(&mpv_bin);
    cmd.arg("--no-terminal")
        .arg("--really-quiet")
        .arg("--no-config")
        .arg("--load-scripts=no")
        .arg("--cache=yes")
        .arg("--network-timeout=60")
        .arg(format!("--start={:.3}", start))
        .arg(format!("--length={:.3}", dur))
        .arg(format!("--o={}", out_path))
        .arg("--of=mp4")
        .arg("--ovc=libx264")
        .arg("--ovcopts=preset=veryfast,crf=18")
        .arg("--oac=aac")
        .arg("--oacopts=b=192k");
    if with_subs {
        if let Some(ext) = &sub_external {
            cmd.arg(format!("--sub-files={}", ext));
        } else if let Some(id) = &sub_id {
            cmd.arg(format!("--sid={}", id));
        }
        cmd.arg("--sub-visibility=yes");
    } else {
        cmd.arg("--sid=no").arg("--no-sub");
    }
    cmd.arg(&src);
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);

    let status = cmd
        .status()
        .await
        .map_err(|e| format!("spawn mpv encode: {}", e))?;
    if !status.success() {
        let _ = std::fs::remove_file(&out_path);
        return Err(format!("clip encode failed (mpv exit {:?})", status.code()));
    }
    match std::fs::metadata(&out_path) {
        Ok(m) if m.len() > 0 => Ok(ClipResult {
            path: out_path,
            duration: dur,
        }),
        _ => Err("clip output missing".into()),
    }
}

#[tauri::command]
pub async fn mpv_screenshot_data_url(state: State<'_, MpvState>) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
    let mpv = {
        let g = state.inner.lock().await;
        g.as_ref()
            .map(|s| s.mpv.clone())
            .ok_or_else(|| "mpv not started".to_string())?
    };
    let temp = std::env::temp_dir().join(format!("harbor-cw-{}.jpg", Uuid::new_v4()));
    let path_str = temp.to_string_lossy().to_string();
    let _ = mpv.set_property("screenshot-format", "jpg");
    let _ = mpv.set_property("screenshot-jpeg-quality", "72");
    let _ = mpv.set_property("screenshot-sw", "yes");
    mpv_argv_command(&mpv, &["screenshot-to-file", path_str.as_str(), "video"])
        .map_err(|e| format!("screenshot-to-file: {}", e))?;
    let mut waited = 0u64;
    while waited < 1500 {
        if temp.exists() {
            if let Ok(meta) = std::fs::metadata(&temp) {
                if meta.len() > 0 {
                    break;
                }
            }
        }
        tokio::time::sleep(Duration::from_millis(40)).await;
        waited += 40;
    }
    if !temp.exists() {
        return Err("screenshot file missing".to_string());
    }
    let bytes = std::fs::read(&temp).map_err(|e| format!("read: {}", e))?;
    let _ = std::fs::remove_file(&temp);
    if bytes.is_empty() {
        return Err("screenshot empty".to_string());
    }
    let encoded = B64.encode(&bytes);
    Ok(format!("data:image/jpeg;base64,{}", encoded))
}

#[tauri::command]
pub async fn mpv_on_pip_changed(
    _app: AppHandle,
    state: State<'_, MpvState>,
    entering: bool,
) -> Result<(), String> {
    let mpv = {
        let g = state.inner.lock().await;
        g.as_ref().map(|s| s.mpv.clone())
    };
    if let Some(m) = mpv {
        let _ = m.set_property("ontop", if entering { "yes" } else { "no" });
    }
    Ok(())
}

#[tauri::command]
pub async fn mpv_sub_add(
    state: State<'_, MpvState>,
    url: String,
    lang: Option<String>,
    title: Option<String>,
    select: Option<bool>,
) -> Result<(), String> {
    let mpv = {
        let g = state.inner.lock().await;
        g.as_ref()
            .map(|s| s.mpv.clone())
            .ok_or_else(|| "mpv not started".to_string())?
    };
    let flag = if select.unwrap_or(true) {
        "select"
    } else {
        "auto"
    };
    let title_input = title.filter(|s| !s.is_empty()).unwrap_or_default();
    let lang_owned = lang.filter(|s| !s.is_empty()).unwrap_or_default();
    let title_for_mpv = if !title_input.is_empty() {
        title_input
    } else if !lang_owned.is_empty() {
        lang_owned.clone()
    } else {
        "Subtitle".to_string()
    };
    let cmd_name = std::ffi::CString::new("sub-add").map_err(|e| format!("cstring: {}", e))?;
    let url_c = std::ffi::CString::new(url.as_str()).map_err(|e| format!("cstring url: {}", e))?;
    let flag_c = std::ffi::CString::new(flag).map_err(|e| format!("cstring flag: {}", e))?;
    let title_c = std::ffi::CString::new(title_for_mpv.as_str())
        .map_err(|e| format!("cstring title: {}", e))?;
    let lang_c = if lang_owned.is_empty() {
        None
    } else {
        Some(
            std::ffi::CString::new(lang_owned.as_str())
                .map_err(|e| format!("cstring lang: {}", e))?,
        )
    };
    let mut ptrs: Vec<*const std::os::raw::c_char> = vec![
        cmd_name.as_ptr(),
        url_c.as_ptr(),
        flag_c.as_ptr(),
        title_c.as_ptr(),
    ];
    if let Some(ref lc) = lang_c {
        ptrs.push(lc.as_ptr());
    }
    ptrs.push(std::ptr::null());
    let rc = unsafe { libmpv2_sys::mpv_command(mpv.ctx.as_ptr(), ptrs.as_mut_ptr()) };
    if rc < 0 {
        return Err(format!("sub-add failed: mpv_command rc={}", rc));
    }
    Ok(())
}

fn sub_cache_dir() -> PathBuf {
    let dir = std::env::temp_dir().join("harbor-subs");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn subtitle_extension(
    url: &str,
    content_type: Option<&str>,
    format_hint: Option<&str>,
    bytes: &[u8],
) -> &'static str {
    match format_hint
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "ass" | "ssa" => return "ass",
        "vtt" | "webvtt" => return "vtt",
        "srt" | "subrip" => return "srt",
        _ => {}
    }
    let head_len = bytes.len().min(1024);
    let head = String::from_utf8_lossy(&bytes[..head_len]).to_ascii_lowercase();
    if head.contains("[script info]")
        || head.contains("[v4+ styles]")
        || head.contains("[v4 styles]")
    {
        return "ass";
    }
    if head.trim_start_matches('\u{feff}').starts_with("webvtt") {
        return "vtt";
    }
    let lower = url.to_lowercase();
    if lower.ends_with(".vtt") || content_type.is_some_and(|c| c.contains("vtt")) {
        return "vtt";
    }
    if lower.ends_with(".ass") || lower.ends_with(".ssa") {
        return "ass";
    }
    "srt"
}

fn normalize_subtitle_bytes(
    bytes: &[u8],
    encoding_hint: Option<&str>,
    lang: Option<&str>,
) -> Vec<u8> {
    if let Ok(text) = std::str::from_utf8(bytes) {
        return text.trim_start_matches('\u{feff}').as_bytes().to_vec();
    }

    let hinted =
        encoding_hint.and_then(|label| encoding_rs::Encoding::for_label(label.trim().as_bytes()));
    let language = lang.unwrap_or_default().trim().to_ascii_lowercase();
    let encoding = hinted.or_else(|| {
        if matches!(language.as_str(), "ar" | "ara" | "arabic") {
            encoding_rs::Encoding::for_label(b"windows-1256")
        } else {
            encoding_rs::Encoding::for_label(b"windows-1252")
        }
    });
    let Some(encoding) = encoding else {
        return String::from_utf8_lossy(bytes).into_owned().into_bytes();
    };
    let (text, _, _) = encoding.decode(bytes);
    text.trim_start_matches('\u{feff}').as_bytes().to_vec()
}

fn prepare_subtitle_download(
    url: &str,
    content_type: Option<&str>,
    format_hint: Option<&str>,
    encoding_hint: Option<&str>,
    lang: Option<&str>,
    bytes: &[u8],
) -> (&'static str, Vec<u8>) {
    let normalized = normalize_subtitle_bytes(bytes, encoding_hint, lang);
    let extension = subtitle_extension(url, content_type, format_hint, &normalized);
    (extension, normalized)
}

#[cfg(test)]
mod subtitle_download_tests {
    use super::{normalize_subtitle_bytes, prepare_subtitle_download, subtitle_extension};

    #[test]
    fn uses_explicit_ass_format_when_download_url_has_no_extension() {
        let body = b"[Script Info]\nTitle: Styled\n[V4+ Styles]\n";
        assert_eq!(
            subtitle_extension(
                "https://example.test/download?id=42",
                Some("application/octet-stream"),
                Some("ass"),
                body,
            ),
            "ass",
        );
    }

    #[test]
    fn detects_ass_from_content_when_provider_omits_format() {
        let body = b"[Script Info]\nTitle: Styled\n[V4+ Styles]\n";
        assert_eq!(
            subtitle_extension(
                "https://example.test/download?id=42",
                Some("text/plain"),
                None,
                body,
            ),
            "ass",
        );
    }

    #[test]
    fn converts_windows_1256_arabic_to_utf8() {
        let windows_1256 = [
            0xe3, 0xd1, 0xcd, 0xc8, 0xc7, 0x20, 0xc8, 0xc7, 0xe1, 0xda, 0xc7, 0xe1, 0xe3,
        ];
        let utf8 = normalize_subtitle_bytes(&windows_1256, Some("windows-1256"), Some("ar"));
        assert_eq!(String::from_utf8(utf8).unwrap(), "مرحبا بالعالم");
    }

    #[test]
    fn uses_arabic_language_as_legacy_encoding_fallback() {
        let windows_1256 = [
            0xe3, 0xd1, 0xcd, 0xc8, 0xc7, 0x20, 0xc8, 0xc7, 0xe1, 0xda, 0xc7, 0xe1, 0xe3,
        ];
        let utf8 = normalize_subtitle_bytes(&windows_1256, None, Some("ara"));
        assert_eq!(String::from_utf8(utf8).unwrap(), "مرحبا بالعالم");
    }

    #[test]
    fn converts_utf16_little_endian_bom_to_utf8() {
        let utf16 = [0xff, 0xfe, b'H', 0x00, b'i', 0x00];
        let utf8 = normalize_subtitle_bytes(&utf16, None, None);
        assert_eq!(String::from_utf8(utf8).unwrap(), "Hi");
    }

    #[test]
    fn detects_ass_after_utf16_normalization() {
        let text = "[Script Info]\nTitle: Styled\n";
        let mut utf16 = vec![0xff, 0xfe];
        for unit in text.encode_utf16() {
            utf16.extend_from_slice(&unit.to_le_bytes());
        }
        let normalized = normalize_subtitle_bytes(&utf16, None, None);
        assert_eq!(
            subtitle_extension("https://example.test/download", None, None, &normalized),
            "ass",
        );
    }

    #[test]
    fn download_preparation_detects_utf16_ass_before_writing() {
        let text = "[Script Info]\nTitle: Styled\n";
        let mut utf16 = vec![0xff, 0xfe];
        for unit in text.encode_utf16() {
            utf16.extend_from_slice(&unit.to_le_bytes());
        }
        let (extension, normalized) = prepare_subtitle_download(
            "https://example.test/download",
            None,
            None,
            None,
            None,
            &utf16,
        );
        assert_eq!(extension, "ass");
        assert_eq!(String::from_utf8(normalized).unwrap(), text);
    }
}

#[tauri::command]
pub async fn sub_download(
    url: String,
    format: Option<String>,
    encoding: Option<String>,
    lang: Option<String>,
) -> Result<String, String> {
    use std::io::Read;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .gzip(true)
        .build()
        .map_err(|e| format!("client: {}", e))?;
    let res = client
        .get(&url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        )
        .header("Accept", "*/*")
        .send()
        .await
        .map_err(|e| format!("fetch: {}", e))?;
    if !res.status().is_success() {
        return Err(format!("status {}", res.status()));
    }
    let ct = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_lowercase());
    let raw = res.bytes().await.map_err(|e| format!("read: {}", e))?;
    let unpacked: Vec<u8> = if raw.len() >= 2 && raw[0] == 0x1f && raw[1] == 0x8b {
        let mut decoder = flate2::read::GzDecoder::new(&raw[..]);
        let mut decoded = Vec::with_capacity(raw.len() * 4);
        decoder
            .read_to_end(&mut decoded)
            .map_err(|e| format!("gunzip: {}", e))?;
        decoded
    } else {
        raw.to_vec()
    };
    let (ext, bytes) = prepare_subtitle_download(
        &url,
        ct.as_deref(),
        format.as_deref(),
        encoding.as_deref(),
        lang.as_deref(),
        &unpacked,
    );
    let id = Uuid::new_v4();
    let path = sub_cache_dir().join(format!("{}.{}", id, ext));
    std::fs::write(&path, &bytes).map_err(|e| format!("write: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn mpv_stop(app: AppHandle, state: State<'_, MpvState>) -> Result<(), String> {
    let mut g = state.inner.lock().await;
    if let Some(session) = g.take() {
        #[cfg(target_os = "macos")]
        {
            let (tx, rx) = std::sync::mpsc::sync_channel::<()>(1);
            let _ = app.run_on_main_thread(move || {
                let _ = crate::mpv_render_mac::uninstall();
                let _ = session.mpv.command("quit", &[]);
                drop(session);
                let _ = tx.send(());
            });
            let _ = rx.recv_timeout(std::time::Duration::from_millis(4000));
        }
        #[cfg(target_os = "linux")]
        {
            let (tx, rx) = std::sync::mpsc::sync_channel::<()>(1);
            let _ = app.run_on_main_thread(move || {
                let _ = crate::mpv_render_linux::uninstall();
                let _ = session.mpv.command("quit", &[]);
                drop(session);
                let _ = tx.send(());
            });
            let _ = rx.recv_timeout(std::time::Duration::from_millis(4000));
        }
        #[cfg(all(not(target_os = "macos"), not(target_os = "linux")))]
        {
            let _ = session.mpv.command("quit", &[]);
            drop(session);
        }
    }
    #[cfg(windows)]
    {
        if let Ok(mut guard) = MPV_POS_LAST_RECT.lock() {
            *guard = None;
        }
        MPV_POS_LAST_COUNT.store(usize::MAX, std::sync::atomic::Ordering::Relaxed);
        // Orphan mpv child HWNDs can paint solid black under a transparent WebView.
        hide_embedded_mpv_children(&app);
        // Restore opaque WebView background when leaving embedded playback.
        crate::webview_helpers::apply_opaque(&app, "main");
    }
    #[cfg(not(windows))]
    {
        let _ = app;
    }
    Ok(())
}

/// Hide/destroy leftover mpv child windows under the main HWND so they cannot
/// cover the WebView after stop (stuck black surface).
#[cfg(windows)]
fn hide_embedded_mpv_children(app: &AppHandle) {
    use windows::core::BOOL;
    use windows::Win32::Foundation::{HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        DestroyWindow, EnumChildWindows, GetClassNameW, GetWindowTextW, SetWindowPos, HWND_BOTTOM,
        SWP_HIDEWINDOW, SWP_NOACTIVATE,
    };
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(parent_hwnd) = window.hwnd() else {
        return;
    };

    struct EnumState {
        mpv_hwnds: Vec<isize>,
    }
    let mut state = EnumState {
        mpv_hwnds: Vec::new(),
    };
    let state_ptr = &mut state as *mut EnumState;

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let mut class_buf = [0u16; 256];
        let class_len = GetClassNameW(hwnd, &mut class_buf);
        let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);
        let mut title_buf = [0u16; 256];
        let title_len = GetWindowTextW(hwnd, &mut title_buf);
        let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);
        let is_mpv = class_name == "mpv"
            || class_name.starts_with("mpv ")
            || (class_name.is_empty() && title.starts_with("Harbor"));
        if is_mpv {
            let s = lparam.0 as *mut EnumState;
            (*s).mpv_hwnds.push(hwnd.0 as isize);
        }
        BOOL(1)
    }

    unsafe {
        let _ = EnumChildWindows(
            Some(parent_hwnd),
            Some(enum_proc),
            LPARAM(state_ptr as isize),
        );
        for h in &state.mpv_hwnds {
            let target = HWND(*h as *mut _);
            let _ = SetWindowPos(
                target,
                Some(HWND_BOTTOM),
                -32000,
                -32000,
                1,
                1,
                SWP_NOACTIVATE | SWP_HIDEWINDOW,
            );
            // Best-effort destroy; ignore failures (mpv may already be tearing down).
            let _ = DestroyWindow(target);
        }
    }
    if !state.mpv_hwnds.is_empty() {
        eprintln!(
            "[harbor::mpv] cleaned {} embedded mpv child hwnd(s) after stop",
            state.mpv_hwnds.len()
        );
    }
}

#[cfg(windows)]
fn get_main_hwnd_str(app: &AppHandle) -> Option<String> {
    let window = app.get_webview_window("main")?;
    let hwnd = window.hwnd().ok()?;
    let raw: isize = hwnd.0 as isize;
    Some(raw.to_string())
}

#[cfg(target_os = "macos")]
static MAC_NSVIEW_CACHE: std::sync::OnceLock<i64> = std::sync::OnceLock::new();

#[cfg(target_os = "macos")]
fn get_main_hwnd_str(app: &AppHandle) -> Option<String> {
    if let Some(&v) = MAC_NSVIEW_CACHE.get() {
        if v == 0 {
            return None;
        }
        return Some(v.to_string());
    }
    use std::sync::mpsc;
    let window = app.get_webview_window("main")?;
    let (tx, rx) = mpsc::sync_channel::<i64>(1);
    window
        .with_webview(move |webview| {
            let raw = webview.inner() as *mut std::ffi::c_void as i64;
            let _ = tx.send(raw);
        })
        .ok()?;
    let v = rx.recv_timeout(Duration::from_millis(2000)).ok()?;
    let _ = MAC_NSVIEW_CACHE.set(v);
    eprintln!("[harbor::mpv] mac: captured NSView wid={:#x}", v);
    if v == 0 {
        return None;
    }
    Some(v.to_string())
}

#[cfg(all(not(windows), not(target_os = "macos")))]
fn get_main_hwnd_str(_app: &AppHandle) -> Option<String> {
    None
}

#[cfg(windows)]
const HARBOR_MPV_SUBCLASS_ID: usize = 0xA1B2C3D4;

#[cfg(windows)]
unsafe extern "system" fn mpv_subclass_proc(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
    _id: usize,
    _data: usize,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::Foundation::LRESULT;
    use windows::Win32::UI::Shell::DefSubclassProc;
    use windows::Win32::UI::WindowsAndMessaging::{HTTRANSPARENT, WM_APPCOMMAND, WM_NCHITTEST};
    if msg == WM_NCHITTEST {
        return LRESULT(HTTRANSPARENT as isize);
    }
    if msg == WM_APPCOMMAND {
        return LRESULT(1);
    }
    DefSubclassProc(hwnd, msg, wparam, lparam)
}

#[cfg(windows)]
static MPV_POS_LAST_COUNT: std::sync::atomic::AtomicUsize =
    std::sync::atomic::AtomicUsize::new(usize::MAX);

#[cfg(windows)]
static MPV_POS_LAST_RECT: std::sync::Mutex<Option<(isize, i32, i32, u32, u32)>> =
    std::sync::Mutex::new(None);

#[cfg(windows)]
static MPV_HDR_STAGE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[cfg(windows)]
fn position_embedded_mpv_child(app: &AppHandle, css: MpvGeometry) -> Result<(), String> {
    use windows::core::BOOL;
    use windows::Win32::Foundation::{HWND, LPARAM};
    use windows::Win32::Graphics::Gdi::{
        RedrawWindow, RDW_ALLCHILDREN, RDW_INVALIDATE, RDW_UPDATENOW,
    };
    use windows::Win32::UI::Shell::{RemoveWindowSubclass, SetWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumChildWindows, GetClassNameW, GetWindowLongW, GetWindowTextW, SetWindowLongW,
        SetWindowPos, GWL_EXSTYLE, HWND_BOTTOM, HWND_TOP, SWP_HIDEWINDOW, SWP_NOACTIVATE,
        SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, WS_EX_TRANSPARENT,
    };
    let hdr_stage = MPV_HDR_STAGE.load(std::sync::atomic::Ordering::Relaxed)
        && app
            .get_webview_window(crate::hdr_overlay::HDR_OVERLAY_LABEL)
            .is_some();
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    let parent_hwnd = window.hwnd().map_err(|e| format!("hwnd: {}", e))?;

    let (x, y, w, h) = {
        use windows::Win32::Foundation::RECT;
        use windows::Win32::UI::WindowsAndMessaging::GetClientRect;
        let mut rc = RECT::default();
        let ok = unsafe { GetClientRect(parent_hwnd, &mut rc).is_ok() };
        let (cw, ch) = (rc.right, rc.bottom);
        if !(ok && cw > 0 && ch > 0) {
            (0i32, 0i32, cw.max(1) as u32, ch.max(1) as u32)
        } else {
            let native = map_css_geometry(&css, cw as f64, ch as f64);
            (
                native.x.round() as i32,
                native.y.round() as i32,
                native.width.round().max(1.0) as u32,
                native.height.round().max(1.0) as u32,
            )
        }
    };

    struct EnumState {
        mpv_hwnds: Vec<isize>,
        all_classes: Vec<(isize, String, String)>,
    }
    let mut state = EnumState {
        mpv_hwnds: Vec::new(),
        all_classes: Vec::new(),
    };
    let state_ptr = &mut state as *mut EnumState;

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let mut class_buf = [0u16; 256];
        let class_len = GetClassNameW(hwnd, &mut class_buf);
        let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);
        let mut title_buf = [0u16; 256];
        let title_len = GetWindowTextW(hwnd, &mut title_buf);
        let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);
        let s = lparam.0 as *mut EnumState;
        (*s).all_classes
            .push((hwnd.0 as isize, class_name.clone(), title.clone()));
        let is_mpv = class_name == "mpv"
            || class_name.starts_with("mpv ")
            || (class_name.is_empty() && title.starts_with("Harbor"));
        if is_mpv {
            (*s).mpv_hwnds.push(hwnd.0 as isize);
        }
        BOOL(1)
    }

    unsafe {
        let _ = EnumChildWindows(
            Some(parent_hwnd),
            Some(enum_proc),
            LPARAM(state_ptr as isize),
        );
    }

    let prev_count =
        MPV_POS_LAST_COUNT.swap(state.mpv_hwnds.len(), std::sync::atomic::Ordering::Relaxed);
    if prev_count != state.mpv_hwnds.len() {
        eprintln!(
            "[harbor::mpv] enumerated {} children of main hwnd:",
            state.all_classes.len()
        );
        for (h, cls, title) in &state.all_classes {
            eprintln!("  hwnd={:#x} class={:?} title={:?}", h, cls, title);
        }
        eprintln!(
            "[harbor::mpv] mpv child matches found: {} (was {})",
            state.mpv_hwnds.len(),
            prev_count
        );
        eprintln!(
            "[harbor::mpv] requested rect x={} y={} w={} h={}",
            x, y, w, h
        );
    }

    let found = state.mpv_hwnds;
    if let Some(&first) = found.first() {
        for &leftover in found.iter().skip(1) {
            let target = HWND(leftover as *mut _);
            unsafe {
                let _ = SetWindowPos(
                    target,
                    Some(HWND_BOTTOM),
                    -32000,
                    -32000,
                    1,
                    1,
                    SWP_NOACTIVATE | SWP_HIDEWINDOW,
                );
            }
        }
        let new_rect = (first, x, y, w, h);
        let prev_rect = {
            let mut guard = MPV_POS_LAST_RECT.lock().unwrap();
            let prev = *guard;
            *guard = Some(new_rect);
            prev
        };
        let first_position = prev_rect.map(|r| r.0) != Some(first);
        let rect_unchanged = prev_rect == Some(new_rect);
        let target = HWND(first as *mut _);
        let z = if hdr_stage { HWND_TOP } else { HWND_BOTTOM };
        unsafe {
            if first_position {
                let cur_ex = GetWindowLongW(target, GWL_EXSTYLE);
                let want_ex = if hdr_stage {
                    cur_ex & !(WS_EX_TRANSPARENT.0 as i32)
                } else {
                    cur_ex | WS_EX_TRANSPARENT.0 as i32
                };
                if cur_ex != want_ex {
                    SetWindowLongW(target, GWL_EXSTYLE, want_ex);
                }
                if hdr_stage {
                    let _ = RemoveWindowSubclass(
                        target,
                        Some(mpv_subclass_proc),
                        HARBOR_MPV_SUBCLASS_ID,
                    );
                } else {
                    let _ = SetWindowSubclass(
                        target,
                        Some(mpv_subclass_proc),
                        HARBOR_MPV_SUBCLASS_ID,
                        0,
                    );
                }
                let _ = SetWindowPos(
                    target,
                    Some(z),
                    x,
                    y,
                    w as i32,
                    h as i32,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW,
                );
            } else if rect_unchanged {
                let _ = SetWindowPos(
                    target,
                    Some(z),
                    0,
                    0,
                    0,
                    0,
                    SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW,
                );
            } else {
                let _ = SetWindowPos(
                    target,
                    Some(z),
                    x,
                    y,
                    w as i32,
                    h as i32,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW,
                );
            }
            let _ = RedrawWindow(
                Some(target),
                None,
                None,
                RDW_INVALIDATE | RDW_UPDATENOW | RDW_ALLCHILDREN,
            );
        }
    }
    Ok(())
}

#[cfg(test)]
mod geometry_tests {
    use super::{map_css_geometry, MpvGeometry, NativeMpvRect};

    #[test]
    fn mpv_geometry_maps_a_zoomed_full_viewport_to_the_full_native_surface() {
        let css = MpvGeometry {
            css_left: 0.0,
            css_top: 0.0,
            css_width: 1221.428571,
            css_height: 742.857143,
            css_view_w: 1221.428571,
            css_view_h: 742.857143,
        };

        assert_eq!(
            map_css_geometry(&css, 1710.0, 1040.0),
            NativeMpvRect {
                x: 0.0,
                y: 0.0,
                width: 1710.0,
                height: 1040.0
            }
        );
    }

    #[test]
    fn mpv_geometry_scales_partial_rectangles_on_each_axis() {
        let css = MpvGeometry {
            css_left: 10.0,
            css_top: 20.0,
            css_width: 500.0,
            css_height: 300.0,
            css_view_w: 1000.0,
            css_view_h: 800.0,
        };

        assert_eq!(
            map_css_geometry(&css, 2000.0, 1200.0),
            NativeMpvRect {
                x: 20.0,
                y: 30.0,
                width: 1000.0,
                height: 450.0
            }
        );
    }

    #[test]
    fn mpv_geometry_falls_back_to_the_native_surface_for_invalid_viewports() {
        let css = MpvGeometry {
            css_left: 40.0,
            css_top: 30.0,
            css_width: 500.0,
            css_height: 300.0,
            css_view_w: 0.0,
            css_view_h: f64::NAN,
        };

        assert_eq!(
            map_css_geometry(&css, 1920.0, 1080.0),
            NativeMpvRect {
                x: 0.0,
                y: 0.0,
                width: 1920.0,
                height: 1080.0
            }
        );
    }
}

#[cfg(test)]
mod event_backoff_tests {
    use super::{record_event_poll_success, EventErrorBackoff, MPV_EVENT_MAX_CONSECUTIVE_ERRORS};
    use std::time::Duration;

    #[test]
    fn event_error_backoff_grows_caps_and_resets() {
        let mut backoff = EventErrorBackoff::default();
        assert_eq!(backoff.next_delay(), Some(Duration::from_millis(40)));
        assert_eq!(backoff.next_delay(), Some(Duration::from_millis(80)));
        assert_eq!(backoff.next_delay(), Some(Duration::from_millis(160)));
        backoff.reset();
        assert_eq!(backoff.next_delay(), Some(Duration::from_millis(40)));
        for _ in 1..MPV_EVENT_MAX_CONSECUTIVE_ERRORS {
            let _ = backoff.next_delay();
        }
        assert_eq!(backoff.next_delay(), None);
    }

    #[test]
    fn successful_empty_poll_resets_consecutive_errors() {
        let mut backoff = EventErrorBackoff::default();
        assert_eq!(backoff.next_delay(), Some(Duration::from_millis(40)));

        record_event_poll_success(&mut backoff);

        assert_eq!(backoff.next_delay(), Some(Duration::from_millis(40)));
    }
}
