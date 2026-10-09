use super::super::audio::fx::{self, MusicFx};
use super::super::MusicState;

async fn reapply(state: &MusicState) -> Result<(), String> {
    let settings = state.engine.audio_settings()?;
    state.engine.set_audio_settings(settings).await.map(|_| ())
}

#[tauri::command]
pub async fn music_fx_set(
    state: tauri::State<'_, MusicState>,
    fx: MusicFx,
) -> Result<MusicFx, String> {
    let previous = fx::snapshot();
    let stored = fx::store(fx);
    if let Err(error) = reapply(state.inner()).await {
        fx::store(previous);
        let _ = reapply(state.inner()).await;
        return Err(error);
    }
    Ok(stored)
}

#[tauri::command]
pub async fn music_fx_clear(state: tauri::State<'_, MusicState>) -> Result<MusicFx, String> {
    let stored = fx::store(MusicFx::OFF);
    reapply(state.inner()).await?;
    Ok(stored)
}

#[tauri::command]
pub fn music_fx_get() -> MusicFx {
    fx::snapshot()
}
