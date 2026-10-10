use super::super::engine::MusicDeckState;
use super::super::{
    library, m3u, MusicState, MusicTrack, ACTIVE_NONE, ACTIVE_SPOTIFY, ACTIVE_STREAM,
};
use super::search::resolve_track;

#[tauri::command]
pub async fn music_play_track(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    track: MusicTrack,
    volume: Option<f64>,
) -> Result<(), String> {
    let request = state.begin_play_request();
    let volume = volume.unwrap_or(0.82);
    if track.connector_id.as_deref() == Some("spotify") {
        let _commit = state.play_commit.lock().await;
        if !state.is_current_play_request(request) {
            return Ok(());
        }
        state.engine.stop(false).await?;
        if !state.is_current_play_request(request) {
            return Ok(());
        }
        state.spotify.play(track, volume).await?;
        state.set_active_engine(ACTIVE_SPOTIFY);
        return Ok(());
    }
    let stream = resolve_track(&app, state.inner(), &track).await;
    if !state.is_current_play_request(request) {
        return Ok(());
    }
    let stream = stream?;
    let _commit = state.play_commit.lock().await;
    if !state.is_current_play_request(request) {
        return Ok(());
    }
    state.spotify.stop(false).await?;
    if !state.is_current_play_request(request) {
        return Ok(());
    }
    state.engine.play(app, stream, track, volume).await?;
    state.set_active_engine(ACTIVE_STREAM);
    Ok(())
}

#[tauri::command]
pub async fn music_engine_pause(
    state: tauri::State<'_, MusicState>,
    paused: bool,
) -> Result<(), String> {
    match state.active_engine() {
        ACTIVE_SPOTIFY => state.spotify.set_paused(paused).await,
        ACTIVE_STREAM => state.engine.set_paused(paused).await,
        _ => Ok(()),
    }
}

/// Only true when a video silenced the music, so the offer to resume is never shown to
/// someone who paused it themselves.
#[tauri::command]
pub async fn music_paused_for_video(state: tauri::State<'_, MusicState>) -> Result<bool, String> {
    Ok(match state.active_engine() {
        ACTIVE_SPOTIFY => state.spotify.paused_for_video(),
        ACTIVE_STREAM => state.engine.paused_for_video(),
        _ => false,
    })
}

#[tauri::command]
pub async fn music_resume_after_video(state: tauri::State<'_, MusicState>) -> Result<(), String> {
    match state.active_engine() {
        ACTIVE_SPOTIFY => state.spotify.set_paused(false).await,
        ACTIVE_STREAM => state.engine.resume_after_video().await,
        _ => Ok(()),
    }
}

#[tauri::command]
pub async fn music_engine_seek(
    state: tauri::State<'_, MusicState>,
    position: f64,
) -> Result<(), String> {
    match state.active_engine() {
        ACTIVE_SPOTIFY => state.spotify.seek(position).await,
        ACTIVE_STREAM => state.engine.seek(position).await,
        _ => Ok(()),
    }
}

#[tauri::command]
pub async fn music_engine_set_volume(
    state: tauri::State<'_, MusicState>,
    volume: f64,
) -> Result<(), String> {
    match state.active_engine() {
        ACTIVE_SPOTIFY => state.spotify.set_volume(volume).await,
        ACTIVE_STREAM => state.engine.set_volume(volume).await,
        _ => Ok(()),
    }
}

#[tauri::command]
pub async fn music_engine_stop(
    state: tauri::State<'_, MusicState>,
    unpause: Option<bool>,
) -> Result<(), String> {
    let unpause = unpause.unwrap_or(false);
    let request = (!unpause).then(|| state.begin_play_request());
    let _commit = state.play_commit.lock().await;
    if request.is_some_and(|request| !state.is_current_play_request(request)) {
        return Ok(());
    }
    let result = match state.active_engine() {
        ACTIVE_SPOTIFY => state.spotify.stop(unpause).await,
        ACTIVE_STREAM => state.engine.stop(unpause).await,
        _ => Ok(()),
    };
    if !unpause && result.is_ok() {
        state.set_active_engine(ACTIVE_NONE);
    }
    result
}

#[tauri::command]
pub fn music_import_m3u(
    state: tauri::State<'_, MusicState>,
    path: String,
) -> Result<Vec<MusicTrack>, String> {
    m3u::import(&state.db, &path)
}

#[tauri::command]
pub async fn music_export_m3u(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    playlist_id: String,
    path: String,
) -> Result<(), String> {
    let tracks = library::tracks_for_playlist(&state.db, &playlist_id)?;
    let mut resolved = Vec::with_capacity(tracks.len());
    for track in tracks {
        let stream = resolve_track(&app, state.inner(), &track).await?;
        resolved.push((track, stream.url));
    }
    m3u::export(&path, &resolved)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn a_slow_old_resolver_cannot_replace_the_newest_request() {
        let state = MusicState::new();
        let old = state.begin_play_request();
        let newest = state.begin_play_request();
        {
            let _commit = state.play_commit.lock().await;
            assert!(state.is_current_play_request(newest));
        }
        let _old_commit = state.play_commit.lock().await;
        assert!(!state.is_current_play_request(old));
    }

    #[test]
    fn stop_invalidates_a_pending_resolution() {
        let state = MusicState::new();
        let pending = state.begin_play_request();
        let stop = state.begin_play_request();
        assert!(!state.is_current_play_request(pending));
        assert!(state.is_current_play_request(stop));
    }
}

#[tauri::command]
pub async fn music_deck_loop(
    state: tauri::State<'_, MusicState>,
    start: Option<f64>,
    end: Option<f64>,
) -> Result<(), String> {
    if state.active_engine() != ACTIVE_STREAM {
        return Ok(());
    }
    state.engine.set_loop(start, end).await
}

#[tauri::command]
pub async fn music_deck_scratch(
    state: tauri::State<'_, MusicState>,
    position: f64,
    rate: f64,
    holding: bool,
) -> Result<f64, String> {
    match state.active_engine() {
        ACTIVE_STREAM => state.engine.scratch(position, rate, holding).await,
        ACTIVE_SPOTIFY if !holding => state.spotify.seek(position).await.map(|()| position),
        _ => Ok(position),
    }
}

#[tauri::command]
pub async fn music_deck_play(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    deck: u8,
    track: MusicTrack,
    volume: Option<f64>,
) -> Result<(), String> {
    if deck == 0 {
        return music_play_track(app, state, track, volume).await;
    }
    if track.connector_id.as_deref() == Some("spotify") {
        return Err("Spotify plays on the main deck only".to_string());
    }
    let volume = volume.unwrap_or(0.82);
    let stream = resolve_track(&app, state.inner(), &track).await?;
    state
        .engine
        .deck_play(app, usize::from(deck), stream, track, volume)
        .await
}

#[tauri::command]
pub async fn music_deck_pause(
    state: tauri::State<'_, MusicState>,
    deck: u8,
    paused: bool,
) -> Result<(), String> {
    if deck == 0 {
        return music_engine_pause(state, paused).await;
    }
    state.engine.deck_pause(usize::from(deck), paused).await
}

#[tauri::command]
pub async fn music_deck_seek(
    state: tauri::State<'_, MusicState>,
    deck: u8,
    position: f64,
) -> Result<(), String> {
    if deck == 0 {
        return music_engine_seek(state, position).await;
    }
    state.engine.deck_seek(usize::from(deck), position).await
}

#[tauri::command]
pub async fn music_deck_volume(
    state: tauri::State<'_, MusicState>,
    deck: u8,
    volume: f64,
) -> Result<(), String> {
    if deck == 0 {
        return music_engine_set_volume(state, volume).await;
    }
    state.engine.deck_volume(usize::from(deck), volume).await
}

#[tauri::command]
pub async fn music_deck_stop(
    state: tauri::State<'_, MusicState>,
    deck: u8,
) -> Result<(), String> {
    if deck == 0 {
        return music_engine_stop(state, Some(false)).await;
    }
    state.engine.deck_stop(usize::from(deck)).await
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicDeckSnapshot {
    pub decks: Vec<MusicDeckState>,
    pub primary: u8,
}

#[tauri::command]
pub async fn music_deck_states(
    state: tauri::State<'_, MusicState>,
) -> Result<MusicDeckSnapshot, String> {
    Ok(MusicDeckSnapshot {
        decks: state.engine.deck_states().await,
        primary: u8::try_from(state.engine.primary_deck()).unwrap_or(0),
    })
}

#[tauri::command]
pub async fn music_deck_primary(
    state: tauri::State<'_, MusicState>,
    deck: u8,
) -> Result<bool, String> {
    Ok(state.engine.set_primary_deck(usize::from(deck)).await)
}

#[tauri::command]
pub async fn music_deck_crossfade(
    state: tauri::State<'_, MusicState>,
    position: f64,
) -> Result<(), String> {
    state.engine.set_crossfade(position).await
}

#[tauri::command]
pub fn music_deck_crossfade_get(state: tauri::State<'_, MusicState>) -> f64 {
    state.engine.crossfade()
}
