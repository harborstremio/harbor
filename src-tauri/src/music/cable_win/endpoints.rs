use wasapi::{DeviceCollection, Direction, SampleType};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Render,
    Capture,
}

#[derive(Debug, Clone)]
pub struct Endpoint {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Copy)]
pub struct Format {
    pub rate: u32,
    pub bits: u16,
    pub channels: u16,
    pub float: bool,
}

impl Format {
    pub fn tag(&self) -> String {
        if self.float {
            format!("float{}le", self.bits)
        } else {
            format!("s{}le", self.bits)
        }
    }

    pub fn spec(&self) -> String {
        format!("{} {}ch {}Hz", self.tag(), self.channels, self.rate)
    }
}

fn flow(side: Side) -> Direction {
    match side {
        Side::Render => Direction::Render,
        Side::Capture => Direction::Capture,
    }
}

fn collection(side: Side) -> Option<(DeviceCollection, u32)> {
    let _ = wasapi::initialize_mta().ok();
    let devices = DeviceCollection::new(&flow(side)).ok()?;
    let count = devices.get_nbr_devices().ok()?;
    Some((devices, count))
}

pub fn list(side: Side) -> Vec<Endpoint> {
    let Some((devices, count)) = collection(side) else {
        return Vec::new();
    };
    let mut found = Vec::with_capacity(count as usize);
    for index in 0..count {
        let Ok(device) = devices.get_device_at_index(index) else {
            continue;
        };
        let (Ok(id), Ok(name)) = (device.get_id(), device.get_friendlyname()) else {
            continue;
        };
        found.push(Endpoint { id, name });
    }
    found
}

pub fn format(side: Side, id: &str) -> Option<Format> {
    let (devices, count) = collection(side)?;
    for index in 0..count {
        let Ok(device) = devices.get_device_at_index(index) else {
            continue;
        };
        if device.get_id().ok().as_deref() != Some(id) {
            continue;
        }
        let Ok(client) = device.get_iaudioclient() else {
            return None;
        };
        let Ok(mix) = client.get_mixformat() else {
            return None;
        };
        let bits = match mix.get_validbitspersample() {
            0 => mix.get_bitspersample(),
            valid => valid,
        };
        return Some(Format {
            rate: mix.get_samplespersec(),
            bits,
            channels: mix.get_nchannels(),
            float: matches!(mix.get_subformat(), Ok(SampleType::Float)),
        });
    }
    None
}

const MPV_TRIMMED_PREFIX: &str = "{0.0.0.00000000}.";

pub fn mpv_device(id: &str) -> String {
    format!(
        "wasapi/{}",
        id.strip_prefix(MPV_TRIMMED_PREFIX).unwrap_or(id)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_float_mix_format_is_reported_the_way_the_linux_cable_reports_its_own() {
        let spec = Format {
            rate: 48_000,
            bits: 32,
            channels: 2,
            float: true,
        }
        .spec();
        assert_eq!(spec, "float32le 2ch 48000Hz");
    }

    #[test]
    fn an_integer_mix_format_is_never_dressed_up_as_float() {
        let spec = Format {
            rate: 44_100,
            bits: 24,
            channels: 2,
            float: false,
        }
        .spec();
        assert_eq!(spec, "s24le 2ch 44100Hz");
    }

    #[test]
    fn a_render_endpoint_id_loses_the_prefix_mpv_itself_strips() {
        assert_eq!(
            mpv_device("{0.0.0.00000000}.{15dccad8-5e49-4b9d-8f0a-e297964ad12b}"),
            "wasapi/{15dccad8-5e49-4b9d-8f0a-e297964ad12b}"
        );
    }

    #[test]
    fn an_id_without_that_prefix_is_passed_through_whole() {
        assert_eq!(
            mpv_device("{0.0.1.00000000}.{9e9fa42e}"),
            "wasapi/{0.0.1.00000000}.{9e9fa42e}"
        );
    }

    #[test]
    #[ignore = "reads the audio endpoints of the machine it runs on"]
    fn this_machine_reports_its_real_endpoints_and_their_mix_formats() {
        for side in [Side::Render, Side::Capture] {
            let found = list(side);
            println!("{side:?}: {} endpoints", found.len());
            for endpoint in &found {
                let spec = format(side, &endpoint.id)
                    .map(|found| found.spec())
                    .unwrap_or_else(|| "no format".to_string());
                println!("  {}  [{spec}]  {}", endpoint.name, endpoint.id);
            }
            assert!(!found.is_empty());
        }
    }
}
