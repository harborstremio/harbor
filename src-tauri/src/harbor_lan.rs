use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::Serialize;
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

pub const HARBOR_SERVICE_TYPE: &str = "_harbor-app._tcp.local.";
const DEFAULT_DISCOVER_MS: u64 = 1800;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HarborIdentity {
    pub id: String,
    pub name: String,
    pub platform: String,
    pub version: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HarborInstance {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub platform: String,
    pub version: String,
    pub commandable: bool,
    pub theme: Option<String>,
    pub is_self: bool,
}

fn instance_id() -> &'static str {
    static ID: OnceLock<String> = OnceLock::new();
    ID.get_or_init(|| uuid::Uuid::new_v4().simple().to_string())
}

fn device_name() -> String {
    #[cfg(windows)]
    {
        if let Ok(name) = std::env::var("COMPUTERNAME") {
            let trimmed = name.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    #[cfg(not(windows))]
    {
        let mut buf = vec![0u8; 256];
        let rc = unsafe { libc::gethostname(buf.as_mut_ptr() as *mut libc::c_char, buf.len()) };
        if rc == 0 {
            if let Some(end) = buf.iter().position(|&b| b == 0) {
                buf.truncate(end);
            }
            if let Ok(text) = String::from_utf8(buf) {
                let trimmed = text.trim().trim_end_matches(".local");
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }
        }
    }
    std::env::var("HOSTNAME")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "Harbor".to_string())
}

fn platform() -> &'static str {
    std::env::consts::OS
}

fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn sanitize_host(raw: &str) -> String {
    let mut out: String = raw
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' {
                c
            } else {
                '-'
            }
        })
        .collect();
    while out.starts_with('-') {
        out.remove(0);
    }
    while out.ends_with('-') {
        out.pop();
    }
    if out.is_empty() {
        out.push_str("harbor");
    }
    out.truncate(48);
    out
}

pub fn identity() -> HarborIdentity {
    HarborIdentity {
        id: instance_id().to_string(),
        name: device_name(),
        platform: platform().to_string(),
        version: app_version(),
    }
}

fn registered_slot() -> &'static Mutex<Option<String>> {
    static S: OnceLock<Mutex<Option<String>>> = OnceLock::new();
    S.get_or_init(|| Mutex::new(None))
}

fn advert_daemon() -> Option<&'static ServiceDaemon> {
    static D: OnceLock<Option<ServiceDaemon>> = OnceLock::new();
    D.get_or_init(|| ServiceDaemon::new().ok()).as_ref()
}

fn pick_address(addrs: &std::collections::HashSet<IpAddr>) -> Option<IpAddr> {
    addrs
        .iter()
        .copied()
        .find(|a| a.is_ipv4())
        .or_else(|| addrs.iter().copied().next())
}

#[tauri::command]
pub fn harbor_lan_identity() -> HarborIdentity {
    identity()
}

#[tauri::command]
pub fn harbor_lan_advertise(
    port: Option<u16>,
    commandable: bool,
    theme: Option<String>,
) -> Result<String, String> {
    let daemon = advert_daemon().ok_or_else(|| "mdns daemon unavailable".to_string())?;
    let me = identity();
    let port = port.unwrap_or(crate::web_server::WEB_PORT);

    let mut props: HashMap<String, String> = HashMap::new();
    props.insert("id".into(), me.id.clone());
    props.insert("name".into(), me.name.clone());
    props.insert("ver".into(), me.version.clone());
    props.insert("plat".into(), me.platform.clone());
    props.insert(
        "cmd".into(),
        if commandable {
            "1".into()
        } else {
            "0".to_string()
        },
    );
    if let Some(active) = theme.as_ref().filter(|t| !t.is_empty()) {
        props.insert("theme".into(), active.to_string());
    }

    let host = format!("{}.local.", sanitize_host(&me.name));
    let label = format!("{} {}", sanitize_host(&me.name), &me.id[..6]);
    let info = ServiceInfo::new(HARBOR_SERVICE_TYPE, &label, &host, (), port, props)
        .map_err(|e| e.to_string())?
        .enable_addr_auto();
    let fullname = info.get_fullname().to_string();

    let previous = registered_slot()
        .lock()
        .ok()
        .and_then(|mut slot| slot.replace(fullname.clone()));
    if let Some(old) = previous {
        if old != fullname {
            let _ = daemon.unregister(&old);
        }
    }
    daemon.register(info).map_err(|e| e.to_string())?;
    Ok(fullname)
}

#[tauri::command]
pub fn harbor_lan_stop_advertise() {
    let Some(daemon) = advert_daemon() else {
        return;
    };
    let Some(fullname) = registered_slot()
        .lock()
        .ok()
        .and_then(|mut slot| slot.take())
    else {
        return;
    };
    let _ = daemon.unregister(&fullname);
}

#[tauri::command]
pub async fn harbor_lan_discover(timeout_ms: Option<u64>) -> Vec<HarborInstance> {
    let window = timeout_ms.unwrap_or(DEFAULT_DISCOVER_MS).clamp(400, 8000);
    let me = instance_id().to_string();
    tokio::task::spawn_blocking(move || -> Vec<HarborInstance> {
        let Ok(daemon) = ServiceDaemon::new() else {
            return Vec::new();
        };
        let Ok(receiver) = daemon.browse(HARBOR_SERVICE_TYPE) else {
            return Vec::new();
        };
        let deadline = std::time::Instant::now() + Duration::from_millis(window);
        let mut found: HashMap<String, HarborInstance> = HashMap::new();
        while std::time::Instant::now() < deadline {
            match receiver.recv_timeout(Duration::from_millis(120)) {
                Ok(ServiceEvent::ServiceResolved(info)) => {
                    let Some(addr) = pick_address(info.get_addresses()) else {
                        continue;
                    };
                    let props: HashMap<String, String> = info
                        .get_properties()
                        .iter()
                        .map(|p| (p.key().to_ascii_lowercase(), p.val_str().to_string()))
                        .collect();
                    let host = addr.to_string();
                    let port = info.get_port();
                    let id = props
                        .get("id")
                        .cloned()
                        .unwrap_or_else(|| format!("{}:{}", host, port));
                    let name = props
                        .get("name")
                        .cloned()
                        .filter(|n| !n.is_empty())
                        .unwrap_or_else(|| host.clone());
                    found.insert(
                        id.clone(),
                        HarborInstance {
                            is_self: id == me,
                            id,
                            name,
                            host,
                            port,
                            platform: props.get("plat").cloned().unwrap_or_default(),
                            version: props.get("ver").cloned().unwrap_or_default(),
                            commandable: props.get("cmd").map(|v| v == "1").unwrap_or(false),
                            theme: props.get("theme").cloned(),
                        },
                    );
                }
                Ok(_) => {}
                Err(_) => {}
            }
        }
        let _ = daemon.shutdown();
        let mut out: Vec<HarborInstance> = found.into_values().collect();
        out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        out
    })
    .await
    .unwrap_or_default()
}
