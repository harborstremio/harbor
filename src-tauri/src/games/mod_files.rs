use super::{
    modrinth::{self, Package, Result},
    p2p_files, save_files, transfer_files,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256, Sha512};
use std::{
    collections::HashSet,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

pub const MANIFEST: &str = ".harbor-mods.json";
const JOURNAL: &str = ".harbor-mods-transaction.json";
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub schema: u8,
    pub owner: String,
    pub revision: String,
    pub loader: String,
    pub game_version: String,
    pub packages: Vec<Package>,
    #[serde(default)]
    pub backups: Vec<Backup>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Backup {
    pub package: Package,
    pub file: String,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct FileMove {
    pub from: String,
    pub to: String,
    pub bytes: u64,
    pub hash: String,
    pub discard: bool,
}
#[derive(Serialize, Deserialize)]
struct Journal {
    before: Workspace,
    after: Workspace,
    moves: Vec<FileMove>,
    #[serde(default)]
    completed: Option<usize>,
    #[serde(default)]
    rolling_back: bool,
}
pub fn owner(profile: &str) -> Result<String> {
    p2p_files::profile(profile).map_err(|_| "mods_profile")?;
    Ok(format!("{:x}", Sha256::digest(profile)))
}
pub fn root(value: &str) -> Result<PathBuf> {
    if value.len() > 4096 || !Path::new(value).is_absolute() {
        return Err("mods_folder");
    }
    p2p_files::plain_dir(Path::new(value)).map_err(|_| "mods_folder")
}
pub fn validate(w: &Workspace) -> Result<()> {
    modrinth::environment(&w.loader, &w.game_version)?;
    let mut projects = HashSet::new();
    let mut filenames = HashSet::new();
    let mut backups = HashSet::new();
    let mut backup_files = HashSet::new();
    if w.schema != 1
        || w.owner.len() != 64
        || uuid::Uuid::parse_str(&w.revision).is_err()
        || w.packages.len() > 500
        || w.backups.len() > 500
        || w.backups.iter().any(|b| {
            !modrinth::valid_package(&b.package)
                || !internal_name(&b.file, "rollback")
                || !backups.insert(&b.package.project)
                || !backup_files.insert(&b.file)
                || !w.packages.iter().any(|p| p.project == b.package.project)
        })
        || w.packages.iter().any(|p| {
            !modrinth::valid_package(p)
                || !projects.insert(&p.project)
                || !filenames.insert(p.filename.to_ascii_lowercase())
        })
    {
        return Err("mods_record");
    }
    Ok(())
}
fn read<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    let info = fs::symlink_metadata(path).map_err(|_| "mods_record")?;
    if !info.is_file() || save_files::reparse(&info) || info.len() > 4 * 1024 * 1024 {
        return Err("mods_record");
    }
    serde_json::from_slice(&fs::read(path).map_err(|_| "mods_record")?).map_err(|_| "mods_record")
}
fn write<T: Serialize>(root: &Path, name: &str, value: &T) -> Result<()> {
    if let Ok(meta) = fs::symlink_metadata(root.join(name)) {
        if !meta.is_file() || save_files::reparse(&meta) {
            return Err("mods_record");
        }
    }
    let bytes = serde_json::to_vec(value).map_err(|_| "mods_record")?;
    if bytes.len() > 4 * 1024 * 1024 {
        return Err("mods_limit");
    }
    p2p_files::atomic(root, name, &bytes).map_err(|_| "mods_write")
}
pub fn connect(profile: &str, path: &str, loader: &str, game: &str) -> Result<Workspace> {
    if loader != "fabric" {
        return Err("mods_loader_support");
    }
    modrinth::environment(loader, game)?;
    let root = root(path)?;
    let owner = owner(profile)?;
    if root.join(MANIFEST).symlink_metadata().is_ok() {
        let value = load(profile, &root)?;
        if value.loader != loader || value.game_version != game {
            return Err("mods_environment");
        }
        return Ok(value);
    }
    if root.join(JOURNAL).symlink_metadata().is_ok() {
        return Err("mods_record");
    }
    let w = Workspace {
        schema: 1,
        owner,
        revision: uuid::Uuid::new_v4().to_string(),
        loader: loader.into(),
        game_version: game.into(),
        packages: Vec::new(),
        backups: Vec::new(),
    };
    let bytes = serde_json::to_vec(&w).map_err(|_| "mods_record")?;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(root.join(MANIFEST))
        .map_err(|_| "mods_write")?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "mods_write")?;
    Ok(w)
}
pub fn load(profile: &str, root: &Path) -> Result<Workspace> {
    let mut w: Workspace = read(&root.join(MANIFEST))?;
    validate(&w)?;
    if w.owner != owner(profile)? {
        return Err("mods_profile");
    }
    if root.join(JOURNAL).symlink_metadata().is_ok() {
        recover(root, &w)?;
        w = read(&root.join(MANIFEST))?;
    }
    Ok(w)
}
pub fn hash(path: &Path, bytes: u64) -> Result<String> {
    let meta = fs::symlink_metadata(path).map_err(|_| "mods_changed")?;
    if !meta.is_file()
        || save_files::reparse(&meta)
        || meta.len() != bytes
        || bytes > 128 * 1024 * 1024
    {
        return Err("mods_changed");
    }
    let mut file = fs::File::open(path).map_err(|_| "mods_changed")?;
    let mut hash = Sha512::new();
    let mut buffer = vec![0; 128 * 1024];
    let mut read = 0;
    loop {
        let n = file.read(&mut buffer).map_err(|_| "mods_changed")?;
        if n == 0 {
            break;
        }
        read += n as u64;
        if read > bytes {
            return Err("mods_changed");
        }
        hash.update(&buffer[..n]);
    }
    if read != bytes {
        return Err("mods_changed");
    }
    Ok(format!("{:x}", hash.finalize()))
}
pub fn current_name(p: &Package) -> String {
    if p.enabled {
        p.filename.clone()
    } else {
        format!("{}.harbor-disabled", p.filename)
    }
}
pub fn matches(root: &Path, p: &Package) -> Result<()> {
    if hash(&root.join(current_name(p)), p.bytes)? != p.sha512 {
        return Err("mods_changed");
    }
    Ok(())
}
pub fn internal(suffix: &str) -> String {
    format!(".harbor-mods-{}.{}", uuid::Uuid::new_v4(), suffix)
}
fn internal_name(value: &str, suffix: &str) -> bool {
    value
        .strip_prefix(".harbor-mods-")
        .and_then(|v| v.strip_suffix(&format!(".{suffix}")))
        .is_some_and(|id| uuid::Uuid::parse_str(id).is_ok())
}
fn safe_name(value: &str) -> bool {
    modrinth::filename(value)
        || value
            .strip_suffix(".harbor-disabled")
            .is_some_and(modrinth::filename)
        || value.strip_prefix(".harbor-mods-").is_some_and(|v| {
            v.rsplit_once('.').is_some_and(|(id, ext)| {
                ["part", "remove", "rollback"].contains(&ext) && uuid::Uuid::parse_str(id).is_ok()
            })
        })
}
fn check_journal(j: &Journal, w: &Workspace) -> Result<()> {
    validate(&j.before)?;
    validate(&j.after)?;
    let mut from = HashSet::new();
    let mut to = HashSet::new();
    if j.before.owner != w.owner
        || j.after.owner != w.owner
        || j.before.loader != w.loader
        || j.after.loader != w.loader
        || j.before.game_version != w.game_version
        || j.after.game_version != w.game_version
        || ![j.before.revision.as_str(), j.after.revision.as_str()].contains(&w.revision.as_str())
        || j.moves.len() > 128
        || j.completed.is_some_and(|n| n > j.moves.len())
        || j.moves.iter().any(|m| {
            !safe_name(&m.from)
                || !safe_name(&m.to)
                || m.from == m.to
                || !from.insert(m.from.to_ascii_lowercase())
                || !to.insert(m.to.to_ascii_lowercase())
                || m.bytes > 128 * 1024 * 1024
                || m.hash.len() != 128
                || !m.hash.bytes().all(|b| b.is_ascii_hexdigit())
        })
    {
        return Err("mods_record");
    }
    // A target may reuse only a path vacated by an earlier move, never a future source.
    for (i, movement) in j.moves.iter().enumerate() {
        if j.moves[i + 1..]
            .iter()
            .any(|m| m.from.eq_ignore_ascii_case(&movement.to))
        {
            return Err("mods_record");
        }
    }
    Ok(())
}
fn remove_matching(root: &Path, name: &str, m: &FileMove) -> Result<()> {
    let path = root.join(name);
    if path.symlink_metadata().is_err() {
        return Ok(());
    }
    if hash(&path, m.bytes)? != m.hash {
        return Err("mods_changed");
    }
    fs::remove_file(path).map_err(|_| "mods_write")
}
fn recover(root: &Path, w: &Workspace) -> Result<()> {
    let mut journal: Journal = read(&root.join(JOURNAL))?;
    check_journal(&journal, w)?;
    let committed = w.revision == journal.after.revision;
    if !committed && journal.completed.is_some() {
        let mut completed = journal.completed.unwrap_or(0);
        // A crash can happen after the atomic move but before its progress write.
        if let Some(m) = journal
            .moves
            .get(completed)
            .filter(|_| !journal.rolling_back)
        {
            if root.join(&m.from).symlink_metadata().is_err() {
                if hash(&root.join(&m.to), m.bytes)? != m.hash {
                    return Err("mods_changed");
                }
                completed += 1;
            } else if hash(&root.join(&m.from), m.bytes)? != m.hash {
                return Err("mods_changed");
            }
        }
        journal.rolling_back = true;
        journal.completed = Some(completed);
        write(root, JOURNAL, &journal)?;
        while completed > 0 {
            let m = &journal.moves[completed - 1];
            if root.join(&m.from).symlink_metadata().is_ok() {
                // A previous recovery may have reversed this move before being interrupted.
                if hash(&root.join(&m.from), m.bytes)? != m.hash
                    || root.join(&m.to).symlink_metadata().is_ok()
                {
                    return Err("mods_changed");
                }
            } else {
                if hash(&root.join(&m.to), m.bytes)? != m.hash {
                    return Err("mods_changed");
                }
                transfer_files::publish(&root.join(&m.to), &root.join(&m.from))
                    .map_err(|_| "mods_write")?;
            }
            completed -= 1;
            journal.completed = Some(completed);
            write(root, JOURNAL, &journal)?;
        }
        for m in &journal.moves {
            if internal_name(&m.from, "part") {
                remove_matching(root, &m.from, m)?;
            }
        }
        return fs::remove_file(root.join(JOURNAL)).map_err(|_| "mods_write");
    }
    for m in journal.moves.iter().rev() {
        if committed {
            if m.discard {
                remove_matching(root, &m.to, m)?;
            }
        } else if root.join(&m.to).symlink_metadata().is_ok() {
            if hash(&root.join(&m.to), m.bytes)? != m.hash
                || root.join(&m.from).symlink_metadata().is_ok()
            {
                return Err("mods_changed");
            }
            transfer_files::publish(&root.join(&m.to), &root.join(&m.from))
                .map_err(|_| "mods_write")?;
        }
        if internal_name(&m.from, "part") {
            remove_matching(root, &m.from, m)?;
        }
    }
    fs::remove_file(root.join(JOURNAL)).map_err(|_| "mods_write")
}
pub fn transact(
    root: &Path,
    before: Workspace,
    mut after: Workspace,
    moves: Vec<FileMove>,
) -> Result<Workspace> {
    let observed: Workspace = read(&root.join(MANIFEST))?;
    validate(&observed)?;
    if observed.owner != before.owner || observed.revision != before.revision {
        return Err("mods_changed");
    }
    for package in &before.packages {
        matches(root, package)?;
    }
    after.revision = uuid::Uuid::new_v4().to_string();
    let mut journal = Journal {
        before: before.clone(),
        after: after.clone(),
        moves,
        completed: Some(0),
        rolling_back: false,
    };
    check_journal(&journal, &before)?;
    for (i, m) in journal.moves.iter().enumerate() {
        if hash(&root.join(&m.from), m.bytes)? != m.hash {
            return Err("mods_changed");
        }
        if root.join(&m.to).symlink_metadata().is_ok()
            && !journal.moves[..i]
                .iter()
                .any(|prior| prior.from.eq_ignore_ascii_case(&m.to))
        {
            return Err("mods_exists");
        }
    }
    write(root, JOURNAL, &journal)?;
    let result = (|| {
        for i in 0..journal.moves.len() {
            let m = &journal.moves[i];
            transfer_files::publish(&root.join(&m.from), &root.join(&m.to))
                .map_err(|_| "mods_write")?;
            journal.completed = Some(i + 1);
            write(root, JOURNAL, &journal)?;
        }
        write(root, MANIFEST, &after)
    })();
    if result.is_err() {
        recover(root, &before)?;
        return result.map(|_| after);
    }
    recover(root, &after)?;
    Ok(after)
}
pub fn action(profile: &str, path: &str, project: &str, action: &str) -> Result<Workspace> {
    let root = root(path)?;
    let before = load(profile, &root)?;
    let p = before
        .packages
        .iter()
        .find(|p| p.project == project)
        .ok_or("mods_missing")?;
    matches(&root, p)?;
    let enable = match action {
        "enable" => true,
        "disable" | "remove" => false,
        _ => return Err("mods_request"),
    };
    if action != "remove" && p.enabled == enable {
        return Ok(before);
    }
    if !enable
        && before.packages.iter().any(|other| {
            other.project != p.project
                && other.enabled
                && other.dependencies.iter().any(|d| {
                    d.dependency_type == "required"
                        && (d.project_id.as_ref() == Some(&p.project)
                            || d.version_id.as_ref() == Some(&p.version))
                })
        })
    {
        return Err("mods_required");
    }
    let mut after = before.clone();
    let index = after
        .packages
        .iter()
        .position(|v| v.project == project)
        .ok_or("mods_missing")?;
    if action == "remove" {
        after.packages.remove(index);
    } else {
        after.packages[index].enabled = enable;
    }
    if enable {
        compatible(&after.packages)?;
        for installed in &after.packages {
            if installed.project != p.project && installed.enabled {
                matches(&root, installed)?;
            }
        }
    }
    let to = if action == "remove" {
        internal("remove")
    } else {
        current_name(&after.packages[index])
    };
    if before.loader != "fabric" {
        return Err("mods_loader_support");
    }
    let mut moves = vec![FileMove {
        from: current_name(p),
        to,
        hash: p.sha512.clone(),
        bytes: p.bytes,
        discard: action == "remove",
    }];
    if action == "remove" {
        if let Some(backup) = before.backups.iter().find(|b| b.package.project == project) {
            moves.push(FileMove {
                from: backup.file.clone(),
                to: internal("remove"),
                bytes: backup.package.bytes,
                hash: backup.package.sha512.clone(),
                discard: true,
            });
        }
        after.backups.retain(|b| b.package.project != project);
    }
    transact(&root, before, after, moves)
}
pub fn compatible(packages: &[Package]) -> Result<()> {
    for p in packages.iter().filter(|p| p.enabled) {
        for d in &p.dependencies {
            let matching = packages.iter().filter(|v| v.enabled).find(|v| {
                d.version_id.as_ref().map_or_else(
                    || d.project_id.as_ref() == Some(&v.project),
                    |id| id == &v.version,
                )
            });
            if d.dependency_type == "required" && matching.is_none() {
                return Err("mods_dependency");
            }
            if d.dependency_type == "incompatible" && matching.is_some() {
                return Err("mods_incompatible");
            }
        }
    }
    Ok(())
}

/// Prepare a reviewed replacement without touching the live setup. One prior version per project
/// stays in a non-loadable local file; obsolete backups are discarded only after commit.
pub fn replacement(
    before: &Workspace,
    packages: &[Package],
    staged: &[String],
) -> Result<(Workspace, Vec<FileMove>)> {
    if packages.len() != staged.len() || packages.len() > 32 {
        return Err("mods_request");
    }
    let mut after = before.clone();
    let mut moves = Vec::new();
    for (package, stage) in packages.iter().zip(staged) {
        if let Some(previous) = before
            .packages
            .iter()
            .find(|p| p.project == package.project)
        {
            if let Some(backup) = before
                .backups
                .iter()
                .find(|b| b.package.project == package.project)
            {
                moves.push(FileMove {
                    from: backup.file.clone(),
                    to: internal("remove"),
                    bytes: backup.package.bytes,
                    hash: backup.package.sha512.clone(),
                    discard: true,
                });
            }
            let file = internal("rollback");
            moves.push(FileMove {
                from: current_name(previous),
                to: file.clone(),
                bytes: previous.bytes,
                hash: previous.sha512.clone(),
                discard: false,
            });
            after
                .backups
                .retain(|b| b.package.project != package.project);
            after.backups.push(Backup {
                package: previous.clone(),
                file,
            });
            after.packages.retain(|p| p.project != package.project);
        }
        after.packages.push(package.clone());
        moves.push(FileMove {
            from: stage.clone(),
            to: current_name(package),
            bytes: package.bytes,
            hash: package.sha512.clone(),
            discard: false,
        });
    }
    compatible(&after.packages)?;
    validate(&after)?;
    Ok((after, moves))
}

pub fn rollback(
    before: &Workspace,
    project: &str,
) -> Result<(Workspace, Vec<FileMove>, Package, String)> {
    let current = before
        .packages
        .iter()
        .find(|p| p.project == project)
        .ok_or("mods_missing")?;
    let backup = before
        .backups
        .iter()
        .find(|b| b.package.project == project)
        .ok_or("mods_missing")?;
    let mut restored = backup.package.clone();
    restored.enabled = current.enabled;
    let next_backup = internal("rollback");
    let moves = vec![
        FileMove {
            from: current_name(current),
            to: next_backup.clone(),
            bytes: current.bytes,
            hash: current.sha512.clone(),
            discard: false,
        },
        FileMove {
            from: backup.file.clone(),
            to: current_name(&restored),
            bytes: restored.bytes,
            hash: restored.sha512.clone(),
            discard: false,
        },
    ];
    let mut after = before.clone();
    after.packages.retain(|p| p.project != project);
    after.packages.push(restored.clone());
    after.backups.retain(|b| b.package.project != project);
    after.backups.push(Backup {
        package: current.clone(),
        file: next_backup,
    });
    compatible(&after.packages)?;
    validate(&after)?;
    Ok((after, moves, restored, backup.file.clone()))
}
