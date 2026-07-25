#![cfg(target_os = "macos")]

use std::ffi::{c_char, c_void, CString};
use std::ptr::NonNull;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};

use libmpv2::render::{OpenGLInitParams, RenderContext, RenderParam, RenderParamApiType};
use libmpv2_sys::mpv_handle;
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2::{msg_send, AnyThread, ClassType, MainThreadOnly, Message};
use objc2_app_kit::{NSOpenGLPixelFormat, NSOpenGLView, NSView, NSWindow};
use objc2_foundation::{MainThreadMarker, NSNumber, NSString};

use crate::mpv::{map_css_geometry, MpvGeometry};

const NSOPENGLPFA_OPENGL_PROFILE: u32 = 99;
const NSOPENGLPFA_DOUBLEBUFFER: u32 = 5;
const NSOPENGLPFA_COLOR_SIZE: u32 = 8;
const NSOPENGLPFA_COLOR_FLOAT: u32 = 58;
const NSOPENGLPFA_DEPTH_SIZE: u32 = 12;
const NSOPENGLPFA_ACCELERATED: u32 = 73;
const NSOPENGLPFA_NO_RECOVERY: u32 = 72;
const NSOPENGL_PROFILE_VERSION_3_2_CORE: u32 = 0x3200;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    #[allow(dead_code)]
    static kCGColorSpaceExtendedLinearDisplayP3: *const c_void;
    // apply_mac_edr() drives mpv with target-trc=pq, so the video surface has
    // to be tagged with a matching PQ space or the values are read as linear.
    static kCGColorSpaceITUR_2100_PQ: *const c_void;
    static kCGColorSpaceDisplayP3_PQ: *const c_void;
    fn CGColorSpaceCreateWithName(name: *const c_void) -> *mut c_void;
    fn CGColorSpaceRelease(space: *mut c_void);
}

const NS_VIEW_AUTORESIZE_WIDTH: usize = 2;
const NS_VIEW_AUTORESIZE_HEIGHT: usize = 16;

const NSOPENGL_CONTEXT_PARAM_SURFACE_OPACITY: i32 = 236;

extern "C" {
    fn dlsym(handle: *mut c_void, name: *const c_char) -> *mut c_void;
    fn dispatch_async_f(queue: *mut c_void, ctx: *mut c_void, work: extern "C" fn(*mut c_void));
    static _dispatch_main_q: c_void;
}
const RTLD_DEFAULT: *mut c_void = -2isize as *mut c_void;

/// Convert a rect expressed in the parent window's contentView coordinates
/// into screen coordinates, so the video child window can be positioned.
unsafe fn content_rect_to_screen(
    parent: &NSWindow,
    rect: objc2_foundation::NSRect,
) -> objc2_foundation::NSRect {
    let Some(content_view) = parent.contentView() else {
        return rect;
    };
    let nil_view: *const AnyObject = std::ptr::null();
    let in_window: objc2_foundation::NSRect =
        msg_send![&*content_view, convertRect: rect, toView: nil_view];
    msg_send![parent, convertRectToScreen: in_window]
}

fn main_queue() -> *mut c_void {
    unsafe { (&_dispatch_main_q as *const c_void) as *mut c_void }
}

pub struct Embed {
    view: Retained<NSOpenGLView>,
    web_view: Option<Retained<NSView>>,
    web_view_was_opaque: bool,
    ns_window: Retained<NSWindow>,
    // The GL surface lives in its own borderless child window so the HDR
    // colorspace can be applied to the video alone. NSWindow::setColorSpace is
    // per-window, so tagging the main window would also re-interpret the sRGB
    // WebView UI drawn on top of it (see #361).
    video_window: Retained<NSWindow>,
    edr: bool,
    render: Mutex<RenderContext>,
}

// SAFETY: the mutex moves ownership into a process-global slot, but every path
// that touches or drops AppKit state first verifies it is on the main thread.
unsafe impl Send for Embed {}

static EMBED: OnceLock<Mutex<Option<Embed>>> = OnceLock::new();

fn slot() -> &'static Mutex<Option<Embed>> {
    EMBED.get_or_init(|| Mutex::new(None))
}

pub fn install(mpv_ctx: NonNull<mpv_handle>, ns_window_ptr: i64, edr: bool) -> Result<(), String> {
    let mtm = MainThreadMarker::new()
        .ok_or_else(|| "mpv_render_mac::install must run on main thread".to_string())?;
    if ns_window_ptr == 0 {
        return Err("ns_window_ptr is zero".into());
    }

    let stale = {
        slot()
            .lock()
            .map_err(|e| format!("slot lock: {}", e))?
            .take()
    };
    if let Some(stale) = stale {
        eprintln!("[harbor::mpv_mac] replacing stale embed on the main thread");
        teardown_embed(stale);
    }

    unsafe {
        let raw_window: *mut AnyObject = ns_window_ptr as *mut AnyObject;
        let ns_window: &NSWindow = &*(raw_window as *const NSWindow);
        let content_view = ns_window
            .contentView()
            .ok_or_else(|| "NSWindow has no contentView".to_string())?;
        let bounds = content_view.bounds();
        eprintln!(
            "[harbor::mpv_mac] contentView bounds: {}x{}",
            bounds.size.width, bounds.size.height
        );

        let make_pf = |float: bool| -> Option<Retained<NSOpenGLPixelFormat>> {
            let attrs: [u32; 15] = if float {
                [
                    NSOPENGLPFA_OPENGL_PROFILE,
                    NSOPENGL_PROFILE_VERSION_3_2_CORE,
                    NSOPENGLPFA_DOUBLEBUFFER,
                    1,
                    NSOPENGLPFA_ACCELERATED,
                    1,
                    NSOPENGLPFA_NO_RECOVERY,
                    1,
                    NSOPENGLPFA_COLOR_FLOAT,
                    1,
                    NSOPENGLPFA_COLOR_SIZE,
                    64,
                    NSOPENGLPFA_DEPTH_SIZE,
                    16,
                    0,
                ]
            } else {
                [
                    NSOPENGLPFA_OPENGL_PROFILE,
                    NSOPENGL_PROFILE_VERSION_3_2_CORE,
                    NSOPENGLPFA_DOUBLEBUFFER,
                    1,
                    NSOPENGLPFA_ACCELERATED,
                    1,
                    NSOPENGLPFA_NO_RECOVERY,
                    1,
                    NSOPENGLPFA_COLOR_SIZE,
                    24,
                    NSOPENGLPFA_DEPTH_SIZE,
                    16,
                    0,
                    0,
                    0,
                ]
            };
            let pf_alloc = NSOpenGLPixelFormat::alloc();
            msg_send![pf_alloc, initWithAttributes: attrs.as_ptr()]
        };

        let pf = if edr {
            make_pf(true).or_else(|| make_pf(false))
        } else {
            make_pf(false)
        }
        .ok_or_else(|| "NSOpenGLPixelFormat init failed".to_string())?;

        let view_alloc = NSOpenGLView::alloc(mtm);
        let view: Option<Retained<NSOpenGLView>> = msg_send![
            view_alloc,
            initWithFrame: bounds,
            pixelFormat: &*pf,
        ];
        let view = view.ok_or_else(|| "NSOpenGLView init failed".to_string())?;
        let _: () = msg_send![&*view, setWantsBestResolutionOpenGLSurface: true];
        if edr {
            let _: () = msg_send![&*view, setWantsExtendedDynamicRangeOpenGLSurface: true];
        }
        let view_as_view: &NSView = view.as_super();

        let subviews = content_view.subviews();
        let first_subview: Option<Retained<NSView>> = subviews.firstObject();

        // Borderless child window that carries only the video surface.
        let screen_rect = content_rect_to_screen(ns_window, bounds);
        let win_alloc = NSWindow::alloc(mtm);
        let style_borderless: usize = 0;
        let backing_buffered: usize = 2;
        let video_window: Option<Retained<NSWindow>> = msg_send![
            win_alloc,
            initWithContentRect: screen_rect,
            styleMask: style_borderless,
            backing: backing_buffered,
            defer: false,
        ];
        let video_window =
            video_window.ok_or_else(|| "video NSWindow init failed".to_string())?;
        let _: () = msg_send![&*video_window, setOpaque: true];
        let _: () = msg_send![&*video_window, setHasShadow: false];
        let _: () = msg_send![&*video_window, setIgnoresMouseEvents: true];
        let _: () = msg_send![&*video_window, setReleasedWhenClosed: false];
        let black_bg: *mut AnyObject = msg_send![objc2::class!(NSColor), blackColor];
        let _: () = msg_send![&*video_window, setBackgroundColor: black_bg];
        let _: () = msg_send![&*video_window, setContentView: view_as_view];
        let mask = NS_VIEW_AUTORESIZE_WIDTH | NS_VIEW_AUTORESIZE_HEIGHT;
        let _: () = msg_send![view_as_view, setAutoresizingMask: mask];
        let ordered_below: isize = -1;
        let _: () = msg_send![
            ns_window,
            addChildWindow: &*video_window,
            ordered: ordered_below,
        ];
        // The child window is ordered behind the parent, so the parent has to
        // stay non-opaque for the video to show through it.
        let _: () = msg_send![ns_window, setOpaque: false];
        let clear_bg: *mut AnyObject = msg_send![objc2::class!(NSColor), clearColor];
        let _: () = msg_send![ns_window, setBackgroundColor: clear_bg];
        eprintln!("[harbor::mpv_mac] video child window attached");

        let _: () = msg_send![view_as_view, setWantsLayer: true];
        if let Some(layer) = view_as_view.layer() {
            let black: *mut AnyObject = msg_send![objc2::class!(NSColor), blackColor];
            let cg_black: *mut AnyObject = msg_send![&*black, CGColor];
            let _: () = msg_send![&*layer, setBackgroundColor: cg_black];
            let _: () = msg_send![&*layer, setOpaque: true];
        }

        let gl_ctx = view
            .openGLContext()
            .ok_or_else(|| "openGLContext was nil".to_string())?;
        gl_ctx.makeCurrentContext();
        let opaque_value: i32 = 1;
        let _: () = msg_send![
            &*gl_ctx,
            setValues: (&opaque_value) as *const i32,
            forParameter: NSOPENGL_CONTEXT_PARAM_SURFACE_OPACITY,
        ];

        let mut web_view_was_opaque = true;
        if let Some(wv) = first_subview.as_deref() {
            let was_opaque: bool = msg_send![wv, isOpaque];
            web_view_was_opaque = was_opaque;
            let _: () = msg_send![wv, setWantsLayer: true];
            let no_num = NSNumber::new_bool(false);
            let key = NSString::from_str("drawsBackground");
            let _: () = msg_send![wv, setValue: &*no_num, forKey: &*key];
            if let Some(layer) = wv.layer() {
                let _: () = msg_send![&*layer, setOpaque: false];
            }
        }

        let init_params = OpenGLInitParams::<()> {
            get_proc_address,
            ctx: (),
        };
        let params: Vec<RenderParam<()>> = vec![
            RenderParam::ApiType(RenderParamApiType::OpenGl),
            RenderParam::InitParams(init_params),
        ];
        let mpv_handle_ref: &mut mpv_handle = &mut *mpv_ctx.as_ptr();
        let mut render = RenderContext::new(mpv_handle_ref, params)
            .map_err(|e| format!("render init: {:?}", e))?;

        render.set_update_callback(|| {
            schedule_redraw();
        });

        *slot().lock().map_err(|e| format!("slot lock: {}", e))? = Some(Embed {
            view,
            web_view: first_subview,
            web_view_was_opaque,
            ns_window: ns_window.retain(),
            video_window,
            edr,
            render: Mutex::new(render),
        });

        eprintln!("[harbor::mpv_mac] installed");
    }
    Ok(())
}

pub fn set_hdr_active(active: bool, bt2020: bool) {
    if MainThreadMarker::new().is_none() {
        eprintln!("[harbor::mpv_mac] ignored HDR update off the main thread");
        return;
    }
    let Ok(guard) = slot().lock() else {
        return;
    };
    let Some(embed) = guard.as_ref() else {
        return;
    };
    if !embed.edr {
        return;
    }
    unsafe {
        let view_as_view: &NSView = embed.view.as_super();
        let _: () = msg_send![view_as_view, setWantsExtendedDynamicRangeOpenGLSurface: active];
        if active {
            // Match the primaries apply_mac_edr() told mpv to output.
            let space_name = if bt2020 {
                kCGColorSpaceITUR_2100_PQ
            } else {
                kCGColorSpaceDisplayP3_PQ
            };
            let cg = CGColorSpaceCreateWithName(space_name);
            if !cg.is_null() {
                let nscs_alloc: *mut AnyObject = msg_send![objc2::class!(NSColorSpace), alloc];
                let nscs: *mut AnyObject = msg_send![nscs_alloc, initWithCGColorSpace: cg];
                if !nscs.is_null() {
                    // Only the video window: the parent keeps its sRGB space so
                    // the WebView UI is not re-interpreted.
                    let _: () = msg_send![&*embed.video_window, setColorSpace: nscs];
                    eprintln!(
                        "[harbor::mpv_mac] HDR on: video window tagged {} (PQ)",
                        if bt2020 { "BT.2020" } else { "Display P3" }
                    );
                }
                CGColorSpaceRelease(cg);
            }
        } else {
            let nil: *mut AnyObject = std::ptr::null_mut();
            let _: () = msg_send![&*embed.video_window, setColorSpace: nil];
            eprintln!("[harbor::mpv_mac] HDR off: video window colorspace reset");
        }
    }
    schedule_redraw();
}

pub fn install_window_rounding(ns_window_ptr: i64) -> Result<(), String> {
    let _mtm = MainThreadMarker::new().ok_or_else(|| "must run on main thread".to_string())?;
    if ns_window_ptr == 0 {
        return Err("ns_window_ptr is zero".into());
    }
    unsafe {
        use objc2::class;
        let raw_window: *mut AnyObject = ns_window_ptr as *mut AnyObject;
        let ns_window: &NSWindow = &*(raw_window as *const NSWindow);
        let _: () = msg_send![ns_window, setOpaque: false];
        let _: () = msg_send![ns_window, setHasShadow: true];
        let clear: *mut AnyObject = msg_send![class!(NSColor), clearColor];
        let _: () = msg_send![ns_window, setBackgroundColor: clear];
        if let Some(content_view) = ns_window.contentView() {
            let _: () = msg_send![&*content_view, setWantsLayer: true];
            if let Some(layer) = content_view.layer() {
                let radius: f64 = 14.0;
                let _: () = msg_send![&*layer, setCornerRadius: radius];
                let _: () = msg_send![&*layer, setMasksToBounds: true];
                let cg_clear: *mut AnyObject = msg_send![&*clear, CGColor];
                let _: () = msg_send![&*layer, setBackgroundColor: cg_clear];
            }
        }
    }
    Ok(())
}

pub fn make_resizable(ns_window_ptr: i64) -> Result<(), String> {
    let _mtm = MainThreadMarker::new().ok_or_else(|| "must run on main thread".to_string())?;
    if ns_window_ptr == 0 {
        return Err("ns_window_ptr is zero".into());
    }
    unsafe {
        let raw_window: *mut AnyObject = ns_window_ptr as *mut AnyObject;
        let ns_window: &NSWindow = &*(raw_window as *const NSWindow);
        let current: usize = msg_send![ns_window, styleMask];
        let resizable = 1usize << 3;
        let miniaturizable = 1usize << 2;
        let _: () = msg_send![ns_window, setStyleMask: current | resizable | miniaturizable];
    }
    Ok(())
}

pub fn resize_to(css: MpvGeometry) -> Result<(), String> {
    let _mtm =
        MainThreadMarker::new().ok_or_else(|| "resize_to must run on main thread".to_string())?;
    let guard = slot().lock().map_err(|e| format!("slot lock: {}", e))?;
    let Some(embed) = guard.as_ref() else {
        return Ok(());
    };
    unsafe {
        // The GL view now fills its own child window, so geometry updates move
        // that window instead of repositioning a subview.
        let parent_content = embed
            .ns_window
            .contentView()
            .ok_or_else(|| "parent window has no contentView".to_string())?;
        let parent_bounds = parent_content.bounds();
        let native = map_css_geometry(&css, parent_bounds.size.width, parent_bounds.size.height);
        let native_y = if parent_content.isFlipped() {
            native.y
        } else {
            parent_bounds.size.height - native.y - native.height
        };
        let rect_in_content = objc2_foundation::NSRect {
            origin: objc2_foundation::NSPoint {
                x: native.x,
                y: native_y,
            },
            size: objc2_foundation::NSSize {
                width: native.width,
                height: native.height,
            },
        };
        let screen_rect = content_rect_to_screen(&embed.ns_window, rect_in_content);
        let _: () = msg_send![&*embed.video_window, setFrame: screen_rect, display: true];
        if let Some(gl_ctx) = embed.view.openGLContext() {
            let _: () = msg_send![&*gl_ctx, update];
        }
    }
    schedule_redraw();
    Ok(())
}

pub fn render_now() -> Result<(), String> {
    let _mtm =
        MainThreadMarker::new().ok_or_else(|| "render_now must run on main thread".to_string())?;
    let guard = slot().lock().map_err(|e| format!("slot lock: {}", e))?;
    let Some(embed) = guard.as_ref() else {
        return Ok(());
    };
    unsafe {
        let gl_ctx = embed
            .view
            .openGLContext()
            .ok_or_else(|| "openGLContext nil".to_string())?;
        gl_ctx.makeCurrentContext();
        let view_as_view: &NSView = embed.view.as_super();
        let bounds = view_as_view.bounds();
        let backing: objc2_foundation::NSRect =
            msg_send![view_as_view, convertRectToBacking: bounds];
        let mut w = backing.size.width as i32;
        let mut h = backing.size.height as i32;
        if w <= 0 || h <= 0 {
            let scale = view_as_view
                .window()
                .map(|win| win.backingScaleFactor())
                .filter(|s| *s > 0.0)
                .unwrap_or(2.0);
            w = (bounds.size.width * scale) as i32;
            h = (bounds.size.height * scale) as i32;
        }
        if w <= 0 || h <= 0 {
            return Ok(());
        }
        let packed = ((w as u64) << 32) | (h as u32 as u64);
        if LAST_SURFACE.swap(packed, Ordering::Relaxed) != packed {
            eprintln!(
                "[harbor::mpv_mac] render surface {}x{} px (bounds {}x{} pt)",
                w, h, bounds.size.width as i32, bounds.size.height as i32
            );
        }
        let render = embed
            .render
            .lock()
            .map_err(|e| format!("render lock: {}", e))?;
        render
            .render::<()>(0, w, h, true)
            .map_err(|e| format!("render: {:?}", e))?;
        gl_ctx.flushBuffer();
    }
    Ok(())
}

pub fn uninstall() -> Result<(), String> {
    let _mtm =
        MainThreadMarker::new().ok_or_else(|| "uninstall must run on main thread".to_string())?;
    let embed = {
        slot()
            .lock()
            .map_err(|e| format!("slot lock: {}", e))?
            .take()
    };
    let Some(embed) = embed else {
        return Ok(());
    };
    teardown_embed(embed);
    eprintln!("[harbor::mpv_mac] uninstalled");
    Ok(())
}

fn teardown_embed(embed: Embed) {
    unsafe {
        let _: () = msg_send![&*embed.ns_window, removeChildWindow: &*embed.video_window];
        let _: () = msg_send![&*embed.video_window, orderOut: std::ptr::null::<AnyObject>()];
        let view_as_view: &NSView = embed.view.as_super();
        view_as_view.removeFromSuperview();
        if let Some(wv) = embed.web_view.as_deref() {
            let restored = embed.web_view_was_opaque;
            let restored_num = NSNumber::new_bool(restored);
            let key = NSString::from_str("drawsBackground");
            let _: () = msg_send![wv, setValue: &*restored_num, forKey: &*key];
            if let Some(layer) = wv.layer() {
                let _: () = msg_send![&*layer, setOpaque: restored];
            }
        }
    }
}

fn get_proc_address(_ctx: &(), name: &str) -> *mut c_void {
    let cstr = match CString::new(name) {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };
    unsafe { dlsym(RTLD_DEFAULT, cstr.as_ptr()) }
}

static REDRAW_PENDING: AtomicBool = AtomicBool::new(false);
static LAST_SURFACE: AtomicU64 = AtomicU64::new(0);

fn schedule_redraw() {
    if REDRAW_PENDING.swap(true, Ordering::AcqRel) {
        return;
    }
    extern "C" fn redraw_cb(_ctx: *mut c_void) {
        REDRAW_PENDING.store(false, Ordering::Release);
        let _ = render_now();
    }
    unsafe {
        dispatch_async_f(main_queue(), std::ptr::null_mut(), redraw_cb);
    }
}
