use super::super::super::{MusicCatalogItem, MusicCatalogRow, MusicRowLayout};
use super::parse::{ApiSelection, SYSTEM_PLAYLIST_PREFIX};
use super::{fetch, parse};
use std::time::Duration;

const SOURCE: &str = "soundcloud";
const SELECTION_PREFIX: &str = "soundcloud:selections:";
const TRENDING_BUDGET: Duration = Duration::from_secs(3);
const TRENDING_ROW: &str = "soundcloud:home:trending";
const TRENDING_TRACKS: usize = 18;
const SELECTIONS: usize = 6;
const PLAYLISTS_PER_ROW: usize = 12;

pub async fn home() -> Result<Vec<MusicCatalogRow>, String> {
    let selections = fetch::selections().await?;
    let mut rows = Vec::new();
    if let Ok(Some(row)) = tokio::time::timeout(TRENDING_BUDGET, trending(&selections)).await {
        rows.push(row);
    }
    for selection in selections.iter().take(SELECTIONS) {
        if let Some(row) = selection_row(selection) {
            rows.push(row);
        }
    }
    if rows.is_empty() {
        return Err("SoundCloud did not return anything to browse".to_string());
    }
    Ok(rows)
}

async fn trending(selections: &[ApiSelection]) -> Option<MusicCatalogRow> {
    let urn = trending_urn(selections)?;
    let playlist = fetch::playlist_by_id(&urn).await.ok()?;
    let title = playlist
        .title
        .as_deref()
        .map(str::trim)
        .filter(|title| !title.is_empty())
        .map(str::to_string)?;
    let tracks = fetch::hydrate(playlist.tracks.unwrap_or_default(), TRENDING_TRACKS)
        .await
        .ok()?;
    if tracks.is_empty() {
        return None;
    }
    Some(MusicCatalogRow {
        id: TRENDING_ROW.to_string(),
        title,
        title_literal: true,
        subtitle: None,
        layout: MusicRowLayout::TrackGrid,
        source: SOURCE.to_string(),
        items: tracks.into_iter().map(MusicCatalogItem::Track).collect(),
    })
}

fn trending_urn(selections: &[ApiSelection]) -> Option<String> {
    let preferred = selections.iter().filter(|selection| {
        selection
            .urn
            .as_deref()
            .unwrap_or_default()
            .contains("trending")
    });
    preferred
        .chain(selections.iter())
        .filter_map(|selection| selection.items.as_ref())
        .flat_map(|items| items.collection.iter())
        .filter_map(|playlist| playlist.urn.as_deref())
        .find(|urn| urn.starts_with(SYSTEM_PLAYLIST_PREFIX))
        .map(str::to_string)
}

fn selection_row(selection: &ApiSelection) -> Option<MusicCatalogRow> {
    let urn = selection.urn.as_deref()?;
    let title = selection
        .title
        .as_deref()
        .map(str::trim)
        .filter(|title| !title.is_empty())?;
    let items = selection
        .items
        .as_ref()?
        .collection
        .iter()
        .filter_map(parse::to_playlist_ref)
        .take(PLAYLISTS_PER_ROW)
        .map(MusicCatalogItem::Playlist)
        .collect::<Vec<_>>();
    if items.is_empty() {
        return None;
    }
    Some(MusicCatalogRow {
        id: format!("soundcloud:selection:{}", slug(urn)),
        title: title.to_string(),
        title_literal: true,
        subtitle: selection
            .description
            .as_deref()
            .map(str::trim)
            .filter(|description| !description.is_empty())
            .map(str::to_string),
        layout: MusicRowLayout::Covers,
        source: SOURCE.to_string(),
        items,
    })
}

fn slug(urn: &str) -> String {
    urn.strip_prefix(SELECTION_PREFIX)
        .unwrap_or(urn)
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const SELECTIONS_BODY: &str = r#"{
        "collection": [
            {
                "urn": "soundcloud:selections:charts-top",
                "title": "  Charts: Top 50  ",
                "description": "  The most played tracks this week  ",
                "items": { "collection": [
                    { "id": 1, "title": "Top 50 All", "artwork_url": "https://i1.sndcdn.com/a-large.jpg", "track_count": 50 },
                    { "id": 2, "title": "   ", "artwork_url": "https://i1.sndcdn.com/b-large.jpg" }
                ] }
            },
            {
                "urn": "soundcloud:selections:trending-by-genre-playlists",
                "title": "Trending",
                "items": { "collection": [
                    { "urn": "soundcloud:system-playlists:trending-by-genre:trap", "title": "Trap" }
                ] }
            },
            {
                "urn": "soundcloud:selections:empty",
                "title": "Nothing here",
                "items": { "collection": [] }
            }
        ]
    }"#;

    fn selections() -> Vec<ApiSelection> {
        serde_json::from_str::<parse::ApiCollection<ApiSelection>>(SELECTIONS_BODY)
            .expect("selections fixture")
            .collection
    }

    #[test]
    fn selections_become_playlist_rows() {
        let selections = selections();
        let row = selection_row(&selections[0]).expect("charts row");
        assert_eq!(row.id, "soundcloud:selection:charts-top");
        assert_eq!(row.title, "Charts: Top 50");
        assert!(row.title_literal);
        assert_eq!(
            row.subtitle.as_deref(),
            Some("The most played tracks this week")
        );
        assert_eq!(row.layout, MusicRowLayout::Covers);
        assert_eq!(row.source, "soundcloud");
        assert_eq!(row.items.len(), 1);
        let MusicCatalogItem::Playlist(playlist) = &row.items[0] else {
            panic!("playlist item");
        };
        assert_eq!(playlist.id, "1");
        assert_eq!(playlist.connector_id, "soundcloud");
    }

    #[test]
    fn a_selection_without_usable_items_produces_no_row() {
        let selections = selections();
        assert!(selection_row(&selections[2]).is_none());
    }

    #[test]
    fn the_trending_selection_supplies_the_system_playlist_urn() {
        assert_eq!(
            trending_urn(&selections()).as_deref(),
            Some("soundcloud:system-playlists:trending-by-genre:trap")
        );
        assert_eq!(trending_urn(&[]), None);
    }

    #[test]
    fn row_ids_are_namespaced_and_slugged() {
        assert_eq!(
            slug("soundcloud:selections:trending-by-genre-playlists"),
            "trending-by-genre-playlists"
        );
        assert_eq!(slug("soundcloud:selections:Charts Top"), "charts-top");
    }
}
