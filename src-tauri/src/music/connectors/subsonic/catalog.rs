use super::super::super::{MusicCatalogItem, MusicCatalogRow, MusicRowLayout, MusicTrack};
use super::client::SubsonicClient;
use super::convert::{album_ref, artist_ref, playlist_ref, track_ref};
use super::model;
use super::CONNECTOR_ID;
use futures_util::future::join_all;

const HOME_SIZE: usize = 24;
const ARTIST_ALBUM_LIMIT: usize = 4;
const ARTIST_TRACK_LIMIT: usize = 30;

pub async fn home_rows(client: &SubsonicClient) -> Result<Vec<MusicCatalogRow>, String> {
    let (newest, frequent, random, starred, artists, playlists) = tokio::join!(
        album_row(
            client,
            "newest",
            "subsonic:home:newest",
            "music.row.serverNewest"
        ),
        album_row(
            client,
            "frequent",
            "subsonic:home:frequent",
            "music.row.serverFrequent"
        ),
        album_row(
            client,
            "random",
            "subsonic:home:random",
            "music.row.serverRandom"
        ),
        starred_row(client),
        artist_row(client),
        playlist_row(client),
    );
    let mut rows = Vec::new();
    let mut failure = None;
    for outcome in [newest, frequent, random, starred, artists, playlists] {
        match outcome {
            Ok(Some(row)) => rows.push(row),
            Ok(None) => {}
            Err(error) => failure = Some(error),
        }
    }
    match failure {
        Some(error) if rows.is_empty() => Err(error),
        _ => Ok(rows),
    }
}

async fn album_row(
    client: &SubsonicClient,
    list_type: &str,
    id: &str,
    title: &str,
) -> Result<Option<MusicCatalogRow>, String> {
    let body = client
        .call(
            "getAlbumList2",
            &[
                ("type", list_type.to_string()),
                ("size", HOME_SIZE.to_string()),
            ],
        )
        .await?;
    let albums = body.album_list.map(|list| list.album).unwrap_or_default();
    Ok(row(
        id,
        title,
        MusicRowLayout::Covers,
        albums
            .into_iter()
            .map(|album| MusicCatalogItem::Album(album_ref(client, album)))
            .collect(),
    ))
}

async fn starred_row(client: &SubsonicClient) -> Result<Option<MusicCatalogRow>, String> {
    let body = client.call("getStarred2", &[]).await?;
    let songs = body.starred.map(|starred| starred.song).unwrap_or_default();
    Ok(row(
        "subsonic:home:starred",
        "music.row.serverStarred",
        MusicRowLayout::TrackGrid,
        songs
            .into_iter()
            .take(HOME_SIZE)
            .map(|song| MusicCatalogItem::Track(track_ref(client, song)))
            .collect(),
    ))
}

async fn artist_row(client: &SubsonicClient) -> Result<Option<MusicCatalogRow>, String> {
    let body = client.call("getArtists", &[]).await?;
    Ok(row(
        "subsonic:home:artists",
        "music.row.serverArtists",
        MusicRowLayout::Circles,
        model::flatten_artists(body.artists)
            .into_iter()
            .take(HOME_SIZE)
            .map(|artist| MusicCatalogItem::Artist(artist_ref(client, artist)))
            .collect(),
    ))
}

async fn playlist_row(client: &SubsonicClient) -> Result<Option<MusicCatalogRow>, String> {
    let body = client.call("getPlaylists", &[]).await?;
    let playlists = body
        .playlists
        .map(|items| items.playlist)
        .unwrap_or_default();
    Ok(row(
        "subsonic:home:playlists",
        "music.row.serverPlaylists",
        MusicRowLayout::Covers,
        playlists
            .into_iter()
            .take(HOME_SIZE)
            .map(|item| MusicCatalogItem::Playlist(playlist_ref(client, item)))
            .collect(),
    ))
}

pub async fn album_songs(client: &SubsonicClient, album: &str) -> Result<Vec<MusicTrack>, String> {
    let body = client
        .call("getAlbum", &[("id", album.to_string())])
        .await?;
    let songs = body.album.map(|album| album.song).unwrap_or_default();
    Ok(model::in_disc_order(songs)
        .into_iter()
        .map(|song| track_ref(client, song))
        .collect())
}

pub async fn artist_songs(
    client: &SubsonicClient,
    artist: &str,
) -> Result<Vec<MusicTrack>, String> {
    let body = client
        .call("getArtist", &[("id", artist.to_string())])
        .await?;
    let albums = body.artist.map(|artist| artist.album).unwrap_or_default();
    let ids = albums
        .into_iter()
        .take(ARTIST_ALBUM_LIMIT)
        .map(|album| album.id)
        .collect::<Vec<_>>();
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let mut tracks = Vec::new();
    let mut failure = None;
    for result in join_all(ids.iter().map(|id| album_songs(client, id))).await {
        match result {
            Ok(songs) => tracks.extend(songs),
            Err(error) => failure = Some(error),
        }
    }
    if let Some(error) = failure {
        if tracks.is_empty() {
            return Err(error);
        }
    }
    tracks.truncate(ARTIST_TRACK_LIMIT);
    Ok(tracks)
}

pub async fn playlist_songs(
    client: &SubsonicClient,
    playlist: &str,
) -> Result<Vec<MusicTrack>, String> {
    let body = client
        .call("getPlaylist", &[("id", playlist.to_string())])
        .await?;
    let entries = body.playlist.map(|items| items.entry).unwrap_or_default();
    Ok(entries
        .into_iter()
        .map(|song| track_ref(client, song))
        .collect())
}

pub async fn search3(
    client: &SubsonicClient,
    query: &str,
    artists: usize,
    albums: usize,
    songs: usize,
) -> Result<model::SearchResult, String> {
    let body = client
        .call(
            "search3",
            &[
                ("query", query.to_string()),
                ("artistCount", artists.to_string()),
                ("albumCount", albums.to_string()),
                ("songCount", songs.to_string()),
            ],
        )
        .await?;
    Ok(body.search_result.unwrap_or_default())
}

fn row(
    id: &str,
    title: &str,
    layout: MusicRowLayout,
    items: Vec<MusicCatalogItem>,
) -> Option<MusicCatalogRow> {
    if items.is_empty() {
        return None;
    }
    Some(MusicCatalogRow {
        id: id.to_string(),
        title: title.to_string(),
        title_literal: false,
        subtitle: None,
        layout,
        source: CONNECTOR_ID.to_string(),
        items,
    })
}

#[cfg(test)]
mod tests {
    use super::super::pairing::Pairing;
    use super::*;

    fn client() -> SubsonicClient {
        SubsonicClient::new(
            reqwest::Client::new(),
            Pairing {
                base_url: "https://music.example.test".to_string(),
                username: "alice".to_string(),
                salt: "c19b2d".to_string(),
                token: "26719a1196d2a940705a59634eb18eab".to_string(),
            },
        )
    }

    #[test]
    fn rows_collapse_when_the_server_returned_nothing() {
        assert!(row(
            "subsonic:home:newest",
            "title",
            MusicRowLayout::Covers,
            Vec::new()
        )
        .is_none());
    }

    #[test]
    fn rows_name_their_source_and_carry_a_lookup_title() {
        let song = serde_json::from_str(r#"{"id":"mf-1","title":"Hysteria"}"#).expect("song");
        let filled = row(
            "subsonic:home:newest",
            "music.row.serverNewest",
            MusicRowLayout::Covers,
            vec![MusicCatalogItem::Track(track_ref(&client(), song))],
        )
        .expect("row");
        assert_eq!(filled.source, "subsonic");
        assert_eq!(filled.title, "music.row.serverNewest");
        assert!(!filled.title_literal);
        assert!(filled.subtitle.is_none());
        assert_eq!(filled.items.len(), 1);
    }
}
