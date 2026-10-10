use crate::music::MusicState;
use serde::Serialize;

pub const CABLE_SINK: &str = "harbor_broadcast";
pub const CABLE_SOURCE: &str = "harbor_virtual_mic";
#[allow(dead_code)]
pub const CABLE_GROUP: &str = "harbor_cable";
#[allow(dead_code)]
pub const CABLE_SINK_LABEL: &str = "Harbor Broadcast";
pub const CABLE_MIC_LABEL: &str = "Harbor Virtual Mic";
pub const CABLE_MONITOR_LABEL: &str = "Monitor of Harbor Broadcast";
#[allow(dead_code)]
pub const CABLE_RATE: u32 = 48_000;
pub const CABLE_RATE_MIN: u32 = 8_000;
pub const CABLE_RATE_MAX: u32 = 768_000;

#[cfg(target_os = "linux")]
#[path = "cable_linux.rs"]
mod backend;

#[cfg(target_os = "macos")]
#[path = "../cable_mac/mod.rs"]
mod backend;

#[cfg(windows)]
#[path = "../cable_win/mod.rs"]
mod backend;

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
mod backend {
    use super::CableStatus;
    use crate::music::MusicState;

    pub(super) async fn status(_state: &MusicState) -> CableStatus {
        CableStatus::idle(false, "none", Some("music.cable.driverNeeded".to_string()))
    }

    pub(super) async fn create(
        _state: &MusicState,
        _rate: Option<u32>,
    ) -> Result<CableStatus, String> {
        Err("music.cable.driverNeeded".to_string())
    }

    pub(super) async fn destroy(state: &MusicState) -> Result<CableStatus, String> {
        Ok(status(state).await)
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CableStatus {
    pub supported: bool,
    pub active: bool,
    pub backend: String,
    pub sink_name: String,
    pub monitor_name: String,
    pub monitor_label: String,
    pub mic_name: String,
    pub mic_label: String,
    pub mic_ready: bool,
    pub monitor_ready: bool,
    pub spec: Option<String>,
    pub rate: Option<u32>,
    pub format: Option<String>,
    pub channels: Option<u32>,
    pub requested_rate: Option<u32>,
    pub graph_rate: Option<u32>,
    pub bit_perfect: bool,
    pub resampled_by: Option<String>,
    pub output_device: Option<String>,
    pub detail: Option<String>,
}

impl CableStatus {
    pub(super) fn idle(supported: bool, backend: &str, detail: Option<String>) -> Self {
        Self {
            supported,
            active: false,
            backend: backend.to_string(),
            sink_name: CABLE_SINK.to_string(),
            monitor_name: format!("{CABLE_SINK}.monitor"),
            monitor_label: CABLE_MONITOR_LABEL.to_string(),
            mic_name: CABLE_SOURCE.to_string(),
            mic_label: CABLE_MIC_LABEL.to_string(),
            mic_ready: false,
            monitor_ready: false,
            spec: None,
            rate: None,
            format: None,
            channels: None,
            requested_rate: None,
            graph_rate: None,
            bit_perfect: false,
            resampled_by: None,
            output_device: None,
            detail,
        }
    }
}

#[tauri::command]
pub async fn music_cable_status(
    state: tauri::State<'_, MusicState>,
) -> Result<CableStatus, String> {
    Ok(backend::status(state.inner()).await)
}

#[tauri::command]
pub async fn music_cable_create(
    state: tauri::State<'_, MusicState>,
    rate: Option<u32>,
) -> Result<CableStatus, String> {
    backend::create(state.inner(), rate).await
}

#[tauri::command]
pub async fn music_cable_destroy(
    state: tauri::State<'_, MusicState>,
) -> Result<CableStatus, String> {
    backend::destroy(state.inner()).await
}
