pub struct Cable {
    pub render: &'static [&'static str],
    pub capture: &'static [&'static str],
    pub loops_back: bool,
}

pub const CABLES: &[Cable] = &[
    Cable {
        render: &["(vb-audio virtual cable)", "^cable input"],
        capture: &["(vb-audio virtual cable)", "^cable output"],
        loops_back: true,
    },
    Cable {
        render: &["(vb-audio hi-fi cable)", "^hi-fi cable input"],
        capture: &["(vb-audio hi-fi cable)", "^hi-fi cable output"],
        loops_back: true,
    },
    Cable {
        render: &["(vb-audio cable a)", "^cable-a input"],
        capture: &["(vb-audio cable a)", "^cable-a output"],
        loops_back: true,
    },
    Cable {
        render: &["(vb-audio cable b)", "^cable-b input"],
        capture: &["(vb-audio cable b)", "^cable-b output"],
        loops_back: true,
    },
    Cable {
        render: &["(vb-audio cable c)", "^cable-c input"],
        capture: &["(vb-audio cable c)", "^cable-c output"],
        loops_back: true,
    },
    Cable {
        render: &["(vb-audio cable d)", "^cable-d input"],
        capture: &["(vb-audio cable d)", "^cable-d output"],
        loops_back: true,
    },
    Cable {
        render: &["(vb-audio voicemeeter vaio)", "^voicemeeter input"],
        capture: &["(vb-audio voicemeeter vaio)", "^voicemeeter output"],
        loops_back: true,
    },
    Cable {
        render: &["(vb-audio voicemeeter aux vaio)", "^voicemeeter aux input"],
        capture: &["(vb-audio voicemeeter aux vaio)", "^voicemeeter aux output"],
        loops_back: true,
    },
    Cable {
        render: &["(vb-audio voicemeeter vaio3)", "^voicemeeter vaio3 input"],
        capture: &["(vb-audio voicemeeter vaio3)", "^voicemeeter vaio3 output"],
        loops_back: true,
    },
    Cable {
        render: &["^line 1 (virtual audio cable)"],
        capture: &["^line 1 (virtual audio cable)"],
        loops_back: true,
    },
    Cable {
        render: &["^line 2 (virtual audio cable)"],
        capture: &["^line 2 (virtual audio cable)"],
        loops_back: true,
    },
    Cable {
        render: &["^line 3 (virtual audio cable)"],
        capture: &["^line 3 (virtual audio cable)"],
        loops_back: true,
    },
    Cable {
        render: &["steam streaming speakers"],
        capture: &["steam streaming microphone"],
        loops_back: false,
    },
];

pub struct Match {
    pub render: usize,
    pub capture: usize,
    pub loops_back: bool,
}

fn hits(needles: &[&str], name: &str) -> bool {
    needles.iter().any(|needle| match needle.strip_prefix('^') {
        Some(head) => name.starts_with(head),
        None => name.contains(needle),
    })
}

fn seek(needles: &[&str], names: &[String]) -> Option<usize> {
    names.iter().position(|name| hits(needles, name))
}

pub fn installed(render: &[String], capture: &[String]) -> Vec<Match> {
    let render: Vec<String> = render.iter().map(|name| name.to_lowercase()).collect();
    let capture: Vec<String> = capture.iter().map(|name| name.to_lowercase()).collect();
    let mut found: Vec<Match> = CABLES
        .iter()
        .filter_map(|cable| {
            Some(Match {
                render: seek(cable.render, &render)?,
                capture: seek(cable.capture, &capture)?,
                loops_back: cable.loops_back,
            })
        })
        .collect();
    found.sort_by_key(|entry| !entry.loops_back);
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    fn pairs<'a>(render: &'a [String], capture: &'a [String]) -> Vec<(&'a str, &'a str)> {
        installed(render, capture)
            .iter()
            .map(|entry| {
                (
                    render[entry.render].as_str(),
                    capture[entry.capture].as_str(),
                )
            })
            .collect()
    }

    #[test]
    fn a_vb_cable_install_pairs_its_render_endpoint_with_the_mic_the_user_picks() {
        let render = names(&[
            "Speakers (Realtek(R) Audio)",
            "CABLE Input (VB-Audio Virtual Cable)",
        ]);
        let capture = names(&[
            "Microphone (Realtek(R) Audio)",
            "CABLE Output (VB-Audio Virtual Cable)",
        ]);
        assert_eq!(
            pairs(&render, &capture),
            vec![(
                "CABLE Input (VB-Audio Virtual Cable)",
                "CABLE Output (VB-Audio Virtual Cable)"
            )]
        );
    }

    #[test]
    fn a_hifi_cable_is_never_also_reported_as_the_plain_vb_cable() {
        let render = names(&["Hi-Fi Cable Input (VB-Audio Hi-Fi Cable)"]);
        let capture = names(&["Hi-Fi Cable Output (VB-Audio Hi-Fi Cable)"]);
        assert_eq!(
            pairs(&render, &capture),
            vec![(
                "Hi-Fi Cable Input (VB-Audio Hi-Fi Cable)",
                "Hi-Fi Cable Output (VB-Audio Hi-Fi Cable)"
            )]
        );
    }

    #[test]
    fn voicemeeter_vaio_aux_and_vaio3_never_cross_wire_with_each_other() {
        let render = names(&[
            "VoiceMeeter Input (VB-Audio VoiceMeeter VAIO)",
            "VoiceMeeter Aux Input (VB-Audio VoiceMeeter AUX VAIO)",
            "VoiceMeeter VAIO3 Input (VB-Audio VoiceMeeter VAIO3)",
        ]);
        let capture = names(&[
            "VoiceMeeter Output (VB-Audio VoiceMeeter VAIO)",
            "VoiceMeeter Aux Output (VB-Audio VoiceMeeter AUX VAIO)",
            "VoiceMeeter VAIO3 Output (VB-Audio VoiceMeeter VAIO3)",
        ]);
        assert_eq!(
            pairs(&render, &capture),
            vec![
                (
                    "VoiceMeeter Input (VB-Audio VoiceMeeter VAIO)",
                    "VoiceMeeter Output (VB-Audio VoiceMeeter VAIO)"
                ),
                (
                    "VoiceMeeter Aux Input (VB-Audio VoiceMeeter AUX VAIO)",
                    "VoiceMeeter Aux Output (VB-Audio VoiceMeeter AUX VAIO)"
                ),
                (
                    "VoiceMeeter VAIO3 Input (VB-Audio VoiceMeeter VAIO3)",
                    "VoiceMeeter VAIO3 Output (VB-Audio VoiceMeeter VAIO3)"
                ),
            ]
        );
    }

    #[test]
    fn a_renamed_endpoint_is_still_found_through_its_adapter_name() {
        let render = names(&["Harbor Broadcast (VB-Audio Virtual Cable)"]);
        let capture = names(&["Harbor Mic (VB-Audio Virtual Cable)"]);
        assert_eq!(
            pairs(&render, &capture),
            vec![(
                "Harbor Broadcast (VB-Audio Virtual Cable)",
                "Harbor Mic (VB-Audio Virtual Cable)"
            )]
        );
    }

    #[test]
    fn a_render_endpoint_with_no_matching_capture_side_is_not_a_cable() {
        let render = names(&["CABLE Input (VB-Audio Virtual Cable)"]);
        let capture = names(&["Microphone (Realtek(R) Audio)"]);
        assert!(pairs(&render, &capture).is_empty());
    }

    #[test]
    fn processors_that_do_not_loop_render_into_capture_are_never_matched() {
        let render = names(&["Speakers (NVIDIA Broadcast)", "Speakers (Realtek(R) Audio)"]);
        let capture = names(&[
            "Microphone (NVIDIA Broadcast)",
            "Stereo Mix (Realtek(R) Audio)",
        ]);
        assert!(pairs(&render, &capture).is_empty());
    }

    #[test]
    fn a_true_cable_outranks_a_pair_whose_loopback_is_unconfirmed() {
        let render = names(&[
            "Speakers (Steam Streaming Speakers)",
            "CABLE Input (VB-Audio Virtual Cable)",
        ]);
        let capture = names(&[
            "Microphone (Steam Streaming Microphone)",
            "CABLE Output (VB-Audio Virtual Cable)",
        ]);
        assert_eq!(
            pairs(&render, &capture),
            vec![
                (
                    "CABLE Input (VB-Audio Virtual Cable)",
                    "CABLE Output (VB-Audio Virtual Cable)"
                ),
                (
                    "Speakers (Steam Streaming Speakers)",
                    "Microphone (Steam Streaming Microphone)"
                ),
            ]
        );
    }

    #[test]
    fn every_virtual_audio_cable_line_keeps_its_own_number() {
        let render = names(&[
            "Line 2 (Virtual Audio Cable)",
            "Line 1 (Virtual Audio Cable)",
        ]);
        let capture = names(&[
            "Line 1 (Virtual Audio Cable)",
            "Line 2 (Virtual Audio Cable)",
        ]);
        let found = installed(&render, &capture);
        assert_eq!(found.len(), 2);
        assert_eq!((found[0].render, found[0].capture), (1, 0));
        assert_eq!((found[1].render, found[1].capture), (0, 1));
    }
}
