use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Wry};

static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(false);
static ALWAYS_ON_TOP: AtomicBool = AtomicBool::new(false);
static PAUSE_MINIMIZED: AtomicBool = AtomicBool::new(true);
static PAUSE_UNFOCUSED: AtomicBool = AtomicBool::new(false);

pub fn close_to_tray() -> bool {
    CLOSE_TO_TRAY.load(Ordering::Relaxed)
}

pub fn always_on_top_pref() -> bool {
    ALWAYS_ON_TOP.load(Ordering::Relaxed)
}

pub fn pause_when_minimized() -> bool {
    PAUSE_MINIMIZED.load(Ordering::Relaxed)
}

#[derive(Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct TrayPrefs {
    pub close_to_tray: bool,
    pub always_on_top: bool,
    pub pause_minimized: bool,
    pub pause_unfocused: bool,
}

#[derive(Clone, Copy)]
enum Pref {
    CloseToTray,
    AlwaysOnTop,
    PauseMinimized,
    PauseUnfocused,
}

struct TrayItems {
    always_on_top: CheckMenuItem<Wry>,
    pause_minimized: CheckMenuItem<Wry>,
    pause_unfocused: CheckMenuItem<Wry>,
    close_to_tray: CheckMenuItem<Wry>,
}

struct ThemeMenu {
    submenu: Submenu<Wry>,
    custom: Mutex<Option<Submenu<Wry>>>,
}

#[derive(Deserialize)]
pub struct CustomThemeEntry {
    pub id: String,
    pub name: String,
}

fn current_prefs() -> TrayPrefs {
    TrayPrefs {
        close_to_tray: CLOSE_TO_TRAY.load(Ordering::Relaxed),
        always_on_top: ALWAYS_ON_TOP.load(Ordering::Relaxed),
        pause_minimized: PAUSE_MINIMIZED.load(Ordering::Relaxed),
        pause_unfocused: PAUSE_UNFOCUSED.load(Ordering::Relaxed),
    }
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        #[cfg(windows)]
        crate::force_show_foreground(&window);
    }
}

fn apply_always_on_top(app: &AppHandle, on: bool) {
    if !on && crate::pip::window_pip_is_active(app) {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(on);
    }
}

fn toggle(app: &AppHandle, pref: Pref) {
    let flag = match pref {
        Pref::CloseToTray => &CLOSE_TO_TRAY,
        Pref::AlwaysOnTop => &ALWAYS_ON_TOP,
        Pref::PauseMinimized => &PAUSE_MINIMIZED,
        Pref::PauseUnfocused => &PAUSE_UNFOCUSED,
    };
    let next = !flag.load(Ordering::Relaxed);
    flag.store(next, Ordering::Relaxed);
    if let Some(items) = app.try_state::<TrayItems>() {
        let item = match pref {
            Pref::CloseToTray => &items.close_to_tray,
            Pref::AlwaysOnTop => &items.always_on_top,
            Pref::PauseMinimized => &items.pause_minimized,
            Pref::PauseUnfocused => &items.pause_unfocused,
        };
        let _ = item.set_checked(next);
    }
    if matches!(pref, Pref::AlwaysOnTop) {
        apply_always_on_top(app, next);
    }
    let _ = app.emit("harbor://tray-prefs", current_prefs());
}

#[tauri::command]
pub fn tray_set_prefs(app: AppHandle, prefs: TrayPrefs) {
    CLOSE_TO_TRAY.store(prefs.close_to_tray, Ordering::Relaxed);
    ALWAYS_ON_TOP.store(prefs.always_on_top, Ordering::Relaxed);
    PAUSE_MINIMIZED.store(prefs.pause_minimized, Ordering::Relaxed);
    PAUSE_UNFOCUSED.store(prefs.pause_unfocused, Ordering::Relaxed);
    if let Some(items) = app.try_state::<TrayItems>() {
        let _ = items.close_to_tray.set_checked(prefs.close_to_tray);
        let _ = items.always_on_top.set_checked(prefs.always_on_top);
        let _ = items.pause_minimized.set_checked(prefs.pause_minimized);
        let _ = items.pause_unfocused.set_checked(prefs.pause_unfocused);
    }
    apply_always_on_top(&app, prefs.always_on_top);
}

#[tauri::command]
pub fn tray_set_custom_themes(app: AppHandle, themes: Vec<CustomThemeEntry>) {
    let Some(tm) = app.try_state::<ThemeMenu>() else {
        return;
    };
    let Ok(mut guard) = tm.custom.lock() else {
        return;
    };
    if let Some(old) = guard.take() {
        let _ = tm.submenu.remove(&old);
    }
    if themes.is_empty() {
        return;
    }
    let mut items: Vec<MenuItem<Wry>> = Vec::new();
    for th in &themes {
        if let Ok(mi) = MenuItem::with_id(
            &app,
            format!("tray_theme_{}", th.id),
            th.name.as_str(),
            true,
            None::<&str>,
        ) {
            items.push(mi);
        }
    }
    if items.is_empty() {
        return;
    }
    let refs: Vec<&dyn IsMenuItem<Wry>> = items.iter().map(|i| i as &dyn IsMenuItem<Wry>).collect();
    if let Ok(sub) = Submenu::with_items(&app, "Custom", true, &refs) {
        let _ = tm.submenu.append(&sub);
        *guard = Some(sub);
    }
}

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "tray_show", "Show Harbor", true, None::<&str>)?;
    let themes: [(&str, &str); 13] = [
        ("cool-grey", "Harbor default"),
        ("nord", "Nord"),
        ("stremio", "Stremio"),
        ("crunch", "Crunchy"),
        ("tokyo-night", "Royal"),
        ("dracula", "Dracula"),
        ("forest", "Forest"),
        ("noir", "Noir"),
        ("elegantfin", "ElegantFin"),
        ("feishin", "Feishin"),
        ("aurora", "Aurora"),
        ("minui", "MinUI"),
        ("velvet", "Velvet"),
    ];
    let mut theme_items: Vec<MenuItem<Wry>> = Vec::with_capacity(themes.len());
    for (id, name) in themes.iter() {
        theme_items.push(MenuItem::with_id(
            app,
            format!("tray_theme_{id}"),
            *name,
            true,
            None::<&str>,
        )?);
    }
    let theme_refs: Vec<&dyn IsMenuItem<Wry>> =
        theme_items.iter().map(|i| i as &dyn IsMenuItem<Wry>).collect();
    let theme_menu = Submenu::with_items(app, "Theme", true, &theme_refs)?;
    app.manage(ThemeMenu {
        submenu: theme_menu.clone(),
        custom: Mutex::new(None),
    });
    let always_on_top = CheckMenuItem::with_id(
        app,
        "tray_aot",
        "Always on Top",
        true,
        ALWAYS_ON_TOP.load(Ordering::Relaxed),
        None::<&str>,
    )?;
    let pause_minimized = CheckMenuItem::with_id(
        app,
        "tray_pmin",
        "Pause When Minimized",
        true,
        PAUSE_MINIMIZED.load(Ordering::Relaxed),
        None::<&str>,
    )?;
    let pause_unfocused = CheckMenuItem::with_id(
        app,
        "tray_punf",
        "Pause When Unfocused",
        true,
        PAUSE_UNFOCUSED.load(Ordering::Relaxed),
        None::<&str>,
    )?;
    let close_to_tray = CheckMenuItem::with_id(
        app,
        "tray_ctt",
        "Close to Tray",
        true,
        CLOSE_TO_TRAY.load(Ordering::Relaxed),
        None::<&str>,
    )?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "tray_quit", "Quit Harbor", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &show,
            &theme_menu,
            &always_on_top,
            &pause_minimized,
            &pause_unfocused,
            &close_to_tray,
            &sep,
            &quit,
        ],
    )?;

    app.manage(TrayItems {
        always_on_top: always_on_top.clone(),
        pause_minimized: pause_minimized.clone(),
        pause_unfocused: pause_unfocused.clone(),
        close_to_tray: close_to_tray.clone(),
    });

    let mut builder = TrayIconBuilder::with_id("harbor-tray")
        .tooltip("Harbor")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id.as_ref();
            match id {
            "tray_show" => show_main(app),
            "tray_aot" => toggle(app, Pref::AlwaysOnTop),
            "tray_pmin" => toggle(app, Pref::PauseMinimized),
            "tray_punf" => toggle(app, Pref::PauseUnfocused),
            "tray_ctt" => toggle(app, Pref::CloseToTray),
            _ if id.starts_with("tray_theme_") => {
                let theme = id.strip_prefix("tray_theme_").unwrap_or_default().to_string();
                let _ = app.emit("harbor://set-theme", theme);
            }
            "tray_quit" => {
                if let Some(w) = app.get_webview_window("main") {
                    crate::CLOSE_FLUSH_DONE.store(false, Ordering::SeqCst);
                    let _ = w.emit("harbor://app-closing", ());
                    for _ in 0..16 {
                        if crate::CLOSE_FLUSH_DONE.load(Ordering::SeqCst) {
                            break;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(50));
                    }
                }
                crate::shutdown_services(app);
                app.exit(0);
            }
            _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            let restore = matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } | TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                }
            );
            if restore {
                show_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}
