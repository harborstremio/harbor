use std::process::Stdio;
use std::sync::OnceLock;
use std::time::Duration;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

const SETTLE_STEP: Duration = Duration::from_millis(150);
const SETTLE_TRIES: u32 = 8;

static CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

fn slot() -> &'static Mutex<Option<Child>> {
    CHILD.get_or_init(|| Mutex::new(None))
}

pub(super) fn usable() -> bool {
    super::on_path("pw-loopback")
}

pub(super) async fn running() -> bool {
    super::on_path("pw-cli") && super::run("pw-cli", &["info", "0"]).await.is_ok()
}

pub(super) async fn alive() -> bool {
    let mut guard = slot().lock().await;
    let Some(child) = guard.as_mut() else {
        return false;
    };
    if matches!(child.try_wait(), Ok(None)) {
        return true;
    }
    *guard = None;
    false
}

pub(super) async fn graph() -> (Option<u32>, Vec<u32>) {
    if !super::on_path("pw-metadata") {
        return (None, Vec::new());
    }
    let Ok(dump) = super::run("pw-metadata", &["-n", "settings", "0"]).await else {
        return (None, Vec::new());
    };
    let mut rate = None;
    let mut forced = None;
    let mut allowed = Vec::new();
    for line in dump.lines() {
        let numbers: Vec<u32> = line
            .split(|glyph: char| !glyph.is_ascii_digit())
            .filter_map(|part| part.parse::<u32>().ok())
            .filter_map(super::sane_rate)
            .collect();
        if line.contains("clock.force-rate") {
            forced = numbers.first().copied();
        } else if line.contains("clock.allowed-rates") {
            allowed = numbers;
        } else if line.contains("clock.rate") {
            rate = numbers.first().copied();
        }
    }
    (forced.or(rate), allowed)
}

fn props(class: &str, name: &str, label: &str, rate: u32, explicit: bool) -> String {
    let depth = if explicit { " audio.format = F32" } else { "" };
    format!(
        "{{ media.class = {class} node.name = {name} node.description = \"{label}\" audio.position = [ FL FR ] audio.rate = {rate} audio.channels = 2{depth} }}"
    )
}

fn spawn(rate: u32, explicit: bool) -> Result<Child, String> {
    let capture = props(
        "Audio/Sink",
        super::super::CABLE_SINK,
        super::super::CABLE_SINK_LABEL,
        rate,
        explicit,
    );
    let playback = props(
        "Audio/Source",
        super::super::CABLE_SOURCE,
        super::super::CABLE_MIC_LABEL,
        rate,
        explicit,
    );
    let mut command = Command::new("pw-loopback");
    command
        .arg("--name")
        .arg(super::super::CABLE_GROUP)
        .arg("--channels")
        .arg("2")
        .arg("--capture-props")
        .arg(&capture)
        .arg("--playback-props")
        .arg(&playback)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    attach_death_signal(&mut command);
    command
        .spawn()
        .map_err(|error| format!("pw-loopback: {error}"))
}

async fn visible() -> bool {
    if !super::on_path("pactl") {
        return true;
    }
    super::pactl_has("sources", super::super::CABLE_SOURCE).await
}

async fn settle() -> bool {
    for _ in 0..SETTLE_TRIES {
        tokio::time::sleep(SETTLE_STEP).await;
        if !alive().await {
            return false;
        }
        if visible().await {
            return true;
        }
    }
    false
}

pub(super) async fn create(rate: u32) -> Result<(), String> {
    destroy().await;
    let mut failure: Option<String> = None;
    for explicit in [true, false] {
        match spawn(rate, explicit) {
            Ok(child) => {
                *slot().lock().await = Some(child);
            }
            Err(error) => {
                failure = Some(error);
                continue;
            }
        }
        if settle().await {
            return Ok(());
        }
        destroy().await;
    }
    Err(failure.unwrap_or_else(|| "music.cable.pipewireFailed".to_string()))
}

pub(super) async fn destroy() {
    let taken = slot().lock().await.take();
    if let Some(mut child) = taken {
        let _ = child.kill().await;
    }
    reap_orphans();
}

pub(super) fn reap_orphans() {
    let Ok(entries) = std::fs::read_dir("/proc") else {
        return;
    };
    let mine = std::process::id();
    for entry in entries.flatten() {
        let Some(pid) = entry
            .file_name()
            .to_str()
            .and_then(|name| name.parse::<u32>().ok())
        else {
            continue;
        };
        if pid == mine {
            continue;
        }
        let Ok(raw) = std::fs::read(entry.path().join("cmdline")) else {
            continue;
        };
        let text = String::from_utf8_lossy(&raw);
        let Some(program) = text.split('\0').next() else {
            continue;
        };
        if !program.ends_with("pw-loopback") {
            continue;
        }
        if !text.contains(super::super::CABLE_GROUP) || !text.contains(super::super::CABLE_SOURCE) {
            continue;
        }
        terminate(pid);
    }
}

#[cfg(target_os = "linux")]
fn attach_death_signal(command: &mut Command) {
    unsafe {
        command.pre_exec(|| {
            libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGTERM);
            Ok(())
        });
    }
}

#[cfg(not(target_os = "linux"))]
fn attach_death_signal(_command: &mut Command) {}

#[cfg(unix)]
fn terminate(pid: u32) {
    let Ok(pid) = i32::try_from(pid) else {
        return;
    };
    unsafe {
        libc::kill(pid, libc::SIGTERM);
    }
}

#[cfg(not(unix))]
fn terminate(_pid: u32) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_sink_half_is_a_sink_and_the_source_half_is_a_microphone() {
        let capture = props(
            "Audio/Sink",
            "harbor_broadcast",
            "Harbor Broadcast",
            96_000,
            true,
        );
        assert!(capture.contains("media.class = Audio/Sink"));
        assert!(capture.contains("node.name = harbor_broadcast"));
        assert!(capture.contains("node.description = \"Harbor Broadcast\""));
        assert!(capture.contains("audio.rate = 96000"));
        assert!(capture.contains("audio.position = [ FL FR ]"));
        assert!(capture.contains("audio.format = F32"));
        let playback = props(
            "Audio/Source",
            "harbor_virtual_mic",
            "Harbor Virtual Mic",
            48_000,
            false,
        );
        assert!(playback.contains("media.class = Audio/Source"));
        assert!(playback.contains("audio.rate = 48000"));
        assert!(!playback.contains("audio.format"));
    }
}
