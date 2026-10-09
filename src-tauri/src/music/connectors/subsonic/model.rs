use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Envelope {
    #[serde(rename = "subsonic-response")]
    pub response: Body,
}

#[derive(Debug, Deserialize)]
pub struct Body {
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub error: Option<ApiError>,
    #[serde(default)]
    pub artists: Option<ArtistIndexes>,
    #[serde(default)]
    pub artist: Option<ArtistAlbums>,
    #[serde(default)]
    pub album: Option<AlbumSongs>,
    #[serde(default, rename = "albumList2")]
    pub album_list: Option<AlbumList>,
    #[serde(default, rename = "starred2")]
    pub starred: Option<Starred>,
    #[serde(default)]
    pub playlists: Option<Playlists>,
    #[serde(default)]
    pub playlist: Option<PlaylistEntries>,
    #[serde(default, rename = "searchResult3")]
    pub search_result: Option<SearchResult>,
}

#[derive(Debug, Deserialize)]
pub struct ApiError {
    #[serde(default)]
    pub code: i64,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AuthLogin {
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default, rename = "subsonicSalt")]
    pub salt: Option<String>,
    #[serde(default, rename = "subsonicToken")]
    pub token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ArtistIndexes {
    #[serde(default)]
    pub index: Vec<ArtistIndex>,
}

#[derive(Debug, Deserialize)]
pub struct ArtistIndex {
    #[serde(default)]
    pub artist: Vec<ArtistId3>,
}

#[derive(Debug, Deserialize)]
pub struct ArtistAlbums {
    #[serde(default)]
    pub album: Vec<AlbumId3>,
}

#[derive(Debug, Deserialize)]
pub struct AlbumList {
    #[serde(default)]
    pub album: Vec<AlbumId3>,
}

#[derive(Debug, Deserialize)]
pub struct AlbumSongs {
    #[serde(default)]
    pub song: Vec<Child>,
}

#[derive(Debug, Deserialize)]
pub struct Starred {
    #[serde(default)]
    pub song: Vec<Child>,
}

#[derive(Debug, Deserialize)]
pub struct Playlists {
    #[serde(default)]
    pub playlist: Vec<PlaylistSummary>,
}

#[derive(Debug, Deserialize)]
pub struct PlaylistEntries {
    #[serde(default)]
    pub entry: Vec<Child>,
}

#[derive(Debug, Default, Deserialize)]
pub struct SearchResult {
    #[serde(default)]
    pub artist: Vec<ArtistId3>,
    #[serde(default)]
    pub album: Vec<AlbumId3>,
    #[serde(default)]
    pub song: Vec<Child>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistId3 {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub cover_art: Option<String>,
    #[serde(default)]
    pub artist_image_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumId3 {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub artist: Option<String>,
    #[serde(default)]
    pub cover_art: Option<String>,
    #[serde(default)]
    pub song_count: Option<u32>,
    #[serde(default)]
    pub year: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistSummary {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub cover_art: Option<String>,
    #[serde(default)]
    pub song_count: Option<u32>,
    #[serde(default)]
    pub comment: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Child {
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub album: Option<String>,
    #[serde(default)]
    pub artist: Option<String>,
    #[serde(default)]
    pub cover_art: Option<String>,
    #[serde(default)]
    pub duration: Option<u64>,
    #[serde(default)]
    pub track: Option<u32>,
    #[serde(default)]
    pub disc_number: Option<u32>,
}

pub fn flatten_artists(indexes: Option<ArtistIndexes>) -> Vec<ArtistId3> {
    indexes
        .map(|indexes| indexes.index)
        .unwrap_or_default()
        .into_iter()
        .flat_map(|index| index.artist)
        .collect()
}

pub fn in_disc_order(mut songs: Vec<Child>) -> Vec<Child> {
    songs.sort_by_key(|song| (song.disc_number.unwrap_or(1), song.track.unwrap_or(0)));
    songs
}

#[cfg(test)]
mod tests {
    use super::*;

    fn body(raw: &str) -> Body {
        serde_json::from_str::<Envelope>(raw)
            .expect("envelope parses")
            .response
    }

    #[test]
    fn ping_envelope_reports_ok_without_a_payload() {
        let parsed = body(
            r#"{"subsonic-response":{"status":"ok","version":"1.16.1","type":"navidrome","serverVersion":"0.63.2","openSubsonic":true}}"#,
        );
        assert_eq!(parsed.status, "ok");
        assert!(parsed.error.is_none());
    }

    #[test]
    fn failed_envelopes_carry_the_subsonic_error_code() {
        let parsed = body(
            r#"{"subsonic-response":{"status":"failed","version":"1.16.1","error":{"code":40,"message":"Wrong username or password"}}}"#,
        );
        assert_eq!(parsed.status, "failed");
        let error = parsed.error.expect("error");
        assert_eq!(error.code, 40);
        assert_eq!(error.message.as_deref(), Some("Wrong username or password"));
    }

    #[test]
    fn search_results_tolerate_absent_arrays() {
        let parsed = body(r#"{"subsonic-response":{"status":"ok","searchResult3":{}}}"#);
        let results = parsed.search_result.expect("search result");
        assert!(results.artist.is_empty());
        assert!(results.album.is_empty());
        assert!(results.song.is_empty());
    }

    #[test]
    fn songs_read_every_field_harbor_needs() {
        let parsed = body(
            r#"{"subsonic-response":{"status":"ok","searchResult3":{"song":[{"id":"mf-1","title":"Hysteria","album":"Absolution","artist":"Muse","coverArt":"mf-1_9f","duration":227,"track":6,"discNumber":1}]}}}"#,
        );
        let song = parsed.search_result.expect("search result").song.remove(0);
        assert_eq!(song.id, "mf-1");
        assert_eq!(song.title, "Hysteria");
        assert_eq!(song.artist.as_deref(), Some("Muse"));
        assert_eq!(song.cover_art.as_deref(), Some("mf-1_9f"));
        assert_eq!(song.duration, Some(227));
    }

    #[test]
    fn album_lists_and_playlists_parse_their_navidrome_shapes() {
        let parsed = body(
            r#"{"subsonic-response":{"status":"ok","albumList2":{"album":[{"id":"al-1","name":"Absolution","artist":"Muse","coverArt":"al-1_2c","songCount":14,"year":2003}]}}}"#,
        );
        let album = parsed.album_list.expect("album list").album.remove(0);
        assert_eq!(album.id, "al-1");
        assert_eq!(album.song_count, Some(14));
        assert_eq!(album.year, Some(2003));

        let parsed = body(
            r#"{"subsonic-response":{"status":"ok","playlists":{"playlist":[{"id":"pl-1","name":"Drive","songCount":40,"comment":"night","coverArt":"pl-1"}]}}}"#,
        );
        let playlist = parsed.playlists.expect("playlists").playlist.remove(0);
        assert_eq!(playlist.name, "Drive");
        assert_eq!(playlist.comment.as_deref(), Some("night"));
    }

    #[test]
    fn artists_flatten_across_index_buckets() {
        let parsed = body(
            r#"{"subsonic-response":{"status":"ok","artists":{"ignoredArticles":"The","index":[{"name":"M","artist":[{"id":"ar-1","name":"Muse"}]},{"name":"R","artist":[{"id":"ar-2","name":"Radiohead","artistImageUrl":"https://example.test/r.jpg"}]}]}}}"#,
        );
        let artists = flatten_artists(parsed.artists);
        assert_eq!(artists.len(), 2);
        assert_eq!(artists[0].name, "Muse");
        assert_eq!(
            artists[1].artist_image_url.as_deref(),
            Some("https://example.test/r.jpg")
        );
    }

    #[test]
    fn album_songs_sort_by_disc_then_track() {
        let parsed = body(
            r#"{"subsonic-response":{"status":"ok","album":{"song":[{"id":"c","title":"C","track":1,"discNumber":2},{"id":"b","title":"B","track":2},{"id":"a","title":"A","track":1}]}}}"#,
        );
        let ordered = in_disc_order(parsed.album.expect("album").song);
        let ids = ordered
            .iter()
            .map(|song| song.id.as_str())
            .collect::<Vec<_>>();
        assert_eq!(ids, vec!["a", "b", "c"]);
    }

    #[test]
    fn navidrome_login_payload_yields_a_reusable_salt_and_token() {
        let login = serde_json::from_str::<AuthLogin>(
            r#"{"id":"1","name":"Alice","username":"alice","isAdmin":false,"token":"jwt","subsonicSalt":"a1b2c3","subsonicToken":"26719a1196d2a940705a59634eb18eab"}"#,
        )
        .expect("login payload");
        assert_eq!(login.username.as_deref(), Some("alice"));
        assert_eq!(login.salt.as_deref(), Some("a1b2c3"));
        assert_eq!(
            login.token.as_deref(),
            Some("26719a1196d2a940705a59634eb18eab")
        );
    }
}
