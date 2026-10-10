use super::minecraft_data::{valid_profile, Account};
use sha2::{Digest, Sha256};
use std::{fs, io::Write, path::{Path, PathBuf}};

fn path(root: &Path, profile: &str) -> PathBuf { root.join(format!("{:x}.minecraft", Sha256::digest(profile.as_bytes()))) }
fn directory(root: &Path) -> Result<(), &'static str> {
    fs::create_dir_all(root).map_err(|_| "minecraft_store")?;
    let meta = fs::symlink_metadata(root).map_err(|_| "minecraft_store")?;
    if !meta.is_dir() || meta.file_type().is_symlink() { return Err("minecraft_store"); }
    #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; fs::set_permissions(root, fs::Permissions::from_mode(0o700)).map_err(|_| "minecraft_store")?; }
    Ok(())
}
pub fn read(root: &Path, profile: &str) -> Result<Option<Account>, &'static str> {
    if !valid_profile(profile) { return Err("minecraft_store"); }
    if !root.exists() { return Ok(None); } directory(root)?;
    let file = path(root, profile);
    let meta = match fs::symlink_metadata(&file) { Ok(meta) => meta, Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None), Err(_) => return Err("minecraft_store") };
    if !meta.is_file() || meta.file_type().is_symlink() || meta.len() > 1_048_576 { return Err("minecraft_store"); }
    let bytes = fs::read(file).map_err(|_| "minecraft_store")?;
    let raw = unseal(&bytes)?;
    let account: Account = serde_json::from_slice(&raw).map_err(|_| "minecraft_store")?;
    if account.schema != 1 || account.harbor_profile != profile || uuid::Uuid::parse_str(&account.client_id).is_err() || uuid::Uuid::parse_str(&account.minecraft.id).is_err() || account.refresh_token.is_empty() || account.refresh_token.len() > 131_072 || account.access_token.is_empty() || account.access_token.len() > 131_072 || account.minecraft.capes.len() > 100 || account.minecraft.skins.len() > 20 || account.minecraft.skins.iter().any(|v| super::minecraft_data::texture_url(&v.url).is_none()) || account.minecraft.capes.iter().any(|v| super::minecraft_data::texture_url(&v.url).is_none()) { return Err("minecraft_store"); }
    Ok(Some(account))
}
pub fn write(root: &Path, account: &Account) -> Result<(), &'static str> {
    if !valid_profile(&account.harbor_profile) { return Err("minecraft_store"); } directory(root)?;
    let bytes = serde_json::to_vec(account).map_err(|_| "minecraft_store")?;
    if bytes.len() > 1_048_576 { return Err("minecraft_store"); }
    let sealed = seal(&bytes)?;
    let temporary = root.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut options = fs::OpenOptions::new(); options.write(true).create_new(true);
        #[cfg(unix)] { use std::os::unix::fs::OpenOptionsExt; options.mode(0o600); }
        let mut file = options.open(&temporary).map_err(|_| "minecraft_store")?;
        file.write_all(&sealed).and_then(|_| file.sync_all()).map_err(|_| "minecraft_store")?; drop(file);
        fs::rename(&temporary, path(root, &account.harbor_profile)).map_err(|_| "minecraft_store")
    })();
    if result.is_err() { let _ = fs::remove_file(temporary); } result
}
pub fn remove(root: &Path, profile: &str) -> Result<(), &'static str> {
    if !valid_profile(profile) { return Err("minecraft_store"); }
    match fs::remove_file(path(root, profile)) { Ok(()) => Ok(()), Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()), Err(_) => Err("minecraft_store") }
}
#[cfg(windows)]
fn seal(bytes: &[u8]) -> Result<Vec<u8>, &'static str> {
    let mut sealed = b"HMCA1".to_vec(); sealed.extend(super::steam_account_store::crypt(bytes, true).map_err(|_| "minecraft_store")?); Ok(sealed)
}
#[cfg(windows)]
fn unseal(bytes: &[u8]) -> Result<Vec<u8>, &'static str> { super::steam_account_store::crypt(bytes.strip_prefix(b"HMCA1").ok_or("minecraft_store")?, false).map_err(|_| "minecraft_store") }
// On Unix, access is restricted to the OS user; do not claim OS-keychain encryption.
#[cfg(not(windows))]
fn seal(bytes: &[u8]) -> Result<Vec<u8>, &'static str> { let mut sealed = b"HMCAU1".to_vec(); sealed.extend(bytes); Ok(sealed) }
#[cfg(not(windows))]
fn unseal(bytes: &[u8]) -> Result<Vec<u8>, &'static str> { Ok(bytes.strip_prefix(b"HMCAU1").ok_or("minecraft_store")?.to_vec()) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn credential_roundtrip_is_bound_to_harbor_profile_and_windows_user() {
        let base = std::env::var_os("HARBOR_GAME_TEST_ROOT").map(PathBuf::from).unwrap_or_else(std::env::temp_dir);
        fs::create_dir_all(&base).unwrap(); let root = base.join(format!("minecraft-{}", uuid::Uuid::new_v4()));
        let mut account = Account { schema: 1, harbor_profile: "profile-a".into(), client_id: uuid::Uuid::new_v4().to_string(), refresh_token: "fixture-refresh-secret".into(), access_token: "fixture-access-secret".into(), expires_at: 123, updated_at: 1, minecraft: super::super::minecraft_data::MinecraftProfile { id: uuid::Uuid::new_v4().simple().to_string(), name: "HarborTest".into(), skins: vec![], capes: vec![] } };
        write(&root, &account).unwrap(); let loaded = read(&root, "profile-a").unwrap().unwrap(); assert_eq!(loaded.refresh_token, account.refresh_token);
        #[cfg(windows)] assert!(!fs::read(path(&root, "profile-a")).unwrap().windows(22).any(|v| v == b"fixture-refresh-secret"));
        account.refresh_token = "new-fixture-refresh".into(); write(&root, &account).unwrap(); assert_eq!(read(&root, "profile-a").unwrap().unwrap().refresh_token, "new-fixture-refresh");
        fs::copy(path(&root, "profile-a"), path(&root, "profile-b")).unwrap(); assert!(read(&root, "profile-b").is_err());
        remove(&root, "profile-a").unwrap(); assert!(read(&root, "profile-a").unwrap().is_none());
        let resolved = root.canonicalize().unwrap(); assert!(resolved.starts_with(base.canonicalize().unwrap())); assert!(resolved.file_name().unwrap().to_string_lossy().starts_with("minecraft-")); fs::remove_dir_all(resolved).unwrap();
    }
}
