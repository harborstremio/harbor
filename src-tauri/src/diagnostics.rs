use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

const REDACTED: &str = "[REDACTED]";
const MAX_BUNDLE_BYTES: u64 = 25 * 1024 * 1024;
const MAX_MPV_BYTES: usize = 20 * 1024 * 1024;
const MAX_RUNTIME_BYTES: usize = 4 * 1024 * 1024;
const MAX_PANIC_BYTES: usize = 256 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectInput {
    pub request_id: String,
    pub ticket: String,
    pub runtime_text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectResult {
    pub temp_path: String,
    pub bytes: u64,
}

struct ScrubRules {
    authorization: Regex,
    bearer: Regex,
    storage_key: Regex,
    key_value: Regex,
    email: Regex,
    user_path: Regex,
    ip_addr: Regex,
    path_seg: Regex,
    base64_token: Regex,
    long_token: Regex,
}

fn rules() -> &'static ScrubRules {
    static RULES: OnceLock<ScrubRules> = OnceLock::new();
    RULES.get_or_init(|| ScrubRules {
        authorization: Regex::new(
            r#"(?i)(authorization)("?\s*[:=]\s*"?)(?:(bearer|basic)\s+)?([^"'\s,;&}\)]+)"#,
        )
        .unwrap(),
        bearer: Regex::new(r"(?i)bearer\s+[A-Za-z0-9._~+/=\-]{8,}").unwrap(),
        storage_key: Regex::new(
            r#"(?i)(harbor\.(?:theme-session|session\.token|auth(?:\.[A-Za-z0-9_.-]+)?))("?\s*[:=]\s*"?)([^"'\s,;&}\)]+)"#,
        )
        .unwrap(),
        key_value: Regex::new(
            r#"(?i)(auth[_-]?key|api[_-]?key|access[_-]?token|refresh[_-]?token|session[_-]?token|client[_-]?secret|secret|token|password|passwd|pwd)("?\s*[:=]\s*"?)([^"'\s,;&}\)]+)"#,
        )
        .unwrap(),
        email: Regex::new(r"(?i)[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}").unwrap(),
        user_path: Regex::new(r#"(?i)([A-Za-z]:[\\/]+Users[\\/]+|/Users/|/home/)([^\\/\s"']+)"#)
            .unwrap(),
        ip_addr: Regex::new(r"\b(?:\d{1,3}\.){3}\d{1,3}\b").unwrap(),
        path_seg: Regex::new(r"(/)([A-Za-z0-9_+=\-]{12,})").unwrap(),
        base64_token: Regex::new(r"[A-Za-z0-9+/]{32,}={0,2}").unwrap(),
        long_token: Regex::new(r"[A-Za-z0-9_\-]{20,}").unwrap(),
    })
}

pub fn diagnostics_scrub(text: &str) -> String {
    let r = rules();
    let step1 = r.authorization.replace_all(text, |c: &regex::Captures| {
        let scheme = c
            .get(3)
            .map(|value| format!("{} ", value.as_str()))
            .unwrap_or_default();
        format!("{}{}{}{}", &c[1], &c[2], scheme, REDACTED)
    });
    let step2 = r
        .bearer
        .replace_all(&step1, |_: &regex::Captures| format!("Bearer {REDACTED}"));
    let step3 = r.storage_key.replace_all(&step2, |c: &regex::Captures| {
        format!("{}{}{}", &c[1], &c[2], REDACTED)
    });
    let step4 = r.key_value.replace_all(&step3, |c: &regex::Captures| {
        format!("{}{}{}", &c[1], &c[2], REDACTED)
    });
    let step5 = r.email.replace_all(&step4, "<email>");
    let step6 = r
        .user_path
        .replace_all(&step5, |c: &regex::Captures| format!("{}<user>", &c[1]));
    let step7 = r.ip_addr.replace_all(&step6, "<ip>");
    let step8 = r.path_seg.replace_all(&step7, |c: &regex::Captures| {
        format!("{}{}", &c[1], REDACTED)
    });
    let step9 = r.base64_token.replace_all(&step8, REDACTED);
    r.long_token.replace_all(&step9, REDACTED).into_owned()
}

fn read_text_capped(path: &Path, max_bytes: usize) -> Option<String> {
    let mut file = std::fs::File::open(path).ok()?;
    let len = file.metadata().ok()?.len() as usize;
    if len > max_bytes {
        let start = (len - max_bytes) as u64;
        file.seek(SeekFrom::Start(start)).ok()?;
        let mut bytes = Vec::with_capacity(max_bytes);
        file.take(max_bytes as u64).read_to_end(&mut bytes).ok()?;
        let body = String::from_utf8_lossy(&bytes);
        Some(format!(
            "[harbor] truncated to last {max_bytes} bytes of {len}\n{body}"
        ))
    } else {
        let mut text = String::new();
        file.read_to_string(&mut text).ok()?;
        Some(text)
    }
}

fn cap_str(text: &str, max_bytes: usize) -> String {
    if text.len() <= max_bytes {
        return text.to_string();
    }
    let mut end = max_bytes.min(text.len());
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    format!("[harbor] truncated to {max_bytes} bytes\n{}", &text[..end])
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn sanitize_id(id: &str) -> String {
    let cleaned: String = id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(64)
        .collect();
    if cleaned.is_empty() {
        "unknown".to_string()
    } else {
        cleaned
    }
}

fn build_system_info(
    app: &AppHandle,
    input: &CollectInput,
    mem: &crate::proc_mem::ProcMem,
) -> String {
    let version = app.package_info().version.to_string();
    format!(
        "Harbor Diagnostics\n\
         generatedAt: {}\n\
         appVersion: {}\n\
         os: {}\n\
         arch: {}\n\
         family: {}\n\
         ticket: #{}\n\
         requestId: {}\n\
         harborRssBytes: {}\n\
         webviewRssBytes: {}\n\
         totalRssBytes: {}\n\
         totalPhysBytes: {}\n",
        now_ms(),
        version,
        std::env::consts::OS,
        std::env::consts::ARCH,
        std::env::consts::FAMILY,
        input.ticket,
        input.request_id,
        mem.harbor_rss,
        mem.webview_rss,
        mem.total,
        mem.total_phys,
    )
}

fn add_member(
    zipw: &mut ZipWriter<std::fs::File>,
    name: &str,
    raw: &str,
    opts: SimpleFileOptions,
) -> Result<(), String> {
    let scrubbed = diagnostics_scrub(raw);
    zipw.start_file(name, opts).map_err(|e| e.to_string())?;
    zipw.write_all(scrubbed.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn diagnostics_collect(
    app: AppHandle,
    input: CollectInput,
) -> Result<CollectResult, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mpv_log = data_dir.join("harbor-mpv.log");
    let panic_file = data_dir.join("crash-recovery").join("panic.json");
    let mem = crate::proc_mem::harbor_process_memory().await;

    let mpv_text = read_text_capped(&mpv_log, MAX_MPV_BYTES)
        .unwrap_or_else(|| "No player log yet. mpv has not been started this session.".to_string());
    let panic_text = read_text_capped(&panic_file, MAX_PANIC_BYTES)
        .unwrap_or_else(|| "No crash report recorded.".to_string());
    let runtime_text = cap_str(&input.runtime_text, MAX_RUNTIME_BYTES);
    let render_note = "Render diagnostics\nlibmpv GPU and render messages are folded into mpv.log \
        (mpv_request_log_messages). Harbor has no separate on-disk render log."
        .to_string();
    let system_info = build_system_info(&app, &input, &mem);

    let temp_path: PathBuf = std::env::temp_dir().join(format!(
        "harbor-diag-{}.zip",
        sanitize_id(&input.request_id)
    ));
    let file = std::fs::File::create(&temp_path).map_err(|e| format!("create bundle: {e}"))?;
    let mut zipw = ZipWriter::new(file);
    let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    add_member(&mut zipw, "system-info.txt", &system_info, opts)?;
    add_member(&mut zipw, "mpv.log", &mpv_text, opts)?;
    add_member(&mut zipw, "render.txt", &render_note, opts)?;
    add_member(&mut zipw, "runtime.txt", &runtime_text, opts)?;
    add_member(&mut zipw, "app-crash.json", &panic_text, opts)?;
    zipw.finish().map_err(|e| format!("finish bundle: {e}"))?;

    let bytes = std::fs::metadata(&temp_path)
        .map_err(|e| e.to_string())?
        .len();
    if bytes > MAX_BUNDLE_BYTES {
        let _ = std::fs::remove_file(&temp_path);
        return Err(format!(
            "diagnostics bundle {bytes} bytes exceeds {MAX_BUNDLE_BYTES} cap"
        ));
    }

    Ok(CollectResult {
        temp_path: temp_path.to_string_lossy().into_owned(),
        bytes,
    })
}

#[tauri::command]
pub fn diagnostics_cleanup(_app: AppHandle, temp_path: String) -> Result<(), String> {
    let path = PathBuf::from(&temp_path);
    let name_ok = path
        .file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.starts_with("harbor-diag-") && n.ends_with(".zip"))
        .unwrap_or(false);
    let in_temp = path.starts_with(std::env::temp_dir());
    if !name_ok || !in_temp {
        return Err("refusing to delete path outside diagnostics temp scope".to_string());
    }
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::diagnostics_scrub;

    #[test]
    fn redacts_authorization_bearer() {
        let out = diagnostics_scrub("Authorization: Bearer abc123DEF456ghi789JKL");
        assert!(out.contains("Bearer [REDACTED]"));
        assert!(!out.contains("abc123DEF456ghi789JKL"));
    }

    #[test]
    fn redacts_stremio_authkey_param() {
        let out = diagnostics_scrub("https://api.strem.io/getUser?authKey=af93kd0slQ92mfPzz1&x=1");
        assert!(out.contains("authKey=[REDACTED]"));
        assert!(out.contains("&x=1"));
        assert!(!out.contains("af93kd0slQ92mfPzz1"));
    }

    #[test]
    fn redacts_harbor_session_token() {
        let out = diagnostics_scrub(r#"{"harbor.theme-session":"tok_LiVe_9182ABCXYZ"}"#);
        assert!(out.contains("[REDACTED]"));
        assert!(!out.contains("tok_LiVe_9182ABCXYZ"));
    }

    #[test]
    fn redacts_provider_api_keys() {
        let out = diagnostics_scrub("tmdb api_key=9c8b7a6d5e4f&rpdb apikey: ZZ11yy22XX");
        assert!(!out.contains("9c8b7a6d5e4f"));
        assert!(!out.contains("ZZ11yy22XX"));
    }

    #[test]
    fn redacts_generic_long_token() {
        let secret = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0";
        let out = diagnostics_scrub(&format!("debrid host token {secret} in url"));
        assert!(!out.contains(secret));
        assert!(out.contains("[REDACTED]"));
    }

    #[test]
    fn keeps_ordinary_prose() {
        let out = diagnostics_scrub("player started ok at position 42 seconds");
        assert_eq!(out, "player started ok at position 42 seconds");
    }
}
