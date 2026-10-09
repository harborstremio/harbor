const PULSE_FORMAT: &str = "float32le";

pub(super) async fn ours() -> Vec<u32> {
    if !super::on_path("pactl") {
        return Vec::new();
    }
    let Ok(listing) = super::run("pactl", &["list", "short", "modules"]).await else {
        return Vec::new();
    };
    listing
        .lines()
        .filter(|line| {
            line.contains(super::super::CABLE_SINK) || line.contains(super::super::CABLE_SOURCE)
        })
        .filter_map(|line| line.split('\t').next()?.trim().parse::<u32>().ok())
        .collect()
}

fn quoted(key: &str, label: &str) -> String {
    format!("{key}=device.description=\"{label}\"")
}

pub(super) async fn create(rate: u32) -> Result<(), String> {
    destroy().await;
    let sink = super::super::CABLE_SINK;
    let source = super::super::CABLE_SOURCE;
    let rate = rate.to_string();
    super::run(
        "pactl",
        &[
            "load-module",
            "module-null-sink",
            &format!("sink_name={sink}"),
            &format!("rate={rate}"),
            "channels=2",
            &format!("format={PULSE_FORMAT}"),
            &quoted("sink_properties", super::super::CABLE_SINK_LABEL),
        ],
    )
    .await?;
    let remap = super::run(
        "pactl",
        &[
            "load-module",
            "module-remap-source",
            &format!("source_name={source}"),
            &format!("master={sink}.monitor"),
            &format!("rate={rate}"),
            "channels=2",
            &format!("format={PULSE_FORMAT}"),
            "remix=no",
            &quoted("source_properties", super::super::CABLE_MIC_LABEL),
        ],
    )
    .await;
    if let Err(error) = remap {
        destroy().await;
        return Err(error);
    }
    Ok(())
}

pub(super) async fn destroy() {
    let mut indexes = ours().await;
    indexes.sort_unstable_by(|left, right| right.cmp(left));
    for index in indexes {
        let _ = super::run("pactl", &["unload-module", &index.to_string()]).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_description_with_a_space_reaches_the_server_quoted() {
        assert_eq!(
            quoted("sink_properties", "Harbor Broadcast"),
            "sink_properties=device.description=\"Harbor Broadcast\""
        );
    }
}
