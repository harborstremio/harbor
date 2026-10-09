use super::battlenet_account::{self as account, Result, Ticket};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::Duration,
};
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::oneshot;

type Reply = oneshot::Sender<Result<account::Report>>;
struct Pending {
    profile: String,
    reply: Reply,
}
fn pending() -> &'static Mutex<HashMap<String, Pending>> {
    static PENDING: OnceLock<Mutex<HashMap<String, Pending>>> = OnceLock::new();
    PENDING.get_or_init(Mutex::default)
}
fn label(request: &str) -> String {
    format!("battlenet-account-{request}")
}
fn answer(request: &str, result: Result<account::Report>) {
    if let Some(waiter) = pending()
        .lock()
        .ok()
        .and_then(|mut all| all.remove(request))
    {
        let _ = waiter.reply.send(result);
    }
}
use super::battlenet_account_policy::{account_origin, navigation, result};
fn create(app: &tauri::AppHandle, root: &Path, ticket: &Ticket) -> Result<WebviewWindow> {
    let request = ticket.request.clone();
    let fresh = ticket.fresh;
    let permitted = Arc::new(AtomicBool::new(false));
    let loaded = permitted.clone();
    let script = include_str!("battlenet_account_script.js")
        .replace(
            "__HARBOR_REQUEST__",
            &serde_json::to_string(&ticket.request).map_err(|_| "battlenet_account_data")?,
        )
        .replace(
            "__HARBOR_CONNECTION__",
            &serde_json::to_string(&ticket.connection).map_err(|_| "battlenet_account_data")?,
        )
        .replace("__HARBOR_FRESH__", if fresh { "true" } else { "false" });
    let builder = WebviewWindowBuilder::new(
        app,
        label(&ticket.request),
        WebviewUrl::External("about:blank".parse().unwrap()),
    )
    .title("Battle.net · Harbor")
    .inner_size(960.0, 740.0)
    .min_inner_size(480.0, 420.0)
    .visible(false)
    .focused(false)
    .data_directory(root.join("browsers").join(&ticket.connection))
    .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
    .on_download(|_, _| false)
    .on_navigation(move |url| {
        if url.scheme() == "harbor-battlenet" {
            if permitted.swap(false, Ordering::AcqRel) {
                answer(&request, result(url, &request));
            }
            return false;
        }
        let allowed = navigation(url, fresh);
        if allowed {
            permitted.store(false, Ordering::Release);
        }
        allowed
    })
    .on_page_load(move |window, payload| {
        if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished)
            && account_origin(payload.url())
        {
            loaded.store(true, Ordering::Release);
            let _ = window.eval(&script);
        }
    });
    let window = builder.build().map_err(|_| "battlenet_account_browser")?;
    let request = ticket.request.clone();
    window.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            answer(&request, Err("battlenet_account_canceled"));
        }
    });
    Ok(window)
}
pub fn cancel(app: &tauri::AppHandle, root: &Path, profile: &str, request: &str) {
    account::cancel(root, profile, request);
    let matches = pending()
        .lock()
        .ok()
        .is_some_and(|all| all.get(request).is_some_and(|held| held.profile == profile));
    if matches {
        answer(request, Err("battlenet_account_canceled"));
    }
    // The request UUID identifies only this operation; never close another profile's window.
    if matches {
        if let Some(window) = app.get_webview_window(&label(request)) {
            let _ = window.close();
        }
    }
}
pub async fn import(
    app: tauri::AppHandle,
    root: PathBuf,
    profile: String,
    request: String,
    fresh: bool,
) -> Result<account::Status> {
    // Installed-library discovery currently supports Windows. Do not promise isolated
    // account stores on platforms whose webview storage has not been verified.
    if !cfg!(target_os = "windows") {
        return Err("battlenet_account_platform");
    }
    let begin_root = root.clone();
    let ticket = tauri::async_runtime::spawn_blocking(move || {
        account::begin(&begin_root, &profile, &request, fresh)
    })
    .await
    .map_err(|_| "battlenet_account_store")??;
    let (reply, receive) = oneshot::channel();
    pending()
        .lock()
        .map_err(|_| "battlenet_account_browser")?
        .insert(
            ticket.request.clone(),
            Pending {
                profile: ticket.profile.clone(),
                reply,
            },
        );
    let start_app = app.clone();
    let start_root = root.clone();
    let start_ticket = ticket.clone();
    let started = tauri::async_runtime::spawn_blocking(move || {
        let window = create(&start_app, &start_root, &start_ticket)?;
        if !account::active(&start_root, &start_ticket)
            || !pending()
                .lock()
                .map_err(|_| "battlenet_account_browser")?
                .contains_key(&start_ticket.request)
        {
            let _ = window.close();
            return Err("battlenet_account_canceled");
        }
        window
            .navigate(
                if fresh {
                    "https://account.battle.net/overview"
                } else {
                    "https://account.battle.net/api/"
                }
                .parse()
                .unwrap(),
            )
            .map_err(|_| "battlenet_account_browser")?;
        if start_ticket.fresh {
            window
                .show()
                .and_then(|_| window.set_focus())
                .map_err(|_| "battlenet_account_browser")?;
        }
        Ok(())
    })
    .await
    .map_err(|_| "battlenet_account_browser")
    .and_then(|value| value);
    let report = match started {
        Ok(()) => {
            match tokio::time::timeout(Duration::from_secs(if fresh { 900 } else { 50 }), receive)
                .await
            {
                Ok(Ok(value)) => value,
                Ok(Err(_)) => Err("battlenet_account_canceled"),
                Err(_) => Err("battlenet_account_timeout"),
            }
        }
        Err(error) => Err(error),
    };
    let finish_root = root.clone();
    let finish_ticket = ticket.clone();
    let imported = match report {
        Ok(report) => tauri::async_runtime::spawn_blocking(move || {
            account::finish(&finish_root, &finish_ticket, report)
        })
        .await
        .map_err(|_| "battlenet_account_store")
        .and_then(|value| value),
        Err(error) => Err(error),
    };
    account::cancel(&root, &ticket.profile, &ticket.request);
    answer(&ticket.request, Err("battlenet_account_canceled"));
    if let Some(window) = app.get_webview_window(&label(&ticket.request)) {
        if ticket.fresh && imported.is_err() {
            let _ = window.clear_all_browsing_data();
        }
        let _ = window.close();
    }
    imported
}

pub fn disconnect(app: &tauri::AppHandle, root: &Path, profile: &str) -> Result<account::Status> {
    let requests: Vec<String> = pending()
        .lock()
        .map_err(|_| "battlenet_account_browser")?
        .iter()
        .filter(|(_, p)| p.profile == profile)
        .map(|(id, _)| id.clone())
        .collect();
    for request in requests {
        cancel(app, root, profile, &request);
    }
    if let Some(connection) = account::status(root, profile)?.connection {
        let window = WebviewWindowBuilder::new(
            app,
            format!("battlenet-clear-{}", uuid::Uuid::new_v4()),
            WebviewUrl::External("about:blank".parse().unwrap()),
        )
        .visible(false)
        .focused(false)
        .data_directory(root.join("browsers").join(connection))
        .on_navigation(|url| url.as_str() == "about:blank")
        .on_download(|_, _| false)
        .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
        .build()
        .map_err(|_| "battlenet_account_browser")?;
        let cleared = window
            .clear_all_browsing_data()
            .map_err(|_| "battlenet_account_browser");
        let _ = window.close();
        cleared?;
    }
    account::disconnect(root, profile)?;
    account::status(root, profile)
}
