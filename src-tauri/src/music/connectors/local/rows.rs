use super::queries;
use crate::music::db::MusicDb;
use crate::music::{MusicCatalogItem, MusicCatalogRow, MusicRowLayout};

const ALBUM_LIMIT: usize = 20;
const ARTIST_LIMIT: usize = 20;
const LIKED_LIMIT: usize = 9;

pub fn home(database: &MusicDb) -> Result<Vec<MusicCatalogRow>, String> {
    let mut rows = Vec::new();
    let albums = queries::recent_albums(database, ALBUM_LIMIT)?;
    if !albums.is_empty() {
        rows.push(row(
            "local:albums",
            "music.row.server",
            MusicRowLayout::Covers,
            albums.into_iter().map(MusicCatalogItem::Album).collect(),
        ));
    }
    let artists = queries::artists(database, ARTIST_LIMIT)?;
    if !artists.is_empty() {
        rows.push(row(
            "local:artists",
            "music.row.artists",
            MusicRowLayout::Circles,
            artists.into_iter().map(MusicCatalogItem::Artist).collect(),
        ));
    }
    let liked = queries::liked_tracks(database, LIKED_LIMIT)?;
    if !liked.is_empty() {
        rows.push(row(
            "local:liked",
            "music.row.liked",
            MusicRowLayout::TrackGrid,
            liked.into_iter().map(MusicCatalogItem::Track).collect(),
        ));
    }
    Ok(rows)
}

fn row(
    id: &str,
    title: &str,
    layout: MusicRowLayout,
    items: Vec<MusicCatalogItem>,
) -> MusicCatalogRow {
    MusicCatalogRow {
        id: id.to_string(),
        title: title.to_string(),
        title_literal: false,
        subtitle: None,
        layout,
        source: "local".to_string(),
        items,
    }
}

#[cfg(test)]
mod tests {
    use super::super::fixtures;
    use super::*;

    #[test]
    fn an_empty_library_produces_no_rows() {
        assert!(home(&fixtures::database()).expect("rows").is_empty());
    }

    #[test]
    fn a_scanned_library_produces_album_and_artist_rows() {
        let database = fixtures::library();
        let rows = home(&database).expect("rows");
        assert_eq!(
            rows.iter().map(|row| row.id.as_str()).collect::<Vec<_>>(),
            vec!["local:albums", "local:artists"]
        );
        assert_eq!(rows[0].title, "music.row.server");
        assert!(!rows[0].title_literal);
        assert!(rows[0].subtitle.is_none());
        assert_eq!(rows[0].source, "local");
        assert_eq!(rows[0].layout, MusicRowLayout::Covers);
        assert_eq!(rows[0].items.len(), 2);
        assert_eq!(rows[1].layout, MusicRowLayout::Circles);
        assert!(matches!(rows[0].items[0], MusicCatalogItem::Album(_)));
        assert!(matches!(rows[1].items[0], MusicCatalogItem::Artist(_)));
    }

    #[test]
    fn liked_local_tracks_add_a_track_grid() {
        let database = fixtures::library();
        fixtures::like(&database, "/m/1.flac", 100);
        let rows = home(&database).expect("rows");
        let liked = rows.last().expect("a liked row");
        assert_eq!(liked.id, "local:liked");
        assert_eq!(liked.title, "music.row.liked");
        assert_eq!(liked.layout, MusicRowLayout::TrackGrid);
        assert!(matches!(liked.items[0], MusicCatalogItem::Track(_)));
    }
}
