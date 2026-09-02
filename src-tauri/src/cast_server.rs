use tauri::AppHandle;

#[derive(Clone, Debug, serde::Serialize)]
pub struct CastServerStatus {
    pub bundled: bool,
    pub running: bool,
    pub ready: bool,
    pub port: Option<u16>,
    pub last_error: Option<String>,
    pub restart_count: u32,
}

pub fn stop() {
    crate::torrent_engine::stop_lan_server();
}

fn kill_orphan_sidecars() {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/FI", "IMAGENAME eq stremio-server*"])
            .creation_flags(0x0800_0000)
            .output();
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("pkill")
            .args(["-f", "stremio-server"])
            .output();
    }
}

pub fn ensure_started_on_setup(_app: &AppHandle) {
    kill_orphan_sidecars();
}

#[tauri::command]
pub fn stop_stremio_sidecar() {
    kill_orphan_sidecars();
}

#[tauri::command]
pub fn cast_server_status() -> CastServerStatus {
    let (running, port, last_error) = crate::torrent_engine::lan_status();
    CastServerStatus {
        bundled: running,
        running,
        ready: running,
        port,
        last_error,
        restart_count: 0,
    }
}

#[tauri::command]
pub async fn cast_server_restart(app: AppHandle) -> Result<(), String> {
    crate::torrent_engine::start_lan_server(&app)
        .await
        .map(|_| ())
}

#[tauri::command]
pub fn cast_server_stop() {
    crate::torrent_engine::stop_lan_server();
    kill_orphan_sidecars();
}
