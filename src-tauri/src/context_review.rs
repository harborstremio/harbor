use tauri::Manager;

pub fn prepare(identifier: &str) -> Result<(), String> {
    if !cfg!(feature = "context-review") {
        return Ok(());
    }
    if identifier != "app.harbor.context-review" {
        return Err(
            "The context-review feature requires the isolated review configuration.".into(),
        );
    }
    let temp = std::env::temp_dir().join("harbor-context-review");
    std::fs::create_dir_all(&temp)
        .map_err(|error| format!("Could not create review temporary directory: {error}"))?;
    for variable in ["TEMP", "TMP", "TMPDIR"] {
        std::env::set_var(variable, &temp);
    }
    Ok(())
}

pub fn plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    let autorun = cfg!(feature = "context-fixture")
        && std::env::var("HARBOR_CONTEXT_FIXTURE_AUTORUN").as_deref() == Ok("1");
    tauri::plugin::Builder::new("context-review")
        .js_init_script(format!("Object.defineProperty(window, '__HARBOR_CONTEXT_REVIEW__', {{ value: true, writable: false, configurable: false }}); Object.defineProperty(window, '__HARBOR_CONTEXT_FIXTURE_AUTORUN__', {{ value: {autorun} }});"))
        .build()
}

#[cfg(feature = "context-fixture")]
pub fn run_fixture() {
    let context = tauri::generate_context!();
    prepare(&context.config().identifier).expect("unsafe context fixture configuration");
    tauri::Builder::default()
        .plugin(plugin())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            #[cfg(windows)]
            crate::native_context_menu::install(app.handle())?;
            let downloads = app.path().app_data_dir()?.join("downloads");
            std::fs::create_dir_all(downloads)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            crate::download_files::download_file_info,
            crate::download_files::download_delete_file,
            crate::download_files::harbor_download_dir,
            crate::download_files::is_context_review,
            crate::download_files::harbor_validate_review_path,
            crate::harbor_set_context_menu,
            crate::harbor_ack_frame_context,
            harbor_fixture_right_click,
            harbor_fixture_finish,
            harbor_fixture_image_server,
        ])
        .run(context)
        .expect("error running isolated native context fixture");
}

#[cfg(feature = "context-fixture")]
#[tauri::command]
async fn harbor_fixture_image_server(png: Vec<u8>) -> Result<String, String> {
    if png.len() > 32_768 || !png.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Err("The fixture server only accepts a small PNG.".into());
    }
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await.map_err(|error| error.to_string())?;
    let address = listener.local_addr().map_err(|error| error.to_string())?;
    let router = axum::Router::new().route("/fixture.png", axum::routing::get(move || {
        let png = png.clone();
        async move { ([("content-type", "image/png"), ("access-control-allow-origin", "*"), ("cross-origin-resource-policy", "cross-origin"), ("cache-control", "no-store")], png) }
    }));
    tauri::async_runtime::spawn(async move {
        if let Err(error) = axum::serve(listener, router).await {
            eprintln!("[harbor::fixture] image server stopped: {error}");
        }
    });
    Ok(format!("http://{address}/fixture.png"))
}

#[cfg(feature = "context-fixture")]
#[tauri::command]
async fn harbor_fixture_right_click(app: tauri::AppHandle, x: f64, y: f64) -> Result<(), String> {
    if !x.is_finite()
        || !y.is_finite()
        || !(0.0..8192.0).contains(&x)
        || !(0.0..8192.0).contains(&y)
    {
        return Err("Invalid fixture coordinates.".into());
    }
    #[cfg(windows)]
    for action in ["mousePressed", "mouseReleased"] {
        let window = app
            .get_webview_window("main")
            .ok_or("Fixture window closed")?;
        let params = serde_json::json!({ "type": action, "x": x, "y": y, "button": "right", "buttons": if action == "mousePressed" { 2 } else { 0 }, "clickCount": 1 }).to_string();
        let (send, receive) = tokio::sync::oneshot::channel();
        window
            .with_webview(move |webview| unsafe {
                use webview2_com::CallDevToolsProtocolMethodCompletedHandler;
                use windows::core::{w, Interface, HSTRING};
                let callback = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                    move |error, _| {
                        let _ = send.send(error.map_err(|error| error.to_string()));
                        Ok(())
                    },
                ));
                let result = webview.controller().CoreWebView2().and_then(|core| {
                    let core: webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2 =
                        core.cast()?;
                    core.CallDevToolsProtocolMethod(
                        w!("Input.dispatchMouseEvent"),
                        &HSTRING::from(params),
                        &callback,
                    )
                });
                if let Err(error) = result {
                    eprintln!("[harbor::fixture] input injection failed: {error}");
                }
            })
            .map_err(|error| error.to_string())?;
        tokio::time::timeout(std::time::Duration::from_secs(3), receive)
            .await
            .map_err(|_| "Fixture input timed out".to_string())?
            .map_err(|error| error.to_string())??;
    }
    #[cfg(not(windows))]
    {
        let _ = (app, x, y);
        return Err("The native context metadata probe is Windows-only.".into());
    }
    Ok(())
}

#[cfg(feature = "context-fixture")]
#[tauri::command]
fn harbor_fixture_finish(
    app: tauri::AppHandle,
    report: serde_json::Value,
) -> Result<String, String> {
    let text = serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?;
    if text.len() > 65_536 {
        return Err("Fixture report is too large.".into());
    }
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("context-fixture-results.json");
    std::fs::write(&path, text).map_err(|error| error.to_string())?;
    if std::env::var("HARBOR_CONTEXT_FIXTURE_AUTORUN").as_deref() == Ok("1") {
        app.exit(0);
    }
    Ok(path.to_string_lossy().into_owned())
}

pub fn initialize_downloads(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if cfg!(feature = "context-review") {
        std::fs::create_dir_all(app.path().app_data_dir()?.join("downloads"))?;
    }
    Ok(())
}
