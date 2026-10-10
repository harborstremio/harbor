use crate::music::{
    duration_label, MusicAlbumRef, MusicArtistRef, MusicCatalogItem, MusicCatalogKind,
    MusicCatalogPage, MusicCatalogScope, MusicTrack,
};
use serde_json::Value;
use std::sync::LazyLock;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

static LAST_REQUEST: LazyLock<Mutex<Option<Instant>>> = LazyLock::new(|| Mutex::new(None));

async fn fetch(path: &str) -> Result<Value, String> {
    {
        let mut last = LAST_REQUEST.lock().await;
        if let Some(previous) = *last {
            if let Some(wait) = Duration::from_secs(1).checked_sub(previous.elapsed()) {
                tokio::time::sleep(wait).await;
            }
        }
        *last = Some(Instant::now());
    }
    let response = super::http::get(
        &format!("https://musicbrainz.org/ws/2/{path}&fmt=json"),
        "MusicBrainz",
    )
    .await?;
    serde_json::from_str(&response.text)
        .map_err(|error| format!("MusicBrainz response was unreadable: {error}"))
}

fn mbid(id: &str, prefix: &str) -> Result<String, String> {
    id.strip_prefix(prefix)
        .and_then(super::coverart::safe_mbid)
        .ok_or_else(|| "Invalid MusicBrainz identity".into())
}

pub async fn album_tracks(album: &MusicAlbumRef) -> Result<Vec<MusicTrack>, String> {
    let release = if album.id.starts_with("musicbrainz:release:") {
        mbid(&album.id, "musicbrainz:release:")?
    } else {
        let group = mbid(&album.id, "musicbrainz:release-group:")?;
        let data = fetch(&format!(
            "release?release-group={group}&status=official&limit=1"
        ))
        .await?;
        data["releases"]
            .as_array()
            .and_then(|items| items.first())
            .and_then(|item| item["id"].as_str())
            .and_then(super::coverart::safe_mbid)
            .ok_or("MusicBrainz has no published edition for this release")?
    };
    let data = fetch(&format!("release/{release}?inc=recordings+artist-credits")).await?;
    let mut tracks = Vec::new();
    if let Some(media) = data["media"].as_array() {
        for medium in media {
            if let Some(entries) = medium["tracks"].as_array() {
                for entry in entries {
                    let recording = &entry["recording"];
                    if let Some(mut track) = recording_track(recording, &album.artist) {
                        // Use the release-track identity, keeping repeated recordings on different discs distinct.
                        if let Some(id) = entry["id"].as_str().and_then(super::coverart::safe_mbid)
                        {
                            track.id = format!("musicbrainz:track:{id}");
                        }
                        if let Some(title) = entry["title"]
                            .as_str()
                            .filter(|value| !value.trim().is_empty())
                        {
                            track.title = title.into();
                        }
                        track.album = Some(album.title.clone());
                        track.artwork = album.artwork.clone();
                        tracks.push(track);
                    }
                }
            }
        }
    }
    Ok(tracks)
}

pub async fn artist_tracks(artist: &MusicArtistRef) -> Result<Vec<MusicTrack>, String> {
    let id = mbid(&artist.id, "musicbrainz:artist:")?;
    let data = fetch(&format!(
        "recording?artist={id}&limit=50&inc=artist-credits"
    ))
    .await?;
    Ok(data["recordings"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|entry| recording_track(entry, &artist.name))
        .collect())
}

pub async fn artist_albums(artist: &MusicArtistRef) -> Result<Vec<MusicAlbumRef>, String> {
    let id = mbid(&artist.id, "musicbrainz:artist:")?;
    let data = fetch(&format!("release-group?artist={id}&type=album|ep&limit=50")).await?;
    Ok(data["release-groups"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|entry| {
            let id = entry["id"].as_str().and_then(super::coverart::safe_mbid)?;
            Some(MusicAlbumRef {
                id: format!("musicbrainz:release-group:{id}"),
                connector_id: "catalog".into(),
                title: entry["title"].as_str()?.into(),
                artist: artist.name.clone(),
                artwork: format!("https://coverartarchive.org/release-group/{id}/front-500"),
                year: entry["first-release-date"]
                    .as_str()
                    .and_then(super::release_year),
                track_count: None,
                explicit: None,
            })
        })
        .collect())
}

pub async fn artist_catalog(
    artist: &MusicArtistRef,
    kind: MusicCatalogKind,
    cursor: Option<&str>,
) -> Result<MusicCatalogPage, String> {
    let id = mbid(&artist.id, "musicbrainz:artist:")?;
    let offset = super::page_offset(artist, kind, cursor)?;
    let entity = match kind {
        MusicCatalogKind::Tracks => "recording",
        MusicCatalogKind::Albums => "release-group",
    };
    let data = fetch(&format!(
        "{entity}?artist={id}&limit=50&offset={offset}&inc=artist-credits"
    ))
    .await?;
    parse_artist_page(&data, artist, kind, offset)
}

fn parse_artist_page(
    data: &Value,
    artist: &MusicArtistRef,
    kind: MusicCatalogKind,
    offset: u64,
) -> Result<MusicCatalogPage, String> {
    let (array_key, count_key) = match kind {
        MusicCatalogKind::Tracks => ("recordings", "recording-count"),
        MusicCatalogKind::Albums => ("release-groups", "release-group-count"),
    };
    let entries = data[array_key]
        .as_array()
        .ok_or("MusicBrainz returned no artist catalog data")?;
    let total = data[count_key].as_u64();
    let next = offset.saturating_add(entries.len() as u64);
    let has_more = total.is_some_and(|count| next < count);
    if has_more && entries.is_empty() {
        return Err(
            "MusicBrainz returned an incomplete artist catalog page. Please try again.".into(),
        );
    }
    let mut items = Vec::with_capacity(entries.len());
    for entry in entries {
        let item = match kind {
            MusicCatalogKind::Tracks => {
                recording_track(entry, &artist.name).map(MusicCatalogItem::Track)
            }
            MusicCatalogKind::Albums => {
                let id = entry["id"].as_str().and_then(super::coverart::safe_mbid);
                let title = entry["title"]
                    .as_str()
                    .filter(|title| !title.trim().is_empty());
                id.zip(title).map(|(id, title)| {
                    MusicCatalogItem::Album(MusicAlbumRef {
                        id: format!("musicbrainz:release-group:{id}"),
                        connector_id: "catalog".into(),
                        title: title.into(),
                        artist: artist_credit(entry, &artist.name),
                        artwork: format!(
                            "https://coverartarchive.org/release-group/{id}/front-500"
                        ),
                        year: entry["first-release-date"]
                            .as_str()
                            .and_then(super::release_year),
                        track_count: None,
                        explicit: None,
                    })
                })
            }
        };
        items.push(
            item.ok_or(
                "MusicBrainz returned an artist catalog item without its identity or title",
            )?,
        );
    }
    Ok(MusicCatalogPage {
        items,
        next_cursor: has_more.then(|| super::page_cursor(artist, kind, next)),
        total,
        scope: MusicCatalogScope::Catalog,
    })
}

fn artist_credit(entry: &Value, fallback_artist: &str) -> String {
    let credit: String = entry["artist-credit"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|credit| {
            format!(
                "{}{}",
                credit["name"]
                    .as_str()
                    .or_else(|| credit["artist"]["name"].as_str())
                    .unwrap_or_default(),
                credit["joinphrase"].as_str().unwrap_or_default()
            )
        })
        .collect();
    if credit.trim().is_empty() {
        fallback_artist.into()
    } else {
        credit
    }
}

fn recording_track(entry: &Value, fallback_artist: &str) -> Option<MusicTrack> {
    let id = entry["id"].as_str().and_then(super::coverart::safe_mbid)?;
    let title = entry["title"].as_str()?.trim();
    if title.is_empty() {
        return None;
    }
    let duration_seconds = entry["length"].as_u64().unwrap_or_default() / 1000;
    Some(MusicTrack {
        explicit: None,
        version: None,
        media_kind: None,
        id: format!("musicbrainz:recording:{id}"),
        connector_id: Some("catalog".into()),
        source_id: Some(id),
        playback_url: None,
        title: title.into(),
        artist: artist_credit(entry, fallback_artist),
        album: None,
        artwork: String::new(),
        duration_seconds,
        duration_label: duration_label(duration_seconds),
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn artist_browse_continues_by_received_count_and_keeps_release_credit() {
        use super::*;
        let artist = MusicArtistRef {
            id: "musicbrainz:artist:a74b1b7f-71a5-4011-9441-d0b5e4122711".into(),
            connector_id: "catalog".into(),
            name: "Artist".into(),
            artwork: None,
            subtitle: None,
        };
        let data = serde_json::json!({"release-group-count":51,"release-groups":[{
            "id":"a74b1b7f-71a5-4011-9441-d0b5e4122711","title":"Shared release", "primary-type":"Single",
            "artist-credit":[{"name":"Artist","joinphrase":" & "},{"name":"Guest"}]
        }]});
        let page = parse_artist_page(&data, &artist, MusicCatalogKind::Albums, 49).unwrap();
        assert_eq!(page.scope, MusicCatalogScope::Catalog);
        assert_eq!(
            super::super::page_offset(
                &artist,
                MusicCatalogKind::Albums,
                page.next_cursor.as_deref()
            )
            .unwrap(),
            50
        );
        let MusicCatalogItem::Album(album) = &page.items[0] else {
            panic!("album")
        };
        assert_eq!(album.artist, "Artist & Guest");
        assert!(
            parse_artist_page(&data, &artist, MusicCatalogKind::Albums, 50)
                .unwrap()
                .next_cursor
                .is_none()
        );
    }

    #[test]
    fn recording_credit_keeps_guests_and_never_invents_a_stream() {
        let value = serde_json::json!({"id":"a74b1b7f-71a5-4011-9441-d0b5e4122711","title":"Track","length":185000,"artist-credit":[{"name":"Artist","joinphrase":" feat. "},{"artist":{"name":"Guest"}}]});
        let track = super::recording_track(&value, "Fallback").unwrap();
        assert_eq!(track.artist, "Artist feat. Guest");
        assert_eq!(track.duration_label, "3:05");
        assert!(track.playback_url.is_none());
        assert!(super::mbid("musicbrainz:artist:../../etc", "musicbrainz:artist:").is_err());
    }
}
