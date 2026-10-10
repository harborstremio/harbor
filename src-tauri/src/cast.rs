use mdns_sd::{ServiceDaemon, ServiceEvent};
use rust_cast::{
    channels::{
        media::{Media, Metadata, MovieMediaMetadata, MusicTrackMediaMetadata, StreamType},
        receiver::CastDeviceApp,
    },
    CastDevice, ChannelMessage,
};
use serde::Serialize;
use std::collections::HashMap;
use std::net::IpAddr;
use std::str::FromStr;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use crate::airplay;
use crate::cast_subs::{self, CastSub, CastSubStyle};
use crate::dlna;
use crate::roku;
use crate::stream_proxy::{AudioCastFormat, AudioCastInput, ProxyState, RegisterArgs};
use crate::transcode::TranscodeProfile;

const CAST_SERVICE_TYPE: &str = "_googlecast._tcp.local.";
const HARBOR_RECEIVER_APP_ID: &str = "120F754D";
const DISCOVERY_TIMEOUT_MS: u64 = 5000;

#[derive(Debug, Clone, Serialize)]
pub struct CastDeviceInfo {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub model: Option<String>,
    pub kind: String,
    pub control_url: Option<String>,
    pub audio_only: bool,
}

fn is_audio_content_type(content_type: Option<&str>) -> bool {
    content_type.is_some_and(|mime| mime.trim().to_ascii_lowercase().starts_with("audio/"))
}

fn needs_auto_remux(kind: &str, url: &str, content_type: Option<&str>) -> bool {
    // Music streams keep their actual codec/container; the video HLS emitter is not an audio converter.
    if is_audio_content_type(content_type) {
        return false;
    }
    if kind != "chromecast" && kind != "dlna" && kind != "roku" {
        return false;
    }
    let path = url.split('?').next().unwrap_or(url).to_lowercase();
    // Streaming-friendly playlists pass through. Everything else (MP4 included,
    // because non-faststart MP4 with moov-at-end stalls the chromecast) gets
    // segmented through our HLS emitter. The HLS path uses fast transmux for
    // h264+aac sources so there's no CPU cost.
    if path.ends_with(".m3u8") || path.ends_with(".mpd") || path.ends_with(".ts") {
        return false;
    }
    true
}

fn chromecast_content_type(url: &str, supplied: Option<&str>) -> String {
    if is_audio_content_type(supplied) {
        return supplied.unwrap_or_default().trim().to_string();
    }
    let lower = url.to_lowercase();
    if lower.contains(".m3u8") {
        "application/x-mpegURL".into()
    } else if lower.contains(".ts") {
        "video/mp2t".into()
    } else {
        "video/mp4".into()
    }
}

fn cast_media_metadata(
    title: Option<String>,
    poster: Option<String>,
    content_type: Option<&str>,
) -> Metadata {
    let images = poster
        .map(|url| vec![rust_cast::channels::media::Image::new(url)])
        .unwrap_or_default();
    if is_audio_content_type(content_type) {
        Metadata::MusicTrack(MusicTrackMediaMetadata {
            title,
            images,
            ..Default::default()
        })
    } else {
        Metadata::Movie(MovieMediaMetadata {
            title,
            images,
            ..Default::default()
        })
    }
}

fn required_control_url(kind: &str, control_url: Option<String>) -> Result<Option<String>, String> {
    match (kind, control_url) {
        ("dlna", None) => Err("DLNA device missing control_url".to_string()),
        ("roku", None) => Err("Roku device missing ecp_base".to_string()),
        (_, control_url) => Ok(control_url),
    }
}

fn detect_audio_only(name: &str, model: &Option<String>, kind: &str) -> bool {
    let n = name.to_lowercase();
    let m = model.as_deref().unwrap_or("").to_lowercase();
    let blob = format!("{n} {m}");
    let screen_hints = ["nest hub", "echo show", "tv ", " tv", "display"];
    if screen_hints.iter().any(|h| blob.contains(h)) {
        return false;
    }
    let speaker_hints = [
        "sonos",
        "echo dot",
        "echo studio",
        "homepod",
        "home pod",
        "google home mini",
        "google nest mini",
        "nest audio",
        "speaker",
        "soundbar",
        "playbar",
        "play:1",
        "play:3",
        "play:5",
        "era 100",
        "era 300",
        "five ",
    ];
    if speaker_hints.iter().any(|h| blob.contains(h)) {
        return true;
    }
    if kind == "chromecast" {
        let audio_models = [
            "chromecast audio",
            "nest audio",
            "google home mini",
            "nest mini",
        ];
        return audio_models.iter().any(|h| m.contains(h));
    }
    false
}

enum ActiveSession {
    Chromecast {
        host: String,
        port: u16,
        transport_id: String,
        session_id: String,
        media_session_id: Option<i32>,
        seek_start_sec: f64,
        hls_session_id: Option<String>,
    },
    Dlna {
        control_url: String,
        hls_session_id: Option<String>,
    },
    Roku {
        ecp_base: String,
        hls_session_id: Option<String>,
    },
    AirPlay {
        host: String,
        port: u16,
        hls_session_id: Option<String>,
    },
}

static ACTIVE: Mutex<Option<ActiveSession>> = Mutex::new(None);
// Keep asynchronous receiver mutations in order; status polling never holds this lock.
static TRANSPORT_OPS: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
static ACTIVE_EPOCH: AtomicU64 = AtomicU64::new(0);

impl ActiveSession {
    fn hls_session_id(&self) -> Option<String> {
        match self {
            Self::Chromecast { hls_session_id, .. }
            | Self::Dlna { hls_session_id, .. }
            | Self::Roku { hls_session_id, .. }
            | Self::AirPlay { hls_session_id, .. } => hls_session_id.clone(),
        }
    }
}

async fn replace_active_session<Stop, StopFuture>(
    next: ActiveSession,
    stop_hls: Stop,
) -> Result<(), String>
where
    Stop: FnOnce(String) -> StopFuture,
    StopFuture: std::future::Future<Output = ()>,
{
    let previous_hls = {
        let mut active = ACTIVE.lock().map_err(|e| format!("lock: {e}"))?;
        ACTIVE_EPOCH.fetch_add(1, Ordering::Relaxed);
        active
            .replace(next)
            .and_then(|session| session.hls_session_id())
    };
    if let Some(id) = previous_hls {
        stop_hls(id).await;
    }
    Ok(())
}

fn restore_failed_stop(session: Option<ActiveSession>, epoch: u64) -> Result<(), String> {
    let mut active = ACTIVE.lock().map_err(|e| format!("lock: {e}"))?;
    restore_failed_stop_if_current(&mut active, session, epoch, ACTIVE_EPOCH.load(Ordering::Relaxed));
    Ok(())
}

fn restore_failed_stop_if_current(
    active: &mut Option<ActiveSession>,
    session: Option<ActiveSession>,
    epoch: u64,
    current_epoch: u64,
) {
    // A new LOAD may have replaced (and subsequently stopped) the session while STOP awaited the network.
    if active.is_none() && current_epoch == epoch {
        *active = session;
    }
}

fn parse_friendly_name(properties: &HashMap<String, String>) -> Option<String> {
    properties
        .get("fn")
        .or_else(|| properties.get("n"))
        .map(|s| s.to_string())
}

fn parse_model(properties: &HashMap<String, String>) -> Option<String> {
    properties.get("md").map(|s| s.to_string())
}

fn pick_address(addrs: &std::collections::HashSet<IpAddr>) -> Option<IpAddr> {
    addrs.iter().copied().find(|a| a.is_ipv4()).or_else(|| {
        addrs.iter().copied().find(|a| match a {
            IpAddr::V6(v6) => {
                let o = v6.octets();
                !(o[0] == 0xfe && (o[1] & 0xc0) == 0x80)
            }
            _ => false,
        })
    })
}

async fn discover_chromecasts() -> Vec<CastDeviceInfo> {
    tokio::task::spawn_blocking(|| -> Vec<CastDeviceInfo> {
        let Ok(daemon) = ServiceDaemon::new() else {
            return Vec::new();
        };
        let Ok(receiver) = daemon.browse(CAST_SERVICE_TYPE) else {
            return Vec::new();
        };
        let deadline = std::time::Instant::now() + Duration::from_millis(DISCOVERY_TIMEOUT_MS);
        let mut devices: HashMap<String, CastDeviceInfo> = HashMap::new();
        while std::time::Instant::now() < deadline {
            match receiver.recv_timeout(Duration::from_millis(120)) {
                Ok(ServiceEvent::ServiceResolved(info)) => {
                    let addrs = info.get_addresses();
                    let Some(addr) = pick_address(addrs) else {
                        continue;
                    };
                    let port = info.get_port();
                    let host = addr.to_string();
                    let props_map: HashMap<String, String> = info
                        .get_properties()
                        .iter()
                        .map(|p| (p.key().to_string(), p.val_str().to_string()))
                        .collect();
                    let name = parse_friendly_name(&props_map)
                        .unwrap_or_else(|| info.get_fullname().to_string());
                    let model = parse_model(&props_map);
                    let id = format!("cc-{}-{}", host, port);
                    let audio_only = detect_audio_only(&name, &model, "chromecast");
                    devices.insert(
                        id.clone(),
                        CastDeviceInfo {
                            id,
                            name,
                            host,
                            port,
                            model,
                            kind: "chromecast".into(),
                            control_url: None,
                            audio_only,
                        },
                    );
                }
                Ok(_) => {}
                Err(_) => {}
            }
        }
        let _ = daemon.shutdown();
        devices.into_values().collect()
    })
    .await
    .unwrap_or_default()
}

async fn discover_dlna() -> Vec<CastDeviceInfo> {
    dlna::discover(DISCOVERY_TIMEOUT_MS)
        .await
        .into_iter()
        .map(|d| {
            let audio_only = detect_audio_only(&d.name, &d.model, "dlna");
            CastDeviceInfo {
                id: format!("dlna-{}", d.id),
                name: d.name,
                host: d.host,
                port: 0,
                model: d.model,
                kind: "dlna".into(),
                control_url: Some(d.control_url),
                audio_only,
            }
        })
        .collect()
}

async fn discover_roku() -> Vec<CastDeviceInfo> {
    roku::discover(DISCOVERY_TIMEOUT_MS)
        .await
        .into_iter()
        .map(|d| {
            let audio_only = detect_audio_only(&d.name, &d.model, "roku");
            let (host, port) = split_host_port(&d.host).unwrap_or_else(|| (d.host.clone(), 8060));
            CastDeviceInfo {
                id: format!("roku-{}", d.id),
                name: d.name,
                host,
                port,
                model: d.model,
                kind: "roku".into(),
                control_url: Some(d.ecp_base),
                audio_only,
            }
        })
        .collect()
}

fn split_host_port(host_str: &str) -> Option<(String, u16)> {
    let (h, p) = host_str.rsplit_once(':')?;
    let port = p.parse::<u16>().ok()?;
    Some((h.to_string(), port))
}

async fn discover_airplay() -> Vec<CastDeviceInfo> {
    airplay::discover(DISCOVERY_TIMEOUT_MS)
        .await
        .into_iter()
        .map(|d| {
            let audio_only = detect_audio_only(&d.name, &d.model, "airplay");
            CastDeviceInfo {
                id: d.id,
                name: d.name,
                host: d.host,
                port: d.port,
                model: d.model,
                kind: "airplay".into(),
                control_url: None,
                audio_only,
            }
        })
        .collect()
}

fn kind_priority(kind: &str) -> u8 {
    match kind {
        "chromecast" => 0,
        "airplay" => 1,
        "roku" => 2,
        "dlna" => 3,
        _ => 9,
    }
}

fn looks_like_apple(name: &str, model: &Option<String>) -> bool {
    let n = name.to_lowercase();
    let m = model.as_deref().unwrap_or("").to_lowercase();
    n.contains("apple tv") || m.contains("appletv") || m.contains("apple")
}

fn dedupe_by_host(devices: Vec<CastDeviceInfo>) -> Vec<CastDeviceInfo> {
    use std::collections::hash_map::Entry;
    let mut by_host: HashMap<String, CastDeviceInfo> = HashMap::new();
    for d in devices {
        let host_key = d.host.split(':').next().unwrap_or(&d.host).to_string();
        match by_host.entry(host_key) {
            Entry::Vacant(slot) => {
                slot.insert(d);
            }
            Entry::Occupied(mut slot) => {
                let existing = slot.get();
                let pair = (existing.kind.as_str(), d.kind.as_str());
                let apple = looks_like_apple(&d.name, &d.model)
                    || looks_like_apple(&existing.name, &existing.model);
                let dlna_wins_airplay =
                    matches!(pair, ("airplay", "dlna") | ("dlna", "airplay")) && !apple;
                if dlna_wins_airplay {
                    if d.kind == "dlna" {
                        slot.insert(d);
                    }
                } else if kind_priority(&d.kind) < kind_priority(&existing.kind) {
                    slot.insert(d);
                }
            }
        }
    }
    by_host.into_values().collect()
}

#[tauri::command]
pub async fn cast_discover() -> Result<Vec<CastDeviceInfo>, String> {
    let (cc, dl, rk, ap) = tokio::join!(
        discover_chromecasts(),
        discover_dlna(),
        discover_roku(),
        discover_airplay(),
    );
    let merged: Vec<CastDeviceInfo> = cc.into_iter().chain(dl).chain(rk).chain(ap).collect();
    let mut out = dedupe_by_host(merged);
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

fn connect_device_once<'a>(host: &str, port: u16) -> Result<CastDevice<'a>, String> {
    let device = CastDevice::connect_without_host_verification(host.to_string(), port)
        .map_err(|e| format!("connect: {e}"))?;
    device
        .connection
        .connect("receiver-0".to_string())
        .map_err(|e| format!("connect ns: {e}"))?;
    device
        .heartbeat
        .ping()
        .map_err(|e| format!("heartbeat: {e}"))?;
    Ok(device)
}

fn humanize_cast_error(err: &str) -> String {
    let lower = err.to_lowercase();
    if lower.contains("unexpected end of file") || lower.contains("connection reset") {
        return "Device dropped the connection. It may be busy with another app, asleep, or another phone is already casting to it. Wake the screen, stop other casts, and try again.".to_string();
    }
    if lower.contains("timed out") || lower.contains("os error 10060") {
        return "Couldn't reach the device. Check it's on the same Wi-Fi as your computer."
            .to_string();
    }
    if lower.contains("connection refused") {
        return "Device refused the connection. Try restarting it.".to_string();
    }
    if lower.contains("certificate") || lower.contains("tls") {
        return "Secure handshake failed. Make sure the TV is on the same network, and update its firmware if this keeps happening.".to_string();
    }
    err.to_string()
}

fn connect_device<'a>(host: &str, port: u16) -> Result<CastDevice<'a>, String> {
    match connect_device_once(host, port) {
        Ok(d) => Ok(d),
        Err(e1) => {
            eprintln!(
                "[harbor::cast] connect attempt 1 failed: {} (retrying once)",
                e1
            );
            std::thread::sleep(Duration::from_millis(500));
            match connect_device_once(host, port) {
                Ok(d) => Ok(d),
                Err(e2) => Err(humanize_cast_error(&e2)),
            }
        }
    }
}

fn launch_harbor_receiver<'a>(device: &CastDevice<'a>) -> Result<(String, String), String> {
    launch_receiver_app(device, HARBOR_RECEIVER_APP_ID)
}

fn launch_receiver_app<'a>(
    device: &CastDevice<'a>,
    app_id: &str,
) -> Result<(String, String), String> {
    let app = CastDeviceApp::from_str(app_id).map_err(|_| "invalid receiver app id".to_string())?;
    let session = device
        .receiver
        .launch_app(&app)
        .map_err(|e| format!("launch: {e}"))?;
    let transport_id = session.transport_id.clone();
    let session_id = session.session_id.clone();
    if transport_id.is_empty() || session_id.is_empty() {
        return Err("Receiver did not return session info".into());
    }
    device
        .connection
        .connect(transport_id.clone())
        .map_err(|e| format!("connect transport: {e}"))?;
    Ok((transport_id, session_id))
}

#[tauri::command]
pub async fn cast_load(
    proxy_state: tauri::State<'_, ProxyState>,
    host: String,
    port: u16,
    url: String,
    title: Option<String>,
    poster: Option<String>,
    content_type: Option<String>,
    start_time_sec: Option<f64>,
    kind: Option<String>,
    control_url: Option<String>,
    headers: Option<std::collections::HashMap<String, String>>,
    transcode: Option<bool>,
    profile: Option<TranscodeProfile>,
    subtitle: Option<CastSub>,
    sub_style: Option<CastSubStyle>,
    audio_only: Option<bool>,
    audio_track_ordinal: Option<u32>,
    audio_start_paused: Option<bool>,
) -> Result<(), String> {
    let kind_str = kind.unwrap_or_else(|| "chromecast".into());
    let _operation = TRANSPORT_OPS.lock().await;
    let control_url = required_control_url(&kind_str, control_url)?;
    let req_headers = headers.unwrap_or_default();
    let direct_audio = kind_str == "dlna" && !audio_start_paused.unwrap_or(false)
        && audio_track_ordinal.unwrap_or(0) == 0
        && dlna::supports_direct_audio(control_url.as_deref().unwrap_or(""), content_type.as_deref()).await;
    if kind_str == "dlna" && !direct_audio && (audio_only.unwrap_or(false) || is_audio_content_type(content_type.as_deref())) {
        let cu = control_url.ok_or("DLNA device missing control_url")?;
        let input = AudioCastInput {
            url, headers: req_headers, audio_ordinal: audio_track_ordinal.unwrap_or(0),
            start_seconds: start_time_sec.unwrap_or(0.0),
            // Live FLAC decoded on Sonos but failed real pause/resume tests. MP3 passed all controls.
            format: AudioCastFormat::Mp3,
            title, target_host: host,
        };
        return load_dlna_audio(&proxy_state, cu, input, audio_start_paused.unwrap_or(false), None).await;
    }
    if audio_only.unwrap_or(false) && !is_audio_content_type(content_type.as_deref()) {
        return Err("Audio-only routing is currently supported by DLNA speakers".into());
    }
    let burn_sub = match subtitle {
        Some(ref s) if !s.off => {
            let style = sub_style.unwrap_or_default();
            let seek = start_time_sec.unwrap_or(0.0).max(0.0);
            cast_subs::prepare(s, &style, &url, &req_headers, seek).await
        }
        _ => None,
    };
    if let Some(ref prepared) = burn_sub {
        eprintln!(
            "[harbor::cast] burning subtitle into transcode: {}",
            prepared.path.display(),
        );
    }
    // Auto-remux to MPEGTS for chromecast/dlna casts of MP4/MKV. This is the
    // ONLY way to reliably stream non-faststart MP4s and MKV through these
    // receivers — same approach Plex/Jellyfin/Stremio use. ffmpeg copy mode
    // is line-rate (no re-encoding) and produces a streaming-friendly container.
    let url_needs_remux = needs_auto_remux(&kind_str, &url, content_type.as_deref());
    let ffmpeg_available = crate::transcode::ffmpeg_present();
    let ffmpeg_path = crate::transcode::locate_ffmpeg();
    let url_path_lc = url.split('?').next().unwrap_or(&url).to_lowercase();
    let already_streaming = url_path_lc.ends_with(".m3u8")
        || url_path_lc.ends_with(".mpd")
        || url_path_lc.ends_with(".ts");
    let roku_force_transcode = kind_str == "roku"
        && ffmpeg_available
        && !already_streaming
        && !is_audio_content_type(content_type.as_deref());
    eprintln!(
        "[harbor::cast] remux probe v3: kind={} url_match={} ffmpeg_present={} ffmpeg_path={:?} roku_force={} already_streaming={}",
        kind_str, url_needs_remux, ffmpeg_available, ffmpeg_path, roku_force_transcode, already_streaming,
    );
    let auto_remux = (url_needs_remux && ffmpeg_available) || roku_force_transcode;
    let do_transcode = transcode.unwrap_or(false) || auto_remux || burn_sub.is_some();
    eprintln!(
        "[harbor::cast] load kind={} host={} port={} transcode={} (auto_remux={} burn_sub={})",
        kind_str,
        host,
        port,
        do_transcode,
        auto_remux,
        burn_sub.is_some(),
    );
    // When auto_remux fires (and the frontend didn't pass a re-encode profile),
    // use copy mode so we just remux to MPEGTS at line rate — no CPU cost.
    let effective_profile = profile.or(if auto_remux {
        Some(crate::transcode::TranscodeProfile {
            max_height: 1080,
            force_h264: false,
            force_aac: false,
            force_stereo: false,
            max_video_kbps: None,
        })
    } else {
        None
    });
    let burn_sub_path = burn_sub
        .as_ref()
        .map(|p| p.path.to_string_lossy().to_string());
    let burn_sub_style = burn_sub.as_ref().map(|p| p.force_style.clone());
    let proxied = proxy_state
        .register_cast(RegisterArgs {
            url: url.clone(),
            headers: req_headers,
            transcode: do_transcode,
            prebuffer_bytes: None,
            profile: effective_profile,
            target_host: Some(host.clone()),
            start_time_sec,
            burn_sub_path,
            burn_sub_style,
        })
        .await;
    eprintln!("[harbor::cast] proxied stream ready");
    let hls_session_id = proxied
        .url
        .contains("/cast/hls/")
        .then(|| proxied.session_id.clone());
    let cast_url = proxied.url;
    if kind_str == "dlna" {
        let cu = control_url.ok_or_else(|| "DLNA device missing control_url".to_string())?;
        let ct = if do_transcode {
            Some("video/mp2t".to_string())
        } else {
            content_type.clone()
        };
        if let Err(error) = dlna::load(
            cu.clone(),
            cast_url,
            title,
            start_time_sec,
            ct,
            do_transcode,
        )
        .await
        {
            if let Some(id) = hls_session_id.as_deref() {
                proxy_state.stop_hls_session(id).await;
            }
            return Err(error);
        }
        replace_active_session(
            ActiveSession::Dlna {
                control_url: cu,
                hls_session_id,
            },
            |id| async move {
                proxy_state.stop_hls_session(&id).await;
            },
        )
        .await?;
        return Ok(());
    }
    if kind_str == "roku" {
        let ecp = control_url.ok_or_else(|| "Roku device missing ecp_base".to_string())?;
        let ct = if do_transcode {
            Some("application/x-mpegURL".to_string())
        } else {
            content_type.clone()
        };
        if let Err(error) = roku::load(ecp.clone(), cast_url, title, ct, start_time_sec).await {
            if let Some(id) = hls_session_id.as_deref() {
                proxy_state.stop_hls_session(id).await;
            }
            return Err(error);
        }
        replace_active_session(
            ActiveSession::Roku {
                ecp_base: ecp,
                hls_session_id,
            },
            |id| async move {
                proxy_state.stop_hls_session(&id).await;
            },
        )
        .await?;
        return Ok(());
    }
    if kind_str == "airplay" {
        if let Err(error) = airplay::load(host.clone(), port, cast_url, start_time_sec).await {
            if let Some(id) = hls_session_id.as_deref() {
                proxy_state.stop_hls_session(id).await;
            }
            return Err(error);
        }
        replace_active_session(
            ActiveSession::AirPlay {
                host,
                port,
                hls_session_id,
            },
            |id| async move {
                proxy_state.stop_hls_session(&id).await;
            },
        )
        .await?;
        return Ok(());
    }
    let result = cast_load_chromecast(
        host,
        port,
        cast_url,
        title,
        poster,
        if do_transcode { None } else { content_type },
        start_time_sec,
        hls_session_id.clone(),
    )
    .await;
    match result {
        Ok(session) => {
            replace_active_session(session, |id| async move {
                proxy_state.stop_hls_session(&id).await;
            })
            .await
        }
        Err(error) => {
            if let Some(id) = hls_session_id.as_deref() {
                proxy_state.stop_hls_session(id).await;
            }
            Err(error)
        }
    }
}

async fn load_dlna_audio(proxy: &ProxyState, control_url: String, input: AudioCastInput, paused: bool, expected_previous: Option<&str>) -> Result<(), String> {
    let title = input.title.clone();
    let mime = input.format.mime().to_string();
    let route = proxy.register_audio_cast(input).await?;
    if let Some(previous) = expected_previous {
        let still_owned = dlna::current_uri(&control_url).await.map(|uri| dlna::uri_has_audio_session(&uri, previous));
        if !matches!(still_owned, Ok(true)) {
            proxy.stop_hls_session(&route.session_id).await;
            return Err("The speaker source changed during seeking".into());
        }
    }
    let result = dlna::load_audio_route(&control_url, route.url, &route.session_id, title, mime, paused).await;
    if let Err(error) = result {
        let cleanup = dlna::stop_audio_if_owned(&control_url, &route.session_id).await;
        if let Err(uncertain) = cleanup {
            // Retain an addressable session so a subsequent Stop can be acknowledged.
            replace_active_session(ActiveSession::Dlna { control_url, hls_session_id: Some(route.session_id) }, |id| async move { proxy.stop_hls_session(&id).await; }).await?;
            return Err(uncertain);
        }
        proxy.stop_hls_session(&route.session_id).await;
        return Err(error);
    }
    replace_active_session(ActiveSession::Dlna { control_url, hls_session_id: Some(route.session_id) }, |id| async move { proxy.stop_hls_session(&id).await; }).await
}

fn snapshot_dlna_audio() -> Option<(String, String)> {
    let active = ACTIVE.lock().ok()?;
    match active.as_ref()? {
        ActiveSession::Dlna { control_url, hls_session_id: Some(id) } if id.starts_with("audio-") => Some((control_url.clone(), id.clone())),
        _ => None,
    }
}

async fn cast_load_chromecast(
    host: String,
    port: u16,
    stream_url: String,
    title: Option<String>,
    poster: Option<String>,
    content_type: Option<String>,
    start_time_sec: Option<f64>,
    hls_session_id: Option<String>,
) -> Result<ActiveSession, String> {
    // Tear down any prior session's receiver app before starting a new one.
    {
        let prior = {
            let active = ACTIVE.lock().map_err(|e| format!("lock: {e}"))?;
            match active.as_ref() {
                Some(ActiveSession::Chromecast {
                    host,
                    port,
                    session_id,
                    ..
                }) => Some((host.clone(), *port, session_id.clone())),
                _ => None,
            }
        };
        if let Some((h, p, sid)) = prior {
            let _ = tokio::task::spawn_blocking(move || {
                if let Ok(d) = connect_device(&h, p) {
                    let _ = d.receiver.stop_app(&sid);
                }
            })
            .await;
        }
    }

    let host_clone = host.clone();
    let stream_url_clone = stream_url.clone();
    let title_clone = title.clone();
    let poster_clone = poster.clone();
    let start = start_time_sec.unwrap_or(0.0);
    let (result_tx, result_rx) =
        tokio::sync::oneshot::channel::<Result<(String, String, Option<i32>), String>>();

    std::thread::spawn(move || {
        let device = match connect_device(&host_clone, port) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("[harbor::cast] connect err: {}", e);
                let _ = result_tx.send(Err(e));
                return;
            }
        };
        eprintln!("[harbor::cast] connected to {}:{}", host_clone, port);
        // Google's default receiver supports audio without requiring the video receiver's registration.
        let launched = if is_audio_content_type(content_type.as_deref()) {
            launch_receiver_app(&device, "default")
        } else {
            launch_harbor_receiver(&device)
        };
        let (transport_id, session_id) = match launched {
            Ok(t) => t,
            Err(e) => {
                let _ = result_tx.send(Err(e));
                return;
            }
        };
        eprintln!(
            "[harbor::cast] receiver launched (transport={}, session={})",
            transport_id, session_id,
        );
        let metadata = cast_media_metadata(title_clone, poster_clone, content_type.as_deref());
        let content_type = chromecast_content_type(&stream_url_clone, content_type.as_deref());
        eprintln!(
            "[harbor::cast] sending LOAD: ct={} time={:.1}",
            content_type, start,
        );
        let media = Media {
            content_id: stream_url_clone.clone(),
            content_type,
            stream_type: StreamType::Buffered,
            duration: None,
            metadata: Some(metadata),
        };
        let is_hls = stream_url_clone.to_lowercase().contains("/cast/hls/")
            || stream_url_clone.to_lowercase().contains(".m3u8");
        let load_opts = rust_cast::channels::media::LoadOptions {
            current_time: if is_hls {
                0.0
            } else if start > 0.5 {
                start
            } else {
                0.0
            },
            autoplay: true,
        };
        let status =
            match device
                .media
                .load_with_opts(&transport_id, &session_id, &media, load_opts)
            {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("[harbor::cast] LOAD failed: {}", e);
                    let _ = result_tx.send(Err(format!("load: {e}")));
                    return;
                }
            };
        let media_session_id = status.entries.first().map(|e| e.media_session_id);
        eprintln!("[harbor::cast] LOAD ok msid={:?}", media_session_id);
        let _ = result_tx.send(Ok((
            transport_id.clone(),
            session_id.clone(),
            media_session_id,
        )));

        eprintln!(
            "[harbor::cast] receive loop entering for {}:{}",
            host_clone, port
        );
        loop {
            match device.receive() {
                Ok(rust_cast::ChannelMessage::Heartbeat(_)) => {
                    if let Err(e) = device.heartbeat.pong() {
                        eprintln!(
                            "[harbor::cast] pong failed for {}:{}: {e}",
                            host_clone, port
                        );
                        return;
                    }
                }
                Ok(rust_cast::ChannelMessage::Connection(msg)) => {
                    eprintln!("[harbor::cast] connection msg: {:?}", msg);
                }
                Ok(_) => {}
                Err(e) => {
                    eprintln!(
                        "[harbor::cast] receive loop ended for {}:{}: {e}",
                        host_clone, port
                    );
                    return;
                }
            }
        }
    });

    let (transport_id, session_id, msid) = result_rx
        .await
        .map_err(|e| format!("cast result channel: {e}"))??;

    Ok(ActiveSession::Chromecast {
        host,
        port,
        transport_id,
        session_id,
        media_session_id: msid,
        seek_start_sec: start,
        hls_session_id,
    })
}

fn snapshot_chromecast() -> Result<(String, u16, String, Option<i32>, f64), String> {
    let active = ACTIVE.lock().map_err(|e| format!("lock: {e}"))?;
    match active.as_ref() {
        Some(ActiveSession::Chromecast {
            host,
            port,
            transport_id,
            media_session_id,
            seek_start_sec,
            ..
        }) => Ok((
            host.clone(),
            *port,
            transport_id.clone(),
            *media_session_id,
            *seek_start_sec,
        )),
        _ => Err("No active Chromecast session".into()),
    }
}

fn snapshot_dlna() -> Option<String> {
    let active = ACTIVE.lock().ok()?;
    if let Some(ActiveSession::Dlna { control_url, .. }) = active.as_ref() {
        Some(control_url.clone())
    } else {
        None
    }
}

fn snapshot_roku() -> Option<String> {
    let active = ACTIVE.lock().ok()?;
    if let Some(ActiveSession::Roku { ecp_base, .. }) = active.as_ref() {
        Some(ecp_base.clone())
    } else {
        None
    }
}

fn snapshot_airplay() -> Option<(String, u16)> {
    let active = ACTIVE.lock().ok()?;
    if let Some(ActiveSession::AirPlay { host, port, .. }) = active.as_ref() {
        Some((host.clone(), *port))
    } else {
        None
    }
}

#[tauri::command]
pub async fn cast_play() -> Result<(), String> {
    let _operation = TRANSPORT_OPS.lock().await;
    if let Some((cu, id)) = snapshot_dlna_audio() {
        if !dlna::uri_has_audio_session(&dlna::current_uri(&cu).await?, &id) { return Err("The speaker source changed".into()); }
        dlna::play(cu.clone()).await?;
        return dlna::wait_audio_state(&cu, &id, false, false).await.map(|_| ());
    }
    if let Some(cu) = snapshot_dlna() {
        return dlna::play(cu).await;
    }
    if let Some(ecp) = snapshot_roku() {
        return roku::play(ecp).await;
    }
    if let Some((h, p)) = snapshot_airplay() {
        return airplay::play(h, p).await;
    }
    let (host, port, transport_id, msid, _seek_start) = snapshot_chromecast()?;
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let device = connect_device(&host, port)?;
        device
            .connection
            .connect(transport_id.clone())
            .map_err(|e| format!("{e}"))?;
        let msid = msid.ok_or("no media session")?;
        device
            .media
            .play(&transport_id, msid)
            .map_err(|e| format!("play: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

#[tauri::command]
pub async fn cast_pause() -> Result<(), String> {
    let _operation = TRANSPORT_OPS.lock().await;
    if let Some((cu, id)) = snapshot_dlna_audio() {
        if !dlna::uri_has_audio_session(&dlna::current_uri(&cu).await?, &id) { return Err("The speaker source changed".into()); }
        dlna::pause(cu.clone()).await?;
        return dlna::wait_audio_state(&cu, &id, true, false).await.map(|_| ());
    }
    if let Some(cu) = snapshot_dlna() {
        return dlna::pause(cu).await;
    }
    if let Some(ecp) = snapshot_roku() {
        return roku::pause(ecp).await;
    }
    if let Some((h, p)) = snapshot_airplay() {
        return airplay::pause(h, p).await;
    }
    let (host, port, transport_id, msid, _seek_start) = snapshot_chromecast()?;
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let device = connect_device(&host, port)?;
        device
            .connection
            .connect(transport_id.clone())
            .map_err(|e| format!("{e}"))?;
        let msid = msid.ok_or("no media session")?;
        device
            .media
            .pause(&transport_id, msid)
            .map_err(|e| format!("pause: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

#[tauri::command]
pub async fn cast_seek(proxy_state: tauri::State<'_, ProxyState>, sec: f64) -> Result<(), String> {
    let _operation = TRANSPORT_OPS.lock().await;
    if let Some((cu, id)) = snapshot_dlna_audio() {
        if !dlna::uri_has_audio_session(&dlna::current_uri(&cu).await?, &id) { return Err("The speaker source changed".into()); }
        let paused = normalize_player_state(&dlna::status(cu.clone()).await?.player_state) == "PAUSED";
        let mut input = proxy_state.audio_cast_input(&id).await.ok_or("Speaker audio route ended")?;
        input.start_seconds = sec;
        return load_dlna_audio(&proxy_state, cu, input, paused, Some(&id)).await;
    }
    if let Some(cu) = snapshot_dlna() {
        return dlna::seek(cu, sec).await;
    }
    if let Some(ecp) = snapshot_roku() {
        return roku::seek(ecp, sec).await;
    }
    if let Some((h, p)) = snapshot_airplay() {
        return airplay::seek(h, p, sec).await;
    }
    let (host, port, transport_id, msid, seek_start) = snapshot_chromecast()?;
    let cast_relative = (sec - seek_start).max(0.0);
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let device = connect_device(&host, port)?;
        device
            .connection
            .connect(transport_id.clone())
            .map_err(|e| format!("{e}"))?;
        let msid = msid.ok_or("no media session")?;
        device
            .media
            .seek(&transport_id, msid, Some(cast_relative as f32), None)
            .map_err(|e| format!("seek: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

#[tauri::command]
pub async fn cast_stop(proxy_state: tauri::State<'_, ProxyState>) -> Result<(), String> {
    let _operation = TRANSPORT_OPS.lock().await;
    let (session, epoch) = {
        let mut active = ACTIVE.lock().map_err(|e| format!("lock: {e}"))?;
        (active.take(), ACTIVE_EPOCH.load(Ordering::Relaxed))
    };
    let hls_session_id = match session.as_ref() {
        Some(ActiveSession::Chromecast { hls_session_id, .. })
        | Some(ActiveSession::Dlna { hls_session_id, .. })
        | Some(ActiveSession::Roku { hls_session_id, .. })
        | Some(ActiveSession::AirPlay { hls_session_id, .. }) => hls_session_id.clone(),
        None => None,
    };
    let result = match session.as_ref() {
        Some(ActiveSession::Dlna { control_url, hls_session_id: Some(id) }) if id.starts_with("audio-") => dlna::stop_audio_if_owned(control_url, id).await,
        Some(ActiveSession::Dlna { control_url, .. }) => dlna::stop(control_url.clone()).await,
        Some(ActiveSession::Roku { ecp_base, .. }) => roku::stop(ecp_base.clone()).await,
        Some(ActiveSession::AirPlay { host, port, .. }) => airplay::stop(host.clone(), *port).await,
        Some(ActiveSession::Chromecast {
            host,
            port,
            session_id,
            ..
        }) => {
            let (host, port, session_id) = (host.clone(), *port, session_id.clone());
            tokio::task::spawn_blocking(move || -> Result<(), String> {
                let device = connect_device(&host, port)?;
                device.receiver.stop_app(&session_id).map_err(|error| format!("stop: {error}"))?;
                Ok(())
            })
            .await
            .map_err(|e| format!("join: {e}"))
            .and_then(|result| result)
        }
        None => Ok(()),
    };
    if let Err(error) = result {
        restore_failed_stop(session, epoch)?;
        return Err(error);
    }
    cast_subs::cleanup();
    if let Some(id) = hls_session_id {
        proxy_state.stop_hls_session(&id).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn cast_status(proxy_state: tauri::State<'_, ProxyState>) -> Result<Option<CastStatus>, String> {
    if let Some((cu, id)) = snapshot_dlna_audio() {
        if !dlna::uri_has_audio_session(&dlna::current_uri(&cu).await?, &id) { return Ok(None); }
        let input = proxy_state.audio_cast_input(&id).await.ok_or("Speaker audio route ended")?;
        let state = dlna::status(cu).await?;
        return Ok(Some(CastStatus { position_sec: input.start_seconds + state.position_sec, player_state: normalize_player_state(&state.player_state), connected: true, transport_codec: Some("mp3".into()) }));
    }
    if let Some(cu) = snapshot_dlna() {
        let s = dlna::status(cu).await.ok();
        return Ok(s.map(|x| CastStatus {
            position_sec: x.position_sec,
            player_state: normalize_player_state(&x.player_state),
            connected: true,
            transport_codec: None,
        }));
    }
    if let Some(ecp) = snapshot_roku() {
        return Ok(roku::status(&ecp).await.ok().map(|s| CastStatus {
            position_sec: s.position_sec,
            player_state: normalize_player_state(&s.player_state),
            connected: !s.error,
            transport_codec: None,
        }));
    }
    if let Some((h, p)) = snapshot_airplay() {
        let s = airplay::status(h, p).await.ok();
        return Ok(s.map(|(pos, state)| CastStatus {
            position_sec: pos,
            player_state: normalize_player_state(&state),
            connected: true,
            transport_codec: None,
        }));
    }
    let snap = match snapshot_chromecast() {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };
    let (host, port, transport_id, msid, seek_start) = snap;
    tokio::task::spawn_blocking(move || -> Result<Option<CastStatus>, String> {
        let device = connect_device(&host, port)?;
        device
            .connection
            .connect(transport_id.clone())
            .map_err(|e| format!("{e}"))?;
        if let Some(msid) = msid {
            let status = device.media.get_status(&transport_id, Some(msid))
                .map_err(|error| format!("status: {error}"))?;
            if let Some(entry) = status.entries.first() {
                let raw_state = format!("{:?}", entry.player_state);
                let cast_pos = entry.current_time.map(|v| v as f64).unwrap_or(0.0);
                return Ok(Some(CastStatus {
                    position_sec: cast_pos + seek_start,
                    player_state: normalize_player_state(&raw_state),
                    connected: true,
                    transport_codec: None,
                }));
            }
            return Ok(None);
        }
        Ok(Some(CastStatus {
            position_sec: 0.0,
            player_state: "UNKNOWN".to_string(),
            connected: true,
            transport_codec: None,
        }))
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

#[derive(Debug, Clone, Serialize)]
pub struct CastStatus {
    pub position_sec: f64,
    pub player_state: String,
    pub connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transport_codec: Option<String>,
}

fn normalize_player_state(raw: &str) -> String {
    let up = raw.trim().to_uppercase();
    match up.as_str() {
        "PLAY" | "PLAYING" => "PLAYING",
        "PAUSE" | "PAUSED" | "PAUSED_PLAYBACK" | "PAUSED_RECORDING" => "PAUSED",
        "BUFFER" | "BUFFERING" | "TRANSITIONING" | "STARTUP" => "BUFFERING",
        "STOP" | "STOPPED" | "IDLE" | "NO_MEDIA_PRESENT" => "IDLE",
        _ => return up,
    }
    .to_string()
}

#[allow(dead_code)]
fn drain_briefly(device: &CastDevice<'_>, ms: u64) {
    let deadline = std::time::Instant::now() + Duration::from_millis(ms);
    while std::time::Instant::now() < deadline {
        match device.receive() {
            Ok(ChannelMessage::Heartbeat(_)) => {}
            Ok(ChannelMessage::Receiver(_)) => {}
            Ok(ChannelMessage::Connection(_)) => {}
            Ok(ChannelMessage::Media(_)) => {}
            Ok(_) => {}
            Err(_) => break,
        }
    }
}

#[cfg(test)]
mod cast_validation_tests {
    use super::{replace_active_session, required_control_url, ActiveSession, ACTIVE};
    use std::sync::{Arc, Mutex};

    #[test]
    fn failed_stop_restores_only_same_session_epoch() {
        let old = || Some(ActiveSession::Dlna { control_url: "old".into(), hls_session_id: None });
        let mut active = None;
        super::restore_failed_stop_if_current(&mut active, old(), 7, 7);
        assert!(matches!(&active, Some(ActiveSession::Dlna { control_url, .. }) if control_url == "old"));
        active = None;
        super::restore_failed_stop_if_current(&mut active, old(), 7, 8);
        assert!(active.is_none(), "do not revive a session after a newer LOAD/STOP");
        active = Some(ActiveSession::Dlna { control_url: "new".into(), hls_session_id: None });
        super::restore_failed_stop_if_current(&mut active, old(), 7, 8);
        assert!(matches!(&active, Some(ActiveSession::Dlna { control_url, .. }) if control_url == "new"));
    }

    #[test]
    fn audio_cast_preserves_mime_metadata_and_skips_video_remux() {
        for kind in ["chromecast", "dlna"] {
            for mime in ["audio/mpeg", "audio/flac", "audio/mp4", "audio/webm; codecs=opus"] {
                assert!(!super::needs_auto_remux(kind, "https://example.test/song", Some(mime)));
                assert_eq!(super::chromecast_content_type("http://192.0.2.1/s/id", Some(mime)), mime);
                assert!(matches!(super::cast_media_metadata(Some("Song".into()), None, Some(mime)), super::Metadata::MusicTrack(_)));
            }
        }
        assert!(super::needs_auto_remux("chromecast", "https://example.test/movie.mp4", Some("video/mp4")));
        assert!(!super::needs_auto_remux("dlna", "https://example.test/live.m3u8", None));
        assert_eq!(super::chromecast_content_type("http://192.0.2.1/s/id", Some("video/mkv")), "video/mp4");
        assert!(matches!(super::cast_media_metadata(None, None, Some("video/mp4")), super::Metadata::Movie(_)));
    }

    #[test]
    fn control_url_is_required_before_starting_dlna_or_roku() {
        assert_eq!(
            required_control_url("dlna", None),
            Err("DLNA device missing control_url".to_string())
        );
        assert_eq!(
            required_control_url("roku", None),
            Err("Roku device missing ecp_base".to_string())
        );
        assert_eq!(required_control_url("chromecast", None), Ok(None));
    }

    #[tokio::test]
    async fn replacing_an_active_cast_stops_its_hls_session() {
        ACTIVE.lock().expect("lock active session").take();
        let stopped = Arc::new(Mutex::new(Vec::new()));

        replace_active_session(
            ActiveSession::Dlna {
                control_url: "first".to_string(),
                hls_session_id: Some("first-hls".to_string()),
            },
            |_| async {},
        )
        .await
        .expect("activate first cast");

        let recorded = stopped.clone();
        replace_active_session(
            ActiveSession::Dlna {
                control_url: "second".to_string(),
                hls_session_id: Some("second-hls".to_string()),
            },
            move |id| async move {
                assert!(
                    ACTIVE.try_lock().is_ok(),
                    "ACTIVE must be unlocked before HLS cleanup"
                );
                recorded.lock().expect("lock stopped sessions").push(id);
            },
        )
        .await
        .expect("activate second cast");

        assert_eq!(
            stopped.lock().expect("lock stopped sessions").as_slice(),
            ["first-hls"]
        );
        ACTIVE.lock().expect("lock active session").take();
    }
}
