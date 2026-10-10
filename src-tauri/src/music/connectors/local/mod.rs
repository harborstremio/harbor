mod collection;
pub use collection::{filtered_page as collection_page, LocalMusicPage};
#[cfg(test)]
mod fixtures;
mod queries;
mod rows;
mod scan;
mod search;
mod store;
mod tags;

use super::super::connector::{ConnectorHealth, HealthCell, MusicConnector};
use super::super::{
    MusicAlbumRef, MusicArtistRef, MusicCatalogItem, MusicCatalogRow, MusicConnection,
    MusicConnectionField, MusicRowLayout, MusicSearchResults, MusicState, MusicStream, MusicTrack,
};
use async_trait::async_trait;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::RwLock;
use tauri::Manager;

const ARTIST_TRACK_LIMIT: usize = 24;

pub struct LocalConnector {
    health: HealthCell,
    folder: RwLock<Option<String>>,
    hydrated: AtomicBool,
    scanning: AtomicBool,
}

struct ScanGuard<'a> {
    flag: &'a AtomicBool,
}

impl Drop for ScanGuard<'_> {
    fn drop(&mut self) {
        self.flag.store(false, Ordering::SeqCst);
    }
}

impl LocalConnector {
    pub fn new() -> Self {
        Self {
            health: HealthCell::new(),
            folder: RwLock::new(None),
            hydrated: AtomicBool::new(false),
            scanning: AtomicBool::new(false),
        }
    }

    pub fn configured(&self) -> bool {
        self.folder().is_some()
    }

    fn folder(&self) -> Option<String> {
        self.folder.read().ok().and_then(|slot| slot.clone())
    }

    fn hydrate(&self, app: &tauri::AppHandle) {
        if self.hydrated.load(Ordering::Acquire) {
            return;
        }
        let stored = store::load_folder(app);
        self.remember(stored);
    }

    fn remember(&self, folder: Option<String>) {
        if let Ok(mut slot) = self.folder.write() {
            *slot = folder;
        }
        self.hydrated.store(true, Ordering::Release);
    }

    fn record<T>(&self, result: &Result<T, String>) {
        self.health.set(match result {
            Ok(_) => ConnectorHealth::Healthy,
            Err(_) => ConnectorHealth::Degraded,
        });
    }
}

impl Default for LocalConnector {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MusicConnector for LocalConnector {
    fn id(&self) -> &str {
        "local"
    }

    fn name(&self) -> &str {
        "Local files"
    }

    async fn search(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<Vec<MusicTrack>, String> {
        self.hydrate(app);
        let state = app.state::<MusicState>();
        if store::ensure_schema(&state.db).is_err() {
            return Ok(Vec::new());
        }
        let result = search::tracks_matching(&state.db, query, limit);
        self.record(&result);
        result
    }

    async fn search_typed(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<MusicSearchResults, String> {
        self.hydrate(app);
        let state = app.state::<MusicState>();
        if store::ensure_schema(&state.db).is_err() {
            return Ok(MusicSearchResults::default());
        }
        let result = search::typed(&state.db, query, limit);
        self.record(&result);
        result
    }

    async fn resolve(
        &self,
        app: &tauri::AppHandle,
        track: &MusicTrack,
    ) -> Result<MusicStream, String> {
        let state = app.state::<MusicState>();
        store::ensure_schema(&state.db)?;
        let path = match location(track) {
            Some(path) => path,
            None => queries::path_for(&state.db, &track.id)?
                .ok_or_else(|| format!("{} is not in your music folder", track.title))?,
        };
        if !Path::new(&path).is_file() {
            return Err(format!("{path} is no longer on disk"));
        }
        self.health.set(ConnectorHealth::Healthy);
        Ok(MusicStream {
            http_headers: Default::default(),
            mime_type: tags::mime_type(Path::new(&path)).to_string(),
            url: path,
            bitrate: 0,
        })
    }

    async fn browse_home(&self, app: &tauri::AppHandle) -> Result<Vec<MusicCatalogRow>, String> {
        self.hydrate(app);
        if !self.configured() {
            return Ok(Vec::new());
        }
        let state = app.state::<MusicState>();
        if store::ensure_schema(&state.db).is_err() {
            return Ok(Vec::new());
        }
        // A folder can be configured with nothing indexed behind it: the scan only ever ran
        // from the connect form, so a restore, a fresh install, or a wiped database left the
        // library permanently empty. Index it once, here, the first time it is asked for.
        if let Some(folder) = self.folder() {
            let empty = store::indexed(&state.db)
                .map(|files| files.is_empty())
                .unwrap_or(false);
            if empty {
                let _ = self.scan(app, &folder).await;
            }
        }
        let result = rows::home(&state.db);
        self.record(&result);
        result
    }

    async fn album_tracks(
        &self,
        app: &tauri::AppHandle,
        album: &MusicAlbumRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let state = app.state::<MusicState>();
        store::ensure_schema(&state.db)?;
        queries::album_tracks(&state.db, &album.id)
    }

    async fn artist_top(
        &self,
        app: &tauri::AppHandle,
        artist: &MusicArtistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let state = app.state::<MusicState>();
        store::ensure_schema(&state.db)?;
        queries::artist_tracks(&state.db, &artist.id, ARTIST_TRACK_LIMIT)
    }

    async fn artist_rows(
        &self,
        app: &tauri::AppHandle,
        artist: &MusicArtistRef,
    ) -> Result<Vec<MusicCatalogRow>, String> {
        let state = app.state::<MusicState>();
        store::ensure_schema(&state.db)?;
        let albums = queries::artist_albums(&state.db, &artist.id)?;
        if albums.is_empty() {
            return Ok(Vec::new());
        }
        Ok(vec![MusicCatalogRow {
            id: format!("local:artist-albums:{}", artist.id),
            title: "music.search.albums".into(),
            title_literal: false,
            subtitle: None,
            layout: MusicRowLayout::Covers,
            source: "local".into(),
            items: albums.into_iter().map(MusicCatalogItem::Album).collect(),
        }])
    }

    async fn connect(
        &self,
        app: &tauri::AppHandle,
        fields: &HashMap<String, String>,
    ) -> Result<MusicConnection, String> {
        let folder = chosen_folder(fields)?;
        store::save_folder(app, Some(&folder))?;
        self.remember(Some(folder));
        self.health.set(ConnectorHealth::Healthy);
        Ok(self.connection())
    }

    async fn disconnect(&self, app: &tauri::AppHandle) -> Result<(), String> {
        store::save_folder(app, None)?;
        self.remember(None);
        self.health.set(ConnectorHealth::Unknown);
        Ok(())
    }

    async fn scan(&self, app: &tauri::AppHandle, folder: &str) -> Result<u32, String> {
        if self.scanning.swap(true, Ordering::SeqCst) {
            return Err("A music folder scan is already running".to_string());
        }
        let _guard = ScanGuard {
            flag: &self.scanning,
        };
        let folder = folder.trim().to_string();
        if !Path::new(&folder).is_dir() {
            return Err(format!("{folder} is not a folder"));
        }
        store::save_folder(app, Some(&folder))?;
        self.remember(Some(folder.clone()));
        let result = scan::run(app, &folder).await;
        self.record(&result);
        result
    }

    fn set_health(&self, health: ConnectorHealth) {
        self.health.set(health);
    }

    fn health(&self) -> ConnectorHealth {
        self.health.get()
    }

    fn browsable(&self) -> bool {
        true
    }

    fn connection(&self) -> MusicConnection {
        let folder = self.folder();
        let status = match (&folder, self.health()) {
            (None, _) => "disconnected",
            (Some(_), ConnectorHealth::Offline) => "error",
            _ => "connected",
        };
        let mut connection = MusicConnection::new(
            "local",
            "Local files",
            "local",
            status,
            &["search", "browse", "play", "library"],
        )
        .needs(vec![MusicConnectionField::new(
            "folder",
            "Music folder",
            "folder",
            true,
        )]);
        connection.detail = folder;
        connection
    }
}

fn chosen_folder(fields: &HashMap<String, String>) -> Result<String, String> {
    let folder = fields
        .get("folder")
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Choose a music folder".to_string())?;
    if !Path::new(folder).is_dir() {
        return Err(format!("{folder} is not a folder"));
    }
    Ok(folder.to_string())
}

fn location(track: &MusicTrack) -> Option<String> {
    [track.playback_url.as_deref(), track.source_id.as_deref()]
        .into_iter()
        .flatten()
        .map(str::trim)
        .find(|value| !value.is_empty() && !value.contains("://"))
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(playback_url: Option<&str>, source_id: Option<&str>) -> MusicTrack {
        MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            id: "local:one".to_string(),
            connector_id: Some("local".to_string()),
            source_id: source_id.map(str::to_string),
            playback_url: playback_url.map(str::to_string),
            title: "Hysteria".to_string(),
            artist: "Muse".to_string(),
            album: Some("Absolution".to_string()),
            artwork: String::new(),
            duration_seconds: 227,
            duration_label: "3:47".to_string(),
        }
    }

    #[test]
    fn a_local_track_resolves_to_its_own_file_path() {
        assert_eq!(
            location(&track(Some("C:/Music/one.flac"), None)),
            Some("C:/Music/one.flac".to_string())
        );
        assert_eq!(
            location(&track(None, Some("/music/one.flac"))),
            Some("/music/one.flac".to_string())
        );
        assert_eq!(
            location(&track(Some("  "), Some("/music/two.flac"))),
            Some("/music/two.flac".to_string())
        );
    }

    #[test]
    fn remote_locations_are_not_treated_as_files() {
        assert!(location(&track(Some("https://example.test/one.mp3"), None)).is_none());
        assert!(location(&track(Some("   "), None)).is_none());
        assert!(location(&track(None, None)).is_none());
    }

    #[test]
    fn a_folder_field_is_required_and_must_exist() {
        let mut fields = HashMap::new();
        assert!(chosen_folder(&fields).is_err());
        fields.insert("folder".to_string(), "  ".to_string());
        assert!(chosen_folder(&fields).is_err());
        fields.insert("folder".to_string(), "C:/definitely/not/here".to_string());
        assert!(chosen_folder(&fields).is_err());
        fields.insert(
            "folder".to_string(),
            std::env::temp_dir().to_string_lossy().to_string(),
        );
        assert_eq!(
            chosen_folder(&fields).expect("a real folder"),
            std::env::temp_dir().to_string_lossy().trim().to_string()
        );
    }

    #[test]
    fn a_connector_without_a_folder_reports_itself_disconnected() {
        let connector = LocalConnector::new();
        let connection = connector.connection();
        assert_eq!(connection.status, "disconnected");
        assert!(connection.detail.is_none());
        assert_eq!(connection.needs[0].key, "folder");
        assert_eq!(connection.needs[0].kind, "folder");
        assert_eq!(
            connection.capabilities,
            vec!["search", "browse", "play", "library"]
        );

        connector.remember(Some("C:/Music".to_string()));
        connector.set_health(ConnectorHealth::Healthy);
        let connection = connector.connection();
        assert_eq!(connection.status, "connected");
        assert_eq!(connection.detail.as_deref(), Some("C:/Music"));

        connector.set_health(ConnectorHealth::Offline);
        assert_eq!(connector.connection().status, "error");
    }

    #[test]
    fn a_local_library_is_always_browsable_and_searchable() {
        let connector = LocalConnector::new();
        assert!(connector.browsable());
        assert!(connector.searchable());
        assert!(connector.playable());
        assert!(!connector.scrobbler());
        assert!(!connector.configured());
    }
}
