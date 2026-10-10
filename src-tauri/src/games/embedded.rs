//! A token-scoped local player. Runtime code has no Tauri bridge or access to other ROMs.
use axum::{
    body::{Body, Bytes},
    extract::{DefaultBodyLimit, Path as RoutePath, State},
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::any,
    Router,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
    time::Duration,
};
use tauri::Manager;
use tokio_util::sync::CancellationToken;

use super::retro_save_path::{core, VERSION};
const MAX_ROM: u64 = 128 * 1024 * 1024;
const MAX_SAVE: usize = 16 * 1024 * 1024;
#[derive(Clone, Deserialize)]
struct Asset {
    path: String,
    sha256: String,
    bytes: usize,
}
#[derive(Serialize)]
pub struct RuntimeStatus {
    installed: bool,
    bytes: usize,
    version: &'static str,
}
#[derive(Serialize)]
pub struct Session {
    id: String,
    url: String,
}
struct Active {
    id: String,
    cancel: CancellationToken,
}
fn active() -> &'static Mutex<Option<Active>> {
    static VALUE: OnceLock<Mutex<Option<Active>>> = OnceLock::new();
    VALUE.get_or_init(|| Mutex::new(None))
}
fn assets(core: &str) -> Result<Vec<Asset>, String> {
    let all: Vec<Asset> =
        serde_json::from_str(include_str!("retro-runtime.json")).map_err(|_| "retro_manifest")?;
    Ok(all
        .into_iter()
        .filter(|a| {
            !a.path.starts_with("cores/")
                || a.path == format!("cores/reports/{core}.json")
                || a.path == format!("cores/{core}-legacy-wasm.data")
        })
        .collect())
}
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn runtime_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_cache_dir()
        .map_err(|_| "retro_storage")?
        .join("games/retro")
        .join(VERSION))
}
async fn verified(path: &Path, asset: &Asset) -> Option<Vec<u8>> {
    let meta = tokio::fs::symlink_metadata(path).await.ok()?;
    if !meta.is_file() || meta.file_type().is_symlink() || meta.len() != asset.bytes as u64 {
        return None;
    }
    let bytes = bounded_read(path, asset.bytes as u64).await.ok()?;
    (digest(&bytes) == asset.sha256).then_some(bytes)
}
async fn bounded_read(path: &Path, limit: u64) -> Result<Vec<u8>, std::io::Error> {
    use tokio::io::AsyncReadExt;
    let file = tokio::fs::File::open(path).await?;
    let mut bytes = Vec::new();
    file.take(limit + 1).read_to_end(&mut bytes).await?;
    if bytes.len() as u64 > limit {
        return Err(std::io::Error::other("retro_size"));
    }
    Ok(bytes)
}
pub async fn status(app: tauri::AppHandle, system: u32) -> Result<RuntimeStatus, String> {
    let core = core(system).ok_or("retro_unsupported")?;
    let root = runtime_root(&app)?;
    let assets = assets(core)?;
    let mut installed = true;
    for asset in &assets {
        if verified(&root.join(&asset.path), asset).await.is_none() {
            installed = false;
            break;
        }
    }
    Ok(RuntimeStatus {
        installed,
        bytes: assets.iter().map(|a| a.bytes).sum(),
        version: VERSION,
    })
}
async fn atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("retro_storage")?;
    tokio::fs::create_dir_all(parent)
        .await
        .map_err(|_| "retro_storage")?;
    // Windows rename can fail through an AppData junction to another volume.
    // Resolve both names to the same real directory before publishing the file.
    let parent = tokio::fs::canonicalize(parent).await.map_err(|_| "retro_storage")?;
    let path = parent.join(path.file_name().ok_or("retro_storage")?);
    let temp = parent.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
    let result = async {
        use tokio::io::AsyncWriteExt;
        let mut file = tokio::fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp)
            .await
            .map_err(|_| "retro_storage")?;
        file.write_all(bytes).await.map_err(|_| "retro_storage")?;
        file.sync_all().await.map_err(|_| "retro_storage")?;
        drop(file);
        tokio::fs::rename(&temp, &path)
            .await
            .map_err(|_| "retro_storage")?;
        Ok(())
    }
    .await;
    if result.is_err() {
        let _ = tokio::fs::remove_file(temp).await;
    }
    result
}
fn validate_game(game: &Path, root: &Path, system: u32) -> Result<(PathBuf, String), String> {
    let root = root.canonicalize().map_err(|_| "retro_game")?;
    let game = game.canonicalize().map_err(|_| "retro_game")?;
    let ext = game
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    // FDS requires a BIOS; leave that format with the configured external player.
    if core(system).is_none()
        || ext == "fds"
        || !root.is_dir()
        || !game.starts_with(root)
        || !super::emulation::extensions(system).contains(&ext.as_str())
    {
        return Err("retro_game".into());
    }
    let meta = game.metadata().map_err(|_| "retro_game")?;
    if !meta.is_file() || meta.len() == 0 || meta.len() > MAX_ROM {
        return Err("retro_size".into());
    }
    Ok((game, ext))
}
pub fn close(id: &str) {
    if let Ok(mut held) = active().lock() {
        if held.as_ref().is_some_and(|v| v.id == id) {
            if let Some(session) = held.take() {
                session.cancel.cancel();
            }
        }
    }
}
pub async fn start(
    app: tauri::AppHandle,
    id: String,
    profile: String,
    game_path: String,
    root: String,
    system: u32,
) -> Result<Session, String> {
    if uuid::Uuid::parse_str(&id).is_err() || profile.is_empty() || profile.len() > 256 {
        return Err("retro_session".into());
    }
    let (game, ext) = validate_game(Path::new(&game_path), Path::new(&root), system)?;
    let core = core(system).ok_or("retro_unsupported")?;
    let runtime = runtime_root(&app)?;
    let saves = app
        .path()
        .app_data_dir()
        .map_err(|_| "retro_storage")?
        .join("games/retro-saves");
    let cancel = CancellationToken::new();
    {
        let mut held = active().lock().map_err(|_| "retro_session")?;
        if held.is_some() {
            return Err("retro_running".into());
        }
        *held = Some(Active {
            id: id.clone(),
            cancel: cancel.clone(),
        });
    }
    let result = tokio::select! { _ = cancel.cancelled() => Err("retro_cancelled".into()), result = prepare(runtime, saves, &id, &profile, game, ext, core, cancel.clone()) => result };
    if result.is_err() {
        close(&id);
    }
    result
}
async fn prepare(
    root: PathBuf,
    saves: PathBuf,
    id: &str,
    profile: &str,
    game: PathBuf,
    ext: String,
    core: &'static str,
    cancel: CancellationToken,
) -> Result<Session, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .redirect(reqwest::redirect::Policy::limited(3))
        .build()
        .map_err(|_| "retro_download")?;
    let mut files = HashMap::new();
    for asset in assets(core)? {
        let path = root.join(&asset.path);
        let bytes = if let Some(bytes) = verified(&path, &asset).await {
            bytes
        } else {
            let mut response = client
                .get(format!(
                    "https://cdn.emulatorjs.org/{VERSION}/data/{}",
                    asset.path
                ))
                .send()
                .await
                .map_err(|_| "retro_download")?;
            if !response.status().is_success() {
                return Err("retro_download".into());
            }
            let mut bytes = Vec::with_capacity(asset.bytes);
            while let Some(chunk) = response.chunk().await.map_err(|_| "retro_download")? {
                if bytes.len() + chunk.len() > asset.bytes {
                    return Err("retro_integrity".into());
                }
                bytes.extend_from_slice(&chunk);
            }
            if bytes.len() != asset.bytes || digest(&bytes) != asset.sha256 {
                return Err("retro_integrity".into());
            }
            atomic(&path, &bytes).await?;
            bytes
        };
        files.insert(format!("data/{}", asset.path), Bytes::from(bytes));
    }
    let rom = bounded_read(&game, MAX_ROM)
        .await
        .map_err(|_| "retro_game")?;
    if rom.is_empty() || rom.len() as u64 > MAX_ROM {
        return Err("retro_size".into());
    }
    let save_dir = super::retro_save_path::directory(&saves, &digest(profile.as_bytes()), &digest(&rom), core);
    tokio::fs::create_dir_all(&save_dir).await.map_err(|_| "retro_storage")?;
    let save_lease = super::save_activity::acquire(&save_dir.join("save"))
        .map_err(|_| "retro_save_busy")?;
    let rom_name = format!("game.{ext}");
    files.insert(rom_name.clone(), Bytes::from(rom));
    let token = uuid::Uuid::new_v4().to_string();
    let listener = tokio::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
        .await
        .map_err(|_| "retro_server")?;
    let origin = format!(
        "http://127.0.0.1:{}",
        listener.local_addr().map_err(|_| "retro_server")?.port()
    );
    let state = Arc::new(Player {
        token: token.clone(),
        origin: origin.clone(),
        files,
        config: serde_json::to_vec(&serde_json::json!({"core":core,"rom":rom_name,"id":id}))
            .map_err(|_| "retro_session")?,
        save_dir,
        _save_lease: save_lease,
        write: tokio::sync::Mutex::new(()),
    });
    let router = Router::new()
        .route("/{token}/", any(index))
        .route("/{token}/{*path}", any(resource))
        .layer(DefaultBodyLimit::max(MAX_SAVE))
        .with_state(state);
    tokio::spawn(async move {
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(cancel.cancelled_owned())
            .await;
    });
    Ok(Session {
        id: id.to_owned(),
        url: format!("{origin}/{token}/"),
    })
}
struct Player {
    token: String,
    origin: String,
    files: HashMap<String, Bytes>,
    config: Vec<u8>,
    save_dir: PathBuf,
    _save_lease: super::save_activity::Lease,
    write: tokio::sync::Mutex<()>,
}
fn reply(bytes: impl Into<Bytes>, mime: &str) -> Response {
    let bytes = bytes.into();
    Response::builder().header("Content-Type", mime).header("Content-Length", bytes.len()).header("Cache-Control", "no-store").header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", "default-src 'none'; script-src 'self' blob: 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; media-src 'self' blob:; worker-src blob:; font-src 'self' data:; base-uri 'none'; form-action 'none'")
        .body(bytes.into()).unwrap()
}
async fn index(
    State(state): State<Arc<Player>>,
    RoutePath(token): RoutePath<String>,
    method: Method,
) -> Response {
    if token != state.token || method != Method::GET {
        return StatusCode::NOT_FOUND.into_response();
    }
    reply(
        include_str!("retro-player.html"),
        "text/html; charset=utf-8",
    )
}
async fn resource(
    State(state): State<Arc<Player>>,
    RoutePath((token, path)): RoutePath<(String, String)>,
    method: Method,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let head = method == Method::HEAD;
    let mut response = resource_response(
        state,
        token,
        path,
        if head { Method::GET } else { method },
        headers,
        body,
    )
    .await;
    if head {
        *response.body_mut() = Body::empty();
    }
    response
}
async fn resource_response(
    state: Arc<Player>,
    token: String,
    path: String,
    method: Method,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if token != state.token {
        return StatusCode::NOT_FOUND.into_response();
    }
    if ["save", "state", "resume"].contains(&path.as_str()) {
        let target = state.save_dir.join(&path);
        let _guard = state.write.lock().await;
        if method == Method::POST {
            if headers.get("origin").and_then(|v| v.to_str().ok()) != Some(state.origin.as_str())
                || body.is_empty()
                || body.len() > MAX_SAVE
            {
                return StatusCode::FORBIDDEN.into_response();
            }
            let result = async {
                atomic(&target, &body).await?;
                if path == "resume" {
                    // An automatic resume must belong to the current battery save. A bank
                    // edit or external save replacement must never be undone by old RAM.
                    let save = resume_battery(&state.save_dir).await.ok_or("retro_storage".to_owned())?;
                    let receipt = format!("{}\n{}", digest(&save), digest(&body));
                    atomic(&state.save_dir.join("resume-save.sha256"), receipt.as_bytes()).await?;
                }
                Ok::<(), String>(())
            }.await;
            return match result {
                Ok(()) => StatusCode::NO_CONTENT.into_response(),
                Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
            };
        }
        if method != Method::GET {
            return StatusCode::METHOD_NOT_ALLOWED.into_response();
        }
        let Ok(meta) = tokio::fs::symlink_metadata(&target).await else {
            return StatusCode::NOT_FOUND.into_response();
        };
        if !meta.is_file() || meta.file_type().is_symlink() || meta.len() > MAX_SAVE as u64 {
            return StatusCode::NOT_FOUND.into_response();
        }
        return match bounded_read(&target, MAX_SAVE as u64).await {
            Ok(bytes) if path == "resume" && !resume_matches_save(&state.save_dir, &bytes).await => StatusCode::NOT_FOUND.into_response(),
            Ok(bytes) => reply(bytes, "application/octet-stream"),
            Err(_) => StatusCode::NOT_FOUND.into_response(),
        };
    }
    if method != Method::GET {
        return StatusCode::METHOD_NOT_ALLOWED.into_response();
    }
    match path.as_str() {
        "bridge.js" => reply(include_str!("retro-player.js"), "application/javascript"),
        "config.json" => reply(state.config.clone(), "application/json"),
        _ => match state.files.get(&path) {
            Some(bytes) => reply(
                bytes.clone(),
                if path.ends_with(".js") {
                    "application/javascript"
                } else if path.ends_with(".css") {
                    "text/css"
                } else if path.ends_with(".json") {
                    "application/json"
                } else {
                    "application/octet-stream"
                },
            ),
            None => StatusCode::NOT_FOUND.into_response(),
        },
    }
}

async fn resume_battery(directory: &Path) -> Option<Vec<u8>> {
    match bounded_read(&directory.join("save"), MAX_SAVE as u64).await {
        Ok(bytes) => Some(bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Some(Vec::new()),
        Err(_) => None,
    }
}
async fn resume_matches_save(directory: &Path, resume: &[u8]) -> bool {
    let Some(save) = resume_battery(directory).await else { return false; };
    let receipt_path = directory.join("resume-save.sha256");
    if receipt_path.exists() {
        let Ok(receipt) = bounded_read(&receipt_path, 129).await else { return false; };
        return receipt == format!("{}\n{}", digest(&save), digest(resume)).as_bytes();
    }
    if save.is_empty() { return directory.join("resume").is_file(); }
    // Preserve older resume files, but only use them when no newer save was written.
    let save_time = tokio::fs::metadata(directory.join("save")).await.ok().and_then(|m| m.modified().ok());
    let resume_time = tokio::fs::metadata(directory.join("resume")).await.ok().and_then(|m| m.modified().ok());
    matches!((save_time, resume_time), (Some(saved), Some(resumed)) if saved <= resumed)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn automatic_resume_rejects_edited_save_without_deleting_recovery_state() {
        let base = tokio::fs::canonicalize(std::env::temp_dir()).await.unwrap();
        let dir = base.join(format!("harbor-retro-resume-{}", uuid::Uuid::new_v4()));
        atomic(&dir.join("resume"), b"homebrew memory").await.unwrap();
        assert!(resume_matches_save(&dir, b"homebrew memory").await);
        atomic(&dir.join("resume-save.sha256"), format!("{}\n{}",digest(b""),digest(b"homebrew memory")).as_bytes()).await.unwrap();
        assert!(resume_matches_save(&dir, b"homebrew memory").await);
        tokio::fs::remove_file(dir.join("resume-save.sha256")).await.unwrap();
        atomic(&dir.join("save"), b"game progress").await.unwrap();
        atomic(&dir.join("resume"), b"paused memory").await.unwrap();
        assert!(resume_matches_save(&dir, b"paused memory").await);
        atomic(&dir.join("resume-save.sha256"), format!("{}\n{}",digest(b"game progress"),digest(b"paused memory")).as_bytes()).await.unwrap();
        assert!(resume_matches_save(&dir, b"paused memory").await);
        atomic(&dir.join("save"), b"reviewed bank edit").await.unwrap();
        assert!(!resume_matches_save(&dir, b"paused memory").await);
        assert_eq!(bounded_read(&dir.join("resume"), MAX_SAVE as u64).await.unwrap(), b"paused memory");
        atomic(&dir.join("resume-save.sha256"), format!("{}\n{}",digest(b"reviewed bank edit"),digest(b"new memory")).as_bytes()).await.unwrap();
        assert!(resume_matches_save(&dir, b"new memory").await);
        assert!(!resume_matches_save(&dir, b"paused memory").await);
        let resolved = tokio::fs::canonicalize(&dir).await.unwrap();
        assert!(resolved.starts_with(&base) && resolved.file_name().unwrap().to_string_lossy().starts_with("harbor-retro-resume-"));
        tokio::fs::remove_dir_all(resolved).await.unwrap();
    }
    #[tokio::test]
    async fn atomic_writes_create_then_replace_without_temp_files() {
        let dir = std::env::temp_dir().join(format!("harbor-retro-{}", uuid::Uuid::new_v4()));
        let path = dir.join("nested").join("state");
        atomic(&path, b"first").await.unwrap();
        atomic(&path, b"replacement").await.unwrap();
        assert_eq!(tokio::fs::read(&path).await.unwrap(), b"replacement");
        assert_eq!(std::fs::read_dir(path.parent().unwrap()).unwrap().count(), 1);
        tokio::fs::remove_dir_all(&dir).await.unwrap();
    }
    #[test]
    fn runtime_manifest_is_pinned_and_core_scoped() {
        let list = assets("mgba").unwrap();
        assert_eq!(list.len(), 6);
        assert!(list
            .iter()
            .all(|a| a.bytes > 0 && a.sha256.len() == 64 && !a.path.contains("..")));
        assert!(list.iter().all(|a| !a.path.contains("snes9x")));
    }
    #[test]
    fn cartridge_paths_reject_escape_and_wrong_system() {
        let dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        std::fs::create_dir_all(dir.join("roms")).unwrap();
        std::fs::write(dir.join("roms/homebrew.gba"), [1, 2, 3]).unwrap();
        std::fs::write(dir.join("outside.gba"), [1]).unwrap();
        assert!(validate_game(&dir.join("roms/homebrew.gba"), &dir.join("roms"), 24).is_ok());
        assert!(validate_game(&dir.join("outside.gba"), &dir.join("roms"), 24).is_err());
        assert!(validate_game(&dir.join("roms/homebrew.gba"), &dir.join("roms"), 19).is_err());
        std::fs::remove_dir_all(dir).unwrap();
    }
    #[tokio::test]
    #[ignore = "Browser integration harness; set HARBOR_RETRO_QA to a folder with homebrew.gba and homebrew.sfc"]
    async fn homebrew_browser_server() {
        let dir = PathBuf::from(std::env::var("HARBOR_RETRO_QA").expect("QA fixture directory"));
        let cancel = CancellationToken::new();
        let mut sessions = Vec::new();
        for (extension, system) in [("gba", 24), ("sfc", 19)] {
            let (game, ext) =
                validate_game(&dir.join(format!("homebrew.{extension}")), &dir, system).unwrap();
            let session = prepare(
                dir.join("runtime"),
                dir.join("saves"),
                &uuid::Uuid::new_v4().to_string(),
                "qa",
                game,
                ext,
                core(system).unwrap(),
                cancel.clone(),
            )
            .await
            .unwrap();
            sessions.push(session);
        }
        tokio::fs::write(
            dir.join("sessions.json"),
            serde_json::to_vec(&sessions).unwrap(),
        )
        .await
        .unwrap();
        for _ in 0..240 {
            if dir.join("done").exists() {
                break;
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
        cancel.cancel();
    }
}
