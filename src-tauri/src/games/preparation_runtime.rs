use super::{
    archive_jobs, archives,
    download_preparation::{Choice, Configure, Engine, Preparations, Snapshot, Target},
    p2p, transfers,
};
use sha2::{Digest, Sha256};
use std::{
    path::Path,
    sync::{Arc, Mutex, OnceLock},
};
use tauri::{Emitter, Manager};
type Result<T> = std::result::Result<T, &'static str>;
fn digest(parts: &[&str]) -> String {
    let mut hash = Sha256::new();
    for part in parts {
        hash.update((part.len() as u64).to_le_bytes());
        hash.update(part.as_bytes());
    }
    format!("{:x}", hash.finalize())
}
fn name(path: &Path) -> Result<&str> {
    path.file_name()
        .and_then(|name| name.to_str())
        .ok_or("archive_path")
}
pub fn candidates(app: &tauri::AppHandle, target: &Target) -> Result<Vec<String>> {
    match target.engine {
        Engine::Direct => {
            let record = transfers::manager(app)?
                .preparation_record(&target.profile, &target.download_id)?;
            Ok(
                if archives::preparation_candidate(name(Path::new(&record.destination))?) {
                    vec![record.destination]
                } else {
                    vec![]
                },
            )
        }
        Engine::Torrent => {
            let manager = p2p::manager(app)?;
            let record = manager.preparation_record(&target.profile, &target.download_id)?;
            Ok(manager
                .preparation_files(&record)?
                .into_iter()
                .filter(|file| {
                    archives::preparation_candidate(file.path.rsplit('/').next().unwrap_or(""))
                })
                .map(|file| file.path)
                .collect())
        }
    }
}
fn resolve(app: &tauri::AppHandle, target: &Target) -> Result<Snapshot> {
    match target.engine {
        Engine::Direct => {
            let manager = transfers::manager(app)?;
            resolve_direct(&manager, target)
        }
        Engine::Torrent => {
            let manager = p2p::manager(app)?;
            resolve_torrent(&manager, target)
        }
    }
}
pub(super) fn resolve_direct(manager: &transfers::Transfers, target: &Target) -> Result<Snapshot> {
    resolve_direct_with(target, |profile, id| {
        manager.preparation_record(profile, id)
    })
}
pub(super) fn resolve_direct_with(
    target: &Target,
    get: impl Fn(&str, &str) -> Result<transfers::Transfer>,
) -> Result<Snapshot> {
    let record = get(&target.profile, &target.download_id)?;
    if target.archive != record.destination
        || !archives::preparation_candidate(name(Path::new(&record.destination))?)
    {
        return Err("archive_path");
    }
    let mut members = target
        .members
        .iter()
        .map(|id| get(&target.profile, id))
        .collect::<Result<Vec<_>>>()?;
    members.push(record.clone());
    members.sort_by(|a, b| a.id.cmp(&b.id));
    let mut identities = Vec::new();
    let mut ready = record.status == transfers::Status::Complete;
    let mut allowed_parts = vec![];
    let mut expected_parts = vec![];
    let source = Path::new(&record.destination);
    let parent = source.parent();
    let selected = name(source)?;
    for sibling in members {
        if matches!(
            sibling.status,
            transfers::Status::Canceling | transfers::Status::Canceled
        ) {
            return Err("archive_canceled");
        }
        let path = Path::new(&sibling.destination);
        if path.parent() != parent || !archives::preparation_family(selected, name(path)?) {
            return Err("archive_parts");
        }
        identities.push(digest(&[
            &sibling.id,
            &sibling.profile,
            &sibling.destination,
            &sibling.url,
            &sibling.created_at.to_string(),
        ]));
        if sibling.status != transfers::Status::Complete {
            ready = false;
        } else {
            expected_parts.push(archives::ArchivePart {
                name: name(path)?.into(),
                bytes: sibling.received,
                sha256: sibling.sha256.ok_or("archive_changed")?,
            });
            allowed_parts.push(sibling.destination);
        }
    }
    let identity = digest(&identities.iter().map(String::as_str).collect::<Vec<_>>());
    Ok(Snapshot {
        identity,
        source: record.destination.clone(),
        origin_source: record.destination,
        game: record.game,
        ready,
        sha256: record.sha256,
        allowed_parts,
        expected_parts: Some(expected_parts),
    })
}
pub(super) fn resolve_torrent(manager: &p2p::Torrents, target: &Target) -> Result<Snapshot> {
    let record = manager.preparation_record(&target.profile, &target.download_id)?;
    let identity = torrent_identity(&record)?;
    let ready = record.status == p2p::Status::Complete;
    let mut allowed_parts = vec![];
    if ready {
        let files = manager.preparation_files(&record)?;
        let selected = files
            .iter()
            .find(|file| file.path == target.archive)
            .ok_or("archive_path")?;
        let selected_path = Path::new(&selected.path);
        let selected_name = name(selected_path)?;
        if !archives::preparation_candidate(selected_name) {
            return Err("archive_path");
        }
        for file in &files {
            let path = Path::new(&file.path);
            if path.parent() == selected_path.parent()
                && archives::preparation_family(selected_name, name(path)?)
            {
                let absolute = Path::new(&record.destination).join(path);
                if std::fs::metadata(&absolute)
                    .map_err(|_| "archive_read")?
                    .len()
                    != file.bytes
                {
                    return Err("archive_changed");
                }
                allowed_parts.push(absolute.to_string_lossy().into_owned());
            }
        }
    }
    Ok(Snapshot {
        identity,
        source: Path::new(&record.destination)
            .join(&target.archive)
            .to_string_lossy()
            .into_owned(),
        origin_source: record.destination,
        game: record.game,
        ready,
        sha256: None,
        allowed_parts,
        expected_parts: None,
    })
}
pub(super) fn torrent_identity(record: &p2p::TorrentRecord) -> Result<String> {
    Ok(digest(&[
        &record.id,
        &record.profile,
        &record.destination,
        &record.metadata_sha,
        &serde_json::to_string(&record.selected).map_err(|_| "torrent_metadata")?,
    ]))
}
pub fn manager(app: &tauri::AppHandle) -> Result<Arc<Preparations>> {
    static INSTANCE: OnceLock<Mutex<Option<Arc<Preparations>>>> = OnceLock::new();
    let mut held = INSTANCE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map_err(|_| "archive_store")?;
    if let Some(manager) = held.as_ref() {
        return Ok(manager.clone());
    }
    let root = app
        .path()
        .app_data_dir()
        .map_err(|_| "archive_store")?
        .join("game-preparation");
    let resolve_app = app.clone();
    let emit_app = app.clone();
    let value = Preparations::load(
        root,
        archive_jobs::manager(app)?,
        move |target| resolve(&resolve_app, target),
        move |choice| {
            let _ = emit_app.emit("games:preparation", choice);
        },
    )?;
    let direct = transfers::manager(app)?;
    let torrents = p2p::manager(app)?;
    value.set_intake(move |policies| {
        super::preparation_intake::direct_pending(policies, &direct)?;
        super::preparation_intake::torrent_pending(policies, &torrents)?;
        Ok(false)
    })?;
    value.start()?;
    *held = Some(value.clone());
    Ok(value)
}
pub fn configure(app: &tauri::AppHandle, request: Configure) -> Result<Choice> {
    if !candidates(app, &request.target)?.contains(&request.target.archive) {
        return Err("archive_path");
    }
    manager(app)?.configure(request)
}
pub fn choices(app: &tauri::AppHandle, profile: &str) -> Result<Vec<Choice>> {
    let policies = manager(app)?;
    // Surface a retained acquisition handoff and its write failure to review,
    // rather than silently presenting an empty list while the worker retries.
    super::preparation_intake::direct_pending(&policies, transfers::manager(app)?.as_ref())?;
    super::preparation_intake::torrent_pending(&policies, p2p::manager(app)?.as_ref())?;
    policies.list(profile)
}
pub fn initialize(app: &tauri::AppHandle) {
    // A crash can occur after acquisition acceptance but before the choices
    // file exists. Engine outboxes must be replayed at that boundary too.
    let Ok(root) = app.path().app_data_dir() else {
        return;
    };
    if ![
        "game-preparation/choices.json",
        "games/transfers.json",
        "game-torrents/transfers.json",
    ]
    .iter()
    .any(|file| root.join(file).is_file())
    {
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if let Err(error) = manager(&app) {
            eprintln!("[harbor::game-preparation] {error}");
        }
    });
}
