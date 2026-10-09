//! Short-lived in-process ownership for acquisition and reviewed source cleanup.
//! Claims are held for work, not by a UI window. No lock is held during I/O.
use std::{
    collections::HashMap,
    path::{Component, Path, PathBuf},
    sync::{Mutex, OnceLock},
};
#[derive(Clone)]
struct Scope {
    path: String,
    tree: bool,
}
struct Claim {
    exclusive: bool,
    scopes: Vec<Scope>,
}
fn claims() -> &'static Mutex<HashMap<String, Claim>> {
    static VALUE: OnceLock<Mutex<HashMap<String, Claim>>> = OnceLock::new();
    VALUE.get_or_init(|| Mutex::new(HashMap::new()))
}
pub(crate) struct Lease(String);
impl Drop for Lease {
    fn drop(&mut self) {
        if let Ok(mut held) = claims().lock() {
            held.remove(&self.0);
        }
    }
}
fn key(path: &Path) -> Result<String, &'static str> {
    if !path.is_absolute()
        || path
            .components()
            .any(|v| matches!(v, Component::ParentDir | Component::CurDir))
    {
        return Err("archive_path");
    }
    // Existing aliases must claim their real target. New destinations resolve
    // their nearest existing ancestor, without creating any directory or file.
    let mut ancestor = path;
    let mut suffix = Vec::new();
    while !ancestor.try_exists().map_err(|_| "archive_path")? {
        suffix.push(ancestor.file_name().ok_or("archive_path")?.to_owned());
        ancestor = ancestor.parent().ok_or("archive_path")?;
    }
    let mut resolved = ancestor.canonicalize().map_err(|_| "archive_path")?;
    for name in suffix.into_iter().rev() {
        resolved.push(name);
    }
    let value = resolved.to_str().ok_or("archive_path")?;
    let value = if cfg!(windows) {
        let value = value.replace('\\', "/");
        value
            .strip_prefix("//?/UNC/")
            .map(|v| format!("//{v}"))
            .unwrap_or_else(|| value.strip_prefix("//?/").unwrap_or(&value).to_owned())
            .to_lowercase()
    } else {
        value.into()
    };
    Ok(value.trim_end_matches('/').into())
}
fn inside(path: &str, parent: &str) -> bool {
    path == parent
        || path
            .strip_prefix(parent)
            .is_some_and(|v| v.starts_with('/'))
}
fn acquire(paths: &[PathBuf], tree: bool, exclusive: bool) -> Result<Lease, &'static str> {
    if paths.is_empty() || paths.len() > 1025 {
        return Err("archive_limit");
    }
    let scopes = paths
        .iter()
        .map(|path| {
            Ok(Scope {
                path: key(path)?,
                tree,
            })
        })
        .collect::<Result<Vec<_>, &'static str>>()?;
    let mut held = claims().lock().map_err(|_| "archive_busy")?;
    if held.values().any(|other| {
        (exclusive || other.exclusive)
            && scopes.iter().any(|a| {
                other.scopes.iter().any(|b| {
                    a.path == b.path
                        || a.tree && inside(&b.path, &a.path)
                        || b.tree && inside(&a.path, &b.path)
                })
            })
    }) {
        return Err("archive_busy");
    }
    let id = uuid::Uuid::new_v4().to_string();
    held.insert(id.clone(), Claim { exclusive, scopes });
    Ok(Lease(id))
}
pub(crate) fn using(paths: &[PathBuf], tree: bool) -> Result<Lease, &'static str> {
    acquire(paths, tree, false)
}
pub(crate) fn cleanup(paths: &[PathBuf]) -> Result<Lease, &'static str> {
    acquire(paths, false, true)
}
pub(crate) fn cleanup_tree(path: &Path) -> Result<Lease, &'static str> {
    acquire(&[path.to_path_buf()], true, true)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn source_lease_excludes_tree_use_but_not_neighboring_files_and_releases_on_drop() {
        let base = PathBuf::from(std::env::var_os("HARBOR_GAME_TEST_ROOT").unwrap())
            .join(uuid::Uuid::new_v4().to_string());
        let first = base.join("Game.zip");
        let guard = cleanup(&[first.clone()]).unwrap();
        assert!(using(&[base.clone()], true).is_err());
        assert!(using(&[first.clone()], false).is_err());
        assert!(using(&[base.join("Another.zip")], false).is_ok());
        assert!(using(
            &[PathBuf::from(format!("{}-sibling", base.display()))],
            true
        )
        .is_ok());
        drop(guard);
        let reader = using(&[base.clone()], true).unwrap();
        assert!(cleanup(&[first.clone()]).is_err());
        drop(reader);
        assert!(cleanup(&[first]).is_ok());
    }
}
