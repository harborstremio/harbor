use super::super::{
    MusicArtistRef, MusicCatalogItem, MusicCatalogKind, MusicCatalogPage, MusicCatalogScope,
};
use super::{api, library, parse, SpotifyState};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Cursor {
    artist: String,
    collection: String,
    offset: usize,
}

fn offset(cursor: Option<&str>, artist: &str) -> Result<usize, String> {
    let Some(cursor) = cursor else {
        return Ok(0);
    };
    let cursor: Cursor =
        serde_json::from_str(cursor).map_err(|_| "Spotify album cursor is invalid".to_string())?;
    if cursor.artist != artist
        || cursor.collection != "albums"
        || cursor.offset == 0
        || cursor.offset > 100_000
    {
        return Err("Spotify album cursor does not match this artist".to_string());
    }
    Ok(cursor.offset)
}

pub async fn load(
    state: &SpotifyState,
    artist: &MusicArtistRef,
    kind: MusicCatalogKind,
    cursor: Option<&str>,
) -> Result<MusicCatalogPage, String> {
    let id = library::spotify_id(&artist.id, "artist")?;
    let token = state.web_token().await?;
    if kind == MusicCatalogKind::Tracks {
        if cursor.is_some() {
            return Err("Spotify top tracks have no continuation".to_string());
        }
        let body = api::artist_top_tracks(state.http(), &token, &id, &state.market()).await?;
        let tracks = body
            .get("tracks")
            .and_then(Value::as_array)
            .ok_or_else(|| "Spotify top tracks response is invalid".to_string())?;
        let items: Vec<_> = tracks
            .iter()
            .filter_map(parse::track)
            .map(MusicCatalogItem::Track)
            .collect();
        return Ok(MusicCatalogPage {
            total: Some(items.len() as u64),
            items,
            next_cursor: None,
            scope: MusicCatalogScope::Top,
        });
    }
    let at = offset(cursor, &id)?;
    let path = format!("/artists/{id}/albums");
    let body = api::get(
        state.http(),
        &token,
        &path,
        &[
            ("limit", "10".to_string()),
            ("offset", at.to_string()),
            (
                "include_groups",
                "album,single,appears_on,compilation".to_string(),
            ),
            ("market", state.market()),
        ],
    )
    .await?;
    let albums = body
        .get("items")
        .and_then(Value::as_array)
        .ok_or_else(|| "Spotify album response is invalid".to_string())?;
    let next = library::next_offset(&body, at, albums.len(), &[&path])?;
    let next_cursor = next
        .map(|offset| {
            serde_json::to_string(&Cursor {
                artist: id,
                collection: "albums".to_string(),
                offset,
            })
        })
        .transpose()
        .map_err(|error| error.to_string())?;
    Ok(MusicCatalogPage {
        items: albums
            .iter()
            .filter_map(parse::album)
            .map(MusicCatalogItem::Album)
            .collect(),
        next_cursor,
        total: body.get("total").and_then(Value::as_u64),
        scope: MusicCatalogScope::Catalog,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn album_cursor_is_bound_to_artist_and_collection() {
        assert_eq!(offset(None, "artist").unwrap(), 0);
        assert_eq!(
            offset(
                Some(r#"{"artist":"artist","collection":"albums","offset":50}"#),
                "artist"
            )
            .unwrap(),
            50
        );
        assert!(offset(
            Some(r#"{"artist":"other","collection":"albums","offset":50}"#),
            "artist"
        )
        .is_err());
        assert!(offset(
            Some(r#"{"artist":"artist","collection":"tracks","offset":50}"#),
            "artist"
        )
        .is_err());
        assert!(offset(
            Some(r#"{"artist":"artist","collection":"albums","offset":0}"#),
            "artist"
        )
        .is_err());
        assert!(offset(Some("not-json"), "artist").is_err());
    }
}
