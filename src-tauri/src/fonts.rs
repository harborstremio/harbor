use std::path::{Path, PathBuf};
use tauri::Manager;

fn is_font_file(p: &Path) -> bool {
    let ext = p
        .extension()
        .and_then(|x| x.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    matches!(ext.as_str(), "otf" | "ttf" | "ttc")
}

fn has_font(dir: &std::path::Path) -> bool {
    let Ok(rd) = std::fs::read_dir(dir) else {
        return false;
    };
    rd.flatten().any(|e| is_font_file(&e.path()))
}

pub fn locate_fonts_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let mut cands: Vec<PathBuf> = Vec::new();
    if let Ok(res) = app.path().resource_dir() {
        cands.push(res.join("fonts"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            cands.push(dir.join("fonts"));
            cands.push(dir.join("..").join("fonts"));
            cands.push(dir.join("..").join("..").join("fonts"));
            cands.push(
                dir.join("..")
                    .join("..")
                    .join("..")
                    .join("src-tauri")
                    .join("fonts"),
            );
        }
    }
    cands.push(PathBuf::from("src-tauri").join("fonts"));
    cands.push(PathBuf::from("fonts"));
    cands.into_iter().find(|d| d.is_dir() && has_font(d))
}

fn user_fonts_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?.join("fonts");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

fn seed_from_bundle(app: &tauri::AppHandle, dest: &Path) {
    let Some(src) = locate_fonts_dir(app) else {
        return;
    };
    if src == dest {
        return;
    }
    let Ok(rd) = std::fs::read_dir(&src) else {
        return;
    };
    for entry in rd.flatten() {
        let from = entry.path();
        if !is_font_file(&from) {
            continue;
        }
        let Some(name) = from.file_name() else {
            continue;
        };
        let to = dest.join(name);
        let same = std::fs::metadata(&to)
            .ok()
            .zip(entry.metadata().ok())
            .is_some_and(|(a, b)| a.len() == b.len());
        if same {
            continue;
        }
        if let Err(e) = std::fs::copy(&from, &to) {
            eprintln!("[harbor::fonts] could not seed {:?}: {e}", name);
        }
    }
}

pub fn sub_fonts_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    match user_fonts_dir(app) {
        Some(dir) => {
            seed_from_bundle(app, &dir);
            if has_font(&dir) {
                Some(dir)
            } else {
                locate_fonts_dir(app)
            }
        }
        None => locate_fonts_dir(app),
    }
}

fn safe_id(id: &str) -> Option<&str> {
    if id.is_empty() || id.len() > 64 {
        return None;
    }
    id.chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        .then_some(id)
}

fn safe_ext(ext: &str) -> Option<&str> {
    matches!(ext, "ttf" | "otf" | "ttc").then_some(ext)
}

#[tauri::command]
pub fn install_sub_font(
    app: tauri::AppHandle,
    id: String,
    ext: String,
    base64: String,
) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
    let id = safe_id(&id).ok_or("bad font id")?;
    let ext = safe_ext(&ext).ok_or("libass can only read ttf, otf or ttc")?;
    let bytes = B64.decode(base64.as_bytes()).map_err(|e| e.to_string())?;
    if bytes.is_empty() || bytes.len() > 32 * 1024 * 1024 {
        return Err("bad font size".into());
    }
    let dir = sub_fonts_dir(&app).ok_or("no writable fonts dir")?;
    std::fs::write(dir.join(format!("harbor-custom-{id}.{ext}")), &bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_sub_font(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let id = safe_id(&id).ok_or("bad font id")?;
    let Some(dir) = user_fonts_dir(&app) else {
        return Ok(());
    };
    for ext in ["ttf", "otf", "ttc"] {
        let _ = std::fs::remove_file(dir.join(format!("harbor-custom-{id}.{ext}")));
    }
    Ok(())
}

#[tauri::command]
pub fn list_sub_fonts(app: tauri::AppHandle) -> Vec<String> {
    let Some(dir) = user_fonts_dir(&app) else {
        return Vec::new();
    };
    let Ok(rd) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    rd.flatten()
        .filter_map(|e| {
            let p = e.path();
            if !is_font_file(&p) {
                return None;
            }
            p.file_stem()
                .and_then(|s| s.to_str())
                .and_then(|s| s.strip_prefix("harbor-custom-"))
                .map(|s| s.to_string())
        })
        .collect()
}
