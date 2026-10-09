use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const DJ_LABEL: &str = "harbor-dj";

#[tauri::command]
pub async fn dj_deck_open(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(DJ_LABEL) {
        let _ = existing.unminimize();
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    let app_for_main = app.clone();
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    app.run_on_main_thread(move || {
        let url = WebviewUrl::App("index.html?harbor-dj=1".into());
        let builder = WebviewWindowBuilder::new(&app_for_main, DJ_LABEL, url)
            .title("Harbor DJ")
            .inner_size(960.0, 660.0)
            .min_inner_size(900.0, 600.0)
            .resizable(true)
            .decorations(false)
            .skip_taskbar(false)
            .visible(true)
            .focused(true);
        let result = crate::browser_args::match_main(&app_for_main, builder).build();
        match result {
            Ok(window) => {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = tx.send(Ok(()));
            }
            Err(error) => {
                eprintln!("[harbor::dj] window build failed: {error}");
                let _ = tx.send(Err(error.to_string()));
            }
        }
    })
    .map_err(|error| format!("dj deck: {error}"))?;

    rx.recv_timeout(std::time::Duration::from_secs(12))
        .map_err(|_| "dj deck: window did not come up".to_string())?
}

#[tauri::command]
pub fn dj_deck_close(app: AppHandle) {
    if let Some(window) = app.get_webview_window(DJ_LABEL) {
        let _ = window.close();
    }
}
