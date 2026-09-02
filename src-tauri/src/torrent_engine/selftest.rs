mod stream_probe;
mod types;

use tauri::AppHandle;

use super::{current_port, current_side_dht, ensure_session, netcheck};
use types::{finish, step, warn_step};

pub use types::SelfTestResult;

pub async fn run(app: AppHandle) -> SelfTestResult {
    let mut steps = Vec::new();
    let session = match ensure_session(&app).await {
        Ok(s) => s,
        Err(e) => {
            steps.push(step("engine up", false, e));
            return finish(steps);
        }
    };
    let Some(port) = current_port() else {
        steps.push(step("engine up", false, "no port bound"));
        return finish(steps);
    };
    let client = reqwest::Client::new();
    match client
        .get(format!("http://127.0.0.1:{port}/health"))
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => {
            steps.push(step("engine up", true, format!("port {port}, /health ok")));
        }
        Ok(r) => {
            steps.push(step("engine up", false, format!("/health {}", r.status())));
            return finish(steps);
        }
        Err(e) => {
            steps.push(step("engine up", false, e.to_string()));
            return finish(steps);
        }
    }

    let net = netcheck::run(current_side_dht()).await;
    let https_tracker_ok = net.iter().any(|s| s.label == "https egress" && s.ok);
    let udp_ok = net.iter().any(|s| s.label == "udp egress" && s.ok);
    let dht_ok = net.iter().any(|s| s.label == "dht nodes" && s.ok);
    for s in net {
        steps.push(types::SelfTestStep {
            label: s.label,
            ok: s.ok,
            warn: s.warn,
            detail: s.detail,
        });
    }

    if !dht_ok && !udp_ok && !https_tracker_ok {
        steps.push(step(
            "discovery",
            false,
            "no route for peer discovery (DHT, UDP and HTTPS trackers all unreachable). If you are online, a VPN or debrid service usually helps; an offline network cannot reach a peer-to-peer swarm",
        ));
        return finish(steps);
    }
    if !dht_ok && !udp_ok && https_tracker_ok {
        steps.push(warn_step(
            "discovery",
            "UDP blocked, but HTTPS trackers are reachable over TCP so streams can still find peers",
        ));
    }

    stream_probe::run(&session, &mut steps).await;
    finish(steps)
}
