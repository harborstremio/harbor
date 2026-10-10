use super::queries::{albums, artist_refs, tracks, ALBUM_COLUMNS, ARTIST_COLUMNS, TRACK_COLUMNS};
use crate::music::db::MusicDb;
use crate::music::{
    MusicAlbumRef, MusicArtistRef, MusicCatalogItem, MusicSearchResults, MusicTrack,
};
use rusqlite::params;

pub fn typed(database: &MusicDb, query: &str, limit: usize) -> Result<MusicSearchResults, String> {
    let tracks = tracks_matching(database, query, limit)?;
    Ok(MusicSearchResults {
        top: tracks.first().cloned().map(MusicCatalogItem::Track),
        tracks,
        albums: albums_matching(database, query, limit)?,
        artists: artists_matching(database, query, limit)?,
        playlists: Vec::new(),
    })
}

pub fn tracks_matching(
    database: &MusicDb,
    query: &str,
    limit: usize,
) -> Result<Vec<MusicTrack>, String> {
    tracks(
        database,
        &format!(
            r#"
SELECT {TRACK_COLUMNS}
FROM music_tracks t
WHERE t.connector = 'local'
  AND (t.title LIKE ?1 ESCAPE '\' OR t.artist LIKE ?1 ESCAPE '\' OR t.album LIKE ?1 ESCAPE '\')
ORDER BY CASE WHEN t.title LIKE ?2 ESCAPE '\' THEN 0 ELSE 1 END, t.title COLLATE NOCASE
LIMIT ?3
"#
        ),
        params![contains(query), prefix(query), limit as i64],
    )
}

fn albums_matching(
    database: &MusicDb,
    query: &str,
    limit: usize,
) -> Result<Vec<MusicAlbumRef>, String> {
    albums(
        database,
        &format!(
            r#"
SELECT {ALBUM_COLUMNS}
FROM music_local_files lf
JOIN music_tracks t ON t.id = lf.track_id
WHERE lf.album_key IS NOT NULL
GROUP BY lf.album_key
HAVING MAX(t.album) LIKE ?1 ESCAPE '\'
    OR MAX(COALESCE(NULLIF(lf.album_artist, ''), t.artist)) LIKE ?1 ESCAPE '\'
ORDER BY MAX(t.album) COLLATE NOCASE
LIMIT ?2
"#
        ),
        params![contains(query), limit as i64],
    )
}

fn artists_matching(
    database: &MusicDb,
    query: &str,
    limit: usize,
) -> Result<Vec<MusicArtistRef>, String> {
    artist_refs(
        database,
        &format!(
            r#"
SELECT {ARTIST_COLUMNS}
FROM music_local_files lf
JOIN music_tracks t ON t.id = lf.track_id
WHERE lf.artist_key IS NOT NULL
GROUP BY lf.artist_key
HAVING MAX(COALESCE(NULLIF(lf.album_artist, ''), t.artist)) LIKE ?1 ESCAPE '\'
ORDER BY COUNT(*) DESC
LIMIT ?2
"#
        ),
        params![contains(query), limit as i64],
    )
}

fn contains(query: &str) -> String {
    format!("%{}%", escape_like(query))
}

fn prefix(query: &str) -> String {
    format!("{}%", escape_like(query))
}

fn escape_like(query: &str) -> String {
    let mut escaped = String::with_capacity(query.len());
    for character in query.trim().chars() {
        if matches!(character, '%' | '_' | '\\') {
            escaped.push('\\');
        }
        escaped.push(character);
    }
    escaped
}

#[cfg(test)]
mod tests {
    use super::super::fixtures;
    use super::*;

    #[test]
    fn a_search_matches_title_artist_and_album() {
        let database = fixtures::library();
        assert_eq!(
            tracks_matching(&database, "hyst", 10).expect("title").len(),
            1
        );
        assert_eq!(
            tracks_matching(&database, "absolution", 10)
                .expect("album")
                .len(),
            2
        );
        assert_eq!(
            tracks_matching(&database, "nina", 10)
                .expect("artist")
                .len(),
            1
        );
        assert!(tracks_matching(&database, "nothing", 10)
            .expect("miss")
            .is_empty());
    }

    #[test]
    fn exact_title_prefixes_are_ranked_first() {
        let database = fixtures::library();
        let found = tracks_matching(&database, "sinnerman", 10).expect("prefix");
        assert_eq!(found[0].title, "Sinnerman");
    }

    #[test]
    fn wildcards_in_a_query_are_treated_as_literal_text() {
        let database = fixtures::library();
        assert!(tracks_matching(&database, "%", 10)
            .expect("wildcard")
            .is_empty());
        assert_eq!(escape_like("50%_off\\"), "50\\%\\_off\\\\");
        assert_eq!(contains(" muse "), "%muse%");
        assert_eq!(prefix(" muse "), "muse%");
    }

    #[test]
    fn typed_results_carry_albums_artists_and_a_top_track() {
        let database = fixtures::library();
        let results = typed(&database, "muse", 10).expect("typed results");
        assert_eq!(results.tracks.len(), 2);
        assert_eq!(results.albums.len(), 1);
        assert_eq!(results.albums[0].title, "Absolution");
        assert_eq!(results.artists.len(), 1);
        assert_eq!(results.artists[0].name, "Muse");
        assert!(results.playlists.is_empty());
        let Some(MusicCatalogItem::Track(top)) = results.top else {
            panic!("a top track");
        };
        assert_eq!(top.artist, "Muse");
    }

    #[test]
    fn a_search_with_no_matches_returns_empty_typed_results() {
        let database = fixtures::library();
        let results = typed(&database, "nothing at all", 10).expect("typed results");
        assert!(results.top.is_none());
        assert!(results.tracks.is_empty());
        assert!(results.albums.is_empty());
        assert!(results.artists.is_empty());
    }
}
