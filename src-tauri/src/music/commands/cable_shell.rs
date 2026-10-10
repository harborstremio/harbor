use super::super::{CABLE_RATE_MAX, CABLE_RATE_MIN};

pub(super) async fn run(program: &str, args: &[&str]) -> Result<String, String> {
    let output = tokio::process::Command::new(program)
        .args(args)
        .output()
        .await
        .map_err(|error| format!("{program}: {error}"))?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if message.is_empty() {
            format!("{program} failed")
        } else {
            message
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub(super) fn on_path(binary: &str) -> bool {
    let Some(paths) = std::env::var_os("PATH") else {
        return false;
    };
    std::env::split_paths(&paths).any(|dir| dir.join(binary).is_file())
}

pub(super) fn sane_rate(value: u32) -> Option<u32> {
    (CABLE_RATE_MIN..=CABLE_RATE_MAX)
        .contains(&value)
        .then_some(value)
}

pub(super) async fn pactl_row(kind: &str, name: &str) -> Option<String> {
    if !on_path("pactl") {
        return None;
    }
    let listing = run("pactl", &["list", "short", kind]).await.ok()?;
    listing.lines().find_map(|line| {
        let mut parts = line.split('\t');
        parts.next()?;
        if parts.next()? != name {
            return None;
        }
        parts.next()?;
        let spec = parts.next().unwrap_or_default().trim();
        Some(spec.to_string())
    })
}

pub(super) async fn pactl_has(kind: &str, name: &str) -> bool {
    pactl_row(kind, name).await.is_some()
}

pub(super) fn parse_spec(spec: &str) -> (Option<String>, Option<u32>, Option<u32>) {
    let mut format = None;
    let mut channels = None;
    let mut rate = None;
    for part in spec.split_whitespace() {
        if let Some(value) = part
            .strip_suffix("Hz")
            .and_then(|raw| raw.parse::<u32>().ok())
        {
            rate = Some(value);
        } else if let Some(value) = part
            .strip_suffix("ch")
            .and_then(|raw| raw.parse::<u32>().ok())
        {
            channels = Some(value);
        } else if format.is_none() {
            format = Some(part.to_string());
        }
    }
    (format, channels, rate)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_listing_specs_split_into_format_channels_and_rate() {
        let (format, channels, rate) = parse_spec("float32le 2ch 48000Hz");
        assert_eq!(format.as_deref(), Some("float32le"));
        assert_eq!(channels, Some(2));
        assert_eq!(rate, Some(48_000));
        let (format, channels, rate) = parse_spec("s16le 6ch 44100Hz");
        assert_eq!(format.as_deref(), Some("s16le"));
        assert_eq!(channels, Some(6));
        assert_eq!(rate, Some(44_100));
    }

    #[test]
    fn rates_outside_what_a_sound_card_can_carry_are_rejected() {
        assert_eq!(sane_rate(0), None);
        assert_eq!(sane_rate(48_000), Some(48_000));
        assert_eq!(sane_rate(768_000), Some(768_000));
        assert_eq!(sane_rate(1_000_000), None);
    }
}
