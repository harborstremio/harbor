use tauri::{AppHandle, WebviewWindowBuilder, Wry};

pub fn main_browser_args(app: &AppHandle) -> Option<String> {
    app.config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .and_then(|w| w.additional_browser_args.clone())
        .filter(|a| !a.trim().is_empty())
}

pub fn match_main<'a>(
    app: &AppHandle,
    builder: WebviewWindowBuilder<'a, Wry, AppHandle>,
) -> WebviewWindowBuilder<'a, Wry, AppHandle> {
    #[cfg(target_os = "windows")]
    let builder = builder.browser_extensions_enabled(true);
    match main_browser_args(app) {
        Some(args) => builder.additional_browser_args(&args),
        None => builder,
    }
}
