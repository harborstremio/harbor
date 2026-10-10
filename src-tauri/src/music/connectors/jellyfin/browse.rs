use super::api;
use super::config::JellyfinConfig;
use super::http;
use super::items::{self, Item, ItemPage};
use crate::music::{MusicCatalogItem, MusicSearchResults, MusicTrack};

const ALBUM_FIELDS: &str = "ChildCount,ProductionYear,DateCreated";
const TRACK_SORT: &str = "ParentIndexNumber,IndexNumber,SortName";
const SEARCH_KINDS: &str = "Audio,MusicAlbum,MusicArtist,Playlist";
const RECENT_LIMIT: usize = 24;
const PLAYLIST_LIMIT: usize = 24;
const FAVOURITE_LIMIT: usize = 18;
const STATION_LIMIT: usize = 12;
const ARTIST_TOP_LIMIT: usize = 30;
const CONTAINER_LIMIT: usize = 200;
const MIX_LIMIT: usize = 60;
const SEARCH_CEILING: usize = 60;

fn base(config: &JellyfinConfig) -> Vec<(&'static str, String)> {
    vec![
        ("userId", config.user_id.clone()),
        ("recursive", "true".to_string()),
        ("enableTotalRecordCount", "false".to_string()),
    ]
}

fn scoped(config: &JellyfinConfig, library: Option<&str>) -> Vec<(&'static str, String)> {
    let mut params = base(config);
    if let Some(library) = library {
        params.push(("parentId", library.to_string()));
    }
    params
}

async fn list(
    config: &JellyfinConfig,
    path: &str,
    params: &[(&str, String)],
) -> Result<Vec<Item>, String> {
    let value = http::get(config, path, params).await?;
    let page = serde_json::from_value::<ItemPage>(value);
    let page = page.map_err(|error| format!("Jellyfin items were unreadable: {error}"))?;
    Ok(page.items)
}

pub async fn recent_albums(
    config: &JellyfinConfig,
    library: Option<&str>,
) -> Result<Vec<Item>, String> {
    let mut params = scoped(config, library);
    params.push(("includeItemTypes", "MusicAlbum".to_string()));
    params.push(("sortBy", "DateCreated".to_string()));
    params.push(("sortOrder", "Descending".to_string()));
    params.push(("limit", RECENT_LIMIT.to_string()));
    params.push(("fields", ALBUM_FIELDS.to_string()));
    list(config, "/Items", &params).await
}

pub async fn playlists(config: &JellyfinConfig) -> Result<Vec<Item>, String> {
    let mut params = base(config);
    params.push(("includeItemTypes", "Playlist".to_string()));
    params.push(("mediaTypes", "Audio".to_string()));
    params.push(("sortBy", "SortName".to_string()));
    params.push(("limit", PLAYLIST_LIMIT.to_string()));
    params.push(("fields", "ChildCount".to_string()));
    list(config, "/Items", &params).await
}

pub async fn favourite_tracks(
    config: &JellyfinConfig,
    library: Option<&str>,
) -> Result<Vec<Item>, String> {
    let mut params = scoped(config, library);
    params.push(("includeItemTypes", "Audio".to_string()));
    params.push(("filters", "IsFavorite".to_string()));
    params.push(("sortBy", "SortName".to_string()));
    params.push(("limit", FAVOURITE_LIMIT.to_string()));
    list(config, "/Items", &params).await
}

pub async fn favourite_artists(
    config: &JellyfinConfig,
    library: Option<&str>,
) -> Result<Vec<Item>, String> {
    let mut params = scoped(config, library);
    params.push(("includeItemTypes", "MusicArtist".to_string()));
    params.push(("filters", "IsFavorite".to_string()));
    params.push(("sortBy", "SortName".to_string()));
    params.push(("limit", STATION_LIMIT.to_string()));
    list(config, "/Items", &params).await
}

pub async fn album_tracks(config: &JellyfinConfig, album: &str) -> Result<Vec<MusicTrack>, String> {
    let album = items::safe_item_id(album)?;
    let mut params = base(config);
    params.push(("parentId", album));
    params.push(("includeItemTypes", "Audio".to_string()));
    params.push(("sortBy", TRACK_SORT.to_string()));
    params.push(("sortOrder", "Ascending".to_string()));
    params.push(("limit", CONTAINER_LIMIT.to_string()));
    let found = list(config, "/Items", &params).await?;
    Ok(tracks(config, &found))
}

pub async fn artist_top(config: &JellyfinConfig, artist: &str) -> Result<Vec<MusicTrack>, String> {
    let artist = items::safe_item_id(artist)?;
    let mut params = base(config);
    params.push(("artistIds", artist));
    params.push(("includeItemTypes", "Audio".to_string()));
    params.push(("sortBy", "PlayCount".to_string()));
    params.push(("sortOrder", "Descending".to_string()));
    params.push(("limit", ARTIST_TOP_LIMIT.to_string()));
    let found = list(config, "/Items", &params).await?;
    Ok(tracks(config, &found))
}

pub async fn playlist_tracks(
    config: &JellyfinConfig,
    playlist: &str,
) -> Result<Vec<MusicTrack>, String> {
    let playlist = items::safe_item_id(playlist)?;
    let params = [
        ("userId", config.user_id.clone()),
        ("limit", CONTAINER_LIMIT.to_string()),
    ];
    let path = format!("/Playlists/{playlist}/Items");
    let found = list(config, &path, &params).await?;
    Ok(tracks(config, &found))
}

pub async fn station_tracks(
    config: &JellyfinConfig,
    station: &str,
) -> Result<Vec<MusicTrack>, String> {
    let station = items::safe_item_id(station)?;
    let params = [
        ("userId", config.user_id.clone()),
        ("limit", MIX_LIMIT.to_string()),
    ];
    let seed_path = format!("/Items/{station}");
    let mix_path = format!("/Items/{station}/InstantMix");
    let seed = http::get(config, &seed_path, &[]);
    let mix = list(config, &mix_path, &params);
    let (seed, mix) = tokio::join!(seed, mix);
    let mut mixed = tracks(config, &mix?);
    let Some(seed) = seed_track(config, seed.ok()) else {
        return Ok(mixed);
    };
    let duplicate = mixed.first().map(|first| first.id.as_str()) == Some(seed.id.as_str());
    if duplicate {
        return Ok(mixed);
    }
    mixed.retain(|track| track.id != seed.id);
    mixed.insert(0, seed);
    Ok(mixed)
}

fn seed_track(config: &JellyfinConfig, value: Option<serde_json::Value>) -> Option<MusicTrack> {
    let item = serde_json::from_value::<Item>(value?).ok()?;
    if item.kind != "Audio" {
        return None;
    }
    items::track(&config.origin, &item)
}

pub async fn search(
    config: &JellyfinConfig,
    query: &str,
    limit: usize,
    kinds: &str,
) -> Result<Vec<Item>, String> {
    let capped = limit.min(SEARCH_CEILING);
    let mut params = base(config);
    params.push(("searchTerm", query.to_string()));
    params.push(("includeItemTypes", kinds.to_string()));
    params.push(("limit", capped.to_string()));
    params.push(("fields", ALBUM_FIELDS.to_string()));
    list(config, "/Items", &params).await
}

pub async fn search_typed(
    config: &JellyfinConfig,
    query: &str,
    limit: usize,
) -> Result<MusicSearchResults, String> {
    let wide = limit.saturating_mul(3);
    let found = search(config, query, wide, SEARCH_KINDS).await?;
    let origin = config.origin.as_str();
    let mut results = MusicSearchResults {
        tracks: bucket(&found, "Audio", limit, |item| items::track(origin, item)),
        albums: bucket(&found, "MusicAlbum", limit, |item| {
            items::album(origin, item)
        }),
        artists: bucket(&found, "MusicArtist", limit, |i| items::artist(origin, i)),
        playlists: bucket(&found, "Playlist", limit, |i| items::playlist(origin, i)),
        ..MusicSearchResults::default()
    };
    let top = top_result(&results);
    results.top = top;
    Ok(results)
}

fn top_result(results: &MusicSearchResults) -> Option<MusicCatalogItem> {
    if let Some(track) = results.tracks.first() {
        return Some(MusicCatalogItem::Track(track.clone()));
    }
    if let Some(album) = results.albums.first() {
        return Some(MusicCatalogItem::Album(album.clone()));
    }
    let artist = results.artists.first()?;
    Some(MusicCatalogItem::Artist(artist.clone()))
}

fn bucket<T>(
    found: &[Item],
    kind: &str,
    limit: usize,
    build: impl Fn(&Item) -> Option<T>,
) -> Vec<T> {
    let matching = found.iter().filter(|item| item.kind == kind);
    matching.filter_map(build).take(limit).collect()
}

pub fn tracks(config: &JellyfinConfig, found: &[Item]) -> Vec<MusicTrack> {
    let origin = config.origin.as_str();
    found
        .iter()
        .filter_map(|item| items::track(origin, item))
        .collect()
}

pub async fn library_id(config: &JellyfinConfig) -> Option<String> {
    if let Some(library) = config.library_id.clone() {
        return Some(library);
    }
    api::music_library(config).await.ok().flatten()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> JellyfinConfig {
        JellyfinConfig {
            origin: "https://media.example.test".to_string(),
            user_id: "u1".to_string(),
            user_name: "josiah".to_string(),
            token: "tok".to_string(),
            device_id: "harbor-music-1".to_string(),
            server_name: "Basement".to_string(),
            library_id: Some("lib1".to_string()),
        }
    }

    fn found(body: &str) -> Vec<Item> {
        let page = serde_json::from_str::<ItemPage>(body);
        page.expect("items").items
    }

    #[test]
    fn scoped_queries_pin_the_music_library_when_one_was_resolved() {
        let params = scoped(&config(), Some("lib1"));
        assert!(params.contains(&("parentId", "lib1".to_string())));
        assert!(params.contains(&("userId", "u1".to_string())));
        assert!(params.contains(&("recursive", "true".to_string())));
        let unscoped = scoped(&config(), None);
        assert!(!unscoped.iter().any(|(key, _)| *key == "parentId"));
    }

    #[test]
    fn buckets_split_a_mixed_result_set_by_item_type() {
        let items = found(
            r#"{"Items":[
                {"Id":"a1","Name":"Hysteria","Type":"Audio","Artists":["Muse"]},
                {"Id":"a2","Name":"Uprising","Type":"Audio","Artists":["Muse"]},
                {"Id":"b1","Name":"Absolution","Type":"MusicAlbum","AlbumArtist":"Muse"},
                {"Id":"r1","Name":"Muse","Type":"MusicArtist"},
                {"Id":"p1","Name":"Late night","Type":"Playlist"}]}"#,
        );
        let origin = "https://media.example.test";
        let tracks = bucket(&items, "Audio", 1, |item| items::track(origin, item));
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].title, "Hysteria");
        let albums = bucket(&items, "MusicAlbum", 5, |i| items::album(origin, i));
        let artists = bucket(&items, "MusicArtist", 5, |i| items::artist(origin, i));
        let lists = bucket(&items, "Playlist", 5, |i| items::playlist(origin, i));
        assert_eq!(albums.len(), 1);
        assert_eq!(artists.len(), 1);
        assert_eq!(lists.len(), 1);
    }

    #[test]
    fn the_top_result_prefers_a_track_then_an_album_then_an_artist() {
        let items = found(
            r#"{"Items":[
                {"Id":"b1","Name":"Absolution","Type":"MusicAlbum","AlbumArtist":"Muse"},
                {"Id":"r1","Name":"Muse","Type":"MusicArtist"}]}"#,
        );
        let origin = "https://media.example.test";
        let results = MusicSearchResults {
            albums: bucket(&items, "MusicAlbum", 5, |i| items::album(origin, i)),
            artists: bucket(&items, "MusicArtist", 5, |i| items::artist(origin, i)),
            ..MusicSearchResults::default()
        };
        let top = top_result(&results).expect("top result");
        assert!(matches!(top, MusicCatalogItem::Album(_)));
        assert!(top_result(&MusicSearchResults::default()).is_none());
    }

    #[test]
    fn tracks_carry_the_connector_id_the_registry_dedupes_on() {
        let items =
            found(r#"{"Items":[{"Id":"a1","Name":"Hysteria","Type":"Audio","Artists":["Muse"]}]}"#);
        let built = tracks(&config(), &items);
        assert_eq!(built.len(), 1);
        assert_eq!(built[0].connector_id.as_deref(), Some("jellyfin"));
        assert_eq!(built[0].id, "jellyfin:a1");
    }

    #[test]
    fn a_seed_song_is_prepended_because_ten_eleven_stopped_returning_it() {
        let items = found(r#"{"Items":[{"Id":"a1","Name":"Hysteria","Type":"Audio"}]}"#);
        let value = serde_json::json!({"Id":"a1","Name":"Hysteria","Type":"Audio"});
        let seed = seed_track(&config(), Some(value)).expect("seed track");
        assert_eq!(seed.id, "jellyfin:a1");
        assert_eq!(items.len(), 1);

        let artist = serde_json::json!({"Id":"r1","Name":"Muse","Type":"MusicArtist"});
        assert!(seed_track(&config(), Some(artist)).is_none());
        assert!(seed_track(&config(), None).is_none());
    }
}
