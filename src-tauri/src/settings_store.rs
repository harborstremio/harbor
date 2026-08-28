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

/// Read the `torrentsDisabled` flag from the settings file without pulling in
/// a full JSON parser. Returns false if the file is missing, unreadable, or
/// the field is absent. This is intended to be cheap enough to call from
/// `torrent_engine::ensure_started_on_setup` and `ensure_session`.
pub fn read_torrents_disabled(app: &tauri::AppHandle) -> bool {
    let path = match settings_path(app) {
        Ok(p) => p,
        Err(_) => return false,
    };
    let s = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return false,
    };
    parse_torrents_disabled(&s)
}

fn parse_torrents_disabled(json: &str) -> bool {
    // Cheap field scan. We only need to know whether
    // `\"torrentsDisabled\":true` appears in the file. False is the safe
    // default if we cannot confirm it.
    let needle = "\"torrentsDisabled\"";
    let Some(idx) = json.find(needle) else {
        return false;
    };
    let rest = &json[idx + needle.len()..];
    // Skip whitespace, optional ':', and any extra whitespace.
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

/// Read the `remoteStreamServerUrl` field from the settings file. Returns the
/// URL string if set to a non-empty value, or an empty string otherwise.
pub fn read_remote_stream_server_url(app: &tauri::AppHandle) -> String {
    let path = match settings_path(app) {
        Ok(p) => p,
        Err(_) => return String::new(),
    };
    let s = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return String::new(),
    };
    parse_remote_stream_server_url(&s)
}

fn parse_remote_stream_server_url(json: &str) -> String {
    // Cheap field scan for `\"remoteStreamServerUrl\":\"...\"`
    let needle = "\"remoteStreamServerUrl\"";
    let Some(idx) = json.find(needle) else {
        return String::new();
    };
    let rest = &json[idx + needle.len()..];
    let mut chars = rest.chars().peekable();
    // Skip whitespace and ':'
    while let Some(c) = chars.peek() {
        if c.is_whitespace() || *c == ':' {
            chars.next();
        } else {
            break;
        }
    }
    // Expect opening quote
    if !matches!(chars.next(), Some('"')) {
        return String::new();
    }
    // Read until closing quote
    let mut url = String::new();
    loop {
        match chars.next() {
            None | Some('"') => break,
            Some(c) => url.push(c),
        }
    }
    url
}
