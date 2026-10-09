use super::{non_empty, release_year};
use crate::music::{MusicAlbumRef, MusicArtistRef, MusicTrack};
use serde::Deserialize;

const SEARCH: &str = "https://itunes.apple.com/search";

#[derive(Debug, Deserialize)]
struct SearchBody {
    results: Vec<SearchResult>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchResult {
    kind: Option<String>,
    track_id: Option<u64>,
    track_name: Option<String>,
    track_time_millis: Option<u64>,
    artist_id: Option<u64>,
    artist_name: Option<String>,
    collection_id: Option<u64>,
    collection_name: Option<String>,
    artwork_url100: Option<String>,
    track_count: Option<u32>,
    release_date: Option<String>,
    primary_genre_name: Option<String>,
}

pub async fn albums(query: &str, limit: usize) -> Result<Vec<MusicAlbumRef>, String> {
    let url = search_url(query, "album", limit)?;
    parse_albums(&fetch(&url).await?, limit)
}

pub async fn artists(query: &str, limit: usize) -> Result<Vec<MusicArtistRef>, String> {
    let url = search_url(query, "musicArtist", limit)?;
    parse_artists(&fetch(&url).await?, limit)
}

pub async fn songs(query: &str, limit: usize) -> Result<Vec<MusicTrack>, String> {
    let url = search_url(query, "song", limit)?;
    Ok(parse_tracks(&fetch(&url).await?)?
        .into_iter()
        .take(limit.clamp(1, 50))
        .collect())
}

pub async fn tracks(id: &str, prefix: &str) -> Result<Vec<MusicTrack>, String> {
    let id = super::numeric_id(id, prefix)?;
    parse_tracks(
        &fetch(&format!(
            "https://itunes.apple.com/lookup?id={id}&entity=song&limit=200"
        ))
        .await?,
    )
}

pub async fn artist_albums(id: &str) -> Result<Vec<MusicAlbumRef>, String> {
    let id = super::numeric_id(id, "itunes:artist:")?;
    parse_albums(
        &fetch(&format!(
            "https://itunes.apple.com/lookup?id={id}&entity=album&limit=200"
        ))
        .await?,
        200,
    )
}

fn parse_tracks(raw: &str) -> Result<Vec<MusicTrack>, String> {
    Ok(body(raw)?
        .into_iter()
        .filter_map(|entry| {
            if entry.kind.as_deref() != Some("song") {
                return None;
            }
            let id = entry.track_id?;
            let duration_seconds = entry.track_time_millis.unwrap_or_default() / 1000;
            Some(MusicTrack {
                explicit: None,
                version: None,
                media_kind: None,
                id: format!("itunes:track:{id}"),
                connector_id: Some("catalog".into()),
                source_id: Some(id.to_string()),
                playback_url: None,
                title: non_empty(entry.track_name)?,
                artist: non_empty(entry.artist_name)?,
                album: non_empty(entry.collection_name),
                artwork: artwork(entry.artwork_url100),
                duration_seconds,
                duration_label: format!("{}:{:02}", duration_seconds / 60, duration_seconds % 60),
            })
        })
        .take(200)
        .collect())
}

async fn fetch(url: &str) -> Result<String, String> {
    Ok(super::http::get(url, "iTunes").await?.text)
}

fn search_url(query: &str, entity: &str, limit: usize) -> Result<String, String> {
    let mut target =
        url::Url::parse(SEARCH).map_err(|error| format!("build the iTunes search URL: {error}"))?;
    target
        .query_pairs_mut()
        .append_pair("term", query.trim())
        .append_pair("media", "music")
        .append_pair("entity", entity)
        .append_pair("limit", &limit.clamp(1, 50).to_string())
        .append_pair("country", "US");
    Ok(target.to_string())
}

fn body(raw: &str) -> Result<Vec<SearchResult>, String> {
    if raw.trim().is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str::<SearchBody>(raw)
        .map(|parsed| parsed.results)
        .map_err(|error| format!("iTunes response was unreadable: {error}"))
}

fn parse_albums(raw: &str, limit: usize) -> Result<Vec<MusicAlbumRef>, String> {
    Ok(body(raw)?
        .into_iter()
        .filter_map(album)
        .take(limit)
        .collect::<Vec<_>>())
}

fn album(entry: SearchResult) -> Option<MusicAlbumRef> {
    let id = entry.collection_id?;
    let title = non_empty(entry.collection_name)?;
    let artist = non_empty(entry.artist_name)?;
    Some(MusicAlbumRef {
        id: format!("itunes:album:{id}"),
        connector_id: "catalog".to_string(),
        title,
        artist,
        artwork: artwork(entry.artwork_url100),
        year: entry.release_date.as_deref().and_then(release_year),
        track_count: entry.track_count,
        explicit: None,
    })
}

fn parse_artists(raw: &str, limit: usize) -> Result<Vec<MusicArtistRef>, String> {
    Ok(body(raw)?
        .into_iter()
        .filter_map(artist)
        .take(limit)
        .collect::<Vec<_>>())
}

fn artist(entry: SearchResult) -> Option<MusicArtistRef> {
    let id = entry.artist_id?;
    let name = non_empty(entry.artist_name)?;
    Some(MusicArtistRef {
        id: format!("itunes:artist:{id}"),
        connector_id: "catalog".to_string(),
        name,
        artwork: None,
        subtitle: non_empty(entry.primary_genre_name),
    })
}

fn artwork(url: Option<String>) -> String {
    url.map(|value| value.replace("100x100bb", "500x500bb"))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lookup_ignores_collection_headers_and_preview_urls() {
        let raw = r#"{"results":[
          {"wrapperType":"collection","collectionId":5,"collectionName":"Album"},
          {"kind":"song","trackId":7,"trackName":"Song","artistName":"Artist","collectionName":"Album","trackTimeMillis":213900,"previewUrl":"https://example.test/preview.m4a"},
          {"kind":"music-video","trackId":8,"trackName":"Video","artistName":"Artist"}
        ]}"#;
        let tracks = parse_tracks(raw).expect("lookup tracks");
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].id, "itunes:track:7");
        assert_eq!(tracks[0].duration_label, "3:33");
        assert!(tracks[0].playback_url.is_none());
    }

    const ALBUMS: &str = r#"{
      "resultCount": 2,
      "results": [
        {
          "wrapperType": "collection",
          "artistId": 657515,
          "collectionId": 1097861387,
          "artistName": "Radiohead",
          "collectionName": "OK Computer",
          "artworkUrl100": "https://is1.test/image/thumb/Music/ok.jpg/100x100bb.jpg",
          "trackCount": 12,
          "releaseDate": "1997-05-28T07:00:00Z",
          "primaryGenreName": "Alternative"
        },
        { "artistName": "No Collection", "collectionName": "Nowhere" }
      ]
    }"#;

    #[test]
    fn album_search_upscales_the_artwork_and_reads_the_year() {
        let albums = parse_albums(ALBUMS, 10).expect("albums");
        assert_eq!(albums.len(), 1);
        assert_eq!(albums[0].id, "itunes:album:1097861387");
        assert_eq!(albums[0].title, "OK Computer");
        assert_eq!(albums[0].year, Some(1997));
        assert_eq!(albums[0].track_count, Some(12));
        assert_eq!(
            albums[0].artwork,
            "https://is1.test/image/thumb/Music/ok.jpg/500x500bb.jpg"
        );
    }

    #[test]
    fn artist_search_leaves_artwork_empty_because_apple_sends_none() {
        let body = r#"{
          "resultCount": 1,
          "results": [
            {
              "wrapperType": "artist",
              "artistType": "Artist",
              "artistName": "Radiohead",
              "artistId": 657515,
              "primaryGenreName": "Alternative"
            }
          ]
        }"#;
        let artists = parse_artists(body, 10).expect("artists");
        assert_eq!(artists[0].id, "itunes:artist:657515");
        assert!(artists[0].artwork.is_none());
        assert_eq!(artists[0].subtitle.as_deref(), Some("Alternative"));
    }

    #[test]
    fn a_throttled_empty_response_reads_as_no_results() {
        assert!(parse_albums(r#"{"resultCount":0,"results":[]}"#, 10)
            .expect("empty")
            .is_empty());
        assert!(parse_artists("", 10).expect("empty body").is_empty());
    }

    #[test]
    fn search_urls_encode_the_term_and_pin_the_catalog() {
        let url = search_url("bad bunny & friends", "album", 12).expect("url");
        assert!(url.starts_with("https://itunes.apple.com/search?"));
        assert!(url.contains("term=bad+bunny+%26+friends"));
        assert!(url.contains("entity=album"));
        assert!(url.contains("limit=12"));
        assert!(url.contains("country=US"));
    }
}
