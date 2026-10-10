use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Serialize;

const SSDP_TARGET: &str = "239.255.255.250:1900";
const SSDP_STS: &[&str] = &[
    "urn:schemas-upnp-org:device:MediaRenderer:1",
    "urn:schemas-upnp-org:device:MediaRenderer:2",
    "urn:schemas-upnp-org:device:MediaRenderer:3",
    "urn:schemas-upnp-org:service:AVTransport:1",
    "urn:dial-multiscreen-org:service:dial:1",
    "ssdp:all",
];

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum DlnaVendor {
    Samsung,
    LgWebos,
    SonyBravia,
    Panasonic,
    HisenseVidaa,
    Other,
}

fn classify_vendor(name: &str, model: &str, manufacturer: &str) -> DlnaVendor {
    let n = name.to_lowercase();
    let mo = model.to_lowercase();
    let mf = manufacturer.to_lowercase();
    if mf.contains("samsung") || n.contains("samsung") || mo.contains("samsung") {
        return DlnaVendor::Samsung;
    }
    if mf.contains("lg")
        || mo.contains("webos")
        || n.contains("[lg]")
        || n.starts_with("lg ")
        || mo.starts_with("lg ")
    {
        return DlnaVendor::LgWebos;
    }
    if mf.contains("sony")
        || n.contains("bravia")
        || mo.contains("bravia")
        || mo.starts_with("kdl-")
        || mo.starts_with("kd-")
        || mo.starts_with("xbr-")
    {
        return DlnaVendor::SonyBravia;
    }
    if mf.contains("panasonic") || n.contains("viera") || mo.contains("viera") {
        return DlnaVendor::Panasonic;
    }
    if mf.contains("hisense")
        || mo.contains("vidaa")
        || n.contains("vidaa")
        || n.contains("hisense")
    {
        return DlnaVendor::HisenseVidaa;
    }
    DlnaVendor::Other
}

fn vendor_cache() -> &'static Mutex<HashMap<String, DlnaVendor>> {
    static CACHE: OnceLock<Mutex<HashMap<String, DlnaVendor>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn connection_managers() -> &'static Mutex<HashMap<String, String>> {
    static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn remember_vendor(control_url: &str, vendor: DlnaVendor) {
    if let Ok(mut map) = vendor_cache().lock() {
        map.insert(control_url.to_string(), vendor);
    }
}

fn recall_vendor(control_url: &str) -> DlnaVendor {
    vendor_cache()
        .lock()
        .ok()
        .and_then(|m| m.get(control_url).copied())
        .unwrap_or(DlnaVendor::Other)
}

fn build_m_search(st: &str) -> Vec<u8> {
    format!(
        "M-SEARCH * HTTP/1.1\r\n\
HOST: 239.255.255.250:1900\r\n\
MAN: \"ssdp:discover\"\r\n\
MX: 1\r\n\
ST: {st}\r\n\
USER-AGENT: Harbor/1.0 UPnP/1.0\r\n\r\n"
    )
    .into_bytes()
}

#[derive(Debug, Clone, Serialize)]
pub struct DlnaDevice {
    pub id: String,
    pub name: String,
    pub model: Option<String>,
    pub manufacturer: Option<String>,
    pub vendor: DlnaVendor,
    pub host: String,
    pub control_url: String,
}

pub async fn discover(timeout_ms: u64) -> Vec<DlnaDevice> {
    let locations = tokio::task::spawn_blocking(move || ssdp_search(timeout_ms))
        .await
        .unwrap_or_default();
    let mut by_device: HashMap<String, Vec<String>> = HashMap::new();
    for (id, location) in locations {
        by_device.entry(id).or_default().push(location);
    }
    let mut handles = Vec::new();
    for (id, mut candidate_locations) in by_device {
        if let Some(host) = candidate_locations
            .first()
            .and_then(|loc| host_from_url(loc))
            .map(|h| h.split(':').next().unwrap_or("").to_string())
        {
            for fallback in samsung_dlna_fallback_urls(&host) {
                if !candidate_locations.contains(&fallback) {
                    candidate_locations.push(fallback);
                }
            }
        }
        handles.push(tokio::spawn(resolve_device(id, candidate_locations)));
    }
    let mut out = Vec::new();
    for h in handles {
        if let Ok(Some(device)) = h.await {
            eprintln!(
                "[harbor::dlna] resolved {} ({}) → {}",
                device.name, device.id, device.control_url
            );
            out.push(device);
        }
    }
    out
}

async fn resolve_device(id: String, candidate_locations: Vec<String>) -> Option<DlnaDevice> {
    let mut attempts = Vec::new();
    for loc in candidate_locations {
        attempts.push(tokio::spawn(async move {
            let result = fetch_device(&loc).await;
            (loc, result)
        }));
    }
    let mut results = Vec::new();
    for h in attempts {
        if let Ok(pair) = h.await {
            results.push(pair);
        }
    }
    for (location, result) in &results {
        match result {
            Ok((name, model, manufacturer, control)) => {
                let host = host_from_url(location).unwrap_or_else(|| location.clone());
                let vendor = classify_vendor(
                    name,
                    model.as_deref().unwrap_or(""),
                    manufacturer.as_deref().unwrap_or(""),
                );
                remember_vendor(control, vendor);
                eprintln!(
                    "[harbor::dlna] classified {} as {:?} (manufacturer={:?} model={:?})",
                    name, vendor, manufacturer, model
                );
                return Some(DlnaDevice {
                    id,
                    name: name.clone(),
                    model: model.clone(),
                    manufacturer: manufacturer.clone(),
                    vendor,
                    host,
                    control_url: control.clone(),
                });
            }
            Err(e) => {
                eprintln!("[harbor::dlna] desc fail {location}: {e}");
            }
        }
    }
    None
}

fn samsung_dlna_fallback_urls(host_ip: &str) -> Vec<String> {
    if host_ip.is_empty() {
        return Vec::new();
    }
    vec![
        format!("http://{}:7676/smp_2_", host_ip),
        format!("http://{}:7676/smp_4_", host_ip),
        format!("http://{}:7676/smp_6_", host_ip),
        format!("http://{}:7676/smp_8_", host_ip),
        format!("http://{}:7676/smp_10_", host_ip),
        format!("http://{}:7676/smp_12_", host_ip),
        format!("http://{}:7676/smp_14_", host_ip),
        format!("http://{}:7676/smp_16_", host_ip),
        format!("http://{}:7676/smp_18_", host_ip),
        format!("http://{}:7676/smp_20_", host_ip),
        format!("http://{}:9197/dmr", host_ip),
        format!("http://{}:9999/dmr", host_ip),
        format!("http://{}:9080/dmr", host_ip),
        format!("http://{}:7677/dmr", host_ip),
    ]
}

fn bind_reuse_udp(addr: SocketAddr) -> std::io::Result<UdpSocket> {
    let sock = socket2::Socket::new(
        socket2::Domain::IPV4,
        socket2::Type::DGRAM,
        Some(socket2::Protocol::UDP),
    )?;
    sock.set_reuse_address(true)?;
    sock.bind(&addr.into())?;
    Ok(sock.into())
}

fn ssdp_search(timeout_ms: u64) -> Vec<(String, String)> {
    let mut found: HashMap<String, Vec<String>> = HashMap::new();
    let mut sockets: Vec<UdpSocket> = Vec::new();
    for iface in local_ipv4_interfaces() {
        match UdpSocket::bind(SocketAddr::new(IpAddr::V4(iface), 0)) {
            Ok(s) => {
                let _ = s.set_read_timeout(Some(Duration::from_millis(200)));
                let _ = s.set_multicast_ttl_v4(4);
                sockets.push(s);
            }
            Err(e) => eprintln!("[harbor::dlna] bind {iface} failed: {e}"),
        }
    }
    if sockets.is_empty() {
        if let Ok(s) = UdpSocket::bind("0.0.0.0:0") {
            let _ = s.set_read_timeout(Some(Duration::from_millis(200)));
            let _ = s.set_multicast_ttl_v4(4);
            sockets.push(s);
        }
    }
    if sockets.is_empty() {
        eprintln!("[harbor::dlna] no usable sockets");
        return Vec::new();
    }

    // Also join the SSDP multicast group on a passive listener socket so we
    // catch NOTIFY broadcasts that devices emit periodically. Samsung TVs in
    // particular sometimes ignore M-SEARCH but reliably NOTIFY every ~30s.
    let mut notify_socket: Option<UdpSocket> = None;
    match bind_reuse_udp(SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), 1900)) {
        Ok(s) => {
            let _ = s.set_read_timeout(Some(Duration::from_millis(200)));
            for iface in local_ipv4_interfaces() {
                let _ = s.join_multicast_v4(&Ipv4Addr::new(239, 255, 255, 250), &iface);
            }
            notify_socket = Some(s);
        }
        Err(e) => {
            eprintln!("[harbor::dlna] port 1900 bind failed ({e}); passive NOTIFY listener off, active M-SEARCH still runs");
        }
    }

    let bursts = 4;
    for burst in 0..bursts {
        for st in SSDP_STS {
            let msg = build_m_search(st);
            for s in &sockets {
                let _ = s.send_to(&msg, SSDP_TARGET);
            }
        }
        if burst + 1 < bursts {
            std::thread::sleep(Duration::from_millis(380));
        }
    }

    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let mut buf = [0u8; 4096];
    while Instant::now() < deadline {
        for s in &sockets {
            match s.recv_from(&mut buf) {
                Ok((n, _)) => handle_ssdp_packet(&buf[..n], &mut found),
                Err(_) => continue,
            }
        }
        if let Some(s) = &notify_socket {
            match s.recv_from(&mut buf) {
                Ok((n, _)) => handle_ssdp_packet(&buf[..n], &mut found),
                Err(_) => continue,
            }
        }
    }
    let mut out: Vec<(String, String)> = Vec::new();
    for (id, locs) in found {
        for loc in locs {
            out.push((id.clone(), loc));
        }
    }
    out
}

fn handle_ssdp_packet(bytes: &[u8], found: &mut HashMap<String, Vec<String>>) {
    let resp = String::from_utf8_lossy(bytes);
    let location = extract_header(&resp, "location");
    let usn = extract_header(&resp, "usn");
    // M-SEARCH replies use "ST:"; NOTIFY broadcasts use "NT:". Accept either.
    let st = extract_header(&resp, "st")
        .or_else(|| extract_header(&resp, "nt"))
        .unwrap_or_default()
        .to_lowercase();
    if !is_renderer_st(&st) {
        return;
    }
    if let (Some(loc), Some(usn_val)) = (location, usn) {
        let id = parse_uuid_from_usn(&usn_val).unwrap_or_else(|| loc.clone());
        let entry = found.entry(id).or_default();
        if !entry.contains(&loc) {
            entry.push(loc);
        }
    }
}

fn is_renderer_st(st: &str) -> bool {
    if st.is_empty() {
        return false;
    }
    st.contains("mediarenderer")
        || st.contains("urn:dial-multiscreen-org:service:dial")
        || st.contains("avtransport")
        || st.contains("renderingcontrol")
}

#[tauri::command]
pub fn lan_ip() -> Option<String> {
    local_ipv4_interfaces()
        .into_iter()
        .next()
        .map(|ip| ip.to_string())
}

fn local_ipv4_interfaces() -> Vec<Ipv4Addr> {
    let mut out: Vec<Ipv4Addr> = Vec::new();
    let probe_targets = ["1.1.1.1:80", "8.8.8.8:80", "192.168.1.1:80"];
    for target in probe_targets {
        if let Ok(s) = UdpSocket::bind("0.0.0.0:0") {
            if s.connect(target).is_ok() {
                if let Ok(addr) = s.local_addr() {
                    if let IpAddr::V4(v4) = addr.ip() {
                        if !v4.is_loopback() && !v4.is_unspecified() && !out.contains(&v4) {
                            out.push(v4);
                        }
                    }
                }
            }
        }
    }
    out
}

fn extract_header(resp: &str, header_lower: &str) -> Option<String> {
    for line in resp.lines() {
        let mut parts = line.splitn(2, ':');
        let key = parts.next()?.trim().to_lowercase();
        if key == header_lower {
            return Some(parts.next()?.trim().to_string());
        }
    }
    None
}

fn parse_uuid_from_usn(usn: &str) -> Option<String> {
    let lower = usn.to_lowercase();
    let prefix = "uuid:";
    let start = lower.find(prefix)? + prefix.len();
    let tail = &usn[start..];
    let end = tail.find("::").unwrap_or(tail.len());
    Some(tail[..end].to_string())
}

async fn fetch_device(
    location: &str,
) -> Result<(String, Option<String>, Option<String>, String), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(1500))
        .connect_timeout(Duration::from_millis(800))
        .build()
        .map_err(|e| format!("client: {e}"))?;
    let resp = client
        .get(location)
        .send()
        .await
        .map_err(|e| format!("desc get: {e}"))?;
    let xml = resp.text().await.map_err(|e| format!("desc body: {e}"))?;
    let name = extract_xml_tag(&xml, "friendlyName")
        .or_else(|| extract_xml_tag(&xml, "roomName"))
        .unwrap_or_else(|| "Media Renderer".into());
    let model = extract_xml_tag(&xml, "modelName");
    let manufacturer = extract_xml_tag(&xml, "manufacturer");
    let control =
        extract_avtransport_control(&xml).ok_or_else(|| "no AVTransport service".to_string())?;
    let control = resolve_url(location, &control);
    if let Some(manager) = extract_renderer_connection_manager(&xml) {
        if let Ok(mut cache) = connection_managers().lock() {
            cache.insert(control.clone(), resolve_url(location, &manager));
        }
    }
    Ok((name, model, manufacturer, control))
}

fn extract_xml_tag(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let start = xml.find(&open)? + open.len();
    let len = xml[start..].find(&close)?;
    Some(xml[start..start + len].trim().to_string())
}

fn extract_avtransport_control(xml: &str) -> Option<String> {
    extract_service_control(xml, "AVTransport")
}

fn extract_renderer_connection_manager(xml: &str) -> Option<String> {
    // Some speakers expose both MediaServer and MediaRenderer. Their managers
    // advertise different capabilities; use the service list containing AVTransport.
    xml.split("<serviceList>").skip(1).filter_map(|tail| tail.split("</serviceList>").next())
        .find(|list| extract_avtransport_control(list).is_some())
        .and_then(|list| extract_service_control(list, "ConnectionManager"))
}

fn extract_service_control(xml: &str, service: &str) -> Option<String> {
    let mut idx = 0;
    while let Some(start) = find_from(xml, "<service>", idx) {
        let end = find_from(xml, "</service>", start + 9)?;
        let block = &xml[start..end];
        if block.contains(&format!(":{service}:")) {
            if let Some(url) = extract_xml_tag(block, "controlURL") {
                return Some(url);
            }
        }
        idx = end + 10;
    }
    None
}

fn find_from(haystack: &str, needle: &str, from: usize) -> Option<usize> {
    haystack.get(from..)?.find(needle).map(|i| from + i)
}

fn resolve_url(base: &str, rel: &str) -> String {
    if rel.starts_with("http://") || rel.starts_with("https://") {
        return rel.to_string();
    }
    let scheme_end = base.find("://").map(|i| i + 3).unwrap_or(0);
    let path_start = base[scheme_end..]
        .find('/')
        .map(|p| scheme_end + p)
        .unwrap_or(base.len());
    let host_part = &base[..path_start];
    if rel.starts_with('/') {
        format!("{}{}", host_part, rel)
    } else {
        format!("{}/{}", host_part, rel)
    }
}

fn host_from_url(url: &str) -> Option<String> {
    let scheme_end = url.find("://")? + 3;
    let rest = &url[scheme_end..];
    let end = rest.find('/').unwrap_or(rest.len());
    Some(rest[..end].to_string())
}

pub async fn load(
    control_url: String,
    url: String,
    title: Option<String>,
    start_sec: Option<f64>,
    content_type: Option<String>,
    is_live: bool,
) -> Result<(), String> {
    let display_title = title.unwrap_or_else(|| "JL Media Vision".into());
    let vendor = recall_vendor(&control_url);
    let mime = content_type.unwrap_or_else(|| pick_vendor_mime(vendor, is_live));
    let metadata = build_didl(&url, &display_title, &mime, is_live, vendor);
    if matches!(vendor, DlnaVendor::SonyBravia) {
        let pre_stop = soap_envelope("Stop", "<InstanceID>0</InstanceID>".into());
        let _ = soap_action(&control_url, "Stop", &pre_stop).await;
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    let set_body = soap_envelope(
        "SetAVTransportURI",
        format!(
            "<InstanceID>0</InstanceID><CurrentURI>{}</CurrentURI><CurrentURIMetaData>{}</CurrentURIMetaData>",
            xml_escape(&url),
            xml_escape(&metadata),
        ),
    );
    soap_action(&control_url, "SetAVTransportURI", &set_body).await?;
    if matches!(vendor, DlnaVendor::SonyBravia | DlnaVendor::Panasonic) {
        tokio::time::sleep(Duration::from_millis(400)).await;
    }
    let play_body = soap_envelope("Play", "<InstanceID>0</InstanceID><Speed>1</Speed>".into());
    soap_action(&control_url, "Play", &play_body).await?;
    if let Some(s) = start_sec {
        if s > 1.0 {
            tokio::time::sleep(Duration::from_millis(1200)).await;
            let hms = format_hms(s);
            let seek_body = soap_envelope(
                "Seek",
                format!(
                    "<InstanceID>0</InstanceID><Unit>REL_TIME</Unit><Target>{}</Target>",
                    hms,
                ),
            );
            match soap_action(&control_url, "Seek", &seek_body).await {
                Ok(()) => eprintln!("[harbor::dlna] seek to {} OK", hms),
                Err(e) => {
                    eprintln!("[harbor::dlna] seek to {} failed: {}", hms, e);
                    tokio::time::sleep(Duration::from_millis(700)).await;
                    let _ = soap_action(&control_url, "Seek", &seek_body).await;
                }
            }
        }
    }
    Ok(())
}

pub async fn play(control_url: String) -> Result<(), String> {
    let body = soap_envelope("Play", "<InstanceID>0</InstanceID><Speed>1</Speed>".into());
    soap_action(&control_url, "Play", &body).await
}

pub async fn pause(control_url: String) -> Result<(), String> {
    let body = soap_envelope("Pause", "<InstanceID>0</InstanceID>".into());
    soap_action(&control_url, "Pause", &body).await
}

pub async fn stop(control_url: String) -> Result<(), String> {
    let body = soap_envelope("Stop", "<InstanceID>0</InstanceID>".into());
    soap_action(&control_url, "Stop", &body).await
}

pub async fn seek(control_url: String, sec: f64) -> Result<(), String> {
    let body = soap_envelope(
        "Seek",
        format!(
            "<InstanceID>0</InstanceID><Unit>REL_TIME</Unit><Target>{}</Target>",
            format_hms(sec),
        ),
    );
    soap_action(&control_url, "Seek", &body).await
}

#[derive(Debug, Clone, Serialize)]
pub struct DlnaStatus {
    pub position_sec: f64,
    pub player_state: String,
}

pub async fn status(control_url: String) -> Result<DlnaStatus, String> {
    let pos_body = soap_envelope("GetPositionInfo", "<InstanceID>0</InstanceID>".into());
    let pos_resp = soap_post(&control_url, "GetPositionInfo", &pos_body)
        .await
        .unwrap_or_default();
    let pos = parse_hms(&extract_xml_tag(&pos_resp, "RelTime").unwrap_or_else(|| "0:00:00".into()));
    let state_body = soap_envelope("GetTransportInfo", "<InstanceID>0</InstanceID>".into());
    let state_resp = soap_post(&control_url, "GetTransportInfo", &state_body)
        .await?;
    let state =
        extract_xml_tag(&state_resp, "CurrentTransportState").unwrap_or_else(|| "UNKNOWN".into());
    Ok(DlnaStatus {
        position_sec: pos,
        player_state: state,
    })
}

pub(crate) async fn current_uri(control_url: &str) -> Result<String, String> {
    let body = soap_envelope("GetMediaInfo", "<InstanceID>0</InstanceID>".into());
    let response = soap_post(control_url, "GetMediaInfo", &body).await?;
    Ok(extract_xml_tag(&response, "CurrentURI").unwrap_or_default()
        .replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'"))
}

pub(crate) fn uri_has_audio_session(uri: &str, id: &str) -> bool {
    reqwest::Url::parse(uri).ok().is_some_and(|url| url.path() == format!("/cast/audio/{id}"))
}

pub(crate) async fn supports_direct_audio(control_url: &str, mime: Option<&str>) -> bool {
    let Some(mime) = mime else { return false; };
    let manager = connection_managers().lock().ok().and_then(|cache| cache.get(control_url).cloned());
    let Some(manager) = manager else { return false; };
    let body = soap_envelope("GetProtocolInfo", String::new()).replace("service:AVTransport:1", "service:ConnectionManager:1");
    let response = soap_post_service(&manager, "ConnectionManager", "GetProtocolInfo", &body).await;
    let sink = response.ok().and_then(|xml| extract_xml_tag(&xml, "Sink")).unwrap_or_default();
    direct_audio_supported(&sink, mime)
}

fn direct_audio_supported(sink: &str, mime: &str) -> bool {
    let mime = mime.split(';').next().unwrap_or("").trim().to_ascii_lowercase();
    // Ogg alone does not distinguish Vorbis from Opus, and Sonos rejects WebM.
    // Keep compatible native/lossless sources intact instead of silently re-encoding them.
    matches!(mime.as_str(), "audio/flac" | "audio/wav" | "audio/x-wav" | "audio/aiff" | "audio/x-aiff" | "audio/mpeg" | "audio/mp3" | "audio/mp4" | "audio/aac" | "audio/x-m4a")
        && sink.split(',').any(|entry| entry.split(':').nth(2).is_some_and(|value| value.eq_ignore_ascii_case(&mime) || value == "*"))
}

pub(crate) async fn wait_audio_state(control_url: &str, session_id: &str, paused: bool, require_progress: bool) -> Result<DlnaStatus, String> {
    tokio::time::timeout(Duration::from_secs(18), async {
        let mut first_position = None;
        loop {
            if !uri_has_audio_session(&current_uri(control_url).await?, session_id) { return Err("The speaker source changed during handoff".into()); }
            let state = status(control_url.to_string()).await?;
            let matches = if paused { state.player_state == "PAUSED_PLAYBACK" || state.player_state == "PAUSED" } else { state.player_state == "PLAYING" };
            if matches {
                let initial = *first_position.get_or_insert(state.position_sec);
                if !require_progress || state.position_sec >= initial + 1.0 { return Ok(state); }
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
    }).await.map_err(|_| "The speaker did not start decoding this audio".to_string())?
}

pub(crate) async fn load_audio_route(control_url: &str, url: String, session_id: &str, title: Option<String>, mime: String, paused: bool) -> Result<(), String> {
    load(control_url.to_string(), url, title, None, Some(mime), true).await?;
    wait_audio_state(control_url, session_id, false, true).await?;
    if paused {
        pause(control_url.to_string()).await?;
        wait_audio_state(control_url, session_id, true, false).await?;
    }
    Ok(())
}

/// Never stop a source the user selected independently while Harbor was waiting.
pub(crate) async fn stop_audio_if_owned(control_url: &str, session_id: &str) -> Result<(), String> {
    let uncertain = || "CAST_AUDIO_STOP_UNCONFIRMED: Could not confirm the speaker stopped; keep local audio paused".to_string();
    if !uri_has_audio_session(&current_uri(control_url).await.map_err(|_| uncertain())?, session_id) { return Ok(()); }
    stop(control_url.to_string()).await.map_err(|_| uncertain())?;
    tokio::time::timeout(Duration::from_secs(6), async {
        loop {
            if !uri_has_audio_session(&current_uri(control_url).await.map_err(|_| uncertain())?, session_id) { return Ok(()); }
            let state = status(control_url.to_string()).await.map_err(|_| uncertain())?;
            if matches!(state.player_state.as_str(), "STOPPED" | "NO_MEDIA_PRESENT") { return Ok(()); }
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    }).await.map_err(|_| uncertain())?
}

fn soap_envelope(action: &str, body: String) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"utf-8\"?>\
<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">\
<s:Body><u:{action} xmlns:u=\"urn:schemas-upnp-org:service:AVTransport:1\">{body}</u:{action}></s:Body>\
</s:Envelope>"
    )
}

async fn soap_action(control_url: &str, action: &str, body: &str) -> Result<(), String> {
    soap_post(control_url, action, body).await.map(|_| ())
}

async fn soap_post(control_url: &str, action: &str, body: &str) -> Result<String, String> {
    soap_post_service(control_url, "AVTransport", action, body).await
}

async fn soap_post_service(control_url: &str, service: &str, action: &str, body: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .build()
        .map_err(|e| format!("client: {e}"))?;
    let action_header = format!("\"urn:schemas-upnp-org:service:{service}:1#{action}\"");
    let resp = client
        .post(control_url)
        .header("Content-Type", "text/xml; charset=\"utf-8\"")
        .header("SOAPAction", action_header)
        .body(body.to_string())
        .send()
        .await
        .map_err(|_| format!("Speaker {action} request failed"))?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        let code = extract_xml_tag(&text, "errorCode").unwrap_or_default();
        return Err(format!("Speaker {action} failed (HTTP {status}, UPnP {code})"));
    }
    Ok(text)
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn pick_vendor_mime(vendor: DlnaVendor, is_live: bool) -> String {
    match (vendor, is_live) {
        (DlnaVendor::SonyBravia, true)
        | (DlnaVendor::Panasonic, true)
        | (DlnaVendor::LgWebos, true)
        | (DlnaVendor::HisenseVidaa, true) => "video/mpeg".into(),
        (_, true) => "video/mp2t".into(),
        (_, false) => "video/mp4".into(),
    }
}

fn build_didl(url: &str, title: &str, mime: &str, is_live: bool, vendor: DlnaVendor) -> String {
    let audio = mime.trim().to_ascii_lowercase().starts_with("audio/");
    let class = if audio {
        "object.item.audioItem.musicTrack"
    } else if is_live {
        "object.item.videoItem.videoBroadcast"
    } else {
        "object.item.videoItem"
    };
    let pn = if audio {
        ""
    } else {
        match (vendor, is_live) {
            (DlnaVendor::SonyBravia, true) => "DLNA.ORG_PN=AVC_TS_HD_60_AC3_ISO;",
            (DlnaVendor::SonyBravia, false) => "DLNA.ORG_PN=AVC_MP4_MP_HD_AC3;",
            (DlnaVendor::Panasonic, true) => "DLNA.ORG_PN=MPEG_TS_SD_NA;",
            (_, true) => "DLNA.ORG_PN=MPEG_TS;",
            _ => "",
        }
    };
    let op = if is_live { "00" } else { "01" };
    let extra = format!(
        ":{pn}DLNA.ORG_OP={op};DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000"
    );
    let extra_ns = match vendor {
        DlnaVendor::SonyBravia => " xmlns:av=\"urn:schemas-sony-com:av\"",
        DlnaVendor::Panasonic => " xmlns:pv=\"http://www.pv.com/pvns/\"",
        _ => "",
    };
    format!(
        "<DIDL-Lite xmlns=\"urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:upnp=\"urn:schemas-upnp-org:metadata-1-0/upnp/\" xmlns:sec=\"http://www.sec.co.kr/\"{}>\
<item id=\"0\" parentID=\"-1\" restricted=\"1\">\
<dc:title>{}</dc:title>\
<upnp:class>{}</upnp:class>\
<res protocolInfo=\"http-get:*:{}{}\">{}</res>\
</item></DIDL-Lite>",
        extra_ns,
        xml_escape(title),
        class,
        xml_escape(mime),
        extra,
        xml_escape(url),
    )
}

fn format_hms(sec: f64) -> String {
    let total = sec.max(0.0) as u64;
    let h = total / 3600;
    let m = (total % 3600) / 60;
    let s = total % 60;
    format!("{:02}:{:02}:{:02}", h, m, s)
}

fn parse_hms(s: &str) -> f64 {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() == 3 {
        let h: f64 = parts[0].parse().unwrap_or(0.0);
        let m: f64 = parts[1].parse().unwrap_or(0.0);
        let sec: f64 = parts[2].parse().unwrap_or(0.0);
        return h * 3600.0 + m * 60.0 + sec;
    }
    0.0
}

#[cfg(test)]
mod audio_bridge_tests {
    use super::*;
    use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};

    #[test]
    fn audio_ownership_matches_exact_route_and_service_selection_is_specific() {
        assert!(uri_has_audio_session("http://192.0.2.10:9000/cast/audio/audio-owned", "audio-owned"));
        assert!(!uri_has_audio_session("http://192.0.2.10:9000/cast/audio/audio-owned-new", "audio-owned"));
        assert!(!uri_has_audio_session("x-sonos-vli:RINCON_example:2", "audio-owned"));
        let xml = "<service><serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType><controlURL>/transport</controlURL></service><service><serviceType>urn:schemas-upnp-org:service:ConnectionManager:1</serviceType><controlURL>/manager</controlURL></service>";
        assert_eq!(extract_service_control(xml, "ConnectionManager").as_deref(), Some("/manager"));
        assert_eq!(extract_avtransport_control(xml).as_deref(), Some("/transport"));
        let separate_devices = format!("<serviceList><service><serviceType>urn:schemas-upnp-org:service:ConnectionManager:1</serviceType><controlURL>/server-manager</controlURL></service></serviceList><serviceList>{xml}</serviceList>");
        assert_eq!(extract_renderer_connection_manager(&separate_devices).as_deref(), Some("/manager"));
        let formats = "http-get:*:audio/flac:*,http-get:*:audio/mpeg:*,http-get:*:audio/ogg:*";
        assert!(direct_audio_supported(formats, "audio/flac"));
        assert!(direct_audio_supported(formats, "audio/mpeg; charset=binary"));
        assert!(!direct_audio_supported(formats, "audio/ogg"));
        assert!(!direct_audio_supported(formats, "audio/webm"));
        assert!(!direct_audio_supported("", "audio/flac"));
    }

    #[tokio::test]
    async fn audio_readiness_requires_clock_progress_and_cleanup_preserves_changed_source() {
        let samples = Arc::new(AtomicUsize::new(0));
        let stops = Arc::new(AtomicUsize::new(0));
        let changed = Arc::new(AtomicUsize::new(0));
        let (a,b,c) = (samples.clone(), stops.clone(), changed.clone());
        let router = axum::Router::new().route("/control", axum::routing::post(move |body: String| {
            let (samples,stops,changed) = (a.clone(),b.clone(),c.clone());
            async move {
                if body.contains("u:GetMediaInfo") {
                    let uri = if changed.load(Ordering::Relaxed) == 0 { "http://127.0.0.1:9/cast/audio/audio-test" } else { "x-sonos-vli:external" };
                    format!("<CurrentURI>{uri}</CurrentURI>")
                } else if body.contains("u:GetPositionInfo") {
                    let value = samples.fetch_add(1, Ordering::Relaxed);
                    format!("<RelTime>0:00:{value:02}</RelTime>")
                } else if body.contains("u:Stop") {
                    stops.fetch_add(1, Ordering::Relaxed); String::new()
                } else { "<CurrentTransportState>PLAYING</CurrentTransportState>".into() }
            }
        }));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/control", listener.local_addr().unwrap());
        let server = tokio::spawn(async move { axum::serve(listener, router).await.unwrap(); });
        let ready = wait_audio_state(&url, "audio-test", false, true).await.unwrap();
        assert!(ready.position_sec >= 1.0);
        assert!(samples.load(Ordering::Relaxed) >= 2);
        changed.store(1, Ordering::Relaxed);
        stop_audio_if_owned(&url, "audio-test").await.unwrap();
        assert_eq!(stops.load(Ordering::Relaxed), 0);
        server.abort();
    }
}

#[cfg(test)]
mod music_metadata_tests {
    use super::{build_didl, DlnaVendor};

    #[test]
    fn audio_didl_preserves_mime_and_avoids_video_profiles() {
        let xml = build_didl("http://192.0.2.1/song?x=1&y=2", "Song & artist", "audio/flac", false, DlnaVendor::SonyBravia);
        assert!(xml.contains("object.item.audioItem.musicTrack"));
        assert!(xml.contains("http-get:*:audio/flac:"));
        assert!(!xml.contains("DLNA.ORG_PN=AVC"));
        assert!(xml.contains("Song &amp; artist"));
        assert!(xml.contains("x=1&amp;y=2"));
        let video = build_didl("http://192.0.2.1/movie.mp4", "Movie", "video/mp4", false, DlnaVendor::SonyBravia);
        assert!(video.contains("object.item.videoItem"));
        assert!(video.contains("DLNA.ORG_PN=AVC_MP4_MP_HD_AC3;"));
    }
}
