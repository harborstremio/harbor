use super::coverart::{release_artwork, safe_mbid};
use super::{non_empty, release_year};
use crate::music::{MusicAlbumRef, MusicArtistRef};
use serde::Deserialize;
use std::sync::LazyLock;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const FRESH_RELEASES: &str = "https://api.listenbrainz.org/1/explore/fresh-releases/?days=7&sort=release_date&past=true&future=false";
const SITEWIDE_ARTISTS: &str =
    "https://api.listenbrainz.org/1/stats/sitewide/artists?count=25&offset=0&range=month";
const MIN_INTERVAL: Duration = Duration::from_secs(1);

static LAST_CALL: LazyLock<Mutex<Option<Instant>>> = LazyLock::new(|| Mutex::new(None));

#[derive(Debug, Deserialize)]
struct FreshReleasesBody {
    payload: FreshReleases,
}

#[derive(Debug, Deserialize)]
struct FreshReleases {
    releases: Vec<FreshRelease>,
}

#[derive(Debug, Deserialize)]
struct FreshRelease {
    artist_credit_name: Option<String>,
    caa_id: Option<u64>,
    caa_release_mbid: Option<String>,
    release_date: Option<String>,
    release_group_mbid: Option<String>,
    release_group_primary_type: Option<String>,
    release_mbid: Option<String>,
    release_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SitewideBody {
    payload: SitewideArtists,
}

#[derive(Debug, Deserialize)]
struct SitewideArtists {
    artists: Vec<SitewideArtist>,
}

#[derive(Debug, Deserialize)]
struct SitewideArtist {
    artist_mbid: Option<String>,
    artist_name: Option<String>,
    listen_count: Option<u64>,
}

pub async fn fresh_releases(limit: usize) -> Result<Vec<MusicAlbumRef>, String> {
    parse_fresh_releases(&fetch(FRESH_RELEASES).await?, limit)
}

pub async fn top_artists(limit: usize) -> Result<Vec<MusicArtistRef>, String> {
    parse_top_artists(&fetch(SITEWIDE_ARTISTS).await?, limit)
}

async fn fetch(url: &str) -> Result<String, String> {
    pace().await;
    let response = super::http::get(url, "ListenBrainz").await?;
    if response.text.trim().is_empty() {
        return Ok(String::new());
    }
    if !response.content_type.contains("json") {
        return Err("ListenBrainz is verifying the client".to_string());
    }
    Ok(response.text)
}

async fn pace() {
    let mut last = LAST_CALL.lock().await;
    if let Some(previous) = *last {
        let elapsed = previous.elapsed();
        if elapsed < MIN_INTERVAL {
            tokio::time::sleep(MIN_INTERVAL - elapsed).await;
        }
    }
    *last = Some(Instant::now());
}

fn parse_fresh_releases(body: &str, limit: usize) -> Result<Vec<MusicAlbumRef>, String> {
    if body.trim().is_empty() {
        return Ok(Vec::new());
    }
    let parsed = serde_json::from_str::<FreshReleasesBody>(body)
        .map_err(|error| format!("ListenBrainz fresh releases were unreadable: {error}"))?;
    let mut releases = parsed
        .payload
        .releases
        .into_iter()
        .filter(|release| {
            matches!(
                release.release_group_primary_type.as_deref(),
                Some("Album") | Some("EP")
            )
        })
        .collect::<Vec<_>>();
    releases.sort_by(|left, right| {
        right
            .release_date
            .as_deref()
            .unwrap_or_default()
            .cmp(left.release_date.as_deref().unwrap_or_default())
    });
    Ok(releases
        .into_iter()
        .filter_map(album)
        .take(limit)
        .collect::<Vec<_>>())
}

fn album(release: FreshRelease) -> Option<MusicAlbumRef> {
    let title = non_empty(release.release_name)?;
    let artist = non_empty(release.artist_credit_name)?;
    let art_mbid = safe_mbid(release.caa_release_mbid.as_deref()?)?;
    let caa_id = release.caa_id?;
    let (entity, mbid) = if let Some(id) = release.release_mbid.as_deref().and_then(safe_mbid) {
        ("release", id)
    } else {
        (
            "release-group",
            release.release_group_mbid.as_deref().and_then(safe_mbid)?,
        )
    };
    Some(MusicAlbumRef {
        id: format!("musicbrainz:{entity}:{mbid}"),
        connector_id: "catalog".to_string(),
        title,
        artist,
        artwork: release_artwork(&art_mbid, caa_id),
        year: release.release_date.as_deref().and_then(release_year),
        track_count: None,
        explicit: None,
    })
}

fn parse_top_artists(body: &str, limit: usize) -> Result<Vec<MusicArtistRef>, String> {
    if body.trim().is_empty() {
        return Ok(Vec::new());
    }
    let parsed = serde_json::from_str::<SitewideBody>(body)
        .map_err(|error| format!("ListenBrainz statistics were unreadable: {error}"))?;
    Ok(parsed
        .payload
        .artists
        .into_iter()
        .filter_map(artist)
        .take(limit)
        .collect::<Vec<_>>())
}

fn artist(entry: SitewideArtist) -> Option<MusicArtistRef> {
    let name = non_empty(entry.artist_name)?;
    let mbid = entry.artist_mbid.as_deref().and_then(safe_mbid)?;
    Some(MusicArtistRef {
        id: format!("musicbrainz:artist:{mbid}"),
        connector_id: "catalog".to_string(),
        name,
        artwork: None,
        subtitle: entry.listen_count.map(listens),
    })
}

fn listens(count: u64) -> String {
    let raw = count.to_string();
    let mut grouped = String::new();
    for (index, character) in raw.chars().enumerate() {
        if index > 0 && (raw.len() - index) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(character);
    }
    format!("{grouped} listens")
}

#[cfg(test)]
mod tests {
    use super::*;

    const FRESH: &str = r#"{
      "payload": {
        "releases": [
          {
            "artist_credit_name": "Bonobo",
            "caa_id": 34059386237,
            "caa_release_mbid": "cd21d4e9-af51-4e7c-bd9f-a5f31d5cfe1a",
            "release_date": "2026-08-29",
            "release_group_mbid": "6e335887-60ba-38f0-95af-fae7774336bf",
            "release_group_primary_type": "Album",
            "release_mbid": "1b6c4560-1234-4e7c-bd9f-a5f31d5cfe1a",
            "release_name": "Fragments"
          },
          {
            "artist_credit_name": "Someone",
            "caa_id": 11,
            "caa_release_mbid": "aa21d4e9-af51-4e7c-bd9f-a5f31d5cfe1a",
            "release_date": "2026-09-01",
            "release_group_mbid": "bb335887-60ba-38f0-95af-fae7774336bf",
            "release_group_primary_type": "Single",
            "release_mbid": "cc6c4560-1234-4e7c-bd9f-a5f31d5cfe1a",
            "release_name": "One Off"
          },
          {
            "artist_credit_name": "Little Simz",
            "caa_id": 42,
            "caa_release_mbid": "dd21d4e9-af51-4e7c-bd9f-a5f31d5cfe1a",
            "release_date": "2026-09-02",
            "release_group_mbid": "ee335887-60ba-38f0-95af-fae7774336bf",
            "release_group_primary_type": "EP",
            "release_mbid": "ff6c4560-1234-4e7c-bd9f-a5f31d5cfe1a",
            "release_name": "Drop 7"
          },
          {
            "artist_credit_name": "No Art",
            "release_date": "2026-09-03",
            "release_group_mbid": "0f335887-60ba-38f0-95af-fae7774336bf",
            "release_group_primary_type": "Album",
            "release_name": "Missing Cover"
          }
        ]
      }
    }"#;

    #[test]
    fn fresh_releases_keep_albums_and_eps_with_art_newest_first() {
        let releases = parse_fresh_releases(FRESH, 10).expect("fresh releases");
        assert_eq!(releases.len(), 2);
        assert_eq!(releases[0].title, "Drop 7");
        assert_eq!(releases[0].year, Some(2026));
        assert_eq!(releases[0].connector_id, "catalog");
        assert_eq!(
            releases[0].id,
            "musicbrainz:release:ff6c4560-1234-4e7c-bd9f-a5f31d5cfe1a"
        );
        assert!(releases[0].artwork.ends_with("-42_thumb500.jpg"));
        assert_eq!(releases[1].artist, "Bonobo");
    }

    #[test]
    fn fresh_releases_honor_the_row_limit_and_an_empty_body() {
        assert_eq!(parse_fresh_releases(FRESH, 1).expect("limited").len(), 1);
        assert!(parse_fresh_releases("", 10).expect("empty body").is_empty());
        assert!(parse_fresh_releases("not json", 10).is_err());
    }

    #[test]
    fn sitewide_artists_carry_a_listen_count_subtitle() {
        let body = r#"{
          "payload": {
            "artists": [
              {
                "artist_mbid": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
                "artist_name": "Radiohead",
                "listen_count": 1236341
              },
              { "artist_name": "No Mbid", "listen_count": 4 }
            ]
          }
        }"#;
        let artists = parse_top_artists(body, 10).expect("artists");
        assert_eq!(artists.len(), 1);
        assert_eq!(artists[0].name, "Radiohead");
        assert_eq!(artists[0].subtitle.as_deref(), Some("1,236,341 listens"));
        assert!(artists[0].artwork.is_none());
    }

    #[test]
    fn listen_counts_group_thousands() {
        assert_eq!(listens(0), "0 listens");
        assert_eq!(listens(999), "999 listens");
        assert_eq!(listens(1000), "1,000 listens");
        assert_eq!(listens(65432), "65,432 listens");
    }
}
