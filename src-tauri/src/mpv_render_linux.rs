#![cfg(target_os = "linux")]

use std::cell::RefCell;
use std::ffi::{c_void, CString};
use std::os::raw::{c_char, c_int};
use std::ptr::NonNull;
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU64, Ordering};

use gtk::gdk;
use gtk::glib;
use gtk::glib::translate::{Stash, ToGlibPtr};
use gtk::prelude::*;
use libmpv2::render::{OpenGLInitParams, RenderContext, RenderParam, RenderParamApiType};
use libmpv2_sys::mpv_handle;

const GL_FRAMEBUFFER_BINDING: u32 = 0x8CA6;
const GL_FRAMEBUFFER: u32 = 0x8D40;
const GL_COLOR_ATTACHMENT0: u32 = 0x8CE0;
const GL_FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE: u32 = 0x8CD0;
const GL_FRAMEBUFFER_ATTACHMENT_OBJECT_NAME: u32 = 0x8CD1;
const GL_RENDERBUFFER: u32 = 0x8D41;
const GL_RENDERBUFFER_WIDTH: u32 = 0x8D42;
const GL_RENDERBUFFER_HEIGHT: u32 = 0x8D43;
const RTLD_DEFAULT: *mut c_void = std::ptr::null_mut();

extern "C" {
    fn dlsym(handle: *mut c_void, name: *const c_char) -> *mut c_void;
    fn gdk_x11_display_get_xdisplay(display: *mut c_void) -> *mut c_void;
    fn gdk_wayland_display_get_wl_display(display: *mut c_void) -> *mut c_void;
}

#[derive(Copy, Clone, PartialEq)]
enum Backend {
    X11,
    Wayland,
}

#[derive(Copy, Clone)]
struct MpvHandlePtr(NonNull<mpv_handle>);
unsafe impl Send for MpvHandlePtr {}

struct Pending {
    mpv: MpvHandlePtr,
    backend: Backend,
    display_native: u64,
}

struct Embed {
    area: gtk::GLArea,
    overlay: gtk::Overlay,
    gtk_window: gtk::ApplicationWindow,
    vbox: gtk::Box,
    web_view: gtk::Widget,
}

thread_local! {
    static EMBED: RefCell<Option<Embed>> = const { RefCell::new(None) };
    static PENDING: RefCell<Option<Pending>> = const { RefCell::new(None) };
}

static REDRAW_PENDING: AtomicBool = AtomicBool::new(false);
static PROC_WAYLAND: AtomicBool = AtomicBool::new(false);
static FBO_WIDTH: AtomicI32 = AtomicI32::new(-1);
static FBO_HEIGHT: AtomicI32 = AtomicI32::new(-1);
static LAST_SURFACE: AtomicU64 = AtomicU64::new(0);
static FBO_ZERO_WARNED: AtomicBool = AtomicBool::new(false);

type GlProcLoader = unsafe extern "C" fn(*const c_char) -> *mut c_void;

fn symbol_as_loader(name: &[u8]) -> Option<GlProcLoader> {
    let sym = unsafe { dlsym(RTLD_DEFAULT, name.as_ptr() as *const c_char) };
    (!sym.is_null()).then(|| unsafe { std::mem::transmute(sym) })
}

fn proc_loader() -> Option<unsafe extern "C" fn(*const c_char) -> *mut c_void> {
    if let Some(epoxy) = symbol_as_loader(b"epoxy_get_proc_address\0") {
        return Some(epoxy);
    }
    let primary = if PROC_WAYLAND.load(Ordering::Relaxed) {
        b"eglGetProcAddress\0".as_ptr()
    } else {
        b"glXGetProcAddressARB\0".as_ptr()
    };
    let sym = unsafe { dlsym(RTLD_DEFAULT, primary as *const c_char) };
    if !sym.is_null() {
        return Some(unsafe { std::mem::transmute(sym) });
    }
    let egl = unsafe { dlsym(RTLD_DEFAULT, b"eglGetProcAddress\0".as_ptr() as *const c_char) };
    if egl.is_null() {
        return None;
    }
    Some(unsafe { std::mem::transmute(egl) })
}

fn get_proc_address(_ctx: &(), name: &str) -> *mut c_void {
    let cstr = match CString::new(name) {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };
    if let Some(f) = proc_loader() {
        let p = unsafe { f(cstr.as_ptr()) };
        if !p.is_null() {
            return p;
        }
    }
    unsafe { dlsym(RTLD_DEFAULT, cstr.as_ptr()) }
}

fn resolve_gl<T>(name: &[u8]) -> Option<T> {
    let sym = unsafe { dlsym(RTLD_DEFAULT, name.as_ptr() as *const c_char) };
    if !sym.is_null() {
        return Some(unsafe { std::mem::transmute_copy(&sym) });
    }
    let f = proc_loader()?;
    let via = unsafe { f(name.as_ptr() as *const c_char) };
    if via.is_null() {
        return None;
    }
    Some(unsafe { std::mem::transmute_copy(&via) })
}

fn current_fbo() -> i32 {
    let getter: Option<unsafe extern "C" fn(u32, *mut c_int)> = resolve_gl(b"glGetIntegerv\0");
    match getter {
        Some(f) => {
            let mut id: c_int = 0;
            unsafe { f(GL_FRAMEBUFFER_BINDING, &mut id) };
            id
        }
        None => 0,
    }
}

fn query_fbo_dimensions() -> Option<(i32, i32)> {
    let get_attach: unsafe extern "C" fn(u32, u32, u32, *mut c_int) =
        resolve_gl(b"glGetFramebufferAttachmentParameteriv\0")?;
    let bind_rb: unsafe extern "C" fn(u32, u32) = resolve_gl(b"glBindRenderbuffer\0")?;
    let get_rb: unsafe extern "C" fn(u32, u32, *mut c_int) =
        resolve_gl(b"glGetRenderbufferParameteriv\0")?;

    let mut obj_type: c_int = 0;
    unsafe {
        get_attach(
            GL_FRAMEBUFFER,
            GL_COLOR_ATTACHMENT0,
            GL_FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE,
            &mut obj_type,
        );
    }
    if obj_type != GL_RENDERBUFFER as c_int {
        return None;
    }
    let mut rb_id: c_int = 0;
    unsafe {
        get_attach(
            GL_FRAMEBUFFER,
            GL_COLOR_ATTACHMENT0,
            GL_FRAMEBUFFER_ATTACHMENT_OBJECT_NAME,
            &mut rb_id,
        );
    }
    if rb_id <= 0 {
        return None;
    }
    let mut w: c_int = 0;
    let mut h: c_int = 0;
    unsafe {
        bind_rb(GL_RENDERBUFFER, rb_id as u32);
        get_rb(GL_RENDERBUFFER, GL_RENDERBUFFER_WIDTH, &mut w);
        get_rb(GL_RENDERBUFFER, GL_RENDERBUFFER_HEIGHT, &mut h);
        bind_rb(GL_RENDERBUFFER, 0);
    }
    (w > 0 && h > 0).then_some((w, h))
}

fn detect_backend() -> Backend {
    if let Some(display) = gdk::Display::default() {
        let name = display.type_().name();
        if name.contains("Wayland") {
            return Backend::Wayland;
        }
        if name.contains("X11") {
            return Backend::X11;
        }
    }
    match std::env::var("XDG_SESSION_TYPE") {
        Ok(v) if v.eq_ignore_ascii_case("wayland") => Backend::Wayland,
        _ => Backend::X11,
    }
}

fn native_display(backend: Backend) -> u64 {
    let Some(display) = gdk::Display::default() else {
        return 0;
    };
    let stash: Stash<'_, *mut gdk::ffi::GdkDisplay, gdk::Display> = display.to_glib_none();
    let raw = stash.0 as *mut c_void;
    if raw.is_null() {
        return 0;
    }
    let native = match backend {
        Backend::X11 => unsafe { gdk_x11_display_get_xdisplay(raw) },
        Backend::Wayland => unsafe { gdk_wayland_display_get_wl_display(raw) },
    };
    native as u64
}

pub fn configure_nvidia_graphics() {
    if !std::path::Path::new("/proc/driver/nvidia/version").exists() {
        return;
    }
    let wayland = std::env::var("XDG_SESSION_TYPE")
        .map(|v| v.eq_ignore_ascii_case("wayland"))
        .unwrap_or(false)
        || std::env::var("WAYLAND_DISPLAY")
            .map(|v| !v.is_empty())
            .unwrap_or(false);
    if wayland {
        if std::env::var("__NV_DISABLE_EXPLICIT_SYNC").is_err() {
            eprintln!("[harbor::mpv_linux] NVIDIA + Wayland detected; setting __NV_DISABLE_EXPLICIT_SYNC=1");
            std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");
        }
        return;
    }
    if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
        eprintln!(
            "[harbor::mpv_linux] NVIDIA + X11 detected; setting WEBKIT_DISABLE_DMABUF_RENDERER=1"
        );
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}

pub fn prepare(mpv_ctx: NonNull<mpv_handle>) -> Result<(), String> {
    let backend = detect_backend();
    PROC_WAYLAND.store(backend == Backend::Wayland, Ordering::Relaxed);
    let display_native = native_display(backend);
    PENDING.with(|slot| {
        *slot.borrow_mut() = Some(Pending {
            mpv: MpvHandlePtr(mpv_ctx),
            backend,
            display_native,
        })
    });
    Ok(())
}

pub fn install(gtk_window: &gtk::ApplicationWindow, vbox: &gtk::Box) -> Result<(), String> {
    if let Some(stale) = EMBED.with(|slot| slot.borrow_mut().take()) {
        restore_webview(stale);
    }
    let pending = PENDING
        .with(|slot| slot.borrow_mut().take())
        .ok_or_else(|| "no pending mpv ctx for linux install".to_string())?;

    apply_rgba_visual(gtk_window);
    let web_view = vbox
        .children()
        .into_iter()
        .next()
        .ok_or_else(|| "no webview child in vbox".to_string())?;

    let overlay = gtk::Overlay::new();
    let area = gtk::GLArea::new();
    // libmpv's update callback is the frame clock. Rendering on every GTK draw
    // as well would duplicate work whenever the transparent WebView repaints.
    area.set_auto_render(false);
    area.set_use_es(false);
    area.set_has_depth_buffer(false);
    area.set_has_stencil_buffer(false);
    area.set_app_paintable(true);
    // GLArea fills the full overlay via GTK expand flags. This avoids
    // set_size_request which on Wayland constrains the window's minimum
    // size to the video resolution.
    area.set_hexpand(true);
    area.set_vexpand(true);

    gtk_window.remove(vbox);
    vbox.remove(&web_view);
    overlay.add(&area);
    overlay.add_overlay(&web_view);
    overlay.set_overlay_pass_through(&web_view, false);
    gtk_window.add(&overlay);

    set_webview_transparent(&web_view);
    overlay.show_all();

    let render_cell: Rc<RefCell<Option<RenderContext>>> = Rc::new(RefCell::new(None));
    let mpv = pending.mpv;
    let backend = pending.backend;
    let display_native = pending.display_native;

    // Invalidate cached FBO dimensions on GLArea resize so the next
    // render call re-queries the physical GPU dimensions. This avoids
    // synchronous GL queries on every frame.
    let area_clone = area.clone();
    area.connect_resize(move |_a, _w, _h| {
        FBO_WIDTH.store(-1, Ordering::Relaxed);
        FBO_HEIGHT.store(-1, Ordering::Relaxed);
        area_clone.queue_render();
    });

    area.connect_render(move |area, _ctx| {
        let mut slot = render_cell.borrow_mut();
        if slot.is_none() {
            match build_render_context(mpv, backend, display_native) {
                Ok(mut rc) => {
                    rc.set_update_callback(|| schedule_redraw());
                    *slot = Some(rc);
                }
                Err(e) => {
                    eprintln!("[harbor::mpv_linux] render ctx init failed: {}", e);
                    return glib::Propagation::Proceed;
                }
            }
        }
        if let Some(rc) = slot.as_ref() {
            do_render(rc, area);
        }
        glib::Propagation::Stop
    });

    EMBED.with(|slot| {
        *slot.borrow_mut() = Some(Embed {
            area: area.clone(),
            overlay,
            gtk_window: gtk_window.clone(),
            vbox: vbox.clone(),
            web_view,
        })
    });

    area.queue_render();
    eprintln!("[harbor::mpv_linux] installed backend={}", backend_label(backend));
    Ok(())
}

fn build_render_context(
    mpv: MpvHandlePtr,
    backend: Backend,
    display_native: u64,
) -> Result<RenderContext, String> {
    let init_params = OpenGLInitParams::<()> {
        get_proc_address,
        ctx: (),
    };
    let mut params: Vec<RenderParam<()>> = vec![
        RenderParam::ApiType(RenderParamApiType::OpenGl),
        RenderParam::InitParams(init_params),
    ];
    if display_native != 0 {
        let ptr = display_native as *const c_void;
        match backend {
            Backend::X11 => params.push(RenderParam::X11Display(ptr)),
            Backend::Wayland => params.push(RenderParam::WaylandDisplay(ptr)),
        }
    }
    let mpv_ref: &mut mpv_handle = unsafe { &mut *mpv.0.as_ptr() };
    RenderContext::new(mpv_ref, params).map_err(|e| format!("render init: {:?}", e))
}

fn do_render(rc: &RenderContext, area: &gtk::GLArea) {
    area.attach_buffers();
    let fbo = current_fbo();

    let mut w = FBO_WIDTH.load(Ordering::Relaxed);
    let mut h = FBO_HEIGHT.load(Ordering::Relaxed);
    if w <= 0 || h <= 0 {
        // Query physical FBO dimensions on first render or after resize.
        // This avoids synchronous GL queries on every frame; the result
        // is cached and only invalidated by the GLArea::resize signal.
        if let Some((mw, mh)) = query_fbo_dimensions() {
            w = mw;
            h = mh;
        } else {
            w = area.allocated_width().max(1);
            h = area.allocated_height().max(1);
        }
        FBO_WIDTH.store(w, Ordering::Relaxed);
        FBO_HEIGHT.store(h, Ordering::Relaxed);
    }

    let packed = ((w as u64) << 32) | (h as u32 as u64);
    if LAST_SURFACE.swap(packed, Ordering::Relaxed) != packed {
        eprintln!(
            "[harbor::mpv_linux] render surface {}x{} px",
            w, h,
        );
    }
    if fbo == 0 && !FBO_ZERO_WARNED.swap(true, Ordering::Relaxed) {
        eprintln!("[harbor::mpv_linux] WARNING: GtkGLArea FBO query returned 0; mpv will render to the default framebuffer and the video region will stay BLACK. glGetIntegerv or the GL proc loader likely failed to resolve.");
    }
    let _ = rc.render::<()>(fbo, w, h, true);
}

// On Wayland, the GLArea fills the full window via GTK expand flags,
// so geometry tracking is not needed. This function is kept for API
// compatibility but is a no-op on Linux.
pub fn resize_to(_css: crate::mpv::MpvGeometry) -> Result<(), String> {
    EMBED.with(|slot| {
        if let Some(embed) = slot.borrow().as_ref() {
            embed.area.queue_render();
        }
    });
    Ok(())
}

pub fn uninstall() -> Result<(), String> {
    let Some(embed) = EMBED.with(|slot| slot.borrow_mut().take()) else {
        return Ok(());
    };
    restore_webview(embed);
    eprintln!("[harbor::mpv_linux] uninstalled");
    Ok(())
}

fn restore_webview(embed: Embed) {
    set_webview_opaque(&embed.web_view);
    if let Some(parent) = embed.web_view.parent() {
        if let Some(container) = parent.downcast_ref::<gtk::Container>() {
            container.remove(&embed.web_view);
        }
    }
    if embed.overlay.parent().is_some() {
        if let Some(parent) = embed.overlay.parent() {
            if let Some(container) = parent.downcast_ref::<gtk::Container>() {
                container.remove(&embed.overlay);
            }
        }
    }
    if embed.web_view.parent().is_none() {
        embed.vbox.pack_start(&embed.web_view, true, true, 0);
        embed.web_view.show();
    }
    if embed.vbox.parent().is_none() {
        embed.gtk_window.add(&embed.vbox);
    }
    embed.vbox.show_all();
}

fn schedule_redraw() {
    if REDRAW_PENDING.swap(true, Ordering::AcqRel) {
        return;
    }
    glib::idle_add(|| {
        REDRAW_PENDING.store(false, Ordering::Release);
        EMBED.with(|slot| {
            if let Some(embed) = slot.borrow().as_ref() {
                embed.area.queue_render();
            }
        });
        glib::ControlFlow::Break
    });
}

fn apply_rgba_visual(window: &gtk::ApplicationWindow) {
    if let Some(screen) = GtkWindowExt::screen(window) {
        if let Some(visual) = screen.rgba_visual() {
            window.set_visual(Some(&visual));
            window.set_app_paintable(true);
        }
    }
}

fn set_webview_transparent(web_view: &gtk::Widget) {
    web_view.set_app_paintable(true);
    set_webview_bg_alpha(web_view, 0.0);
}

fn set_webview_opaque(web_view: &gtk::Widget) {
    web_view.set_app_paintable(false);
    set_webview_bg_alpha(web_view, 1.0);
}

fn set_webview_bg_alpha(web_view: &gtk::Widget, alpha: f64) {
    let setter: Option<unsafe extern "C" fn(*mut c_void, *const GdkRgba)> =
        resolve_symbol(b"webkit_web_view_set_background_color\0");
    if let Some(f) = setter {
        let stash: Stash<'_, *mut gtk::ffi::GtkWidget, gtk::Widget> = web_view.to_glib_none();
        let ptr = stash.0 as *mut c_void;
        let color = GdkRgba {
            red: 0.0,
            green: 0.0,
            blue: 0.0,
            alpha,
        };
        unsafe { f(ptr, &color) };
    }
}

fn resolve_symbol<T>(name: &[u8]) -> Option<T> {
    let sym = unsafe { dlsym(RTLD_DEFAULT, name.as_ptr() as *const c_char) };
    if sym.is_null() {
        return None;
    }
    Some(unsafe { std::mem::transmute_copy(&sym) })
}

#[repr(C)]
struct GdkRgba {
    red: f64,
    green: f64,
    blue: f64,
    alpha: f64,
}

fn backend_label(backend: Backend) -> &'static str {
    match backend {
        Backend::X11 => "x11",
        Backend::Wayland => "wayland",
    }
}
