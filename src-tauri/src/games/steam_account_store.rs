use super::steam_account::SteamAccountSnapshot;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

#[derive(Clone, Serialize, Deserialize)]
pub struct AccountRecord {
    pub version: u32,
    pub profile: String,
    pub steam_id: String,
    pub key: Option<String>,
    pub snapshot: SteamAccountSnapshot,
}

fn path(root: &Path, profile: &str) -> PathBuf {
    root.join(format!("{:x}.account", Sha256::digest(profile.as_bytes())))
}

pub fn read(root: &Path, profile: &str) -> Result<Option<AccountRecord>, &'static str> {
    let path = path(root, profile);
    let meta = match fs::symlink_metadata(&path) {
        Ok(meta) => meta,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("steam_account_store"),
    };
    if !meta.is_file() || meta.file_type().is_symlink() || meta.len() > 8 * 1024 * 1024 {
        return Err("steam_account_store");
    }
    let bytes = fs::read(&path).map_err(|_| "steam_account_store")?;
    let raw = unprotect(&bytes)?;
    let record: AccountRecord = serde_json::from_slice(&raw).map_err(|_| "steam_account_store")?;
    if record.version != 1
        || record.profile != profile
        || record.steam_id != record.snapshot.steam_id
        || record.snapshot.games.len() > 20_000
        || !super::steam_account::valid_id(&record.steam_id)
        || record
            .key
            .as_ref()
            .is_some_and(|key| !super::steam_account::valid_key(key))
    {
        return Err("steam_account_store");
    }
    Ok(Some(record))
}

pub fn write(root: &Path, record: &AccountRecord) -> Result<(), &'static str> {
    fs::create_dir_all(root).map_err(|_| "steam_account_store")?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(root, fs::Permissions::from_mode(0o700))
            .map_err(|_| "steam_account_store")?;
    }
    let bytes = serde_json::to_vec(record).map_err(|_| "steam_account_store")?;
    if bytes.len() > 8 * 1024 * 1024 {
        return Err("steam_account_limit");
    }
    let sealed = protect(&bytes)?;
    let temporary = root.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut options = fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&temporary)
            .map_err(|_| "steam_account_store")?;
        file.write_all(&sealed)
            .and_then(|_| file.sync_all())
            .map_err(|_| "steam_account_store")?;
        drop(file);
        fs::rename(&temporary, path(root, &record.profile)).map_err(|_| "steam_account_store")?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

pub fn remove(root: &Path, profile: &str) -> Result<(), &'static str> {
    match fs::remove_file(path(root, profile)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("steam_account_store"),
    }
}

#[cfg(windows)]
pub(super) fn crypt(bytes: &[u8], encrypt: bool) -> Result<Vec<u8>, &'static str> {
    use windows::{
        core::PCWSTR,
        Win32::{
            Foundation::{LocalFree, HLOCAL},
            Security::Cryptography::{
                CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
            },
        },
    };
    let input = CRYPT_INTEGER_BLOB {
        cbData: u32::try_from(bytes.len()).map_err(|_| "steam_account_store")?,
        pbData: bytes.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        if encrypt {
            CryptProtectData(
                &input,
                PCWSTR::null(),
                None,
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        } else {
            CryptUnprotectData(
                &input,
                None,
                None,
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        }
        .map_err(|_| "steam_account_store")?;
        let result = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        let _ = LocalFree(Some(HLOCAL(output.pbData.cast())));
        Ok(result)
    }
}
#[cfg(windows)]
fn protect(bytes: &[u8]) -> Result<Vec<u8>, &'static str> {
    let mut result = b"HGSA1".to_vec();
    result.extend(crypt(bytes, true)?);
    Ok(result)
}
#[cfg(windows)]
fn unprotect(bytes: &[u8]) -> Result<Vec<u8>, &'static str> {
    crypt(
        bytes.strip_prefix(b"HGSA1").ok_or("steam_account_store")?,
        false,
    )
}
// Unix records are private to the OS user (0700 directory, 0600 file); no encryption claim.
#[cfg(not(windows))]
fn protect(bytes: &[u8]) -> Result<Vec<u8>, &'static str> {
    let mut result = b"HGSJ1".to_vec();
    result.extend(bytes);
    Ok(result)
}
#[cfg(not(windows))]
fn unprotect(bytes: &[u8]) -> Result<Vec<u8>, &'static str> {
    Ok(bytes
        .strip_prefix(b"HGSJ1")
        .ok_or("steam_account_store")?
        .to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stored_accounts_roundtrip_with_profile_binding_and_removal() {
        let root = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!("account-{}", uuid::Uuid::new_v4()));
        let record = AccountRecord {
            version: 1,
            profile: "profile-a".into(),
            steam_id: "76561198000000001".into(),
            key: Some("A".repeat(32)),
            snapshot: SteamAccountSnapshot {
                steam_id: "76561198000000001".into(),
                name: "Fixture".into(),
                avatar: String::new(),
                games: vec![],
                library_visible: true,
                updated_at: 1,
            },
        };
        write(&root, &record).unwrap();
        let found = read(&root, "profile-a").unwrap().unwrap();
        assert_eq!(found.key, record.key);
        assert!(read(&root, "profile-b").unwrap().is_none());
        #[cfg(windows)]
        assert!(!fs::read(path(&root, "profile-a"))
            .unwrap()
            .windows(32)
            .any(|part| part == b"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"));
        let mut changed = record.clone();
        changed.snapshot.name = "Updated".into();
        write(&root, &changed).unwrap();
        assert_eq!(
            read(&root, "profile-a").unwrap().unwrap().snapshot.name,
            "Updated"
        );
        fs::copy(path(&root, "profile-a"), path(&root, "profile-b")).unwrap();
        assert!(read(&root, "profile-b").is_err());
        remove(&root, "profile-a").unwrap();
        assert!(read(&root, "profile-a").unwrap().is_none());
        let _ = fs::remove_dir_all(root);
    }
}
