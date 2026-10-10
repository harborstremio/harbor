use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::Path;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
pub fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub async fn read(path: &Path, limit: usize) -> Result<Vec<u8>, String> {
    let meta = tokio::fs::symlink_metadata(path)
        .await
        .map_err(|_| "pokemon_read")?;
    if !meta.is_file() || super::save_files::reparse(&meta) || meta.len() > limit as u64 {
        return Err("pokemon_file".into());
    }
    let file = tokio::fs::File::open(path)
        .await
        .map_err(|_| "pokemon_read")?;
    let mut bytes = Vec::new();
    file.take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .await
        .map_err(|_| "pokemon_read")?;
    if bytes.len() > limit {
        return Err("pokemon_file".into());
    }
    Ok(bytes)
}
pub async fn atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = tokio::fs::canonicalize(path.parent().ok_or("pokemon_path")?)
        .await
        .map_err(|_| "pokemon_path")?;
    let dest = parent.join(path.file_name().ok_or("pokemon_path")?);
    if dest.exists() {
        let meta = tokio::fs::symlink_metadata(&dest)
            .await
            .map_err(|_| "pokemon_read")?;
        if !meta.is_file() || super::save_files::reparse(&meta) {
            return Err("pokemon_file".into());
        }
    }
    let temp = parent.join(format!(".harbor-pokemon-{}.tmp", uuid::Uuid::new_v4()));
    let result = async {
        let mut file = tokio::fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp)
            .await
            .map_err(|_| "pokemon_write")?;
        file.write_all(bytes).await.map_err(|_| "pokemon_write")?;
        file.sync_all().await.map_err(|_| "pokemon_write")?;
        drop(file);
        tokio::fs::rename(&temp, &dest)
            .await
            .map_err(|_| "pokemon_write")?;
        #[cfg(unix)]
        {
            let directory = tokio::fs::File::open(&parent)
                .await
                .map_err(|_| "pokemon_write")?;
            directory.sync_all().await.map_err(|_| "pokemon_write")?;
        }
        Ok::<(), &str>(())
    }
    .await;
    if result.is_err() {
        let _ = tokio::fs::remove_file(temp).await;
    }
    result.map_err(String::from)
}

/// A durable receipt is written before replacement, so a crash never makes the original undiscoverable.
pub async fn commit_file(
    path: &Path,
    backups: &Path,
    original: &[u8],
    candidate: &[u8],
) -> Result<Value, String> {
    let live = read(path, 16 * 1024 * 1024).await?;
    if digest(&live) != digest(original) {
        return Err("pokemon_save_changed".into());
    }
    let id = uuid::Uuid::new_v4().to_string();
    atomic(&backups.join(format!("{id}.sav")), &live).await?;
    let receipt = json!({"id":id,"path":path,"originalHash":digest(&live),"writtenHash":digest(candidate),"at":std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()});
    atomic(
        &backups.join(format!("{id}.json")),
        &serde_json::to_vec(&receipt).map_err(|_| "pokemon_write")?,
    )
    .await?;
    if digest(&read(path, 16 * 1024 * 1024).await?) != digest(&live) {
        return Err("pokemon_save_changed".into());
    }
    atomic(path, candidate).await?;
    Ok(receipt)
}
#[cfg(test)]
mod tests {
    use super::*;
    async fn cleanup(root: std::path::PathBuf) {
        let base = tokio::fs::canonicalize(std::env::temp_dir()).await.unwrap();
        let path = tokio::fs::canonicalize(root).await.unwrap();
        assert!(path.starts_with(base));
        assert!(path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("harbor-pokemon-test-"));
        tokio::fs::remove_dir_all(path).await.unwrap();
    }
    fn workspace() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("harbor-pokemon-test-{}", uuid::Uuid::new_v4()))
    }
    #[tokio::test]
    async fn reviewed_commit_preserves_original_and_replaces_atomically() {
        let root = workspace();
        tokio::fs::create_dir_all(&root).await.unwrap();
        let path = root.join("game.sav");
        atomic(&path, b"original").await.unwrap();
        let receipt = commit_file(&path, &root, b"original", b"edited")
            .await
            .unwrap();
        assert_eq!(read(&path, 100).await.unwrap(), b"edited");
        assert_eq!(
            read(
                &root.join(format!("{}.sav", receipt["id"].as_str().unwrap())),
                100
            )
            .await
            .unwrap(),
            b"original"
        );
        assert_eq!(receipt["originalHash"], digest(b"original"));
        let mut entries = tokio::fs::read_dir(&root).await.unwrap();
        while let Some(entry) = entries.next_entry().await.unwrap() {
            assert_ne!(
                entry.path().extension().and_then(|e| e.to_str()),
                Some("tmp")
            );
        }
        cleanup(root).await;
    }
    #[tokio::test]
    async fn changed_save_and_failed_backup_never_overwrite_live_bytes() {
        let root = workspace();
        tokio::fs::create_dir_all(&root).await.unwrap();
        let path = root.join("game.sav");
        atomic(&path, b"newer game progress").await.unwrap();
        assert_eq!(
            commit_file(&path, &root, b"old progress", b"edited")
                .await
                .unwrap_err(),
            "pokemon_save_changed"
        );
        assert!(commit_file(
            &path,
            &root.join("missing"),
            b"newer game progress",
            b"edited"
        )
        .await
        .is_err());
        assert_eq!(read(&path, 100).await.unwrap(), b"newer game progress");
        cleanup(root).await;
    }
    #[tokio::test]
    async fn bounded_reader_rejects_oversize_and_directories() {
        let root = workspace();
        tokio::fs::create_dir_all(&root).await.unwrap();
        let path = root.join("game.sav");
        atomic(&path, b"123456").await.unwrap();
        assert!(read(&path, 5).await.is_err());
        assert!(read(&root, 100).await.is_err());
        cleanup(root).await;
    }
    #[cfg(windows)]
    #[tokio::test]
    async fn failed_replacement_leaves_original_and_durable_recovery_receipt() {
        use std::os::windows::fs::OpenOptionsExt;
        let root = workspace();
        tokio::fs::create_dir_all(&root).await.unwrap();
        let path = root.join("game.sav");
        atomic(&path, b"original").await.unwrap();
        let lock = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(3)
            .open(&path)
            .unwrap();
        assert_eq!(
            commit_file(&path, &root, b"original", b"edited")
                .await
                .unwrap_err(),
            "pokemon_write"
        );
        assert_eq!(read(&path, 100).await.unwrap(), b"original");
        let mut entries = tokio::fs::read_dir(&root).await.unwrap();
        let mut receipts = 0;
        while let Some(entry) = entries.next_entry().await.unwrap() {
            assert_ne!(
                entry.path().extension().and_then(|v| v.to_str()),
                Some("tmp")
            );
            if entry.path().extension().and_then(|v| v.to_str()) == Some("json") {
                let receipt: Value =
                    serde_json::from_slice(&read(&entry.path(), 16384).await.unwrap()).unwrap();
                assert_eq!(
                    read(
                        &root.join(format!("{}.sav", receipt["id"].as_str().unwrap())),
                        100
                    )
                    .await
                    .unwrap(),
                    b"original"
                );
                receipts += 1;
            }
        }
        assert_eq!(receipts, 1);
        drop(lock);
        cleanup(root).await;
    }
}
