use super::super::super::MusicTrack;
use super::client;
use super::parse::{
    self, ApiCollection, ApiPlaylist, ApiSelection, ApiTrack, ApiUser, SYSTEM_PLAYLIST_PREFIX,
};
use serde::de::DeserializeOwned;
use std::collections::HashMap;

const HYDRATE_CHUNK: usize = 50;
const PAGE_LIMIT: usize = 50;

pub async fn search_tracks(query: &str, limit: usize) -> Result<Vec<ApiTrack>, String> {
    collection("/search/tracks", query, limit).await
}

pub async fn search_users(query: &str, limit: usize) -> Result<Vec<ApiUser>, String> {
    collection("/search/users", query, limit).await
}

pub async fn search_playlists(query: &str, limit: usize) -> Result<Vec<ApiPlaylist>, String> {
    collection("/search/playlists", query, limit).await
}

pub async fn selections() -> Result<Vec<ApiSelection>, String> {
    let parsed = object::<ApiCollection<ApiSelection>>("/mixed-selections", &[]).await?;
    Ok(parsed.collection)
}

pub async fn user_tracks(user: u64, limit: usize) -> Result<Vec<ApiTrack>, String> {
    let parsed = object::<ApiCollection<ApiTrack>>(
        &format!("/users/{user}/tracks"),
        &[
            ("limit", page_size(limit).to_string()),
            ("linked_partitioning", "1".to_string()),
        ],
    )
    .await?;
    Ok(parsed.collection)
}

pub async fn tracks_by_ids(ids: &[u64]) -> Result<Vec<ApiTrack>, String> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let joined = ids.iter().map(u64::to_string).collect::<Vec<_>>().join(",");
    object("/tracks", &[("ids", joined)]).await
}

pub async fn playlist_by_id(id: &str) -> Result<ApiPlaylist, String> {
    if let Some(urn) = system_playlist_urn(id) {
        return object(&format!("/system-playlists/{urn}"), &[]).await;
    }
    let numeric =
        parse::numeric_id(id).ok_or_else(|| "SoundCloud playlist id is invalid".to_string())?;
    object(&format!("/playlists/{numeric}"), &[]).await
}

pub async fn track_for(track: &MusicTrack) -> Result<ApiTrack, String> {
    let source = track.source_id.as_deref().unwrap_or(track.id.as_str());
    if let Some(id) = stable_track_id(&track.id, source) {
        let mut found = tracks_by_ids(&[id]).await?;
        if found.is_empty() {
            return Err("SoundCloud could not find this track".to_string());
        }
        return Ok(found.remove(0));
    }
    let permalink = client::safe_permalink(source)?;
    object("/resolve", &[("url", permalink)]).await
}

fn stable_track_id(track_id: &str, source: &str) -> Option<u64> {
    // Uploaders can rename a track's permalink while its numeric identity remains
    // playable. Saved songs must not depend on that old display URL still existing.
    track_id
        .strip_prefix("soundcloud:")
        .unwrap_or(track_id)
        .parse::<u64>()
        .ok()
        .or_else(|| parse::numeric_id(source))
}

pub async fn hydrate(tracks: Vec<ApiTrack>, limit: usize) -> Result<Vec<MusicTrack>, String> {
    let tracks = tracks.into_iter().take(limit).collect::<Vec<_>>();
    let shallow = tracks
        .iter()
        .filter(|track| track.title.is_none() || track.media.is_none())
        .filter_map(|track| track.id)
        .collect::<Vec<_>>();
    if shallow.is_empty() {
        return Ok(parse::to_music_tracks(&tracks));
    }
    let mut fetched = Vec::new();
    for chunk in shallow.chunks(HYDRATE_CHUNK) {
        fetched.extend(tracks_by_ids(chunk).await?);
    }
    let by_id = fetched
        .iter()
        .filter_map(|track| track.id.map(|id| (id, track)))
        .collect::<HashMap<_, _>>();
    Ok(tracks
        .iter()
        .map(|track| {
            track
                .id
                .and_then(|id| by_id.get(&id).copied())
                .unwrap_or(track)
        })
        .filter(|track| parse::playable(track))
        .filter_map(parse::to_music_track)
        .collect())
}

pub fn system_playlist_urn(id: &str) -> Option<String> {
    let trimmed = id.trim();
    if !trimmed.starts_with(SYSTEM_PLAYLIST_PREFIX) {
        return None;
    }
    let safe = trimmed.chars().all(|character| {
        character.is_ascii_alphanumeric()
            || character == ':'
            || character == '-'
            || character == '_'
    });
    if !safe {
        return None;
    }
    Some(trimmed.to_string())
}

async fn collection<T: DeserializeOwned>(
    path: &str,
    query: &str,
    limit: usize,
) -> Result<Vec<T>, String> {
    let parsed = object::<ApiCollection<T>>(
        path,
        &[
            ("q", query.trim().to_string()),
            ("limit", page_size(limit).to_string()),
            ("offset", "0".to_string()),
            ("linked_partitioning", "1".to_string()),
        ],
    )
    .await?;
    Ok(parsed.collection)
}

async fn object<T: DeserializeOwned>(path: &str, params: &[(&str, String)]) -> Result<T, String> {
    let value = client::get(path, params).await?;
    serde_json::from_value::<T>(value)
        .map_err(|error| format!("SoundCloud response was invalid: {error}"))
}

fn page_size(limit: usize) -> usize {
    limit.clamp(1, PAGE_LIMIT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_saved_track_uses_its_stable_id_after_the_permalink_changes() {
        assert_eq!(
            stable_track_id(
                "soundcloud:2321190041",
                "https://soundcloud.com/uploader/old-name"
            ),
            Some(2321190041)
        );
        assert_eq!(
            stable_track_id("soundcloud:2321190041", "soundcloud:123"),
            Some(2321190041)
        );
        assert_eq!(stable_track_id("imported", "soundcloud:123"), Some(123));
        assert_eq!(
            stable_track_id("deezer:track:123", "https://soundcloud.com/uploader/song"),
            None
        );
    }

    #[test]
    fn system_playlist_urns_are_accepted_and_path_escapes_are_not() {
        assert_eq!(
            system_playlist_urn("soundcloud:system-playlists:trending-by-genre:trap").as_deref(),
            Some("soundcloud:system-playlists:trending-by-genre:trap")
        );
        assert_eq!(
            system_playlist_urn("soundcloud:system-playlists:../../me"),
            None
        );
        assert_eq!(system_playlist_urn("soundcloud:system-playlists:a b"), None);
        assert_eq!(system_playlist_urn("998"), None);
    }

    #[test]
    fn page_sizes_stay_inside_the_api_window() {
        assert_eq!(page_size(0), 1);
        assert_eq!(page_size(20), 20);
        assert_eq!(page_size(500), 50);
    }
}
