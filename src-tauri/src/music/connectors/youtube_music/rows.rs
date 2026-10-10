use super::super::super::{MusicCatalogItem, MusicCatalogRow, MusicRowLayout};
use super::fields::CONNECTOR;
use super::items::{catalog_item, track_from_list_item};
use super::parse::{collect, nav, text};
use serde_json::Value;
use std::collections::HashSet;

pub fn browse_rows(
    response: &Value,
    prefix: &str,
    shelf_cap: usize,
    item_cap: usize,
) -> Vec<MusicCatalogRow> {
    let mut shelves = Vec::new();
    collect(response, "musicCarouselShelfRenderer", &mut shelves);
    collect(
        response,
        "musicImmersiveCarouselShelfRenderer",
        &mut shelves,
    );
    let mut taken = HashSet::new();
    let mut rows = Vec::new();
    for shelf in shelves {
        if rows.len() >= shelf_cap {
            break;
        }
        let Some(title) = shelf_title(shelf) else {
            continue;
        };
        let items = shelf_items(shelf, item_cap);
        if items.is_empty() {
            continue;
        }
        let id = format!("{prefix}:{}", slug(&title));
        if !taken.insert(id.clone()) {
            continue;
        }
        rows.push(MusicCatalogRow {
            id,
            title,
            title_literal: true,
            subtitle: shelf_strapline(shelf),
            layout: layout_for(&items),
            source: CONNECTOR.to_string(),
            items,
        });
    }
    rows
}

fn shelf_title(shelf: &Value) -> Option<String> {
    nav(
        shelf,
        &["header", "musicCarouselShelfBasicHeaderRenderer", "title"],
    )
    .and_then(text)
}

fn shelf_strapline(shelf: &Value) -> Option<String> {
    nav(
        shelf,
        &[
            "header",
            "musicCarouselShelfBasicHeaderRenderer",
            "strapline",
        ],
    )
    .and_then(text)
}

fn shelf_items(shelf: &Value, item_cap: usize) -> Vec<MusicCatalogItem> {
    let mut items = Vec::new();
    let entries = shelf.get("contents").and_then(Value::as_array);
    for entry in entries.into_iter().flatten() {
        if items.len() >= item_cap {
            break;
        }
        let item = entry
            .get("musicTwoRowItemRenderer")
            .and_then(catalog_item)
            .or_else(|| {
                entry
                    .get("musicResponsiveListItemRenderer")
                    .and_then(track_from_list_item)
                    .map(MusicCatalogItem::Track)
            });
        if let Some(item) = item {
            items.push(item);
        }
    }
    items
}

fn layout_for(items: &[MusicCatalogItem]) -> MusicRowLayout {
    let mut artists = 0;
    let mut tracks = 0;
    for item in items {
        match item {
            MusicCatalogItem::Artist(_) => artists += 1,
            MusicCatalogItem::Track(_) => tracks += 1,
            _ => {}
        }
    }
    if artists * 2 > items.len() {
        MusicRowLayout::Circles
    } else if tracks * 2 > items.len() {
        MusicRowLayout::TrackGrid
    } else {
        MusicRowLayout::Covers
    }
}

fn slug(value: &str) -> String {
    let mut out = String::new();
    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            out.push(character.to_ascii_lowercase());
        } else if !out.is_empty() && !out.ends_with('-') {
            out.push('-');
        }
    }
    let trimmed = out.trim_end_matches('-');
    if trimmed.is_empty() {
        "shelf".to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn two_row(title: &str, browse_id: &str, page_type: &str) -> Value {
        json!({"musicTwoRowItemRenderer": {
            "title": {"runs": [{"text": title}]},
            "subtitle": {"runs": [{"text": "Muse"}]},
            "navigationEndpoint": {"browseEndpoint": {
                "browseId": browse_id,
                "browseEndpointContextSupportedConfigs": {
                    "browseEndpointContextMusicConfig": {"pageType": page_type}
                }
            }},
            "thumbnailRenderer": {"musicThumbnailRenderer": {"thumbnail": {"thumbnails": [
                {"url": "art.jpg", "width": 226, "height": 226}
            ]}}}
        }})
    }

    fn shelf(title: &str, strapline: Option<&str>, contents: Vec<Value>) -> Value {
        let mut header = json!({"musicCarouselShelfBasicHeaderRenderer": {
            "title": {"runs": [{"text": title}]}
        }});
        if let Some(strapline) = strapline {
            header["musicCarouselShelfBasicHeaderRenderer"]["strapline"] =
                json!({"runs": [{"text": strapline}]});
        }
        json!({"musicCarouselShelfRenderer": {"header": header, "contents": contents}})
    }

    #[test]
    fn home_shelves_keep_the_provider_title_and_pick_a_layout() {
        let response = json!({"contents": {"sectionListRenderer": {"contents": [
            shelf(
                "Quick picks",
                Some("SOUNDTRACK THE SEASON"),
                vec![
                    two_row("Absolution", "MPREb_one", "MUSIC_PAGE_TYPE_ALBUM"),
                    two_row("Origin of Symmetry", "MPREb_two", "MUSIC_PAGE_TYPE_ALBUM"),
                ],
            ),
            shelf(
                "Artists you follow",
                None,
                vec![
                    two_row("Muse", "UCone", "MUSIC_PAGE_TYPE_ARTIST"),
                    two_row("Radiohead", "UCtwo", "MUSIC_PAGE_TYPE_ARTIST"),
                ],
            ),
        ]}}});
        let rows = browse_rows(&response, "ytm:home", 6, 20);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].id, "ytm:home:quick-picks");
        assert_eq!(rows[0].title, "Quick picks");
        assert!(rows[0].title_literal);
        assert_eq!(rows[0].source, "youtube");
        assert_eq!(rows[0].subtitle.as_deref(), Some("SOUNDTRACK THE SEASON"));
        assert_eq!(rows[0].layout, MusicRowLayout::Covers);
        assert_eq!(rows[1].id, "ytm:home:artists-you-follow");
        assert_eq!(rows[1].layout, MusicRowLayout::Circles);
    }

    #[test]
    fn shelf_and_item_caps_are_honored() {
        let contents = (0..30)
            .map(|index| {
                two_row(
                    &format!("Album {index}"),
                    "MPREb_one",
                    "MUSIC_PAGE_TYPE_ALBUM",
                )
            })
            .collect::<Vec<_>>();
        let sections = (0..9)
            .map(|index| shelf(&format!("Shelf {index}"), None, contents.clone()))
            .collect::<Vec<_>>();
        let response = json!({"contents": sections});
        let rows = browse_rows(&response, "ytm:home", 6, 20);
        assert_eq!(rows.len(), 6);
        assert!(rows.iter().all(|row| row.items.len() == 20));
    }

    #[test]
    fn empty_and_untitled_shelves_are_dropped() {
        let untitled = json!({"musicCarouselShelfRenderer": {"contents": [
            two_row("Absolution", "MPREb_one", "MUSIC_PAGE_TYPE_ALBUM")
        ]}});
        let response = json!({"contents": [shelf("Empty", None, Vec::new()), untitled]});
        assert!(browse_rows(&response, "ytm:home", 6, 20).is_empty());
    }

    #[test]
    fn song_shelves_render_as_a_track_grid() {
        let song = json!({"musicResponsiveListItemRenderer": {
            "playlistItemData": {"videoId": "MdVBSHOMWSY"},
            "flexColumns": [
                {"musicResponsiveListItemFlexColumnRenderer": {"text": {"runs": [{"text": "Hysteria"}]}}},
                {"musicResponsiveListItemFlexColumnRenderer": {"text": {"runs": [
                    {"text": "Muse"}, {"text": " \u{2022} "}, {"text": "3:47"}
                ]}}}
            ]
        }});
        let response = json!({"contents": [shelf("Listen again", None, vec![song])]});
        let rows = browse_rows(&response, "ytm:charts", 1, 20);
        assert_eq!(rows[0].id, "ytm:charts:listen-again");
        assert_eq!(rows[0].layout, MusicRowLayout::TrackGrid);
    }

    #[test]
    fn slugs_collapse_punctuation_and_never_come_back_empty() {
        assert_eq!(slug("Mixed for you"), "mixed-for-you");
        assert_eq!(slug("  Top 100: Global!  "), "top-100-global");
        assert_eq!(slug("!!!"), "shelf");
    }
}
