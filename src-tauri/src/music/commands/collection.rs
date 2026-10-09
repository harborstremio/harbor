use super::super::{
    bootstrap, library, store, MusicBootstrap, MusicMigration, MusicState, MusicStream, MusicTrack,
};
use tauri::Manager;

fn music_db_file(profile: Option<&str>) -> String {
    let id = profile.unwrap_or("").trim();
    if id.is_empty() || id == "default" {
        return "music.db".to_string();
    }
    let safe: String = id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '_' })
        .take(48)
        .collect();
    format!("music-{safe}.db")
}

#[tauri::command]
pub fn music_db_init(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    migration: Option<MusicMigration>,
    profile: Option<String>,
) -> Result<MusicBootstrap, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    state
        .db
        .initialize(&directory.join(music_db_file(profile.as_deref())))?;
    if let Some(migration) = migration {
        store::migrate(&state.db, &migration)?;
    }
    bootstrap(&state.db)
}

#[tauri::command]
pub fn music_track_upsert(
    state: tauri::State<'_, MusicState>,
    track: MusicTrack,
) -> Result<(), String> {
    state.db.upsert_track(&track)
}

#[tauri::command]
pub fn music_track_get(
    state: tauri::State<'_, MusicState>,
    id: String,
) -> Result<Option<MusicTrack>, String> {
    state.db.get_track(&id)
}

#[tauri::command]
pub fn music_resolve_cached(
    state: tauri::State<'_, MusicState>,
    id: String,
) -> Result<Option<MusicStream>, String> {
    state.db.cached_stream(&id)
}

#[tauri::command]
pub fn music_get_liked(state: tauri::State<'_, MusicState>) -> Result<Vec<MusicTrack>, String> {
    store::liked_tracks(&state.db)
}

#[tauri::command]
pub fn music_set_liked(
    state: tauri::State<'_, MusicState>,
    track: MusicTrack,
    liked: bool,
) -> Result<(), String> {
    store::set_liked(&state.db, &track, liked)
}

#[tauri::command]
pub fn music_get_recents(state: tauri::State<'_, MusicState>) -> Result<Vec<MusicTrack>, String> {
    store::recents(&state.db)
}

#[tauri::command]
pub fn music_add_recent(
    state: tauri::State<'_, MusicState>,
    track: MusicTrack,
) -> Result<(), String> {
    store::add_recent(&state.db, &track)
}

#[tauri::command]
pub fn music_get_queue(state: tauri::State<'_, MusicState>) -> Result<Vec<MusicTrack>, String> {
    store::queue(&state.db)
}

#[tauri::command]
pub fn music_set_queue(
    state: tauri::State<'_, MusicState>,
    tracks: Vec<MusicTrack>,
) -> Result<(), String> {
    store::set_queue(&state.db, &tracks)
}

#[tauri::command]
pub fn music_list_albums(
    state: tauri::State<'_, MusicState>,
) -> Result<Vec<library::MusicAlbum>, String> {
    library::list_albums(&state.db)
}

#[tauri::command]
pub fn music_list_artists(
    state: tauri::State<'_, MusicState>,
) -> Result<Vec<library::MusicArtist>, String> {
    library::list_artists(&state.db)
}

#[tauri::command]
pub fn music_list_playlists(
    state: tauri::State<'_, MusicState>,
) -> Result<Vec<library::MusicPlaylist>, String> {
    library::list_playlists(&state.db)
}

#[tauri::command]
pub fn music_create_playlist(
    state: tauri::State<'_, MusicState>,
    name: String,
) -> Result<library::MusicPlaylist, String> {
    library::create_playlist(&state.db, &name)
}

#[tauri::command]
pub fn music_add_to_playlist(
    state: tauri::State<'_, MusicState>,
    playlist_id: String,
    track: MusicTrack,
) -> Result<library::MusicPlaylist, String> {
    library::add_to_playlist(&state.db, &playlist_id, &track)
}

#[tauri::command]
pub fn music_add_tracks_to_playlist(
    state: tauri::State<'_, MusicState>,
    playlist_id: String,
    tracks: Vec<MusicTrack>,
) -> Result<library::MusicPlaylist, String> {
    library::add_tracks_to_playlist(&state.db, &playlist_id, &tracks)
}

#[tauri::command]
pub fn music_rename_playlist(
    state: tauri::State<'_, MusicState>,
    playlist_id: String,
    name: String,
) -> Result<library::MusicPlaylist, String> {
    library::rename_playlist(&state.db, &playlist_id, &name)
}

#[tauri::command]
pub fn music_delete_playlist(
    state: tauri::State<'_, MusicState>,
    playlist_id: String,
) -> Result<(), String> {
    library::delete_playlist(&state.db, &playlist_id)
}

#[tauri::command]
pub fn music_reorder_playlist(
    state: tauri::State<'_, MusicState>,
    playlist_id: String,
    track_id: String,
    to_index: usize,
) -> Result<library::MusicPlaylist, String> {
    library::reorder_playlist(&state.db, &playlist_id, &track_id, to_index)
}

#[tauri::command]
pub fn music_remove_from_playlist(
    state: tauri::State<'_, MusicState>,
    playlist_id: String,
    track_id: String,
) -> Result<library::MusicPlaylist, String> {
    library::remove_from_playlist(&state.db, &playlist_id, &track_id)
}
