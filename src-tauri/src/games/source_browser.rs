//! Uses the provider's visible browser flow; no scraped API tokens or challenge solving.
use super::{source_browser_grants as grants, source_browser_policy as policy};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
    time::Duration,
};
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::oneshot;

type Result<T> = std::result::Result<T, &'static str>;
type Sender = oneshot::Sender<Result<BrowserFile>>;
struct Session {
    id: String,
    page: String,
    sender: Sender,
}
static APP: OnceLock<tauri::AppHandle> = OnceLock::new();
static WINDOWS: Mutex<()> = Mutex::new(());
fn sessions() -> &'static Mutex<HashMap<String, Session>> {
    static SESSIONS: OnceLock<Mutex<HashMap<String, Session>>> = OnceLock::new();
    SESSIONS.get_or_init(Mutex::default)
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserFile {
    pub url: String,
    pub name: String,
    pub browser_ticket: String,
}
pub fn configure(app: &tauri::AppHandle) {
    let _ = APP.set(app.clone());
}
fn profile_valid(profile: &str) -> bool {
    !profile.is_empty() && profile.len() <= 256 && !profile.chars().any(char::is_control)
}
fn identity(profile: &str) -> String {
    format!("{:x}", Sha256::digest(profile.as_bytes()))
}
fn label(id: &str) -> String {
    format!("source-download-{id}")
}

fn trace(host: policy::Host, event: &str, url: &url::Url, detail: &str) {
    eprintln!(
        "[source-browser] {} {event} host={} path={} query={} {detail}",
        host.key(),
        url.host_str().unwrap_or(""),
        url.path(),
        url.query().map_or(0, str::len),
    );
}

fn window(
    app: &tauri::AppHandle,
    profile: &str,
    id: &str,
    host: policy::Host,
) -> Result<WebviewWindow> {
    let _guard = WINDOWS.lock().map_err(|_| "public_browser")?;
    let label = label(id);
    if let Some(window) = app.get_webview_window(&label) {
        return Ok(window);
    }
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "public_browser")?
        .join("source-browsers")
        .join(host.key())
        .join(identity(profile));
    let download_profile = profile.to_owned();
    let download_id = id.to_owned();
    let popup_app = app.clone();
    let popup_label = label.clone();
    let mut builder = WebviewWindowBuilder::new(
        app,
        &label,
        WebviewUrl::External("about:blank".parse().unwrap()),
    )
    .title(format!("{} · Harbor", host.title()))
    .inner_size(960.0, 720.0)
    .min_inner_size(460.0, 400.0)
    .visible(false)
    .focused(false)
    .data_directory(directory)
    .on_navigation(move |url| {
        let allowed = url.as_str() == "about:blank" || policy::browser_file(url.as_str()).is_ok();
        trace(host, if allowed { "navigate-allow" } else { "navigate-deny" }, &url, &format!("scheme={} port={:?}", url.scheme(), url.port()));
        allowed
    })
    .on_new_window(move |url, _| {
        // A pop-up cannot be told apart from the file handoff by its address: these pages open
        // advertising on the same click, and following it walks the window out of the provider
        // and into a redirect chain. Nothing is followed and no pop-up acquires a webview, so
        // the page's own fallback link stays the way through, and the file is still accepted
        // from whatever host the native download event names.
        let _ = &popup_app;
        let _ = &popup_label;
        trace(host, "popup-deny", &url, &format!("scheme={} port={:?}", url.scheme(), url.port()));
        tauri::webview::NewWindowResponse::Deny
    })
    .on_download(move |webview, event| {
        if let tauri::webview::DownloadEvent::Requested { url, destination } = event {
            // An unrelated download must not consume the user's active selection, and a failed
            // attempt must leave it armed so the next try on the page is still captured.
            let (page, why) = sessions().lock().ok().map_or((None, "no-lock"), |all| {
                match all.get(&download_profile) {
                    None => (None, "no-session"),
                    Some(s) if s.id != download_id => (None, "stale-session"),
                    Some(s) if policy::browser_pair(&s.page, url.as_str()).is_err() => (None, "pair-rejected"),
                    Some(s) => (Some(s.page.clone()), "armed"),
                }
            });
            trace(host, "download", &url, &format!("accepted={} session={why} file={:?}", policy::browser_file(url.as_str()).is_ok(), destination.file_name()));
            if let Some(page) = page {
                let url = url.clone();
                let destination = destination.clone();
                let profile = download_profile.clone();
                let id = download_id.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    let result: Result<BrowserFile> = (|| {
                        let url = policy::browser_file(url.as_str())?;
                        let name = destination
                            .file_name()
                            .and_then(|s| s.to_str())
                            .filter(|s| {
                                !s.is_empty() && s.len() <= 1000 && !s.chars().any(char::is_control)
                            })
                            .ok_or("public_metadata")?;
                        let cookies = if host == policy::Host::FuckingFast {
                            Vec::new()
                        } else {
                            webview
                                .cookies_for_url(url.clone())
                                .map_err(|_| "public_browser")?
                        };
                        let cookie =
                            browser_cookie(host, cookies.iter().map(|c| (c.name(), c.value())))?;
                        let ticket = grants::shared().insert(
                            &profile,
                            url.as_str(),
                            &page,
                            cookie,
                        )?;
                        Ok(BrowserFile {
                            url: url.to_string(),
                            name: name.to_owned(),
                            browser_ticket: ticket,
                        })
                    })();
                    match result {
                        Ok(file) => {
                            let session = sessions().lock().ok().and_then(|mut all| {
                                if all.get(&profile).is_some_and(|s| s.id == id) {
                                    all.remove(&profile)
                                } else {
                                    None
                                }
                            });
                            if let Some(session) = session {
                                let _ = session.sender.send(Ok(file));
                            }
                        }
                        Err(reason) => {
                            eprintln!("[source-browser] capture did not complete: {reason}; the selection stays armed for the next try");
                        }
                    }
                });
            }
        }
        // Harbor asks for a destination before starting its own managed transfer.
        false
    });
    #[cfg(target_os = "macos")]
    {
        // Older WKWebView versions cannot isolate persistent stores by profile.
        let version = std::process::Command::new("/usr/bin/sw_vers")
            .arg("-productVersion")
            .output()
            .map_err(|_| "public_browser")?;
        let major = String::from_utf8_lossy(&version.stdout)
            .split('.')
            .next()
            .and_then(|n| n.trim().parse::<u32>().ok())
            .unwrap_or(0);
        if major < 14 {
            return Err("public_browser");
        }
        // Preserve existing Gofile stores while keeping other providers separate.
        let key = if host == policy::Host::Gofile {
            profile.to_owned()
        } else {
            format!("{}:{profile}", host.key())
        };
        let hash = Sha256::digest(key.as_bytes());
        let mut id = [0u8; 16];
        id.copy_from_slice(&hash[..16]);
        builder = builder.data_store_identifier(id);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = &mut builder;
    let created = builder.build().map_err(|_| "public_browser")?;
    let close_profile = profile.to_owned();
    let close_id = id.to_owned();
    created.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            if let Some(session) = sessions().lock().ok().and_then(|mut all| {
                if all.get(&close_profile).is_some_and(|s| s.id == close_id) {
                    all.remove(&close_profile)
                } else {
                    None
                }
            }) {
                let _ = session.sender.send(Err("public_browser_canceled"));
            }
        }
    });
    Ok(created)
}

pub async fn choose(
    app: tauri::AppHandle,
    profile: String,
    id: String,
    url: String,
) -> Result<BrowserFile> {
    if !profile_valid(&profile) || uuid::Uuid::parse_str(&id).is_err() {
        return Err("public_url");
    }
    let host = policy::host(&url)?;
    let url = policy::page(&url)?;
    trace(host, "session-open", &url, &format!("id={id}"));
    configure(&app);
    let (send, receive) = oneshot::channel();
    {
        let mut all = sessions().lock().map_err(|_| "public_browser")?;
        if all.contains_key(&profile) || all.len() >= 4 {
            return Err("public_browser_busy");
        }
        all.insert(
            profile.clone(),
            Session {
                id: id.clone(),
                page: url.to_string(),
                sender: send,
            },
        );
    }
    let setup_app = app.clone();
    let setup_profile = profile.clone();
    let setup_id = id.clone();
    let setup = tauri::async_runtime::spawn_blocking(move || {
        let win = window(&setup_app, &setup_profile, &setup_id, host)?;
        // Closing/switching modes while the native window was being created wins.
        if !sessions()
            .lock()
            .map_err(|_| "public_browser")?
            .get(&setup_profile)
            .is_some_and(|s| s.id == setup_id)
        {
            let _ = win.close();
            return Err("public_browser_canceled");
        }
        win.navigate(url).map_err(|_| "public_browser")?;
        win.show().map_err(|_| "public_browser")?;
        win.set_focus().map_err(|_| "public_browser")
    })
    .await
    .map_err(|_| "public_browser")
    .and_then(|r| r);
    let result = match setup {
        Ok(()) => match tokio::time::timeout(Duration::from_secs(15 * 60), receive).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err("public_browser_canceled"),
            Err(_) => Err("public_browser_timeout"),
        },
        Err(error) => Err(error),
    };
    close(&app, &profile, &id);
    eprintln!("[source-browser] {} session-close id={id} outcome={}", host.key(), result.as_ref().map(|f| f.name.as_str()).unwrap_or_else(|e| e));
    result
}

pub fn close(app: &tauri::AppHandle, profile: &str, id: &str) {
    let matches = if let Ok(mut all) = sessions().lock() {
        match all.get(profile) {
            Some(session) if session.id != id => false,
            Some(_) => {
                if let Some(session) = all.remove(profile) {
                    let _ = session.sender.send(Err("public_browser_canceled"));
                }
                true
            }
            None => true,
        }
    } else {
        false
    };
    if matches {
        if let Some(win) = app.get_webview_window(&label(id)) {
            let _ = win.close();
        }
    }
}

pub fn receipt(ticket: &str, profile: &str, url: &str) -> Result<String> {
    policy::browser_file(url).map_err(|_| "transfer_url")?;
    grants::shared().resolve(ticket, profile, url)
}

pub async fn request(
    profile: String,
    page: String,
    url: String,
) -> Result<reqwest::RequestBuilder> {
    let host = policy::browser_pair(&page, &url).map_err(|_| "transfer_access")?;
    let parsed = policy::browser_file(&url).map_err(|_| "transfer_access")?;
    // Temporary public links are already issued by the provider's visible page.
    // They need no Gofile account cookie, browser creation or renderer-supplied headers.
    if host == policy::Host::FuckingFast {
        return download_request(&url, None, &page);
    }
    let cached = grants::shared().cookie(&profile, &url);
    let cookie = if let Some(cookie) = cached {
        Some(cookie)
    } else if let Some(app) = APP.get().cloned() {
        tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>> {
            if !profile_valid(&profile) {
                return Err("transfer_access");
            }
            let win = window(&app, &profile, &uuid::Uuid::new_v4().to_string(), host)
                .map_err(|_| "transfer_access")?;
            // The browser supplies only cookies eligible for this exact provider URL.
            let result = win
                .cookies_for_url(parsed)
                .map_err(|_| "transfer_access")
                .and_then(|cookies| {
                    browser_cookie(host, cookies.iter().map(|c| (c.name(), c.value())))
                        .map_err(|_| "transfer_access")
                });
            let _ = win.close();
            result
        })
        .await
        .map_err(|_| "transfer_access")??
    } else if host == policy::Host::Gofile {
        return Err("transfer_access");
    } else {
        None
    };
    download_request(&url, cookie.as_deref(), &page)
}

fn browser_cookie<'a>(
    host: policy::Host,
    cookies: impl IntoIterator<Item = (&'a str, &'a str)>,
) -> Result<Option<String>> {
    if host == policy::Host::FuckingFast {
        return Ok(None);
    }
    if host == policy::Host::Gofile {
        return cookies
            .into_iter()
            .find(|(name, value)| *name == "accountToken" && policy::cookie(value))
            .map(|(_, value)| Some(format!("accountToken={value}")))
            .ok_or("public_browser");
    }
    // Only cookies returned by the native store for this exact file URL enter a request.
    let value = cookies
        .into_iter()
        .map(|(name, value)| format!("{name}={value}"))
        .filter(|value| policy::cookie_header(value))
        .collect::<Vec<_>>()
        .join("; ");
    if value.is_empty() {
        Ok(None)
    } else if policy::cookie_header(&value) {
        Ok(Some(value))
    } else {
        Err("public_browser")
    }
}

fn download_request(
    url: &str,
    cookie: Option<&str>,
    page: &str,
) -> Result<reqwest::RequestBuilder> {
    // Never forward a temporary URL or host cookie to a redirect or another host.
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(15))
        .no_gzip()
        .no_brotli()
        .no_deflate()
        .no_zstd()
        .build()
        .map_err(|_| "transfer_network")?;
    policy::browser_pair(page, url).map_err(|_| "transfer_access")?;
    let mut referer = reqwest::header::HeaderValue::from_str(
        policy::page(page).map_err(|_| "transfer_access")?.as_str(),
    )
    .map_err(|_| "transfer_access")?;
    referer.set_sensitive(true);
    let mut request = client.get(url).header(reqwest::header::REFERER, referer);
    if let Some(cookie) = cookie {
        let mut header =
            reqwest::header::HeaderValue::from_str(cookie).map_err(|_| "transfer_access")?;
        header.set_sensitive(true);
        request = request.header(reqwest::header::COOKIE, header);
    }
    Ok(request)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn direct_host_requests_use_only_exact_native_cookies_and_provider_referer() {
        for (page, file) in [
            (
                "https://datanodes.to/r9s07mymkzbt",
                "https://cdn17.datanodes.to/download/token/archive.rar",
            ),
            (
                "https://1fichier.com/?b7ltalh4x9cn68f0grn1",
                "https://a-34.1fichier.com/c1103650933",
            ),
            (
                "https://buzzheavier.com/abcdefghijkl",
                "https://dl.buzzheavier.com/download/token/archive.zip",
            ),
        ] {
            let ticket = grants::shared()
                .insert(
                    "direct-requests",
                    file,
                    page,
                    Some("session=fixture".into()),
                )
                .unwrap();
            assert_eq!(receipt(&ticket, "direct-requests", file).unwrap(), page);
            let built = request("direct-requests".into(), page.into(), file.into())
                .await
                .unwrap()
                .build()
                .unwrap();
            assert_eq!(built.headers()[reqwest::header::COOKIE], "session=fixture");
            assert!(built.headers()[reqwest::header::COOKIE].is_sensitive());
            assert_eq!(built.headers()[reqwest::header::REFERER], page);
            assert!(!built.headers().contains_key(reqwest::header::AUTHORIZATION));
            let other = request("another-profile".into(), page.into(), file.into())
                .await
                .unwrap()
                .build()
                .unwrap();
            assert!(!other.headers().contains_key(reqwest::header::COOKIE));
        }
        assert_eq!(
            browser_cookie(
                policy::Host::Fichier,
                [("session", "abc"), ("bad", "a\r\nb")]
            )
            .unwrap()
            .as_deref(),
            Some("session=abc")
        );
        assert_eq!(
            browser_cookie(policy::Host::FuckingFast, [("session", "abc")]).unwrap(),
            None
        );
        assert!(browser_cookie(policy::Host::Gofile, [("session", "abc")]).is_err());
    }
    #[tokio::test]
    async fn public_browser_requests_need_no_app_or_cookie_and_reject_cross_host_state() {
        let page = "https://fuckingfast.co/ab12cd34ef56".to_owned();
        let file = format!("https://fuckingfast.co/dl/{}", "a_B9-".repeat(20));
        let built = request("fixture".into(), page.clone(), file.clone())
            .await
            .unwrap()
            .build()
            .unwrap();
        assert_eq!(built.url().as_str(), file);
        assert_eq!(built.method(), reqwest::Method::GET);
        assert!(!built.headers().contains_key(reqwest::header::COOKIE));
        assert!(!built.headers().contains_key(reqwest::header::AUTHORIZATION));
        assert!(request(
            "fixture".into(),
            "https://gofile.io/d/a1B2c3".into(),
            file.clone()
        )
        .await
        .is_err());
        assert!(request(
            "fixture".into(),
            page.clone(),
            "https://localhost/file.zip".into()
        )
        .await
        .is_err());
        let signed = download_request(&file, Some("accountToken=fixture"), &page)
            .unwrap()
            .build()
            .unwrap();
        assert!(signed.headers()[reqwest::header::COOKIE].is_sensitive());
    }
}
