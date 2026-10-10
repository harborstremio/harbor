use super::{minecraft_instances as instances, minecraft_launch_process, minecraft_runtime, mod_files, modrinth::Result, mods, save_files};
use serde::Serialize;
use std::{fs, path::{Path, PathBuf}};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct File { pub name: String, pub bytes: u64 }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Content { pub path: String, pub workspace: mod_files::Workspace, pub external: Vec<File> }

pub struct Guard { _work: minecraft_runtime::Work, instance: instances::Instance }
impl Guard {
    pub fn environment(&self, loader: Option<&str>, game: Option<&str>) -> Result<()> {
        if loader.is_some_and(|v| v != self.instance.loader) || game.is_some_and(|v| v != self.instance.game_version) { return Err("mods_environment"); }
        Ok(())
    }
}

// Generic folder actions must obey the same launch lock when their destination
// belongs to a Harbor instance. A folder picker must not bypass this protection.
pub fn guard(profile: &str, root: &Path) -> Result<Option<Guard>> {
    if !named(root, "mods") { return Ok(None); }
    let Some(game) = root.parent().filter(|p| named(p, "game")) else { return Ok(None); };
    let folder = game.parent().ok_or("mods_folder")?;
    let managed_layout = folder.parent().and_then(Path::parent).is_some_and(|p| named(p, "Harbor Minecraft"));
    if !managed_layout && !folder.join(instances::RECORD).exists() { return Ok(None); }
    let _work = minecraft_runtime::start(profile, &uuid::Uuid::new_v4().to_string()).map_err(|_| "mods_busy")?;
    let id = folder.file_name().and_then(|v| v.to_str()).ok_or("mods_record")?;
    let (checked, instance) = instances::load(folder.parent().ok_or("mods_folder")?, profile, id).map_err(|_| "mods_record")?;
    if checked != folder || instance.loader != "fabric" { return Err("mods_environment"); }
    minecraft_launch_process::idle(&checked).map_err(process_error)?;
    let value = Guard { _work, instance };
    if root.join(mod_files::MANIFEST).exists() {
        let workspace: mod_files::Workspace = instances::read(&root.join(mod_files::MANIFEST)).map_err(|_| "mods_record")?;
        value.environment(Some(&workspace.loader), Some(&workspace.game_version))?;
    }
    Ok(Some(value))
}

fn named(path: &Path, name: &str) -> bool { path.file_name().and_then(|v| v.to_str()).is_some_and(|v| v.eq_ignore_ascii_case(name)) }

fn target(profile: &str, path: &str, id: &str) -> Result<(PathBuf, instances::Instance)> {
    let _work = minecraft_runtime::start(profile, &uuid::Uuid::new_v4().to_string()).map_err(|_| "mods_busy")?;
    let library = instances::library(profile, path).map_err(|_| "mods_folder")?;
    let (folder, instance) = instances::load(&library, profile, id).map_err(|_| "mods_record")?;
    if instance.loader != "fabric" { return Err("mods_loader_support"); }
    minecraft_launch_process::idle(&folder).map_err(process_error)?;
    let game = instances::directory(&folder.join("game")).map_err(|_| "mods_folder")?;
    let root = minecraft_runtime::directory(&game, "mods").map_err(|_| "mods_folder")?;
    Ok((root, instance))
}

pub fn external(root: &Path, workspace: &mod_files::Workspace) -> Result<Vec<File>> {
    let mut result = Vec::new();
    let entries = fs::read_dir(root).map_err(|_| "mods_folder")?.take(2001).collect::<std::result::Result<Vec<_>, _>>().map_err(|_| "mods_folder")?;
    if entries.len() > 2000 { return Err("mods_limit"); }
    for entry in entries {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.to_ascii_lowercase().ends_with(".jar") || workspace.packages.iter().any(|p| p.filename.eq_ignore_ascii_case(&name)) { continue; }
        let meta = fs::symlink_metadata(entry.path()).map_err(|_| "mods_changed")?;
        if !meta.is_file() || save_files::reparse(&meta) { return Err("mods_folder"); }
        result.push(File { name, bytes: meta.len() });
    }
    result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(result)
}

pub async fn content(profile: String, path: String, id: String) -> Result<Content> {
    let p = profile.clone();
    let (root, instance) = tokio::task::spawn_blocking(move || target(&p, &path, &id)).await.map_err(|_| "mods_folder")??;
    let path = root.to_str().ok_or("mods_folder")?.to_owned();
    let workspace = mods::workspace(profile, path.clone(), Some(instance.loader), Some(instance.game_version)).await?;
    // Unmanaged pack files remain read-only; connecting is never adoption.
    let (workspace, external) = tokio::task::spawn_blocking(move || -> Result<_> { let external = external(&root, &workspace)?; Ok((workspace, external)) }).await.map_err(|_| "mods_folder")??;
    Ok(Content { path, workspace, external })
}

fn process_error(error: &'static str) -> &'static str { if error == "launch_running" { "mods_instance_running" } else { "mods_record" } }

#[cfg(test)]
#[path = "minecraft_content_tests.rs"]
mod tests;
