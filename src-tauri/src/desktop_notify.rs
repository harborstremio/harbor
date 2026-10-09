use notify_rust::{Notification, NotificationResponse};
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::Emitter;

// Waiting for a click response blocks its thread until the OS notification
// server reports the toast closed. That's bounded on Windows (winrt_notification
// auto-dismisses after its display duration), but some minimal Linux D-Bus
// notification daemons never send a close signal, so a burst of clickable
// notifications there could otherwise grow threads without limit. Cap how many
// waiter threads can be outstanding at once; once the cap is hit, further
// notifications still show, just without click-to-open for that one.
const MAX_PENDING_CLICK_WAITS: usize = 32;
static PENDING_CLICK_WAITS: AtomicUsize = AtomicUsize::new(0);

// Poster images arrive as bytes (fetched on the JS side, which already knows how
// to route around CORS/CSP for each image host). notify-rust needs a local file
// path, not bytes, so we cache them under the OS temp dir keyed by content hash —
// naturally dedupes repeat posters (e.g. multiple episodes of the same show) and
// skips rewriting a file that's already there.
const MAX_CACHED_POSTERS: usize = 200;

fn poster_cache_dir() -> std::path::PathBuf {
    std::env::temp_dir().join("harbor-notify-posters")
}

fn image_extension(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        "png"
    } else if bytes.starts_with(b"\xFF\xD8\xFF") {
        "jpg"
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        "webp"
    } else {
        "jpg"
    }
}

fn cache_poster_image(bytes: &[u8]) -> Option<std::path::PathBuf> {
    use std::hash::{Hash, Hasher};

    let dir = poster_cache_dir();
    std::fs::create_dir_all(&dir).ok()?;

    if let Ok(entries) = std::fs::read_dir(&dir) {
        if entries.count() > MAX_CACHED_POSTERS {
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).ok()?;
        }
    }

    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    bytes.hash(&mut hasher);
    let path = dir.join(format!("{:x}.{}", hasher.finish(), image_extension(bytes)));
    if !path.exists() {
        std::fs::write(&path, bytes).ok()?;
    }
    Some(path)
}

// Windows toasts fall back to the "Windows PowerShell" system AUMID unless we
// set our own — but that AUMID only shows up correctly for the *installed*
// app (it needs a matching Start Menu shortcut). In an unpackaged dev build
// there is no such shortcut, so setting it there breaks toasts entirely.
// Mirrors the same dev/prod check tauri-plugin-notification's own desktop
// backend uses internally (src-tauri isn't able to reuse that logic directly
// since it's private to the plugin).
#[cfg(windows)]
fn windows_app_id(app: &tauri::AppHandle) -> Option<String> {
    use std::path::MAIN_SEPARATOR as SEP;
    let exe = tauri::utils::platform::current_exe().ok()?;
    let exe_dir = exe.parent()?.display().to_string();
    let is_dev = exe_dir.ends_with(format!("{SEP}target{SEP}debug").as_str())
        || exe_dir.ends_with(format!("{SEP}target{SEP}release").as_str());
    if is_dev {
        None
    } else {
        Some(app.config().identifier.clone())
    }
}

// tauri-plugin-notification has no click/action support on desktop (only on
// mobile), so a notification with a deep link bypasses the plugin and talks
// to notify-rust directly to get the click callback.
#[tauri::command]
pub fn send_clickable_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    deep_link: Option<String>,
    image_bytes: Option<Vec<u8>>,
) -> Result<(), String> {
    let mut notification = Notification::new();
    notification.summary(&title).body(&body);
    #[cfg(windows)]
    if let Some(app_id) = windows_app_id(&app) {
        notification.app_id(&app_id);
    }
    if let Some(bytes) = image_bytes.filter(|b| !b.is_empty()) {
        if let Some(path) = cache_poster_image(&bytes) {
            notification.image_path(&path.to_string_lossy());
        }
    }

    let handle = notification.show().map_err(|e| e.to_string())?;

    if let Some(link) = deep_link {
        let reserved = PENDING_CLICK_WAITS
            .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |n| {
                (n < MAX_PENDING_CLICK_WAITS).then_some(n + 1)
            })
            .is_ok();
        if reserved {
            std::thread::spawn(move || {
                let _ = handle.wait_for_response(move |response: &NotificationResponse| {
                    if response.is_default_action() {
                        let _ = app.emit("harbor:notification-click", link);
                    }
                });
                PENDING_CLICK_WAITS.fetch_sub(1, Ordering::SeqCst);
            });
        }
    }

    Ok(())
}
