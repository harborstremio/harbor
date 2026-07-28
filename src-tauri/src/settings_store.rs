use tauri::Manager;

fn settings_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

#[tauri::command]
pub fn settings_read(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = settings_path(&app)?;
    match std::fs::read_to_string(&path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn settings_write(app: tauri::AppHandle, content: String) -> Result<(), String> {
    let path = settings_path(&app)?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, content.as_bytes()).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secrets_read(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let map = load_envelope(&app)?;
    if map.is_empty() {
        return Ok(None);
    }
    Ok(Some(serde_json::to_string(&map).map_err(|e| e.to_string())?))
}

#[tauri::command]
pub fn secrets_write(app: tauri::AppHandle, content: String) -> Result<(), String> {
    let new: HashMap<String, String> =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let old = load_envelope(&app)?;
    for (k, v) in &new {
        vault_set(&app, k, v)?;
    }
    for k in old.keys() {
        if !new.contains_key(k) {
            vault_delete(&app, k)?;
        }
    }
    Ok(())
}

pub fn read_torrents_disabled(app: &tauri::AppHandle) -> bool {
    let Ok(path) = settings_path(app) else {
        return false;
    };
    let Ok(s) = std::fs::read_to_string(&path) else {
        return false;
    };
    parse_torrents_disabled(&s)
}

fn parse_torrents_disabled(json: &str) -> bool {
    let needle = "\"torrentsDisabled\"";
    let Some(idx) = json.find(needle) else {
        return false;
    };
    let rest = &json[idx + needle.len()..];
    let mut chars = rest.chars().peekable();
    while let Some(c) = chars.peek() {
        if c.is_whitespace() || *c == ':' {
            chars.next();
        } else {
            break;
        }
    }
    matches!(chars.next(), Some('t') | Some('T'))
}

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use serde_json::Value;
use std::collections::HashMap;
use std::io::ErrorKind;
use std::sync::OnceLock;

const VAULT_SERVICE: &str = "harbor";
const VAULT_PROBE: &str = "__harbor_probe__";
const VAULT_VERSION: u8 = 1;
const KEK_LEN: usize = 32;
const NONCE_LEN: usize = 12;

fn vault_file_path(app: &tauri::AppHandle, ext: &str) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(format!("secrets.{ext}")))
}

fn use_fallback() -> bool {
    static F: OnceLock<bool> = OnceLock::new();
    *F.get_or_init(|| {
        if std::env::var("HARBOR_VAULT_FORCE_FALLBACK").is_ok() {
            return true;
        }
        match keyring::Entry::new(VAULT_SERVICE, VAULT_PROBE) {
            Ok(entry) => match entry.set_password("probe") {
                Ok(()) => {
                    let _ = entry.delete_credential();
                    false
                }
                Err(_) => true,
            },
            Err(_) => true,
        }
    })
}

fn keyring_entry(user: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(VAULT_SERVICE, user).map_err(|e| e.to_string())
}

fn base64_encode(input: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(input)
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(input)
        .map_err(|e| e.to_string())
}

fn load_kek(app: &tauri::AppHandle) -> Result<[u8; KEK_LEN], String> {
    let path = vault_file_path(app, "kek")?;
    match std::fs::read(&path) {
        Ok(bytes) if bytes.len() == KEK_LEN => {
            let mut kek = [0u8; KEK_LEN];
            kek.copy_from_slice(&bytes);
            Ok(kek)
        }
        Ok(_) => Err("corrupt KEK".into()),
        Err(e) if e.kind() == ErrorKind::NotFound => {
            let mut kek = [0u8; KEK_LEN];
            rand::thread_rng().fill_bytes(&mut kek);
            std::fs::write(&path, &kek).map_err(|e| e.to_string())?;
            Ok(kek)
        }
        Err(e) => Err(e.to_string()),
    }
}

fn load_envelope(app: &tauri::AppHandle) -> Result<HashMap<String, String>, String> {
    let path = vault_file_path(app, "vault.json")?;
    match std::fs::read_to_string(&path) {
        Ok(s) => {
            let doc: Value = serde_json::from_str(&s).map_err(|e| e.to_string())?;
            if doc.get("v").and_then(|v| v.as_u64()) != Some(VAULT_VERSION as u64) {
                return Err("unsupported vault version".into());
            }
            let nonce_b64 = doc.get("nonce").and_then(|v| v.as_str()).ok_or("missing nonce")?;
            let cipher_b64 = doc.get("cipher").and_then(|v| v.as_str()).ok_or("missing cipher")?;
            let nonce = base64_decode(nonce_b64)?;
            let cipher = base64_decode(cipher_b64)?;
            if nonce.len() != NONCE_LEN {
                return Err("bad nonce".into());
            }
            let kek = load_kek(app)?;
            let cipher_obj = Aes256Gcm::new_from_slice(&kek).map_err(|e| e.to_string())?;
            let plain = cipher_obj
                .decrypt(Nonce::from_slice(&nonce), cipher.as_slice())
                .map_err(|_| "decrypt failed".to_string())?;
            let map: HashMap<String, String> =
                serde_json::from_slice(&plain).map_err(|e| e.to_string())?;
            Ok(map)
        }
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(HashMap::new()),
        Err(e) => Err(e.to_string()),
    }
}

fn save_envelope(app: &tauri::AppHandle, map: &HashMap<String, String>) -> Result<(), String> {
    let kek = load_kek(app)?;
    let plain = serde_json::to_vec(map).map_err(|e| e.to_string())?;
    let cipher_obj = Aes256Gcm::new_from_slice(&kek).map_err(|e| e.to_string())?;
    let mut nonce = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce);
    let cipher = cipher_obj
        .encrypt(Nonce::from_slice(&nonce), plain.as_slice())
        .map_err(|e| e.to_string())?;
    let doc = serde_json::json!({
        "v": VAULT_VERSION,
        "nonce": base64_encode(&nonce),
        "cipher": base64_encode(&cipher),
    });
    let path = vault_file_path(app, "vault.json")?;
    let tmp = path.with_extension("vault.json.tmp");
    std::fs::write(&tmp, doc.to_string()).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

pub fn vault_set(app: &tauri::AppHandle, key: &str, value: &str) -> Result<(), String> {
    let mut map = load_envelope(app)?;
    map.insert(key.to_string(), value.to_string());
    save_envelope(app, &map)?;
    if !use_fallback() {
        if let Ok(entry) = keyring_entry(key) {
            let _ = entry.set_password(value);
        }
    }
    Ok(())
}

#[allow(dead_code)]
pub fn vault_get(app: &tauri::AppHandle, key: &str) -> Result<Option<String>, String> {
    let map = load_envelope(app)?;
    if let Some(v) = map.get(key) {
        return Ok(Some(v.clone()));
    }
    if !use_fallback() {
        if let Ok(entry) = keyring_entry(key) {
            if let Ok(v) = entry.get_password() {
                return Ok(Some(v));
            }
        }
    }
    Ok(None)
}

#[allow(dead_code)]
pub fn vault_delete(app: &tauri::AppHandle, key: &str) -> Result<(), String> {
    let mut map = load_envelope(app)?;
    map.remove(key);
    save_envelope(app, &map)?;
    if !use_fallback() {
        if let Ok(entry) = keyring_entry(key) {
            let _ = entry.delete_credential();
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_mode_toggle() {
        std::env::set_var("HARBOR_VAULT_FORCE_FALLBACK", "1");
        assert!(use_fallback());
        std::env::remove_var("HARBOR_VAULT_FORCE_FALLBACK");
    }

    #[test]
    fn base64_roundtrip() {
        let raw = b"realdebrid=abc123";
        let enc = base64_encode(raw);
        let dec = base64_decode(&enc).unwrap();
        assert_eq!(dec, raw);
    }
}
