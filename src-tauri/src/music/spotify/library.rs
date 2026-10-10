use std::collections::HashMap;
use super::super::{MusicPlaylistRef, MusicState, MusicTrack};
use super::{api, keystore, parse, SpotifyState};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const PAGE_SIZE: usize = 50;
const MAX_OFFSET: usize = 100_000;
const PRIVATE_SCOPE: &str = "playlist-modify-private";
const PUBLIC_SCOPE: &str = "playlist-modify-public";
const WRITE_PERMISSION: &str =
    "Spotify playlist permission is missing. Reconnect Spotify to allow playlist changes.";

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SpotifyLibraryKind {
    Liked,
    Playlists,
    Playlist,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyLibraryPlaylist {
    #[serde(flatten)]
    playlist: MusicPlaylistRef,
    can_read: bool,
    editable: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyLibraryPage {
    tracks: Vec<MusicTrack>,
    track_added_at: HashMap<String, String>,
    playlists: Vec<SpotifyLibraryPlaylist>,
    next_offset: Option<usize>,
    total: Option<u64>,
    skipped: usize,
    can_create: bool,
    write_permission: bool,
}

fn scopes(state: &SpotifyState) -> Vec<String> {
    state
        .web_token
        .read()
        .clone()
        .or_else(|| state.app.read().as_ref().and_then(keystore::web_token))
        .map(|token| token.scopes)
        .unwrap_or_default()
}

fn has_scope(scopes: &[String], required: &str) -> bool {
    scopes.iter().any(|scope| scope == required)
}

fn can_add(scopes: &[String], public: Option<bool>) -> bool {
    match public {
        Some(true) => has_scope(scopes, PUBLIC_SCOPE),
        Some(false) => has_scope(scopes, PRIVATE_SCOPE),
        None => has_scope(scopes, PUBLIC_SCOPE) && has_scope(scopes, PRIVATE_SCOPE),
    }
}

pub(super) fn spotify_id(value: &str, kind: &str) -> Result<String, String> {
    let prefix = format!("spotify:{kind}:");
    let id = value.strip_prefix(&prefix).unwrap_or(value);
    if id.len() != 22 || !id.bytes().all(|byte| byte.is_ascii_alphanumeric()) {
        return Err(format!("Spotify {kind} id is invalid"));
    }
    Ok(id.to_string())
}

fn library_track(entry: &Value) -> Option<MusicTrack> {
    let item = parse::entry(entry)?;
    let uri = item.get("uri")?.as_str()?;
    if !uri.starts_with("spotify:track:")
        || spotify_id(uri, "track").is_err()
        || item.get("is_local").and_then(Value::as_bool) == Some(true)
        || item.get("is_playable").and_then(Value::as_bool) == Some(false)
        || item
            .get("type")
            .and_then(Value::as_str)
            .is_some_and(|kind| kind != "track")
    {
        return None;
    }
    parse::track(item)
}

pub(super) fn next_offset(
    body: &Value,
    offset: usize,
    count: usize,
    paths: &[&str],
) -> Result<Option<usize>, String> {
    let invalid = || "Spotify returned invalid library pagination".to_string();
    let next = body.get("next").ok_or_else(invalid)?;
    if next.is_null() {
        return Ok(None);
    }
    let url = reqwest::Url::parse(next.as_str().ok_or_else(invalid)?).map_err(|_| invalid())?;
    if url.scheme() != "https"
        || url.host_str() != Some("api.spotify.com")
        || !paths.iter().any(|path| url.path() == format!("/v1{path}"))
    {
        return Err(invalid());
    }
    let next = url
        .query_pairs()
        .find(|(key, _)| key == "offset")
        .and_then(|(_, value)| value.parse::<usize>().ok())
        .ok_or_else(invalid)?;
    if count == 0 || next <= offset || next > MAX_OFFSET {
        return Err(invalid());
    }
    Ok(Some(next))
}

async fn profile_id(state: &SpotifyState, token: &str) -> Result<String, String> {
    api::me(state.http(), token)
        .await?
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "Spotify did not return the account id".to_string())
}

fn playlist_access(
    item: &Value,
    account_id: &str,
    scopes: &[String],
) -> Option<SpotifyLibraryPlaylist> {
    let playlist = parse::playlist(item)?;
    let owned = item.pointer("/owner/id").and_then(Value::as_str) == Some(account_id);
    let collaborative = item.get("collaborative").and_then(Value::as_bool) == Some(true);
    let can_read = owned || collaborative;
    Some(SpotifyLibraryPlaylist {
        playlist,
        can_read,
        editable: can_read && can_add(scopes, item.get("public").and_then(Value::as_bool)),
    })
}

#[tauri::command]
pub async fn music_spotify_library_page(
    state: tauri::State<'_, MusicState>,
    kind: SpotifyLibraryKind,
    offset: Option<usize>,
    playlist_id: Option<String>,
) -> Result<SpotifyLibraryPage, String> {
    let offset = offset.unwrap_or(0);
    if offset > MAX_OFFSET {
        return Err("Spotify library offset is too large".to_string());
    }
    let spotify = &state.spotify;
    let token = spotify.web_token().await?;
    let scopes = scopes(spotify);
    let mut query = vec![
        ("limit", PAGE_SIZE.to_string()),
        ("offset", offset.to_string()),
    ];
    let path = match kind {
        SpotifyLibraryKind::Liked => "/me/tracks".to_string(),
        SpotifyLibraryKind::Playlists => "/me/playlists".to_string(),
        SpotifyLibraryKind::Playlist => format!(
            "/playlists/{}/items",
            spotify_id(playlist_id.as_deref().unwrap_or_default(), "playlist")?
        ),
    };
    if !matches!(kind, SpotifyLibraryKind::Playlists) {
        query.push(("market", spotify.market()));
    }
    let body = api::get(spotify.http(), &token, &path, &query).await?;
    let entries = body
        .get("items")
        .and_then(Value::as_array)
        .ok_or_else(|| "Spotify returned an invalid library page".to_string())?;
    let next_offset = next_offset(&body, offset, entries.len(), &[&path])?;
    let mut tracks = Vec::new();
    let mut track_added_at = HashMap::new();
    let mut playlists = Vec::new();
    if matches!(kind, SpotifyLibraryKind::Playlists) {
        let account = profile_id(spotify, &token).await?;
        playlists = entries
            .iter()
            .filter_map(|entry| playlist_access(entry, &account, &scopes))
            .collect();
    } else {
        for entry in entries {
            if let Some(track) = library_track(entry) {
                if let Some(date) = entry.get("added_at").and_then(Value::as_str) {
                    track_added_at.insert(track.id.clone(), date.to_string());
                }
                tracks.push(track);
            }
        }
    }
    let skipped = entries.len().saturating_sub(tracks.len() + playlists.len());
    Ok(SpotifyLibraryPage {
        track_added_at,
        tracks,
        playlists,
        next_offset,
        total: body.get("total").and_then(Value::as_u64),
        skipped,
        can_create: has_scope(&scopes, PRIVATE_SCOPE),
        write_permission: has_scope(&scopes, PRIVATE_SCOPE) || has_scope(&scopes, PUBLIC_SCOPE),
    })
}

#[tauri::command]
pub async fn music_spotify_create_playlist(
    state: tauri::State<'_, MusicState>,
    name: String,
) -> Result<SpotifyLibraryPlaylist, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 100 {
        return Err("Playlist name must be between 1 and 100 characters".to_string());
    }
    let spotify = &state.spotify;
    let token = spotify.web_token().await?;
    let scopes = scopes(spotify);
    if !has_scope(&scopes, PRIVATE_SCOPE) {
        return Err(WRITE_PERMISSION.to_string());
    }
    let account = profile_id(spotify, &token).await?;
    let body = api::post(
        spotify.http(),
        &token,
        "/me/playlists",
        &json!({"name": name, "public": false}),
    )
    .await?;
    playlist_access(&body, &account, &scopes)
        .ok_or_else(|| "Spotify created the playlist but did not return its details. Check Spotify before trying again.".to_string())
}

#[tauri::command]
pub async fn music_spotify_add_to_playlist(
    state: tauri::State<'_, MusicState>,
    playlist_id: String,
    track_uri: String,
) -> Result<(), String> {
    let id = spotify_id(&playlist_id, "playlist")?;
    if !track_uri.starts_with("spotify:track:") {
        return Err("Only Spotify tracks can be added to a Spotify playlist".to_string());
    }
    spotify_id(&track_uri, "track")?;
    let spotify = &state.spotify;
    let token = spotify.web_token().await?;
    let scopes = scopes(spotify);
    if !has_scope(&scopes, PRIVATE_SCOPE) && !has_scope(&scopes, PUBLIC_SCOPE) {
        return Err(WRITE_PERMISSION.to_string());
    }
    let body = api::get(spotify.http(), &token, &format!("/playlists/{id}"), &[]).await?;
    let account = profile_id(spotify, &token).await?;
    let access = playlist_access(&body, &account, &scopes)
        .ok_or_else(|| "Spotify playlist is unavailable".to_string())?;
    if !access.can_read {
        return Err("Only playlists you own or collaborate on can be changed".to_string());
    }
    if !access.editable {
        return Err(WRITE_PERMISSION.to_string());
    }
    let result = api::post(
        spotify.http(),
        &token,
        &format!("/playlists/{id}/items"),
        &json!({"uris": [track_uri]}),
    )
    .await?;
    if result
        .get("snapshot_id")
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty())
        .is_none()
    {
        return Err("Spotify did not confirm the change. Check the playlist on Spotify before trying again.".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    const ID: &str = "4iV5W9uYEdYUVa79Axb7Rh";

    #[test]
    fn library_cursor_must_advance_on_the_known_spotify_endpoint() {
        let body = json!({"next":"https://api.spotify.com/v1/me/tracks?offset=50&limit=50"});
        assert_eq!(
            next_offset(&body, 0, 50, &["/me/tracks"]).unwrap(),
            Some(50)
        );
        assert!(next_offset(&body, 50, 50, &["/me/tracks"]).is_err());
        assert!(next_offset(&body, 0, 0, &["/me/tracks"]).is_err());
        assert!(next_offset(
            &json!({"next":"https://example.test/v1/me/tracks?offset=50"}),
            0,
            50,
            &["/me/tracks"]
        )
        .is_err());
        assert_eq!(
            next_offset(&json!({"next":null}), 0, 5, &["/me/tracks"]).unwrap(),
            None
        );
    }

    #[test]
    fn library_omits_local_removed_and_episode_entries() {
        let song =
            json!({"track":{"uri":format!("spotify:track:{ID}"),"name":"Song","type":"track"}});
        assert!(library_track(&song).is_some());
        assert!(library_track(&json!({"track":null})).is_none());
        assert!(library_track(
            &json!({"track":{"uri":format!("spotify:episode:{ID}"),"name":"Episode"}})
        )
        .is_none());
        assert!(library_track(
            &json!({"track":{"uri":format!("spotify:track:{ID}"),"name":"Local","is_local":true}})
        )
        .is_none());
        assert!(library_track(&json!({"track":{"uri":format!("spotify:track:{ID}"),"name":"Unavailable","is_playable":false}})).is_none());
    }

    #[test]
    fn playlist_editing_requires_ownership_and_granted_scope() {
        let item = json!({"uri":format!("spotify:playlist:{ID}"),"name":"Mine","owner":{"id":"me"},"public":false});
        assert!(!playlist_access(&item, "me", &[]).unwrap().editable);
        assert!(
            playlist_access(&item, "me", &[PRIVATE_SCOPE.to_string()])
                .unwrap()
                .editable
        );
        assert!(
            !playlist_access(&item, "someone", &[PRIVATE_SCOPE.to_string()])
                .unwrap()
                .can_read
        );
        assert!(
            !playlist_access(&item, "me", &[PUBLIC_SCOPE.to_string()])
                .unwrap()
                .editable
        );
    }

    #[test]
    fn write_ids_cannot_change_the_request_path() {
        assert_eq!(
            spotify_id(&format!("spotify:playlist:{ID}"), "playlist").unwrap(),
            ID
        );
        assert!(spotify_id("../me", "playlist").is_err());
        assert!(spotify_id(&format!("spotify:album:{ID}"), "playlist").is_err());
    }
}
