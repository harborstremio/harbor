use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
};
use tokio_util::sync::CancellationToken;
pub(crate) use crate::transfer_files::{ensure_regular, free_bytes, publish};


pub fn destination(value: &str) -> Result<PathBuf, &'static str> {
    let input = Path::new(value);
    if !input.is_absolute() || value.len() > 4096 {
        return Err("transfer_destination");
    }
    let name = input.file_name().ok_or("transfer_destination")?;
    if name.to_string_lossy().starts_with(".harbor-") {
        return Err("transfer_destination");
    }
    let parent = fs::canonicalize(input.parent().ok_or("transfer_destination")?)
        .map_err(|_| "transfer_destination")?;
    if !parent.is_dir() {
        return Err("transfer_destination");
    }
    Ok(parent.join(name))
}
pub fn partial(dest: &Path, id: &str) -> Result<PathBuf, &'static str> {
    uuid::Uuid::parse_str(id).map_err(|_| "transfer_invalid_record")?;
    Ok(dest
        .parent()
        .ok_or("transfer_destination")?
        .join(format!(".harbor-{id}.part")))
}
pub fn hash_file(path: &Path, cancel: &CancellationToken) -> Result<String, &'static str> {
    ensure_regular(path)?.ok_or("transfer_read")?;
    let mut file = fs::File::open(path).map_err(|_| "transfer_read")?;
    let mut buffer = vec![0u8; 1024 * 1024];
    let mut hash = Sha256::new();
    loop {
        if cancel.is_cancelled() {
            return Err("transfer_stopped");
        }
        let len = file.read(&mut buffer).map_err(|_| "transfer_read")?;
        if len == 0 {
            break;
        }
        hash.update(&buffer[..len]);
    }
    Ok(format!("{:x}", hash.finalize()))
}
