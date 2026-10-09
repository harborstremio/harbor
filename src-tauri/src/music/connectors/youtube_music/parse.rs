use super::fields::seconds_from_label;
use serde_json::Value;

pub fn nav<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut cursor = value;
    for step in path {
        cursor = match cursor {
            Value::Array(items) => items.get(step.parse::<usize>().ok()?)?,
            _ => cursor.get(step)?,
        };
    }
    Some(cursor)
}

pub fn text(value: &Value) -> Option<String> {
    if let Some(simple) = value.get("simpleText").and_then(Value::as_str) {
        return non_empty(simple);
    }
    let joined = value
        .get("runs")?
        .as_array()?
        .iter()
        .filter_map(|run| run.get("text").and_then(Value::as_str))
        .collect::<String>();
    non_empty(&joined)
}

pub fn collect<'a>(value: &'a Value, key: &str, out: &mut Vec<&'a Value>) {
    match value {
        Value::Object(entries) => {
            for (name, child) in entries {
                if name == key {
                    out.push(child);
                } else {
                    collect(child, key, out);
                }
            }
        }
        Value::Array(items) => {
            for item in items {
                collect(item, key, out);
            }
        }
        _ => {}
    }
}

pub fn runs(value: &Value) -> Vec<String> {
    value
        .get("runs")
        .and_then(Value::as_array)
        .map(|runs| {
            runs.iter()
                .filter_map(|run| run.get("text").and_then(Value::as_str))
                .map(str::trim)
                .filter(|part| !part.is_empty() && *part != "\u{2022}" && *part != "&")
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

pub fn flex_columns(value: &Value) -> Vec<&Value> {
    value
        .get("flexColumns")
        .and_then(Value::as_array)
        .map(|columns| {
            columns
                .iter()
                .filter_map(|column| column.get("musicResponsiveListItemFlexColumnRenderer"))
                .filter_map(|column| column.get("text"))
                .collect()
        })
        .unwrap_or_default()
}

pub fn fixed_duration(value: &Value) -> Option<u64> {
    value
        .get("fixedColumns")
        .and_then(Value::as_array)?
        .iter()
        .filter_map(|column| column.get("musicResponsiveListItemFixedColumnRenderer"))
        .filter_map(|column| column.get("text"))
        .filter_map(text)
        .find_map(|label| seconds_from_label(&label))
}

pub fn video_id_of(value: &Value) -> Option<String> {
    for path in [
        &["playlistItemData", "videoId"][..],
        &[
            "overlay",
            "musicItemThumbnailOverlayRenderer",
            "content",
            "musicPlayButtonRenderer",
            "playNavigationEndpoint",
            "watchEndpoint",
            "videoId",
        ][..],
        &[
            "flexColumns",
            "0",
            "musicResponsiveListItemFlexColumnRenderer",
            "text",
            "runs",
            "0",
            "navigationEndpoint",
            "watchEndpoint",
            "videoId",
        ][..],
    ] {
        if let Some(found) = nav(value, path).and_then(Value::as_str).and_then(non_empty) {
            return Some(found);
        }
    }
    None
}

pub fn browse_id_of(value: &Value) -> Option<String> {
    for path in [
        &["navigationEndpoint", "browseEndpoint", "browseId"][..],
        &[
            "title",
            "runs",
            "0",
            "navigationEndpoint",
            "browseEndpoint",
            "browseId",
        ][..],
        &[
            "flexColumns",
            "0",
            "musicResponsiveListItemFlexColumnRenderer",
            "text",
            "runs",
            "0",
            "navigationEndpoint",
            "browseEndpoint",
            "browseId",
        ][..],
    ] {
        if let Some(found) = nav(value, path).and_then(Value::as_str).and_then(non_empty) {
            return Some(found);
        }
    }
    None
}

pub fn kind_of(value: &Value, id: &str) -> &'static str {
    let page = nav(
        value,
        &[
            "navigationEndpoint",
            "browseEndpoint",
            "browseEndpointContextSupportedConfigs",
            "browseEndpointContextMusicConfig",
            "pageType",
        ],
    )
    .and_then(Value::as_str)
    .unwrap_or_default();
    match page {
        "MUSIC_PAGE_TYPE_ALBUM" => "album",
        "MUSIC_PAGE_TYPE_ARTIST" | "MUSIC_PAGE_TYPE_USER_CHANNEL" => "artist",
        "MUSIC_PAGE_TYPE_PLAYLIST" => "playlist",
        _ if id.starts_with("MPRE") => "album",
        _ if id.starts_with("UC") => "artist",
        _ => "playlist",
    }
}

pub fn artwork_of(value: &Value) -> Option<String> {
    for path in [
        &[
            "thumbnail",
            "musicThumbnailRenderer",
            "thumbnail",
            "thumbnails",
        ][..],
        &[
            "thumbnailRenderer",
            "musicThumbnailRenderer",
            "thumbnail",
            "thumbnails",
        ][..],
        &["thumbnail", "thumbnails"][..],
    ] {
        if let Some(found) = nav(value, path).and_then(largest) {
            return Some(found);
        }
    }
    None
}

fn largest(value: &Value) -> Option<String> {
    value
        .as_array()?
        .iter()
        .max_by_key(|thumbnail| {
            thumbnail.get("width").and_then(Value::as_u64).unwrap_or(0)
                * thumbnail.get("height").and_then(Value::as_u64).unwrap_or(0)
        })
        .and_then(|thumbnail| thumbnail.get("url").and_then(Value::as_str))
        .and_then(non_empty)
}

fn non_empty(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn nav_walks_objects_and_array_indexes() {
        let value = json!({"a": {"b": [{"c": "found"}, {"c": "second"}]}});
        assert_eq!(
            nav(&value, &["a", "b", "1", "c"]).and_then(Value::as_str),
            Some("second")
        );
        assert!(nav(&value, &["a", "b", "9", "c"]).is_none());
        assert!(nav(&value, &["a", "missing"]).is_none());
    }

    #[test]
    fn text_reads_runs_and_simple_text() {
        assert_eq!(
            text(&json!({"runs": [{"text": "Hys"}, {"text": "teria"}]})),
            Some("Hysteria".to_string())
        );
        assert_eq!(
            text(&json!({"simpleText": " Muse "})),
            Some("Muse".to_string())
        );
        assert!(text(&json!({"runs": []})).is_none());
    }

    #[test]
    fn collect_finds_every_renderer_at_any_depth() {
        let value = json!({
            "contents": [
                {"shelf": {"contents": [{"row": {"id": 1}}, {"row": {"id": 2}}]}},
                {"other": {"row": {"id": 3}}}
            ]
        });
        let mut found = Vec::new();
        collect(&value, "row", &mut found);
        assert_eq!(found.len(), 3);
    }

    #[test]
    fn runs_drop_separators_and_blanks() {
        let value = json!({"runs": [
            {"text": "Muse"}, {"text": " \u{2022} "}, {"text": "Absolution"}, {"text": ""}
        ]});
        assert_eq!(runs(&value), vec!["Muse", "Absolution"]);
    }

    #[test]
    fn artwork_picks_the_largest_thumbnail() {
        let value = json!({"thumbnail": {"musicThumbnailRenderer": {"thumbnail": {"thumbnails": [
            {"url": "small.jpg", "width": 60, "height": 60},
            {"url": "large.jpg", "width": 544, "height": 544}
        ]}}}});
        assert_eq!(artwork_of(&value).as_deref(), Some("large.jpg"));
        assert!(artwork_of(&json!({})).is_none());
    }

    #[test]
    fn page_type_wins_over_the_browse_id_prefix() {
        let value = json!({"navigationEndpoint": {"browseEndpoint": {
            "browseId": "VLPL123",
            "browseEndpointContextSupportedConfigs": {
                "browseEndpointContextMusicConfig": {"pageType": "MUSIC_PAGE_TYPE_ALBUM"}
            }
        }}});
        assert_eq!(kind_of(&value, "VLPL123"), "album");
        assert_eq!(kind_of(&json!({}), "MPREb_one"), "album");
        assert_eq!(kind_of(&json!({}), "UCone"), "artist");
        assert_eq!(kind_of(&json!({}), "VLPL123"), "playlist");
    }
}
