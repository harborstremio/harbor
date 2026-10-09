use super::connector::ConnectorHealth;
use super::{MusicSourceCandidate, MusicTrack};
use std::collections::{HashSet, VecDeque};

pub(super) fn requested_candidate(
    track: &MusicTrack,
    connector_id: &str,
    connector_name: String,
) -> MusicSourceCandidate {
    MusicSourceCandidate {
        connector_id: connector_id.to_string(),
        connector_name,
        health: ConnectorHealth::Healthy,
        track: track.clone(),
    }
}

pub(super) fn source_name(id: &str) -> String {
    match id {
        "local" => "Local file".to_string(),
        "direct" => "Direct stream".to_string(),
        _ => id.to_string(),
    }
}

pub(super) fn settle_search_results(
    results: Vec<(String, Result<Vec<MusicTrack>, String>)>,
    limit: usize,
) -> Result<Vec<MusicTrack>, String> {
    let mut succeeded = false;
    let mut errors = Vec::new();
    let mut queues = Vec::new();
    for (connector, result) in results {
        match result {
            Ok(items) => {
                succeeded = true;
                queues.push(items.into_iter().collect::<VecDeque<_>>());
            }
            Err(error) => errors.push(format!("{connector}: {error}")),
        }
    }
    if !succeeded {
        return Err(if errors.is_empty() {
            "Music sources are offline".to_string()
        } else {
            errors.join("; ")
        });
    }

    let mut seen = HashSet::new();
    let mut tracks = Vec::new();
    while tracks.len() < limit {
        let mut advanced = false;
        for queue in &mut queues {
            while let Some(track) = queue.pop_front() {
                advanced = true;
                if seen.insert(source_key(&track)) {
                    tracks.push(track);
                    break;
                }
            }
            if tracks.len() == limit {
                break;
            }
        }
        if !advanced {
            break;
        }
    }
    Ok(tracks)
}

pub(super) fn source_key(track: &MusicTrack) -> String {
    format!(
        "{}:{}",
        track.connector_id.as_deref().unwrap_or("unknown"),
        track.source_id.as_deref().unwrap_or(&track.id)
    )
}

pub(super) fn track_identity(track: &MusicTrack) -> (String, String) {
    (
        track.title.trim().to_lowercase(),
        track.artist.trim().to_lowercase(),
    )
}

pub(super) fn connector_priority(id: &str) -> u8 {
    match id {
        "spotify" => 0,
        "soundcloud" => 1,
        "youtube" => 2,
        _ => 3,
    }
}

fn clean_marked(title: &str) -> bool {
    let lowered = title.to_lowercase();
    lowered.contains("(clean")
        || lowered.contains("[clean")
        || lowered.contains("clean version")
        || lowered.contains("clean edit")
        || lowered.contains("radio edit")
        || lowered.contains("censored")
}

fn explicit_marked(title: &str) -> bool {
    let lowered = title.to_lowercase();
    lowered.contains("(explicit")
        || lowered.contains("[explicit")
        || lowered.contains("explicit version")
}

fn explicitness(track: &MusicTrack) -> Option<bool> {
    if explicit_marked(&track.title) {
        return Some(true);
    }
    if clean_marked(&track.title) {
        return Some(false);
    }
    track.explicit
}

fn lyric_bias(target: &MusicTrack, candidate: &MusicTrack) -> i32 {
    match (explicitness(target), explicitness(candidate)) {
        (Some(true), Some(true)) | (Some(false), Some(false)) => 25,
        (Some(true), Some(false)) => -60,
        (Some(false), Some(true)) => -45,
        (Some(true), None) => -8,
        _ => 0,
    }
}

fn tempo_version(track: &MusicTrack) -> Option<&'static str> {
    let label = normalized(&format!(
        "{} {}",
        track.title,
        track.version.as_deref().unwrap_or("")
    ));
    let words = label.split_whitespace().collect::<Vec<_>>();
    if words.contains(&"nightcore") || words.windows(2).any(|pair| pair == ["night", "core"]) {
        Some("nightcore")
    } else if words.contains(&"spedup")
        || words.contains(&"speedup")
        || words
            .windows(2)
            .any(|pair| matches!(pair, ["sped" | "speed", "up"]))
    {
        Some("sped-up")
    } else if words.contains(&"slowed") || words.contains(&"sloweddown") {
        Some("slowed")
    } else {
        None
    }
}

fn backing_version(track: &MusicTrack) -> Option<&'static str> {
    let label = normalized(&format!(
        "{} {}",
        track.title,
        track.version.as_deref().unwrap_or("")
    ));
    let words = label.split_whitespace().collect::<Vec<_>>();
    if words.contains(&"karaoke") || words.windows(2).any(|w| w == ["sing", "along"]) {
        Some("karaoke")
    } else if words.contains(&"instrumental")
        || words.windows(2).any(|w| {
            matches!(
                w,
                ["backing", "track"]
                    | ["no", "vocals"]
                    | ["without", "vocals"]
                    | ["vocal", "removed"]
            )
        })
    {
        Some("instrumental")
    } else {
        None
    }
}

pub(super) fn candidate_score(target: &MusicTrack, candidate: &MusicTrack) -> Option<i32> {
    if backing_version(target) != backing_version(candidate) {
        return None;
    }
    // A close duration alone does not make a speed edit the requested recording.
    if tempo_version(target) != tempo_version(candidate) {
        return None;
    }
    let title = similarity(&target.title, &candidate.title);
    // An upload credits the artist in its title and carries the uploader as the artist.
    let artist = similarity(&target.artist, &candidate.artist).max(
        if credits_artist(&target.artist, &candidate.title) {
            70
        } else {
            0
        },
    );
    if title < 55 || artist < 35 {
        return None;
    }
    let duration = match (target.duration_seconds, candidate.duration_seconds) {
        (0, _) | (_, 0) => 0,
        (left, right) => {
            let difference = left.abs_diff(right);
            let tolerance = 12_u64.max(left.max(right) / 10);
            if difference > tolerance {
                return None;
            }
            20 - ((difference * 20 / tolerance.max(1)) as i32)
        }
    };
    Some(title + artist + duration + lyric_bias(target, candidate))
}

fn credits_artist(artist: &str, title: &str) -> bool {
    let artist = normalized(artist);
    let title = normalized(title);
    if artist.is_empty() || title.is_empty() {
        return false;
    }
    let tokens = title.split_whitespace().collect::<HashSet<_>>();
    let mut named = false;
    for token in artist.split_whitespace() {
        if token.len() < 2 {
            continue;
        }
        if !tokens.contains(token) {
            return false;
        }
        named = true;
    }
    named
}

fn similarity(left: &str, right: &str) -> i32 {
    let left = normalized(left);
    let right = normalized(right);
    if left.is_empty() || right.is_empty() {
        return 0;
    }
    if left == right {
        return 100;
    }
    if left.contains(&right) || right.contains(&left) {
        return 82;
    }
    let left_tokens = left.split_whitespace().collect::<HashSet<_>>();
    let right_tokens = right.split_whitespace().collect::<HashSet<_>>();
    let intersection = left_tokens.intersection(&right_tokens).count() as i32;
    let union = left_tokens.union(&right_tokens).count() as i32;
    if union == 0 {
        0
    } else {
        intersection * 100 / union
    }
}

fn normalized(input: &str) -> String {
    input
        .chars()
        .map(|character| {
            if character.is_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .filter(|token| {
            !matches!(
                *token,
                "official" | "video" | "audio" | "lyrics" | "remastered" | "remaster"
            )
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(id: &str) -> MusicTrack {
        MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            id: id.to_string(),
            connector_id: Some("test".to_string()),
            source_id: Some(id.to_string()),
            playback_url: None,
            title: id.to_string(),
            artist: "Artist".to_string(),
            album: None,
            artwork: String::new(),
            duration_seconds: 1,
            duration_label: "0:01".to_string(),
        }
    }

    #[test]
    fn backing_tracks_do_not_replace_vocal_recordings() {
        let vocal = track("KEEP GOING");
        for title in [
            "KEEP GOING (Instrumental)",
            "KEEP GOING karaoke",
            "KEEP GOING - no vocals",
        ] {
            assert!(candidate_score(&vocal, &track(title)).is_none());
        }
        assert!(candidate_score(&vocal, &track("KEEP GOING (Official Audio)")).is_some());
        let instrumental = track("KEEP GOING (Instrumental)");
        assert!(candidate_score(&instrumental, &instrumental).is_some());
        assert!(candidate_score(&instrumental, &vocal).is_none());
    }

    fn song(title: &str, seconds: u64, explicit: Option<bool>) -> MusicTrack {
        let mut built = track(title);
        built.title = title.to_string();
        built.artist = "Tee Grizzley".to_string();
        built.duration_seconds = seconds;
        built.explicit = explicit;
        built
    }

    #[test]
    fn a_reupload_that_names_the_artist_in_its_title_is_still_the_song() {
        let mut target = song("Runnin' Thru the 7th with My Woadies", 205, None);
        target.artist = "$uicideboy$, Pouya".to_string();
        let mut upload = song(
            "$UICIDEBOY$ & Pouya - RUNNIN THRU THE 7TH WITH MY WOADIES",
            205,
            None,
        );
        upload.artist = "crazytim23".to_string();
        assert!(candidate_score(&target, &upload).is_some());
    }

    #[test]
    fn an_uploader_that_never_names_the_artist_is_not_the_song() {
        let mut target = song("Runnin' Thru the 7th with My Woadies", 205, None);
        target.artist = "$uicideboy$, Pouya".to_string();
        let mut other = song("Runnin' Thru the 7th with My Woadies", 205, None);
        other.artist = "crazytim23".to_string();
        assert!(candidate_score(&target, &other).is_none());
    }

    #[test]
    fn a_short_artist_name_does_not_match_inside_a_longer_word() {
        let mut target = song("Some Demo", 200, None);
        target.artist = "Ye".to_string();
        let mut other = song("Yesterday Some Demo", 200, None);
        other.artist = "someone else".to_string();
        assert!(candidate_score(&target, &other).is_none());
    }

    #[test]
    fn an_explicit_target_outranks_the_clean_recording_of_the_same_song() {
        let target = song("First Day Out", 254, Some(true));
        let explicit = song("First Day Out", 254, Some(true));
        let clean = song("First Day Out", 254, Some(false));
        let marked = song("First Day Out (Clean)", 254, None);
        let unknown = song("First Day Out", 254, None);
        let best = candidate_score(&target, &explicit).expect("explicit match");
        assert!(best > candidate_score(&target, &clean).expect("clean match"));
        assert!(best > candidate_score(&target, &marked).expect("marked match"));
        assert!(best > candidate_score(&target, &unknown).expect("unknown match"));
    }

    #[test]
    fn a_clean_target_is_not_handed_the_explicit_recording() {
        let target = song("First Day Out (Clean)", 254, None);
        let clean = song("First Day Out (Clean)", 254, None);
        let explicit = song("First Day Out", 254, Some(true));
        assert!(
            candidate_score(&target, &clean).expect("clean match")
                > candidate_score(&target, &explicit).expect("explicit match")
        );
    }

    #[test]
    fn normal_recordings_do_not_match_tempo_edits_even_with_unknown_durations() {
        let target = song("Vampire Love", 103, Some(true));
        assert!(candidate_score(&target, &song("Vampire Love", 102, Some(true))).is_some());
        for label in [
            "Sped up",
            "Sped-Up",
            "spedup",
            "Speed Up",
            "Slowed + Reverb",
            "Nightcore",
        ] {
            for duration in [0, 103] {
                let edit = song(&format!("Vampire Love ({label})"), duration, Some(true));
                assert!(candidate_score(&target, &edit).is_none(), "{label}");
            }
        }
        let mut versioned = song("Vampire Love", 103, Some(true));
        versioned.version = Some("sped up".to_string());
        assert!(candidate_score(&target, &versioned).is_none());
        assert!(candidate_score(&target, &song("Vampire Love", 89, Some(true))).is_none());
    }

    #[test]
    fn an_explicitly_requested_tempo_edit_keeps_its_version() {
        let target = song("Vampire Love (Sped Up)", 89, Some(true));
        let edit = song("Vampire Love [sped-up]", 89, Some(true));
        assert!(candidate_score(&target, &edit).is_some());
        assert!(candidate_score(&target, &song("Vampire Love", 89, Some(true))).is_none());
        assert!(
            candidate_score(&target, &song("Vampire Love (Nightcore)", 89, Some(true))).is_none()
        );
        // An ordinary song title containing "slow" is not a version marker.
        let original = song("Slow Down", 200, None);
        assert!(candidate_score(&original, &original).is_some());
    }

    #[test]
    fn settled_search_keeps_partial_results_and_deduplicates() {
        let results = settle_search_results(
            vec![
                ("one".to_string(), Ok(vec![track("a"), track("b")])),
                ("two".to_string(), Err("offline".to_string())),
                ("three".to_string(), Ok(vec![track("b"), track("c")])),
            ],
            10,
        )
        .expect("partial results");
        assert_eq!(
            results
                .into_iter()
                .map(|track| track.id)
                .collect::<Vec<_>>(),
            vec!["a", "b", "c"]
        );
    }

    #[test]
    fn settled_search_reports_failure_when_every_connector_fails() {
        let error = settle_search_results(
            vec![
                ("one".to_string(), Err("offline".to_string())),
                ("two".to_string(), Err("timed out".to_string())),
            ],
            10,
        )
        .expect_err("all connector failures");
        assert!(error.contains("one: offline"));
        assert!(error.contains("two: timed out"));
    }

    #[test]
    fn candidate_matching_requires_identity_and_duration_proximity() {
        let target = MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            title: "Hysteria".to_string(),
            artist: "Muse".to_string(),
            duration_seconds: 227,
            ..track("spotify:track:one")
        };
        let matching = MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            title: "Hysteria (Official Audio)".to_string(),
            artist: "Muse".to_string(),
            duration_seconds: 230,
            ..track("youtube-id")
        };
        let wrong_artist = MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            artist: "Def Leppard".to_string(),
            ..matching.clone()
        };
        let wrong_duration = MusicTrack {
            duration_seconds: 400,
            ..matching.clone()
        };
        assert!(candidate_score(&target, &matching).is_some());
        assert!(candidate_score(&target, &wrong_artist).is_none());
        assert!(candidate_score(&target, &wrong_duration).is_none());
    }

    #[test]
    fn source_keys_keep_provider_ids_distinct() {
        let mut youtube = track("same");
        youtube.connector_id = Some("youtube".to_string());
        let mut soundcloud = track("same");
        soundcloud.connector_id = Some("soundcloud".to_string());
        assert_ne!(source_key(&youtube), source_key(&soundcloud));
    }

    #[test]
    fn track_identity_collapses_case_and_padding() {
        let mut left = track("one");
        left.title = "  Hysteria ".to_string();
        left.artist = "MUSE".to_string();
        let mut right = track("two");
        right.title = "hysteria".to_string();
        right.artist = "muse".to_string();
        assert_eq!(track_identity(&left), track_identity(&right));
    }

    #[test]
    fn imported_tracks_keep_their_direct_source_candidate() {
        let imported = MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            id: "m3u:one".to_string(),
            connector_id: Some("local".to_string()),
            source_id: Some("C:/Music/Hysteria.flac".to_string()),
            playback_url: Some("C:/Music/Hysteria.flac".to_string()),
            title: "Hysteria".to_string(),
            artist: "Muse".to_string(),
            album: None,
            artwork: String::new(),
            duration_seconds: 227,
            duration_label: "3:47".to_string(),
        };
        let candidate = requested_candidate(&imported, "local", source_name("local"));
        assert_eq!(candidate.connector_id, "local");
        assert_eq!(candidate.connector_name, "Local file");
        assert_eq!(candidate.health, ConnectorHealth::Healthy);
        assert_eq!(
            candidate.track.playback_url.as_deref(),
            Some("C:/Music/Hysteria.flac")
        );
    }

    #[test]
    fn settled_search_reserves_space_for_each_provider() {
        let from = |connector: &str, id: &str| {
            let mut value = track(id);
            value.connector_id = Some(connector.to_string());
            value
        };
        let results = settle_search_results(
            vec![
                (
                    "soundcloud".to_string(),
                    Ok(vec![
                        from("soundcloud", "s1"),
                        from("soundcloud", "s2"),
                        from("soundcloud", "s3"),
                        from("soundcloud", "s4"),
                    ]),
                ),
                ("spotify".to_string(), Ok(vec![from("spotify", "p1")])),
                ("youtube".to_string(), Ok(vec![from("youtube", "y1")])),
            ],
            4,
        )
        .expect("multi-source results");
        assert_eq!(
            results
                .iter()
                .map(|item| item.connector_id.as_deref().unwrap())
                .collect::<Vec<_>>(),
            vec!["soundcloud", "spotify", "youtube", "soundcloud"]
        );
    }
}
