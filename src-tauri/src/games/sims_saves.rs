//! Sims save snapshots share Harbor's checked copy/review/recovery engine.
//! The companion fixes the source to the selected user-data folder's saves.
use super::{save_files::SaveResult, saves, sims_files as files};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

const GAME: &str = "steam:1222670";
const VAULT: &str = "HarborSimsSaves";

#[derive(Serialize)]
pub struct Context {
    pub source: String,
    pub vault: String,
}

pub fn context(path: &str) -> SaveResult<Context> {
    let folder = files::inspect_folder(path)?;
    let root = Path::new(&folder.path);
    Ok(Context {
        source: root.join("saves").to_string_lossy().into_owned(),
        vault: root.join(VAULT).to_string_lossy().into_owned(),
    })
}

fn guard(path: &str, source: &str) -> SaveResult<saves::SaveGuard> {
    let before = files::validate(path)?;
    let source = files::directory(Path::new(source))?;
    if source != files::directory(&Path::new(&before.path).join("saves"))? {
        return Err("sims_folder");
    }
    let guard: saves::SaveGuard = Arc::new(move || {
        files::idle()?;
        // The save engine holds its target lock and may have just published
        // its own journal. Keep checking identity/version without rejecting it.
        let current = files::inspect_folder(&before.path)?;
        if current.path != before.path
            || current.game_version != before.game_version
            || files::directory(&Path::new(&current.path).join("saves"))? != source
        {
            return Err("save_changed");
        }
        Ok(())
    });
    guard()?;
    Ok(guard)
}

fn vault(path: &str, value: &str, create: bool) -> SaveResult<PathBuf> {
    let folder = files::inspect_folder(path)?;
    let root = Path::new(&folder.path);
    let requested = Path::new(value);
    if requested.try_exists().map_err(|_| "save_read")? {
        let dest = files::directory(requested)?;
        // Never put snapshots inside Mods, Tray, saves or another game folder.
        if dest.starts_with(root) && dest != root.join(VAULT) {
            return Err("save_nested");
        }
        return Ok(dest);
    }
    if requested.file_name().and_then(|v| v.to_str()) != Some(VAULT)
        || files::directory(requested.parent().ok_or("save_folder")?)? != root
    {
        return Err("save_folder");
    }
    let dest = root.join(VAULT);
    if create {
        fs::create_dir(&dest).map_err(|_| "save_write")?;
        return files::directory(&dest);
    }
    Ok(dest)
}

pub fn list(
    path: &str,
    profile: String,
    destination: String,
) -> SaveResult<Vec<saves::SaveSnapshotInfo>> {
    let dest = vault(path, &destination, false)?;
    if !dest.try_exists().map_err(|_| "save_read")? {
        return Ok(Vec::new());
    }
    saves::list(dest.to_string_lossy().into_owned(), profile, GAME.into())
}

pub fn snapshot(
    path: &str,
    mut args: saves::SaveRequest,
    emit: impl Fn(saves::SaveProgress),
) -> SaveResult<saves::SaveSnapshotInfo> {
    if args.game_id != GAME {
        return Err("save_record");
    }
    let check = guard(path, &args.source)?;
    args.vault = vault(path, &args.vault, true)?
        .to_string_lossy()
        .into_owned();
    args.game_name = "The Sims 4".into();
    saves::snapshot_guarded(args, check, emit)
}

pub fn review(
    path: &str,
    profile: String,
    destination: String,
    snapshot_id: String,
    operation_id: String,
    emit: impl Fn(saves::SaveProgress),
) -> SaveResult<saves::SaveRestorePlan> {
    let context = context(path)?;
    let check = guard(path, &context.source)?;
    let dest = vault(path, &destination, false)?;
    saves::prepare_restore_guarded(
        dest.to_string_lossy().into_owned(),
        profile,
        GAME.into(),
        snapshot_id,
        context.source,
        operation_id,
        check,
        emit,
    )
}

pub fn recover(
    path: String,
    profile: String,
    operation_id: String,
    emit: impl Fn(saves::SaveProgress),
) -> SaveResult<saves::SaveRestoreReceipt> {
    let context = context(&path)?;
    let check: saves::SaveGuard = Arc::new(move || {
        files::idle()?;
        files::inspect_folder(&path)?;
        Ok(())
    });
    saves::recover_pending(
        profile,
        GAME.into(),
        context.source,
        operation_id,
        check,
        emit,
    )
}

#[cfg(test)]
#[path = "sims_saves_tests.rs"]
mod tests;
