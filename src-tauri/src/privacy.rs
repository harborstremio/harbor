//! Windows WebView2 extension lifecycle. No stream proxy or remote script injection.
use serde::Serialize;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex, OnceLock,
};

static ENABLED: AtomicBool = AtomicBool::new(true);
static PROFILES: OnceLock<Mutex<std::collections::BTreeMap<String, ProfileStatus>>> =
    OnceLock::new();

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileStatus {
    installed: bool,
    enabled: bool,
    pending: bool,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivacyStatus {
    supported: bool,
    requested_enabled: bool,
    profiles: Vec<ProfileStatus>,
}

fn profiles() -> &'static Mutex<std::collections::BTreeMap<String, ProfileStatus>> {
    PROFILES.get_or_init(Default::default)
}

#[cfg(target_os = "windows")]
fn update(key: &str, f: impl FnOnce(&mut ProfileStatus)) {
    if let Ok(mut all) = profiles().lock() {
        if let Some(status) = all.get_mut(key) {
            f(status);
        }
    }
}

#[tauri::command]
pub fn privacy_status() -> PrivacyStatus {
    PrivacyStatus {
        supported: cfg!(target_os = "windows"),
        requested_enabled: ENABLED.load(Ordering::SeqCst),
        profiles: profiles()
            .lock()
            .map(|p| p.values().cloned().collect())
            .unwrap_or_default(),
    }
}

#[tauri::command]
pub fn privacy_set_enabled(app: tauri::AppHandle, enabled: bool) -> Result<PrivacyStatus, String> {
    ENABLED.store(enabled, Ordering::SeqCst);
    #[cfg(target_os = "windows")]
    app.run_on_main_thread(windows_impl::sync_all)
        .map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "windows"))]
    let _ = app;
    // The callback updates actual enabled state. requestedEnabled is not a success claim.
    Ok(privacy_status())
}

pub fn init() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("harbor-privacy")
        .on_webview_ready(|webview| {
            #[cfg(target_os = "windows")]
            windows_impl::install(webview);
            #[cfg(not(target_os = "windows"))]
            let _ = webview;
        })
        .build()
}

#[cfg(target_os = "windows")]
mod windows_impl {
    use super::*;
    use std::{cell::RefCell, collections::BTreeMap};
    use tauri::Manager;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2BrowserExtension, ICoreWebView2Profile7, ICoreWebView2_13,
    };
    use webview2_com::{
        take_pwstr, BrowserExtensionEnableCompletedHandler,
        ProfileAddBrowserExtensionCompletedHandler,
    };
    use windows::core::{Interface, HSTRING, PWSTR};

    // COM interfaces remain on the UI apartment; never put them in app-wide Send state.
    thread_local! {
        static EXTENSIONS: RefCell<BTreeMap<String, ICoreWebView2BrowserExtension>> = RefCell::new(BTreeMap::new());
        static BUSY: RefCell<std::collections::BTreeSet<String>> = RefCell::new(Default::default());
    }

    fn failure(key: &str, error: impl ToString) {
        update(key, |s| {
            s.pending = false;
            s.error = Some(error.to_string());
        });
    }

    pub fn sync_all() {
        let keys: Vec<String> = EXTENSIONS.with(|all| all.borrow().keys().cloned().collect());
        for key in keys {
            sync_one(key);
        }
    }

    fn sync_one(key: String) {
        if BUSY.with(|all| !all.borrow_mut().insert(key.clone())) {
            return;
        }
        let extension = EXTENSIONS.with(|all| all.borrow().get(&key).cloned());
        let Some(extension) = extension else {
            BUSY.with(|all| all.borrow_mut().remove(&key));
            return;
        };
        let requested = ENABLED.load(Ordering::SeqCst);
        update(&key, |s| {
            s.pending = true;
            s.error = None;
        });
        let callback_key = key.clone();
        let handler = BrowserExtensionEnableCompletedHandler::create(Box::new(move |result| {
            BUSY.with(|all| all.borrow_mut().remove(&callback_key));
            if let Err(error) = result {
                failure(&callback_key, error);
            } else {
                update(&callback_key, |s| {
                    s.enabled = requested;
                    s.pending = false;
                    s.error = None;
                });
                // Serialize rapid toggles so an older callback cannot win.
                if requested != ENABLED.load(Ordering::SeqCst) {
                    sync_one(callback_key.clone());
                }
            }
            Ok(())
        }));
        if let Err(error) = unsafe { extension.Enable(requested, &handler) } {
            BUSY.with(|all| all.borrow_mut().remove(&key));
            failure(&key, error);
        }
    }

    pub fn install(webview: tauri::Webview<tauri::Wry>) {
        let app = webview.app_handle().clone();
        let label = webview.label().to_owned();
        let path = app
            .path()
            .resource_dir()
            .map(|dir| dir.join("resources/harbor-stream-blocker"));
        let result = webview.with_webview(move |platform| {
            let install_result = (|| -> Result<(), String> {
                let path = path.map_err(|e| e.to_string())?;
                if !path.join("manifest.json").is_file() {
                    return Err("Bundled stream blocker manifest is missing".into());
                }
                let core =
                    unsafe { platform.controller().CoreWebView2() }.map_err(|e| e.to_string())?;
                let profile = unsafe { core.cast::<ICoreWebView2_13>().and_then(|c| c.Profile()) }
                    .map_err(|e| e.to_string())?;
                let mut raw_path = PWSTR::null();
                unsafe { profile.ProfilePath(&mut raw_path) }.map_err(|e| e.to_string())?;
                let key = take_pwstr(raw_path);
                let profile = profile
                    .cast::<ICoreWebView2Profile7>()
                    .map_err(|e| e.to_string())?;
                {
                    let mut all = profiles().lock().map_err(|_| "Privacy state lock failed")?;
                    // All Harbor windows sharing a profile need only one installation.
                    if all.contains_key(&key) {
                        return Ok(());
                    }
                    all.insert(
                        key.clone(),
                        ProfileStatus {
                            installed: false,
                            enabled: false,
                            pending: true,
                            error: None,
                        },
                    );
                }
                let callback_key = key.clone();
                let handler = ProfileAddBrowserExtensionCompletedHandler::create(Box::new(
                    move |result, extension| {
                        if let Err(error) = result {
                            failure(&callback_key, error);
                            return Ok(());
                        }
                        let Some(extension) = extension else {
                            failure(&callback_key, "WebView2 returned no installed extension");
                            return Ok(());
                        };
                        EXTENSIONS
                            .with(|all| all.borrow_mut().insert(callback_key.clone(), extension));
                        update(&callback_key, |s| {
                            s.installed = true;
                        });
                        sync_one(callback_key.clone());
                        Ok(())
                    },
                ));
                if let Err(error) =
                    unsafe { profile.AddBrowserExtension(&HSTRING::from(path.as_path()), &handler) }
                {
                    failure(&key, error);
                }
                Ok(())
            })();
            if let Err(error) = install_result {
                if let Ok(mut all) = profiles().lock() {
                    all.insert(
                        format!("window:{label}"),
                        ProfileStatus {
                            installed: false,
                            enabled: false,
                            pending: false,
                            error: Some(error),
                        },
                    );
                }
            }
        });
        if let Err(error) = result {
            if let Ok(mut all) = profiles().lock() {
                all.insert(
                    "webview-dispatch".into(),
                    ProfileStatus {
                        installed: false,
                        enabled: false,
                        pending: false,
                        error: Some(error.to_string()),
                    },
                );
            }
        }
    }
}
