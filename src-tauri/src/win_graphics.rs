const ENV: &str = "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS";

fn settings_file() -> Option<std::path::PathBuf> {
    let base = std::env::var_os("APPDATA")?;
    Some(
        std::path::PathBuf::from(base)
            .join("app.harbor")
            .join("settings.json"),
    )
}

fn stored_backend() -> Option<String> {
    let raw = std::fs::read_to_string(settings_file()?).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let value = parsed.get("uiGraphicsBackend")?.as_str()?.to_string();
    Some(value)
}

fn flags_for(backend: &str) -> Option<&'static str> {
    match backend {
        "d3d11" => Some("--use-angle=d3d11"),
        "opengl" => Some("--use-angle=gl"),
        "vulkan" => Some("--use-angle=vulkan"),
        "software" => Some("--use-angle=swiftshader --disable-gpu-compositing"),
        _ => None,
    }
}

pub fn configure_windows_graphics() {
    let backend = match std::env::var("HARBOR_UI_GFX") {
        Ok(v) if !v.is_empty() => v,
        _ => match stored_backend() {
            Some(v) => v,
            None => return,
        },
    };
    let Some(flags) = flags_for(backend.as_str()) else {
        return;
    };
    let existing = std::env::var(ENV).unwrap_or_default();
    if existing.contains("--use-angle") {
        eprintln!("[harbor::win_gfx] {ENV} already selects a backend; leaving it alone");
        return;
    }
    let merged = if existing.trim().is_empty() {
        flags.to_string()
    } else {
        format!("{existing} {flags}")
    };
    eprintln!("[harbor::win_gfx] graphics backend '{backend}' -> {flags}");
    std::env::set_var(ENV, merged);
}
