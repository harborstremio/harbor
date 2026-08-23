#![allow(dead_code)]

use std::collections::HashMap;
use std::net::Ipv4Addr;
use url::{Host, Url};

const HOP_BY_HOP: &[&str] = &[
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
];

fn is_abs_path(url: &str) -> bool {
    let b = url.as_bytes();
    (b.len() > 2 && b[1] == b':' && (b[2] == b'/' || b[2] == b'\\')) || url.starts_with('/')
}

fn check_v4(ip: Ipv4Addr, is_stream: bool) -> Result<(), String> {
    if ip.is_loopback() {
        return if is_stream { Ok(()) } else { Err("loopback-blocked".into()) };
    }
    let o = ip.octets();
    let shared = o[0] == 100 && (o[1] & 0xc0) == 0x40;
    if ip.is_private() || ip.is_link_local() || ip.is_unspecified() || ip.is_broadcast() || shared {
        return Err("internal-ip-blocked".into());
    }
    Ok(())
}

pub fn validate_media_url(url: &str, allow_local: bool) -> Result<(), String> {
    let trimmed = url.trim();
    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("file://") || is_abs_path(trimmed) {
        return if allow_local {
            Ok(())
        } else {
            Err("local-source-not-allowed".into())
        };
    }
    let parsed = Url::parse(trimmed).map_err(|_| "invalid-url")?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("scheme-not-allowed".into());
    }
    let is_stream = parsed.path().starts_with("/stream/");
    match parsed.host().ok_or("no-host")? {
        Host::Ipv4(v4) => check_v4(v4, is_stream),
        Host::Ipv6(v6) => {
            if v6.is_loopback() {
                return if is_stream {
                    Ok(())
                } else {
                    Err("loopback-blocked".into())
                };
            }
            if v6.is_unspecified() {
                return Err("internal-ip-blocked".into());
            }
            let seg = v6.segments();
            if (seg[0] & 0xffc0) == 0xfe80 || (seg[0] & 0xfe00) == 0xfc00 {
                return Err("internal-ip-blocked".into());
            }
            let mapped = seg[0] == 0
                && seg[1] == 0
                && seg[2] == 0
                && seg[3] == 0
                && seg[4] == 0
                && seg[5] == 0xffff;
            if mapped {
                let v4 = Ipv4Addr::new(
                    (seg[6] >> 8) as u8,
                    (seg[6] & 0xff) as u8,
                    (seg[7] >> 8) as u8,
                    (seg[7] & 0xff) as u8,
                );
                return check_v4(v4, is_stream);
            }
            Ok(())
        }
        Host::Domain(host) => {
            let host = host.trim_end_matches('.');
            if host == "localhost" || host.ends_with(".localhost") || host.ends_with(".local") {
                Err("local-hostname-blocked".into())
            } else {
                Ok(())
            }
        }
    }
}

fn has_ctl(s: &str) -> bool {
    s.chars().any(|c| c.is_control())
}

pub fn safe_header_blob(headers: &HashMap<String, String>) -> String {
    let mut blob = String::new();
    for (k, v) in headers {
        let lk = k.to_ascii_lowercase();
        if lk == "user-agent" || HOP_BY_HOP.contains(&lk.as_str()) || has_ctl(k) || has_ctl(v) {
            continue;
        }
        blob.push_str(&format!("{}: {}\r\n", k, v));
    }
    blob
}

pub fn user_agent(headers: &HashMap<String, String>) -> Option<String> {
    headers
        .iter()
        .find(|(k, _)| k.eq_ignore_ascii_case("user-agent"))
        .and_then(|(_, value)| {
            let trimmed = value.trim();
            if trimmed.is_empty() || has_ctl(value) {
                None
            } else {
                Some(value.clone())
            }
        })
}

pub fn safe_map_spec(spec: Option<&str>) -> String {
    if let Some(s) = spec {
        if let Some(rest) = s.strip_prefix("0:a:") {
            if !rest.is_empty() && rest.bytes().all(|b| b.is_ascii_digit()) {
                return s.to_string();
            }
        }
    }
    "0:a:0".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_metadata_private_linklocal_and_bare_loopback() {
        assert!(validate_media_url("http://169.254.169.254/latest/meta-data/", true).is_err());
        assert!(validate_media_url("http://10.0.0.5/x.mkv", true).is_err());
        assert!(validate_media_url("http://192.168.1.10/x.mkv", true).is_err());
        assert!(validate_media_url("http://172.16.4.4/x.mkv", true).is_err());
        assert!(validate_media_url("http://100.100.0.1/x.mkv", true).is_err());
        assert!(validate_media_url("http://[fe80::1]/x", true).is_err());
        assert!(validate_media_url("http://[::1]:9000/admin", true).is_err());
        assert!(validate_media_url("http://127.0.0.1:9000/admin", true).is_err());
        assert!(
            validate_media_url("http://127.0.0.1:9000/admin?next=/stream/abc/0", true).is_err()
        );
    }

    #[test]
    fn allows_public_stream_loopback_and_local_files() {
        assert!(validate_media_url("https://cdn.example.com/a.mkv", true).is_ok());
        assert!(validate_media_url("http://127.0.0.1:5312/stream/abc/0", true).is_ok());
        assert!(validate_media_url("http://[::1]:5312/stream/abc/0", true).is_ok());
        assert!(validate_media_url("file:///m/x.mkv", true).is_ok());
        assert!(validate_media_url("/m/x.mkv", true).is_ok());
        assert!(validate_media_url("file:///m/x.mkv", false).is_err());
    }

    #[test]
    fn rejects_non_web_schemes_and_local_hostnames() {
        assert!(validate_media_url("gopher://x/1", true).is_err());
        assert!(validate_media_url("ftp://x/1", true).is_err());
        assert!(validate_media_url("http://localhost:8080/x", true).is_err());
        assert!(validate_media_url("http://printer.local/x", true).is_err());
    }

    #[test]
    fn header_blob_strips_injection_hop_by_hop_and_ua() {
        let mut h = HashMap::new();
        h.insert("Referer".into(), "https://ok".into());
        h.insert("X-Bad".into(), "a\r\nHost: evil".into());
        h.insert("Connection".into(), "keep-alive".into());
        h.insert("User-Agent".into(), "UA".into());
        let blob = safe_header_blob(&h).to_lowercase();
        assert!(blob.contains("referer: https://ok"));
        assert!(!blob.contains("evil"));
        assert!(!blob.contains("connection"));
        assert!(!blob.contains("user-agent"));
    }

    #[test]
    fn user_agent_rejects_control_character_injection() {
        let mut h = HashMap::new();
        h.insert("User-Agent".into(), "Harbor\r\nX-Injected: yes".into());
        assert_eq!(user_agent(&h), None);
    }

    #[test]
    fn map_spec_only_accepts_audio_index() {
        assert_eq!(safe_map_spec(Some("0:a:2")), "0:a:2");
        assert_eq!(safe_map_spec(Some("0:a:")), "0:a:0");
        assert_eq!(safe_map_spec(Some("0:v:0")), "0:a:0");
        assert_eq!(safe_map_spec(Some("evil; rm -rf /")), "0:a:0");
        assert_eq!(safe_map_spec(None), "0:a:0");
    }
}
