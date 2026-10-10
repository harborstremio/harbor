use super::queries::{albums, artist_refs, tracks, ALBUM_COLUMNS, ARTIST_COLUMNS, TRACK_COLUMNS};
use crate::music::db::MusicDb;
use crate::music::MusicCatalogItem;
use rusqlite::params;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalMusicPage {
    pub items: Vec<MusicCatalogItem>,
    pub next_offset: Option<usize>,
}

#[cfg(test)]
pub fn page(
    database: &MusicDb,
    kind: &str,
    query: &str,
    offset: usize,
    limit: usize,
) -> Result<LocalMusicPage, String> {
    filtered_page(database, kind, query, offset, limit, None)
}

pub fn filtered_page(
    database: &MusicDb,
    kind: &str,
    query: &str,
    offset: usize,
    limit: usize,
    artist_key: Option<&str>,
) -> Result<LocalMusicPage, String> {
    super::store::ensure_schema(database)?;
    if query.len() > 200 || offset > 1_000_000 {
        return Err("Local library query is too large".into());
    }
    let limit = limit.clamp(1, 96);
    let take = (limit + 1) as i64;
    let pattern = format!(
        "%{}%",
        query
            .trim()
            .replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_")
    );
    let offset_sql = offset as i64;
    let mut items = match kind {
        "albums" => albums(database, &format!(r#"
SELECT {ALBUM_COLUMNS} FROM music_local_files lf JOIN music_tracks t ON t.id = lf.track_id
WHERE lf.album_key IS NOT NULL
GROUP BY lf.album_key
HAVING MAX(t.album) LIKE ?1 ESCAPE '\' OR MAX(COALESCE(NULLIF(lf.album_artist, ''), t.artist)) LIKE ?1 ESCAPE '\'
ORDER BY MAX(t.album) COLLATE NOCASE, lf.album_key LIMIT ?2 OFFSET ?3
"#), params![pattern, take, offset_sql])?.into_iter().map(MusicCatalogItem::Album).collect::<Vec<_>>(),
        "artists" => artist_refs(database, &format!(r#"
SELECT {ARTIST_COLUMNS} FROM music_local_files lf JOIN music_tracks t ON t.id = lf.track_id
WHERE lf.artist_key IS NOT NULL
GROUP BY lf.artist_key
HAVING MAX(COALESCE(NULLIF(lf.album_artist, ''), t.artist)) LIKE ?1 ESCAPE '\'
ORDER BY MAX(COALESCE(NULLIF(lf.album_artist, ''), t.artist)) COLLATE NOCASE, lf.artist_key LIMIT ?2 OFFSET ?3
"#), params![pattern, take, offset_sql])?.into_iter().map(MusicCatalogItem::Artist).collect(),
        "tracks" => tracks(database, &format!(r#"
SELECT {TRACK_COLUMNS} FROM music_local_files lf JOIN music_tracks t ON t.id = lf.track_id
WHERE (?4 IS NULL OR lf.artist_key = ?4)
AND (t.title LIKE ?1 ESCAPE '\' OR t.artist LIKE ?1 ESCAPE '\' OR t.album LIKE ?1 ESCAPE '\')
ORDER BY CASE WHEN ?4 IS NOT NULL THEN t.album END COLLATE NOCASE,
CASE WHEN ?4 IS NOT NULL THEN COALESCE(lf.disc_no, 1) END,
CASE WHEN ?4 IS NOT NULL THEN COALESCE(lf.track_no, 0) END,
t.title COLLATE NOCASE, t.id LIMIT ?2 OFFSET ?3
"#), params![pattern, take, offset_sql, artist_key])?.into_iter().map(MusicCatalogItem::Track).collect(),
        _ => return Err("Unknown local library section".into()),
    };
    let next_offset = (items.len() > limit).then_some(offset + limit);
    items.truncate(limit);
    Ok(LocalMusicPage { items, next_offset })
}

#[cfg(test)]
mod tests {
    use super::super::fixtures;
    use super::*;

    #[test]
    fn paging_has_no_duplicate_or_missing_tracks() {
        let db = fixtures::library();
        let all = page(&db, "tracks", "", 0, 96).unwrap();
        let first = page(&db, "tracks", "", 0, 1).unwrap();
        assert_eq!(first.items.len(), 1);
        assert_eq!(first.next_offset, Some(1));
        let rest = page(&db, "tracks", "", 1, 96).unwrap();
        assert_eq!(first.items.len() + rest.items.len(), all.items.len());
        assert_eq!(rest.next_offset, None);
        let first_json = serde_json::to_value(&first.items[0]).unwrap();
        assert!(rest
            .items
            .iter()
            .all(|item| serde_json::to_value(item).unwrap() != first_json));
    }

    #[test]
    fn search_is_literal_and_unknown_sections_fail() {
        let db = fixtures::library();
        assert!(!page(&db, "albums", "Absolution", 0, 48)
            .unwrap()
            .items
            .is_empty());
        assert!(page(&db, "albums", "%", 0, 48).unwrap().items.is_empty());
        assert!(page(&db, "invalid", "", 0, 48).is_err());
    }

    #[test]
    fn artist_pages_exclude_other_artists_and_keep_album_order() {
        let db = fixtures::library();
        let artists = super::super::queries::artists(&db, 20).unwrap();
        let muse = artists.iter().find(|artist| artist.name == "Muse").unwrap();
        let first = filtered_page(&db, "tracks", "", 0, 1, Some(&muse.id)).unwrap();
        let second = filtered_page(
            &db,
            "tracks",
            "",
            first.next_offset.unwrap(),
            1,
            Some(&muse.id),
        )
        .unwrap();
        assert_eq!(second.next_offset, None);
        let values: Vec<_> = first.items.into_iter().chain(second.items).collect();
        let titles: Vec<_> = values
            .iter()
            .map(|item| match item {
                MusicCatalogItem::Track(track) => {
                    assert_eq!(track.artist, "Muse");
                    track.title.as_str()
                }
                _ => panic!("expected track"),
            })
            .collect();
        assert_eq!(titles, vec!["Apocalypse Please", "Hysteria"]);
        assert!(filtered_page(&db, "tracks", "", 0, 48, Some("missing"))
            .unwrap()
            .items
            .is_empty());
    }
}
