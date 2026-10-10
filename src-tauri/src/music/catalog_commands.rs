use super::connector::MusicConnector;
use super::rows;
use super::{
    MusicAlbumRef, MusicArtistRef, MusicCatalogItem, MusicCatalogKind, MusicCatalogPage,
    MusicCatalogRow, MusicConnection, MusicPlaylistRef, MusicSearchResults, MusicStationRef,
};
use super::{MusicState, MusicTrack, MusicVideoStream};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

const BROWSE_TIMEOUT: Duration = Duration::from_secs(12);

#[tauri::command]
pub async fn music_home_rows(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    refresh: bool,
) -> Result<Vec<MusicCatalogRow>, String> {
    if !refresh {
        let cached = rows::cached(&state.db, None)?;
        if !cached.is_empty() {
            return Ok(cached);
        }
    }
    let results = state.registry.browse_home(&app, BROWSE_TIMEOUT, None).await;
    let ordered = rows::order_rows(results);
    if !ordered.is_empty() {
        rows::store(&state.db, &ordered)?;
    }
    Ok(ordered)
}

#[tauri::command]
pub async fn music_browse_connector(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    connector: String,
) -> Result<Vec<MusicCatalogRow>, String> {
    let target = pick(state.inner(), &connector)?;
    if !target.browsable() {
        return Err(target.unsupported("browsing"));
    }
    let results = state
        .registry
        .browse_home(&app, BROWSE_TIMEOUT, Some(&connector))
        .await;
    let mut errors = Vec::new();
    for (id, result) in &results {
        if let Err(error) = result {
            errors.push(format!("{id}: {error}"));
        }
    }
    let ordered = rows::order_rows(results);
    if ordered.is_empty() && !errors.is_empty() {
        return Err(errors.join("; "));
    }
    if !ordered.is_empty() {
        rows::store(&state.db, &ordered)?;
    }
    Ok(ordered)
}

#[tauri::command]
pub async fn music_album_tracks(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    album: MusicAlbumRef,
) -> Result<Vec<MusicTrack>, String> {
    let connector = pick(state.inner(), &album.connector_id)?;
    let tracks = connector.album_tracks(&app, &album).await?;
    remember(state.inner(), tracks)
}

#[tauri::command]
pub async fn music_artist_rows(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    artist: MusicArtistRef,
) -> Result<Vec<MusicCatalogRow>, String> {
    let connector = pick(state.inner(), &artist.connector_id)?;
    tokio::time::timeout(BROWSE_TIMEOUT, connector.artist_rows(&app, &artist))
        .await
        .map_err(|_| "Artist discovery timed out".to_string())?
}

#[tauri::command]
pub async fn music_artist_top(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    artist: MusicArtistRef,
) -> Result<Vec<MusicTrack>, String> {
    let connector = pick(state.inner(), &artist.connector_id)?;
    let tracks = connector.artist_top(&app, &artist).await?;
    remember(state.inner(), tracks)
}

#[tauri::command]
pub async fn music_artist_catalog(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    artist: MusicArtistRef,
    kind: MusicCatalogKind,
    cursor: Option<String>,
) -> Result<MusicCatalogPage, String> {
    if cursor.as_ref().is_some_and(|value| value.len() > 32_768) {
        return Err("Artist catalog cursor is too large".into());
    }
    let connector = pick(state.inner(), &artist.connector_id)?;
    // Some providers first return an artist page with a link to its full collection.
    let page = tokio::time::timeout(
        Duration::from_secs(25),
        connector.artist_catalog(&app, &artist, kind, cursor.as_deref()),
    )
    .await
    .map_err(|_| "Artist catalog timed out".to_string())??;
    for item in &page.items {
        if let MusicCatalogItem::Track(track) = item {
            state.db.upsert_track(track)?;
        }
    }
    Ok(page)
}

#[tauri::command]
pub async fn music_catalog_playlist_tracks(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    playlist: MusicPlaylistRef,
) -> Result<Vec<MusicTrack>, String> {
    let connector = pick(state.inner(), &playlist.connector_id)?;
    let tracks = connector.playlist_tracks(&app, &playlist).await?;
    remember(state.inner(), tracks)
}

#[tauri::command]
pub async fn music_station_tracks(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    station: MusicStationRef,
) -> Result<Vec<MusicTrack>, String> {
    let connector = pick(state.inner(), &station.connector_id)?;
    let tracks = connector.station_tracks(&app, &station).await?;
    remember(state.inner(), tracks)
}

#[tauri::command]
pub async fn music_search_typed(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    query: String,
    limit: usize,
    connector: Option<String>,
) -> Result<MusicSearchResults, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(MusicSearchResults::default());
    }
    if query.len() > 200 {
        return Err("Music search is too long".to_string());
    }
    let limit = limit.clamp(1, 40);
    let results = state
        .registry
        .search_typed(&app, query, limit, connector.as_deref())
        .await?;
    for track in &results.tracks {
        state.db.upsert_track(track)?;
    }
    Ok(results)
}

/// Exact video identities from YouTube Music's video-only search; no song rematching.
#[tauri::command]
pub async fn music_search_videos(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    query: String,
    limit: usize,
    interviews: Option<bool>,
) -> Result<Vec<MusicTrack>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    if query.len() > 200 {
        return Err("Music search is too long".to_string());
    }
    let connector = pick(state.inner(), "youtube")?;
    tokio::time::timeout(
        if interviews.unwrap_or(false) { Duration::from_secs(28) } else { BROWSE_TIMEOUT },
        connector.search_videos(&app, query, limit.clamp(1, 48), interviews.unwrap_or(false)),
    )
    .await
    .map_err(|_| "Music video search timed out".to_string())?
}

/// One page of exact provider video identities and its continuation.
#[tauri::command]
pub async fn music_search_video_page(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    query: String,
    regular: bool,
    cursor: Option<String>,
) -> Result<super::MusicVideoPage, String> {
    let query = query.trim();
    if query.is_empty() || query.len() > 200 { return Err("Invalid music video search".into()); }
    tokio::time::timeout(
        Duration::from_secs(35),
        pick(state.inner(), "youtube")?.search_video_page(&app, query, regular, cursor.as_deref()),
    ).await.map_err(|_| "Music video search timed out".to_string())?
}

/// The music video for a track, when its source has one. Playback itself runs through the
/// ordinary video player so the music pane inherits embedding, hardware decoding and geometry.
#[tauri::command]
pub async fn music_video_stream(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    track: MusicTrack,
) -> Result<MusicVideoStream, String> {
    let connector = track
        .connector_id
        .as_deref()
        .ok_or_else(|| "This track has no source to ask for a video".to_string())?;
    pick(state.inner(), connector)?
        .resolve_video(&app, &track)
        .await
}

#[tauri::command]
pub fn music_connections(state: tauri::State<'_, MusicState>) -> Vec<MusicConnection> {
    state.registry.connections()
}

#[tauri::command]
pub async fn music_connect(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    id: String,
    fields: HashMap<String, String>,
) -> Result<MusicConnection, String> {
    pick(state.inner(), &id)?.connect(&app, &fields).await
}

#[tauri::command]
pub async fn music_disconnect(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    id: String,
) -> Result<(), String> {
    pick(state.inner(), &id)?.disconnect(&app).await
}

#[tauri::command]
pub async fn music_local_scan(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    folder: String,
) -> Result<u32, String> {
    let folder = folder.trim();
    if folder.is_empty() {
        return Err("Choose a music folder to scan".to_string());
    }
    pick(state.inner(), "local")?.scan(&app, folder).await
}

fn pick(state: &MusicState, id: &str) -> Result<Arc<dyn MusicConnector>, String> {
    state
        .registry
        .get(id)
        .ok_or_else(|| format!("Unknown music connector: {id}"))
}

fn remember(state: &MusicState, tracks: Vec<MusicTrack>) -> Result<Vec<MusicTrack>, String> {
    for track in &tracks {
        state.db.upsert_track(track)?;
    }
    Ok(tracks)
}

#[tauri::command]
pub fn music_local_collection(
    state: tauri::State<'_, MusicState>,
    kind: String,
    query: String,
    offset: usize,
    limit: usize,
    artist_key: Option<String>,
) -> Result<super::connectors::local::LocalMusicPage, String> {
    super::connectors::local::collection_page(
        &state.db,
        &kind,
        &query,
        offset,
        limit,
        artist_key.as_deref(),
    )
}
