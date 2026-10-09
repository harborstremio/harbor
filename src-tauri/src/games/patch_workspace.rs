use super::patch::{self, PatchResult};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

const ROM_EXTENSIONS: &[&str] = &[
    "gba", "gb", "gbc", "nes", "sfc", "smc", "n64", "z64", "v64", "nds", "gen", "md", "smd", "sms",
    "gg", "pce", "bin", "iso", "rom",
];
const LIFETIME: Duration = Duration::from_secs(15 * 60);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchPlan {
    token: String,
    format: &'static str,
    source_name: String,
    patch_name: String,
    source_bytes: usize,
    target_bytes: usize,
    source_sha256: String,
    patch_sha256: String,
    target_sha256: String,
    checksums_verified: bool,
    metadata: String,
    output_name: String,
    extension: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchReceipt {
    path: String,
    bytes: usize,
    sha256: String,
}

struct Prepared {
    plan: PatchPlan,
    source: PathBuf,
    patch: PathBuf,
    output: Vec<u8>,
    created: Instant,
}
fn workspace() -> &'static Mutex<Option<Prepared>> {
    static WORKSPACE: OnceLock<Mutex<Option<Prepared>>> = OnceLock::new();
    WORKSPACE.get_or_init(|| Mutex::new(None))
}
fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|p| p.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}
fn name(path: &Path) -> String {
    path.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned()
}
fn read(path: &Path) -> PatchResult<Vec<u8>> {
    let file = File::open(path).map_err(|_| "patch_read_failed")?;
    let info = file.metadata().map_err(|_| "patch_read_failed")?;
    if !info.is_file() {
        return Err("patch_read_failed");
    }
    if info.len() > patch::MAX_BYTES as u64 {
        return Err("patch_too_large");
    }
    let mut bytes = Vec::new();
    file.take(patch::MAX_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "patch_read_failed")?;
    if bytes.len() > patch::MAX_BYTES {
        return Err("patch_too_large");
    }
    Ok(bytes)
}

/// BPS/UPS carry the exact required input checksum; IPS does not.
pub fn match_sources(patch_path: String, paths: Vec<String>) -> PatchResult<Vec<String>> {
    let bytes=read(Path::new(&patch_path))?;
    if bytes.len()<16 || !(bytes.starts_with(b"BPS1") || bytes.starts_with(b"UPS1")) {return Ok(vec![]);}
    let checksum=u32::from_le_bytes(bytes[bytes.len()-12..bytes.len()-8].try_into().unwrap());
    let patch_checksum=u32::from_le_bytes(bytes[bytes.len()-4..].try_into().unwrap());
    if patch::crc32(&bytes[..bytes.len()-4])!=patch_checksum {return Err("patch_checksum_mismatch");}
    let mut matches=vec![];
    let mut inspected=0usize;
    for path in paths.into_iter().take(32) {
        let path_ref=Path::new(&path);
        if !ROM_EXTENSIONS.contains(&extension(path_ref).as_str()) {continue;}
        let Ok(info)=fs::metadata(path_ref) else {continue};
        if info.len()>patch::MAX_BYTES as u64 || inspected.saturating_add(info.len() as usize)>1024*1024*1024 {continue;}
        inspected+=info.len() as usize;
        if let Ok(source)=read(path_ref) {if patch::crc32(&source)==checksum {matches.push(path);}}
    }
    Ok(matches)
}

fn prepare(source_path: &Path, patch_path: &Path) -> PatchResult<Prepared> {
    let source = source_path
        .canonicalize()
        .map_err(|_| "patch_read_failed")?;
    let patch = patch_path.canonicalize().map_err(|_| "patch_read_failed")?;
    let ext = extension(&source);
    if !ROM_EXTENSIONS.contains(&ext.as_str()) {
        return Err("patch_game_type");
    }
    if !["bps", "ips", "ups"].contains(&extension(&patch).as_str()) {
        return Err("patch_unsupported");
    }
    let original = read(&source)?;
    let patch_bytes = read(&patch)?;
    let result = patch::apply(&original, &patch_bytes)?;
    let output_name = format!(
        "{} (patched).{}",
        patch.file_stem().unwrap_or_default().to_string_lossy(),
        ext
    );
    let plan = PatchPlan {
        token: uuid::Uuid::new_v4().to_string(),
        format: result.format,
        source_name: name(&source),
        patch_name: name(&patch),
        source_bytes: original.len(),
        target_bytes: result.bytes.len(),
        source_sha256: sha256(&original),
        patch_sha256: sha256(&patch_bytes),
        target_sha256: sha256(&result.bytes),
        checksums_verified: result.checksums_verified,
        metadata: result.metadata,
        output_name,
        extension: ext,
    };
    Ok(Prepared {
        plan,
        source,
        patch,
        output: result.bytes,
        created: Instant::now(),
    })
}

fn write(prepared: &Prepared, output_path: &Path) -> PatchResult<PatchReceipt> {
    if prepared.created.elapsed() > LIFETIME {
        return Err("patch_expired");
    }
    if extension(output_path) != prepared.plan.extension {
        return Err("patch_output_type");
    }
    // Re-read before committing: a file edited after verification needs a fresh plan.
    if sha256(&read(&prepared.source)?) != prepared.plan.source_sha256
        || sha256(&read(&prepared.patch)?) != prepared.plan.patch_sha256
    {
        return Err("patch_inputs_changed");
    }
    // create_new is atomic: existing files, symlinks and hardlinks are never followed or overwritten.
    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(output_path)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                "patch_output_exists"
            } else {
                "patch_write_failed"
            }
        })?;
    if output
        .write_all(&prepared.output)
        .and_then(|_| output.sync_all())
        .is_err()
    {
        drop(output);
        let _ = fs::remove_file(output_path);
        return Err("patch_write_failed");
    }
    Ok(PatchReceipt {
        path: output_path.to_string_lossy().into_owned(),
        bytes: prepared.output.len(),
        sha256: prepared.plan.target_sha256.clone(),
    })
}

pub fn prepare_patch(source_path: String, patch_path: String) -> PatchResult<PatchPlan> {
    // Only one bounded output buffer is retained. Concurrent requests fail promptly rather than queueing large allocations.
    let mut state = workspace().try_lock().map_err(|_| "patch_busy")?;
    *state = None;
    let prepared = prepare(Path::new(&source_path), Path::new(&patch_path))?;
    let plan = prepared.plan.clone();
    *state = Some(prepared);
    Ok(plan)
}
pub fn write_patch(token: String, output_path: String) -> PatchResult<PatchReceipt> {
    let mut state = workspace().try_lock().map_err(|_| "patch_busy")?;
    let prepared = state
        .as_ref()
        .filter(|p| p.plan.token == token)
        .ok_or("patch_expired")?;
    let result = write(prepared, Path::new(&output_path))?;
    *state = None;
    Ok(result)
}
pub fn discard_patch(token: String) -> PatchResult<()> {
    let mut state = workspace().lock().map_err(|_| "patch_busy")?;
    if state.as_ref().is_some_and(|p| p.plan.token == token) {
        *state = None;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root = std::env::var_os("HARBOR_GAME_TEST_ROOT")
                .map(PathBuf::from)
                .unwrap_or_else(std::env::temp_dir);
            let path = root.join(format!("patch-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&path).unwrap();
            fs::write(path.join("base.gba"), b"abcdef").unwrap();
            fs::write(path.join("fan.ips"), b"PATCH\0\0\x01\0\x02XYEOF").unwrap();
            Self(path)
        }
        fn prepared(&self) -> Prepared {
            prepare(&self.0.join("base.gba"), &self.0.join("fan.ips")).unwrap()
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    #[test]
    fn writes_separate_copy_and_preserves_inputs() {
        let f = Fixture::new();
        let p = f.prepared();
        let receipt = write(&p, &f.0.join("new.gba")).unwrap();
        assert_eq!(fs::read(f.0.join("new.gba")).unwrap(), b"aXYdef");
        assert_eq!(fs::read(f.0.join("base.gba")).unwrap(), b"abcdef");
        assert_eq!(receipt.sha256, sha256(b"aXYdef"));
        assert!(!p.plan.checksums_verified);
        assert_eq!(p.plan.output_name, "fan (patched).gba");
    }
    #[test]
    fn ups_file_verifies_and_writes_separate_output() {
        let f = Fixture::new();
        // Independently encoded fixture; CRCs checked with Python zlib.
        let ups = [0x55, 0x50, 0x53, 0x31, 0x86, 0x86, 0x81, 0x3a, 0x3a, 0x00, 0xef, 0x39, 0x8e, 0x4b, 0x0d, 0x81, 0x89, 0x3f, 0x65, 0x68, 0x75, 0xde];
        fs::write(f.0.join("fan.ups"), ups).unwrap();
        let p = prepare(&f.0.join("base.gba"), &f.0.join("fan.ups")).unwrap();
        assert_eq!(p.plan.format, "UPS");
        assert!(p.plan.checksums_verified);
        write(&p, &f.0.join("ups-output.gba")).unwrap();
        assert_eq!(fs::read(f.0.join("ups-output.gba")).unwrap(), b"aXYdef");
        assert_eq!(fs::read(f.0.join("base.gba")).unwrap(), b"abcdef");
        assert_eq!(fs::read(f.0.join("fan.ups")).unwrap(), ups);
    }
    #[test]
    fn refuses_original_existing_copy_and_wrong_extension() {
        let f = Fixture::new();
        let p = f.prepared();
        assert_eq!(
            write(&p, &f.0.join("base.gba")).err(),
            Some("patch_output_exists")
        );
        fs::hard_link(f.0.join("base.gba"), f.0.join("alias.gba")).unwrap();
        assert_eq!(
            write(&p, &f.0.join("alias.gba")).err(),
            Some("patch_output_exists")
        );
        assert_eq!(
            write(&p, &f.0.join("new.exe")).err(),
            Some("patch_output_type")
        );
        assert_eq!(fs::read(f.0.join("base.gba")).unwrap(), b"abcdef");
    }
    #[test]
    fn detects_modified_inputs_and_expired_plan() {
        let f = Fixture::new();
        let mut p = f.prepared();
        fs::write(f.0.join("fan.ips"), b"PATCHEOF").unwrap();
        assert_eq!(
            write(&p, &f.0.join("new.gba")).err(),
            Some("patch_inputs_changed")
        );
        assert!(!f.0.join("new.gba").exists());
        p.created = Instant::now() - LIFETIME - Duration::from_secs(1);
        assert_eq!(write(&p, &f.0.join("new.gba")).err(), Some("patch_expired"));
    }
}
