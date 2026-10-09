use super::{catalog, innertube::Client, ytdlp};
use crate::music::MusicVideoPage;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Deserialize, Serialize)]
struct Cursor {
    query: String,
    regular: bool,
    token: Option<String>,
    offset: usize,
}

pub async fn search(
    client: &Client,
    app: &tauri::AppHandle,
    query: &str,
    regular: bool,
    cursor: Option<&str>,
) -> Result<MusicVideoPage, String> {
    let previous = cursor.map(|raw| decode(raw, query, regular)).transpose()?;
    let (tracks, token, offset) = if regular {
        let offset = previous.as_ref().map_or(0, |c| c.offset);
        let (tracks, more) = ytdlp::search_video_page(app, query, offset, 24).await?;
        (tracks, more.then(String::new), offset + 24)
    } else {
        let response = if let Some(token) = previous.as_ref().and_then(|c| c.token.as_deref()) {
            client.search_continuation(app, token).await?
        } else {
            client
                .search(app, query, super::innertube::VIDEOS_FILTER)
                .await?
        };
        let token = continuation(&response)
            .filter(|token| previous.as_ref().and_then(|c| c.token.as_ref()) != Some(token));
        (
            catalog::video_results_kind(&response, usize::MAX, false),
            token,
            0,
        )
    };
    let next = token
        .map(|token| {
            serde_json::to_string(&Cursor {
                query: query.to_string(),
                regular,
                token: Some(token),
                offset,
            })
        })
        .transpose()
        .map_err(|_| "Could not save video continuation")?;
    Ok(MusicVideoPage { tracks, next })
}

fn decode(raw: &str, query: &str, regular: bool) -> Result<Cursor, String> {
    if raw.len() > 32768 {
        return Err("Invalid video continuation".into());
    }
    let cursor: Cursor = serde_json::from_str(raw).map_err(|_| "Invalid video continuation")?;
    if cursor.query != query
        || cursor.regular != regular
        || cursor.offset.checked_add(25).is_none()
        || (!regular && cursor.token.as_ref().is_none_or(String::is_empty))
    {
        return Err("Video continuation does not match this search".into());
    }
    Ok(cursor)
}

fn continuation(value: &Value) -> Option<String> {
    match value {
        Value::Object(object) => {
            for key in ["nextContinuationData", "continuationCommand"] {
                if let Some(token) = object
                    .get(key)
                    .and_then(|v| {
                        v.get(if key == "nextContinuationData" {
                            "continuation"
                        } else {
                            "token"
                        })
                    })
                    .and_then(Value::as_str)
                    .filter(|s| !s.is_empty())
                {
                    return Some(token.to_string());
                }
            }
            object.values().find_map(continuation)
        }
        Value::Array(items) => items.iter().find_map(continuation),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn video_continuation_accepts_music_shelves_and_continuation_items() {
        assert_eq!(continuation(&json!({"continuationContents":{"musicShelfContinuation":{"continuations":[{"nextContinuationData":{"continuation":"second"}}]}}})).as_deref(), Some("second"));
        assert_eq!(continuation(&json!({"contents":[{"continuationItemRenderer":{"continuationEndpoint":{"continuationCommand":{"token":"third"}}}}]})).as_deref(), Some("third"));
        assert!(continuation(&json!({"contents":[]})).is_none());
    }
    #[test]
    fn video_cursor_is_bound_to_query_and_source() {
        let raw = serde_json::to_string(&Cursor {
            query: "rap".into(),
            regular: false,
            token: Some("next".into()),
            offset: 0,
        })
        .unwrap();
        assert!(decode(&raw, "rap", false).is_ok());
        assert!(decode(&raw, "pop", false).is_err());
        assert!(decode(&raw, "rap", true).is_err());
        assert!(decode("not json", "rap", false).is_err());
    }
}
