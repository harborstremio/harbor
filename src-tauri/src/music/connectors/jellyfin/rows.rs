use super::browse;
use super::config::JellyfinConfig;
use super::items::{self, Item};
use crate::music::{MusicCatalogItem, MusicCatalogRow, MusicRowLayout};

const SEED_FALLBACK: usize = 8;

pub async fn home(
    config: &JellyfinConfig,
    library: Option<&str>,
) -> Result<Vec<MusicCatalogRow>, String> {
    let (albums, lists, favourites, artists) = tokio::join!(
        browse::recent_albums(config, library),
        browse::playlists(config),
        browse::favourite_tracks(config, library),
        browse::favourite_artists(config, library)
    );
    let albums = albums?;
    let origin = config.origin.as_str();
    let named = !config.server_name.is_empty();
    let subtitle = named.then(|| config.server_name.clone());

    let mut seeds = artists.unwrap_or_default();
    if seeds.is_empty() {
        seeds = albums.iter().take(SEED_FALLBACK).cloned().collect();
    }
    let covers = albums
        .iter()
        .filter_map(|item| items::album(origin, item))
        .map(MusicCatalogItem::Album)
        .collect::<Vec<_>>();
    let stations = seeds
        .iter()
        .filter_map(|item| items::station(origin, item))
        .map(MusicCatalogItem::Station)
        .collect::<Vec<_>>();
    let shelves = collect(origin, lists.unwrap_or_default());
    let loved = favourites
        .unwrap_or_default()
        .iter()
        .filter_map(|item| items::track(origin, item))
        .map(MusicCatalogItem::Track)
        .collect::<Vec<_>>();

    let mut built = Vec::new();
    push(
        &mut built,
        "jellyfin:home:recent",
        "music.row.server",
        subtitle.clone(),
        MusicRowLayout::Covers,
        covers,
    );
    push(
        &mut built,
        "jellyfin:home:stations",
        "music.row.stations",
        subtitle.clone(),
        MusicRowLayout::Covers,
        stations,
    );
    push(
        &mut built,
        "jellyfin:home:playlists",
        "music.row.playlists",
        subtitle.clone(),
        MusicRowLayout::Covers,
        shelves,
    );
    push(
        &mut built,
        "jellyfin:home:favourites",
        "music.row.liked",
        subtitle,
        MusicRowLayout::TrackGrid,
        loved,
    );
    Ok(built)
}

fn collect(origin: &str, found: Vec<Item>) -> Vec<MusicCatalogItem> {
    found
        .iter()
        .filter_map(|item| items::playlist(origin, item))
        .map(MusicCatalogItem::Playlist)
        .collect()
}

fn push(
    rows: &mut Vec<MusicCatalogRow>,
    id: &str,
    title: &str,
    subtitle: Option<String>,
    layout: MusicRowLayout,
    items: Vec<MusicCatalogItem>,
) {
    if items.is_empty() {
        return;
    }
    rows.push(MusicCatalogRow {
        id: id.to_string(),
        title: title.to_string(),
        title_literal: false,
        subtitle,
        layout,
        source: items::CONNECTOR.to_string(),
        items,
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::music::MusicArtistRef;

    fn artist(name: &str) -> MusicCatalogItem {
        MusicCatalogItem::Artist(MusicArtistRef {
            id: "r1".to_string(),
            connector_id: "jellyfin".to_string(),
            name: name.to_string(),
            artwork: None,
            subtitle: None,
        })
    }

    #[test]
    fn rows_are_namespaced_credited_and_dropped_when_they_would_be_empty() {
        let mut rows = Vec::new();
        push(
            &mut rows,
            "jellyfin:home:recent",
            "music.row.server",
            Some("Basement".to_string()),
            MusicRowLayout::Covers,
            vec![artist("Muse")],
        );
        push(
            &mut rows,
            "jellyfin:home:playlists",
            "music.row.playlists",
            None,
            MusicRowLayout::Covers,
            Vec::new(),
        );
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].id, "jellyfin:home:recent");
        assert_eq!(rows[0].source, "jellyfin");
        assert!(!rows[0].title_literal);
        assert_eq!(rows[0].subtitle.as_deref(), Some("Basement"));
        assert_eq!(rows[0].layout, MusicRowLayout::Covers);
    }

    #[test]
    fn playlist_shelves_drop_the_entries_the_server_could_not_name() {
        let page = r#"{"Items":[{"Id":"p1","Name":"Late night"},{"Id":"p2","Name":"  "}]}"#;
        let found = serde_json::from_str::<items::ItemPage>(page);
        let shelves = collect("https://media.example.test", found.expect("page").items);
        assert_eq!(shelves.len(), 1);
    }
}
