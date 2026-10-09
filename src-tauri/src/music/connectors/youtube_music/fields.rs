pub const CONNECTOR: &str = "youtube";

pub struct Details {
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration: u64,
}

pub fn details_from(mut parts: Vec<String>) -> Details {
    let mut duration = 0;
    if let Some(seconds) = parts.last().and_then(|part| seconds_from_label(part)) {
        duration = seconds;
        parts.pop();
    }
    let mut usable = parts
        .iter()
        .filter(|part| !is_kind_word(part) && !looks_like_stat(part));
    Details {
        artist: usable.next().cloned(),
        album: usable.next().cloned(),
        duration,
    }
}

pub fn primary(parts: &[String]) -> Option<String> {
    parts
        .iter()
        .find(|part| !is_kind_word(part) && !looks_like_stat(part))
        .cloned()
}

pub fn year_from(parts: &[String]) -> Option<u32> {
    parts.iter().rev().find_map(|part| {
        part.trim()
            .parse::<u32>()
            .ok()
            .filter(|year| (1900..=2100).contains(year))
    })
}

pub fn count_from(parts: &[String]) -> Option<u32> {
    parts.iter().find_map(|part| {
        let lower = part.to_ascii_lowercase();
        if !lower.ends_with(" songs")
            && !lower.ends_with(" song")
            && !lower.ends_with(" tracks")
            && !lower.ends_with(" track")
        {
            return None;
        }
        part.split_whitespace()
            .next()?
            .replace(',', "")
            .parse()
            .ok()
    })
}

pub fn seconds_from_label(value: &str) -> Option<u64> {
    let mut total = 0;
    let mut fields = 0;
    for field in value.trim().split(':') {
        total = total * 60 + field.trim().parse::<u64>().ok()?;
        fields += 1;
    }
    if (2..=3).contains(&fields) {
        Some(total)
    } else {
        None
    }
}

pub fn clean_title(raw: &str, artist: &str) -> String {
    let mut title = raw.trim().to_string();
    let prefix = format!("{} - ", artist.trim());
    if title
        .to_ascii_lowercase()
        .starts_with(&prefix.to_ascii_lowercase())
    {
        title = title[prefix.len()..].trim().to_string();
    }
    for marker in [
        " [official",
        " (official",
        " [lyrics",
        " (lyrics",
        " / lyrics",
        " - lyrics",
        " [audio",
        " (audio",
    ] {
        if let Some(index) = title.to_ascii_lowercase().find(marker) {
            title.truncate(index);
        }
    }
    title.trim().to_string()
}

fn is_kind_word(value: &str) -> bool {
    matches!(
        value.to_ascii_lowercase().as_str(),
        "song"
            | "video"
            | "album"
            | "single"
            | "ep"
            | "artist"
            | "playlist"
            | "podcast"
            | "episode"
    )
}

fn looks_like_stat(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.ends_with("subscribers")
        || lower.ends_with("plays")
        || lower.ends_with("views")
        || lower.ends_with("songs")
        || lower.ends_with("tracks")
        || value.trim().parse::<u32>().is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn details_split_artist_album_and_duration() {
        let details = details_from(vec![
            "Song".to_string(),
            "Muse".to_string(),
            "Absolution".to_string(),
            "3:47".to_string(),
        ]);
        assert_eq!(details.artist.as_deref(), Some("Muse"));
        assert_eq!(details.album.as_deref(), Some("Absolution"));
        assert_eq!(details.duration, 227);

        let plays = details_from(vec![
            "Muse".to_string(),
            "3.2M plays".to_string(),
            "1:02:03".to_string(),
        ]);
        assert_eq!(plays.artist.as_deref(), Some("Muse"));
        assert!(plays.album.is_none());
        assert_eq!(plays.duration, 3723);
    }

    #[test]
    fn subtitle_parts_yield_year_and_track_count() {
        let parts = vec![
            "Album".to_string(),
            "Muse".to_string(),
            "2003".to_string(),
            "14 songs".to_string(),
        ];
        assert_eq!(primary(&parts).as_deref(), Some("Muse"));
        assert_eq!(year_from(&parts), Some(2003));
        assert_eq!(count_from(&parts), Some(14));
        assert_eq!(count_from(&["1,204 tracks".to_string()]), Some(1204));
    }

    #[test]
    fn durations_reject_labels_that_are_not_clock_times() {
        assert_eq!(seconds_from_label("3:47"), Some(227));
        assert_eq!(seconds_from_label(" 1:02:03 "), Some(3723));
        assert!(seconds_from_label("227").is_none());
        assert!(seconds_from_label("live").is_none());
    }

    #[test]
    fn title_cleanup_removes_channel_prefix_and_video_markers() {
        assert_eq!(
            clean_title("Muse - Hysteria (Official Video)", "Muse"),
            "Hysteria"
        );
        assert_eq!(clean_title("Hysteria [Lyrics]", "Muse"), "Hysteria");
    }
}
