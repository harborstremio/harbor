//! Discover saves only for explicitly matched local ROMs; never crawl users' folders.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use tokio::io::AsyncReadExt;

#[derive(Deserialize)]
pub struct LocalRom {
    path: PathBuf,
    root: PathBuf,
    system: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedSave {
    path: PathBuf,
    name: String,
    rom_name: String,
    origin: &'static str,
    modified: u64,
}

async fn rom_hash(path: &Path) -> Option<String> {
    let mut file = tokio::fs::File::open(path).await.ok()?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 65536];
    let mut total = 0;
    loop {
        let count = file.read(&mut buffer).await.ok()?;
        if count == 0 {
            break;
        }
        total += count;
        if total > 128 * 1024 * 1024 {
            return None;
        }
        hasher.update(&buffer[..count]);
    }
    Some(format!("{:x}", hasher.finalize()))
}

async fn candidate(
    path: PathBuf,
    boundary: &Path,
    rom: &Path,
    origin: &'static str,
) -> Option<DetectedSave> {
    let meta = tokio::fs::symlink_metadata(&path).await.ok()?;
    if !meta.is_file()
        || super::save_files::reparse(&meta)
        || meta.len() == 0
        || meta.len() > 16 * 1024 * 1024
    {
        return None;
    }
    let path = tokio::fs::canonicalize(path).await.ok()?;
    // Reject an adjacent directory junction that leaves the selected ROM folder.
    if !path.starts_with(tokio::fs::canonicalize(boundary).await.ok()?) {
        return None;
    }
    Some(DetectedSave {
        name: path.file_name()?.to_string_lossy().into_owned(),
        path,
        rom_name: rom.file_stem()?.to_string_lossy().into_owned(),
        origin,
        modified: meta
            .modified()
            .ok()?
            .duration_since(UNIX_EPOCH)
            .ok()?
            .as_secs(),
    })
}

pub async fn discover(
    saves: &Path,
    profile: &str,
    roms: Vec<LocalRom>,
) -> Result<Vec<DetectedSave>, String> {
    if profile.is_empty() || profile.len() > 512 || roms.len() > 8 {
        return Err("pokemon_file".into());
    }
    let profile_root = saves.join(super::pokemon_files::digest(profile.as_bytes()));
    let mut found = Vec::new();
    let mut seen = HashSet::new();
    for rom in roms {
        // DS saves can be found alongside a ROM even though Harbor's embedded player
        // currently supports only GB/GBC/GBA. Larger DS ROMs are never hashed here.
        let extensions: &[&str] = match rom.system {
            24 => &["gba"],
            33 => &["gb"],
            22 => &["gbc", "gb"],
            20 => &["nds"],
            _ => continue,
        };
        let Ok(root) = tokio::fs::canonicalize(&rom.root).await else {
            continue;
        };
        let Ok(path) = tokio::fs::canonicalize(&rom.path).await else {
            continue;
        };
        let ext = path
            .extension()
            .and_then(|v| v.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        let Ok(meta) = tokio::fs::symlink_metadata(&path).await else {
            continue;
        };
        if !path.starts_with(&root)
            || !extensions.contains(&ext.as_str())
            || !meta.is_file()
            || meta.len() == 0
        {
            continue;
        }
        if let Some(core) = super::retro_save_path::core(rom.system) {
            if meta.len() <= 128 * 1024 * 1024 {
                if let Some(hash) = rom_hash(&path).await {
                    let save = super::retro_save_path::directory(
                        saves,
                        &super::pokemon_files::digest(profile.as_bytes()),
                        &hash,
                        core,
                    )
                    .join("save");
                    if let Some(value) = candidate(save, &profile_root, &path, "harbor").await {
                        found.push(value);
                    }
                }
            }
        }
        for ext in ["sav", "srm", "dsv"] {
            if let Some(value) = candidate(path.with_extension(ext), &root, &path, "adjacent").await
            {
                found.push(value);
            }
        }
    }
    found.retain(|item| seen.insert(item.path.clone()));
    found.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(found)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn finds_exact_profile_saves_and_adjacent_files_without_guessing() {
        let root = std::env::temp_dir().join(format!("pokemon-discovery-{}", uuid::Uuid::new_v4()));
        let roms = root.join("roms");
        let saves = root.join("saves");
        tokio::fs::create_dir_all(&roms).await.unwrap();
        let game = roms.join("Emerald.gba");
        let bytes = b"disposable ROM fixture";
        tokio::fs::write(&game, bytes).await.unwrap();
        let own = super::super::retro_save_path::directory(
            &saves,
            &super::super::pokemon_files::digest(b"one"),
            &super::super::pokemon_files::digest(bytes),
            "mgba",
        );
        let other = super::super::retro_save_path::directory(
            &saves,
            &super::super::pokemon_files::digest(b"two"),
            &super::super::pokemon_files::digest(bytes),
            "mgba",
        );
        for dir in [&own, &other] {
            tokio::fs::create_dir_all(dir).await.unwrap();
            tokio::fs::write(dir.join("save"), b"save").await.unwrap();
        }
        tokio::fs::write(roms.join("Emerald.sav"), b"save")
            .await
            .unwrap();
        tokio::fs::write(roms.join("Emerald backup.sav"), b"save")
            .await
            .unwrap();
        tokio::fs::write(roms.join("Emerald.srm"), b"")
            .await
            .unwrap();
        let rows = discover(
            &saves,
            "one",
            vec![
                LocalRom {
                    path: game.clone(),
                    root: roms.clone(),
                    system: 24,
                },
                LocalRom {
                    path: game.clone(),
                    root: roms.clone(),
                    system: 24,
                },
            ],
        )
        .await
        .unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows.iter().filter(|s| s.origin == "harbor").count(), 1);
        assert!(rows
            .iter()
            .all(|s| !s.path.starts_with(other.canonicalize().unwrap())));
        assert!(discover(
            &saves,
            "one",
            vec![LocalRom {
                path: game,
                root: own.clone(),
                system: 24
            }]
        )
        .await
        .unwrap()
        .is_empty());
        let canonical = root.canonicalize().unwrap();
        assert!(canonical.starts_with(std::env::temp_dir().canonicalize().unwrap()));
        assert!(canonical
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("pokemon-discovery-"));
        tokio::fs::remove_dir_all(canonical).await.unwrap();
    }
}
