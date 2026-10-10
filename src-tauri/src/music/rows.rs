use super::db::{now_seconds, MusicDb};
use super::matching::track_identity;
use super::{MusicCatalogItem, MusicCatalogRow, MusicRowLayout, MusicSearchResults};
use rusqlite::params;
use std::collections::HashSet;
use std::time::Duration;

pub const ROW_CACHE_TTL: Duration = Duration::from_secs(6 * 60 * 60);

pub fn source_rank(source: &str) -> u8 {
    match source {
        "catalog" => 0,
        "spotify" => 1,
        "youtube" => 2,
        "soundcloud" => 3,
        "local" => 4,
        "jellyfin" => 5,
        "plex" => 6,
        "subsonic" => 7,
        _ => 8,
    }
}

pub fn order_rows(
    results: Vec<(String, Result<Vec<MusicCatalogRow>, String>)>,
) -> Vec<MusicCatalogRow> {
    let mut ordered = results
        .into_iter()
        .filter_map(|(source, rows)| rows.ok().map(|rows| (source, rows)))
        .collect::<Vec<_>>();
    ordered.sort_by(|left, right| {
        source_rank(&left.0)
            .cmp(&source_rank(&right.0))
            .then_with(|| left.0.cmp(&right.0))
    });
    let mut seen = HashSet::new();
    ordered
        .into_iter()
        .flat_map(|(_, rows)| rows)
        .filter(|row| seen.insert(row.id.clone()))
        .collect()
}

pub fn cached(database: &MusicDb, source: Option<&str>) -> Result<Vec<MusicCatalogRow>, String> {
    let fresh_after = now_seconds().saturating_sub(ROW_CACHE_TTL.as_secs() as i64);
    database.with_connection(|connection| {
        let mut statement = connection
            .prepare(
                r#"
SELECT id, title, title_literal, subtitle, layout, source
FROM catalog_rows
WHERE CAST(fetched_at AS INTEGER) >= ?1 AND (?2 IS NULL OR source = ?2)
ORDER BY position, id
"#,
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![fresh_after, source], |row| {
                Ok(MusicCatalogRow {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    title_literal: row.get::<_, i64>(2)? != 0,
                    subtitle: row.get(3)?,
                    layout: MusicRowLayout::from_str(&row.get::<_, String>(4)?),
                    source: row.get(5)?,
                    items: Vec::new(),
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        let mut items = connection
            .prepare("SELECT payload FROM catalog_row_items WHERE row_id = ?1 ORDER BY position")
            .map_err(|error| error.to_string())?;
        rows.into_iter()
            .map(|mut row| {
                let payloads = items
                    .query_map(params![row.id], |item| item.get::<_, String>(0))
                    .map_err(|error| error.to_string())?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|error| error.to_string())?;
                row.items = payloads
                    .iter()
                    .filter_map(|payload| serde_json::from_str::<MusicCatalogItem>(payload).ok())
                    .collect();
                Ok(row)
            })
            .collect::<Result<Vec<_>, String>>()
    })
}

pub fn store(database: &MusicDb, rows: &[MusicCatalogRow]) -> Result<(), String> {
    let fetched_at = now_seconds().to_string();
    database.with_connection(|connection| {
        let transaction = connection.transaction().map_err(|error| error.to_string())?;
        let mut sources = rows.iter().map(|row| row.source.clone()).collect::<Vec<_>>();
        sources.sort();
        sources.dedup();
        for source in sources {
            transaction
                .execute("DELETE FROM catalog_rows WHERE source = ?1", params![source])
                .map_err(|error| error.to_string())?;
        }
        for (position, row) in rows.iter().enumerate() {
            transaction
                .execute(
                    r#"
INSERT INTO catalog_rows (id, title, title_literal, subtitle, layout, source, position, fetched_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  title_literal = excluded.title_literal,
  subtitle = excluded.subtitle,
  layout = excluded.layout,
  source = excluded.source,
  position = excluded.position,
  fetched_at = excluded.fetched_at
"#,
                    params![
                        row.id,
                        row.title,
                        i64::from(row.title_literal),
                        row.subtitle,
                        row.layout.as_str(),
                        row.source,
                        position as i64,
                        fetched_at,
                    ],
                )
                .map_err(|error| error.to_string())?;
            transaction
                .execute(
                    "DELETE FROM catalog_row_items WHERE row_id = ?1",
                    params![row.id],
                )
                .map_err(|error| error.to_string())?;
            for (index, item) in row.items.iter().enumerate() {
                let payload = serde_json::to_string(item).map_err(|error| error.to_string())?;
                transaction
                    .execute(
                        "INSERT INTO catalog_row_items (row_id, position, payload) VALUES (?1, ?2, ?3)",
                        params![row.id, index as i64, payload],
                    )
                    .map_err(|error| error.to_string())?;
            }
        }
        transaction.commit().map_err(|error| error.to_string())
    })
}

pub(super) fn merge_typed_results(
    results: Vec<(String, Result<MusicSearchResults, String>)>,
    limit: usize,
) -> Result<MusicSearchResults, String> {
    let mut errors = Vec::new();
    let mut settled = Vec::new();
    for (connector, result) in results {
        match result {
            Ok(value) => settled.push(value),
            Err(error) => errors.push(format!("{connector}: {error}")),
        }
    }
    if settled.is_empty() {
        return Err(if errors.is_empty() {
            "Music sources are offline".to_string()
        } else {
            errors.join("; ")
        });
    }

    let mut merged = MusicSearchResults {
        top: settled.iter().find_map(|value| value.top.clone()),
        ..MusicSearchResults::default()
    };
    let mut seen = HashSet::new();
    let depth = settled
        .iter()
        .map(|value| value.tracks.len())
        .max()
        .unwrap_or(0);
    for index in 0..depth {
        for value in &settled {
            let Some(track) = value.tracks.get(index) else {
                continue;
            };
            if merged.tracks.len() >= limit {
                break;
            }
            if seen.insert(track_identity(track)) {
                merged.tracks.push(track.clone());
            }
        }
    }

    let mut albums = HashSet::new();
    let mut artists = HashSet::new();
    let mut playlists = HashSet::new();
    for value in settled {
        for album in value.albums {
            let key = (
                album.title.trim().to_lowercase(),
                album.artist.trim().to_lowercase(),
            );
            if merged.albums.len() < limit && albums.insert(key) {
                merged.albums.push(album);
            }
        }
        for artist in value.artists {
            let key = artist.name.trim().to_lowercase();
            if merged.artists.len() < limit && artists.insert(key) {
                merged.artists.push(artist);
            }
        }
        for playlist in value.playlists {
            let key = (
                playlist.name.trim().to_lowercase(),
                playlist.connector_id.clone(),
            );
            if merged.playlists.len() < limit && playlists.insert(key) {
                merged.playlists.push(playlist);
            }
        }
    }
    Ok(merged)
}

#[cfg(test)]
mod tests {
    use super::super::MusicTrack;
    use super::*;

    fn track(title: &str, artist: &str) -> MusicTrack {
        MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            id: format!("{title}:{artist}"),
            connector_id: Some("youtube".to_string()),
            source_id: Some(title.to_string()),
            playback_url: None,
            title: title.to_string(),
            artist: artist.to_string(),
            album: None,
            artwork: String::new(),
            duration_seconds: 227,
            duration_label: "3:47".to_string(),
        }
    }

    fn row(id: &str, source: &str) -> MusicCatalogRow {
        MusicCatalogRow {
            id: id.to_string(),
            title: "music.row.newReleases".to_string(),
            title_literal: false,
            subtitle: Some("ListenBrainz".to_string()),
            layout: MusicRowLayout::Covers,
            source: source.to_string(),
            items: vec![MusicCatalogItem::Track(track("Hysteria", "Muse"))],
        }
    }

    #[test]
    fn rows_are_ordered_by_source_and_keep_partial_results() {
        let ordered = order_rows(vec![
            (
                "soundcloud".to_string(),
                Ok(vec![row("sc:one", "soundcloud")]),
            ),
            ("catalog".to_string(), Ok(vec![row("cat:one", "catalog")])),
            ("youtube".to_string(), Err("timed out".to_string())),
            ("spotify".to_string(), Ok(vec![row("sp:one", "spotify")])),
        ]);
        assert_eq!(
            ordered
                .iter()
                .map(|row| row.id.as_str())
                .collect::<Vec<_>>(),
            vec!["cat:one", "sp:one", "sc:one"]
        );
    }

    #[test]
    fn duplicate_row_ids_collapse_to_the_highest_ranked_source() {
        let ordered = order_rows(vec![
            (
                "soundcloud".to_string(),
                Ok(vec![row("shared", "soundcloud")]),
            ),
            ("catalog".to_string(), Ok(vec![row("shared", "catalog")])),
        ]);
        assert_eq!(ordered.len(), 1);
        assert_eq!(ordered[0].source, "catalog");
    }

    #[test]
    fn cached_rows_round_trip_through_the_database() {
        let database = MusicDb::in_memory();
        store(
            &database,
            &[row("cat:one", "catalog"), row("sp:one", "spotify")],
        )
        .expect("store rows");
        let restored = cached(&database, None).expect("read rows");
        assert_eq!(restored.len(), 2);
        assert_eq!(restored[0].id, "cat:one");
        assert_eq!(restored[0].subtitle.as_deref(), Some("ListenBrainz"));
        assert_eq!(restored[0].layout, MusicRowLayout::Covers);
        assert_eq!(restored[0].items.len(), 1);

        let scoped = cached(&database, Some("spotify")).expect("read scoped rows");
        assert_eq!(scoped.len(), 1);
        assert_eq!(scoped[0].source, "spotify");
    }

    #[test]
    fn stale_rows_are_not_served_from_the_cache() {
        let database = MusicDb::in_memory();
        store(&database, &[row("cat:one", "catalog")]).expect("store rows");
        database
            .with_connection(|connection| {
                connection
                    .execute("UPDATE catalog_rows SET fetched_at = '0'", [])
                    .map(|_| ())
                    .map_err(|error| error.to_string())
            })
            .expect("expire rows");
        assert!(cached(&database, None).expect("read rows").is_empty());
    }

    #[test]
    fn typed_results_merge_and_deduplicate_by_title_and_artist() {
        let left = MusicSearchResults {
            top: Some(MusicCatalogItem::Track(track("Hysteria", "Muse"))),
            tracks: vec![
                track("Hysteria", "Muse"),
                track("Stockholm Syndrome", "Muse"),
            ],
            ..MusicSearchResults::default()
        };
        let right = MusicSearchResults {
            top: Some(MusicCatalogItem::Track(track(
                "Time Is Running Out",
                "Muse",
            ))),
            tracks: vec![
                track("HYSTERIA", "muse"),
                track("Time Is Running Out", "Muse"),
            ],
            ..MusicSearchResults::default()
        };
        let merged = merge_typed_results(
            vec![
                ("spotify".to_string(), Ok(left)),
                ("youtube".to_string(), Ok(right)),
                ("soundcloud".to_string(), Err("offline".to_string())),
            ],
            10,
        )
        .expect("merged results");
        assert_eq!(
            merged
                .tracks
                .iter()
                .map(|track| track.title.as_str())
                .collect::<Vec<_>>(),
            vec!["Hysteria", "Stockholm Syndrome", "Time Is Running Out"]
        );
        assert!(matches!(merged.top, Some(MusicCatalogItem::Track(_))));
    }

    #[test]
    fn typed_results_report_failure_when_every_connector_fails() {
        let error = merge_typed_results(
            vec![
                ("spotify".to_string(), Err("offline".to_string())),
                ("youtube".to_string(), Err("timed out".to_string())),
            ],
            10,
        )
        .expect_err("all connector failures");
        assert!(error.contains("spotify: offline"));
        assert!(error.contains("youtube: timed out"));
    }
}
