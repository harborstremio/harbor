//! Author-published WoWInterface packages. Release labels alone never establish
//! compatibility: validate every installed TOC against the actual client.
use super::{p2p_files, wow_addons};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    io::{Cursor, Read},
    time::Duration,
};
use tokio_util::sync::CancellationToken;

pub type Result<T> = std::result::Result<T, &'static str>;
pub const MAX_ARCHIVE: usize = 32 * 1024 * 1024;
pub const MAX_CONTENT: usize = 128 * 1024 * 1024;
pub const MAX_FILES: usize = 8000;
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Release {
    pub id: u32,
    pub title: String,
    pub version: String,
    pub updated_at: u64,
    pub checksum: String,
    pub download_url: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileStamp {
    pub path: String,
    pub bytes: u64,
    pub sha256: String,
}
pub struct File {
    pub stamp: FileStamp,
    pub data: Vec<u8>,
}
pub struct Package {
    pub release: Release,
    pub files: Vec<File>,
    pub folders: Vec<String>,
    pub dependencies: Vec<String>,
}
pub struct Layout {
    pub release: Release,
    pub folders: Vec<String>,
}
pub fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub fn check_cancel(cancel: &CancellationToken) -> Result<()> {
    if cancel.is_cancelled() {
        Err("wow_addons_cancelled")
    } else {
        Ok(())
    }
}
pub fn interface(version: &str) -> Result<u32> {
    let parts = version
        .split('.')
        .map(str::parse::<u32>)
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(|_| "wow_addons_version")?;
    if !(3..=4).contains(&parts.len())
        || !(1..100).contains(&parts[0])
        || parts[1] >= 100
        || parts[2] >= 100
    {
        return Err("wow_addons_version");
    }
    Ok(parts[0] * 10000 + parts[1] * 100 + parts[2])
}
pub fn relative(value: &str) -> Result<String> {
    if value.len() > 768 {
        return Err("wow_addons_archive");
    }
    let value = value.replace('\\', "/");
    let parts: Vec<_> = value.split('/').collect();
    if parts.is_empty() || parts.len() > 24 {
        return Err("wow_addons_archive");
    }
    for part in parts {
        p2p_files::component(part).map_err(|_| "wow_addons_archive")?;
    }
    Ok(value)
}
fn text(value: &serde_json::Value, name: &str, limit: usize) -> Result<String> {
    let value = value[name].as_str().ok_or("wow_addons_provider")?.trim();
    if value.is_empty() || value.len() > limit || value.chars().any(char::is_control) {
        return Err("wow_addons_provider");
    }
    Ok(value.into())
}
pub fn release(value: &serde_json::Value, id: u32) -> Result<Release> {
    if id == 0 {
        return Err("wow_addons_provider");
    }
    let rows = value
        .as_array()
        .filter(|v| v.len() == 1)
        .ok_or("wow_addons_provider")?;
    let value = &rows[0];
    if value["id"].as_u64() != Some(id as u64) || value["pendingUpdate"].as_u64().unwrap_or(1) != 0
    {
        return Err("wow_addons_provider");
    }
    let checksum = text(value, "checksum", 32)?.to_ascii_lowercase();
    if checksum.len() != 32 || !checksum.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err("wow_addons_provider");
    }
    let url = reqwest::Url::parse(&text(value, "downloadUri", 2048)?)
        .map_err(|_| "wow_addons_provider")?;
    if url.scheme() != "https"
        || url.host_str() != Some("cdn.wowinterface.com")
        || url.path() != "/downloads/getfile.php"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.fragment().is_some()
    {
        return Err("wow_addons_provider");
    }
    let ids: Vec<_> = url
        .query_pairs()
        .filter(|(k, _)| k == "id")
        .map(|(_, v)| v.parse::<u32>().ok())
        .collect();
    if ids != vec![Some(id)] {
        return Err("wow_addons_provider");
    }
    let filename = text(value, "fileName", 240)?;
    p2p_files::component(&filename).map_err(|_| "wow_addons_provider")?;
    if !filename.to_ascii_lowercase().ends_with(".zip") {
        return Err("wow_addons_provider");
    }
    Ok(Release {
        id,
        title: text(value, "title", 180)?,
        version: text(value, "version", 100)?,
        updated_at: value["lastUpdate"]
            .as_u64()
            .filter(|v| *v > 0)
            .ok_or("wow_addons_provider")?,
        checksum,
        download_url: url.into(),
    })
}
async fn get(
    client: &reqwest::Client,
    url: &str,
    limit: usize,
    cancel: &CancellationToken,
) -> Result<Vec<u8>> {
    let mut response = tokio::select! { _ = cancel.cancelled() => return Err("wow_addons_cancelled"), r = client.get(url).send() => r.map_err(|_| "wow_addons_network")? };
    if response.status().as_u16() == 429 {
        return Err("wow_addons_limited");
    }
    if !response.status().is_success() {
        return Err("wow_addons_network");
    }
    if response
        .content_length()
        .is_some_and(|size| size > limit as u64)
    {
        return Err("wow_addons_limit");
    }
    let mut bytes = Vec::new();
    loop {
        let chunk = tokio::select! { _ = cancel.cancelled() => return Err("wow_addons_cancelled"), chunk = response.chunk() => chunk.map_err(|_| "wow_addons_network")? };
        let Some(chunk) = chunk else {
            break;
        };
        if chunk.len() > limit - bytes.len() {
            return Err("wow_addons_limit");
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
pub async fn latest(id: u32, cancel: &CancellationToken) -> Result<(Release, Vec<u8>)> {
    if id == 0 {
        return Err("wow_addons_provider");
    }
    let client = reqwest::Client::builder()
        .user_agent("Harbor/WoW-addons")
        .timeout(Duration::from_secs(45))
        .connect_timeout(Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "wow_addons_network")?;
    let raw = get(
        &client,
        &format!("https://api.mmoui.com/v4/game/WOW/filedetails/{id}.json"),
        1024 * 1024,
        cancel,
    )
    .await?;
    let item = release(
        &serde_json::from_slice(&raw).map_err(|_| "wow_addons_provider")?,
        id,
    )?;
    let zip = get(&client, &item.download_url, MAX_ARCHIVE, cancel).await?;
    if format!("{:x}", md5::compute(&zip)) != item.checksum {
        return Err("wow_addons_checksum");
    }
    Ok((item, zip))
}
pub fn unpack(
    release: Release,
    bytes: &[u8],
    id: &str,
    version: &str,
    cancel: &CancellationToken,
) -> Result<Package> {
    inspect(release, bytes, id, version, true, cancel)
}
/// Bundle membership is useful for importing an older installed version. It is
/// never an installable Package: installation still requires exact compatibility.
pub fn layout(
    release: Release,
    bytes: &[u8],
    id: &str,
    version: &str,
    cancel: &CancellationToken,
) -> Result<Layout> {
    let package = inspect(release, bytes, id, version, false, cancel)?;
    Ok(Layout {
        release: package.release,
        folders: package.folders,
    })
}
fn inspect(
    release: Release,
    bytes: &[u8],
    id: &str,
    version: &str,
    exact: bool,
    cancel: &CancellationToken,
) -> Result<Package> {
    if ![
        "battlenet:wow",
        "battlenet:wow_classic",
        "battlenet:wow_classic_era",
        "battlenet:wow_classic_anniversary",
    ]
    .contains(&id)
    {
        return Err("wow_addons_edition");
    }
    if format!("{:x}", md5::compute(bytes)) != release.checksum {
        return Err("wow_addons_checksum");
    }
    let target = interface(version)?;
    let suffixes = wow_addons::suffixes(id, Some(target / 10000));
    if suffixes.is_empty() || bytes.len() > MAX_ARCHIVE {
        return Err("wow_addons_version");
    }
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|_| "wow_addons_archive")?;
    if archive.is_empty() || archive.len() > MAX_FILES {
        return Err("wow_addons_limit");
    }
    let mut files = Vec::new();
    let mut size = 0usize;
    let mut names = BTreeSet::new();
    let mut folders = BTreeMap::<String, String>::new();
    let mut tocs = BTreeMap::<String, Vec<wow_addons::Manifest>>::new();
    for index in 0..archive.len() {
        check_cancel(cancel)?;
        let mut file = archive.by_index(index).map_err(|_| "wow_addons_archive")?;
        let dir = file.is_dir();
        if file
            .unix_mode()
            .is_some_and(|mode| ![0, 0o100000, 0o040000].contains(&(mode & 0o170000)))
        {
            return Err("wow_addons_archive");
        }
        let path = relative(if dir {
            file.name().trim_end_matches('/')
        } else {
            file.name()
        })?;
        if !names.insert(path.to_ascii_lowercase()) {
            return Err("wow_addons_archive");
        }
        if dir {
            continue;
        }
        let (folder, inner) = path.split_once('/').ok_or("wow_addons_archive")?;
        if folder.to_ascii_lowercase().starts_with("blizzard_") {
            return Err("wow_addons_archive");
        }
        if let Some(previous) = folders.insert(folder.to_ascii_lowercase(), folder.into()) {
            if previous != folder {
                return Err("wow_addons_archive");
            }
        }
        if folders.len() > 64
            || file.size() > 16 * 1024 * 1024
            || file.size() > (MAX_CONTENT - size) as u64
        {
            return Err("wow_addons_limit");
        }
        let mut data = Vec::new();
        let file_size = file.size();
        file.by_ref()
            .take(file_size + 1)
            .read_to_end(&mut data)
            .map_err(|_| "wow_addons_archive")?;
        if data.len() as u64 != file_size {
            return Err("wow_addons_archive");
        }
        size += data.len();
        if !inner.contains('/') && inner.to_ascii_lowercase().ends_with(".toc") {
            if data.len() > 128 * 1024 {
                return Err("wow_addons_limit");
            }
            let raw = std::str::from_utf8(&data).map_err(|_| "wow_addons_archive")?;
            tocs.entry(folder.to_ascii_lowercase())
                .or_default()
                .push(wow_addons::manifest(inner, raw));
        }
        files.push(File {
            stamp: FileStamp {
                sha256: digest(&data),
                bytes: data.len() as u64,
                path,
            },
            data,
        });
    }
    let mut identified = false;
    let mut dependencies = BTreeSet::new();
    for (key, folder) in &folders {
        let choices = tocs.get(key).ok_or("wow_addons_manifest")?;
        let toc = wow_addons::select_manifest(folder, choices, suffixes)
            .map_err(|_| "wow_addons_manifest")?
            .ok_or("wow_addons_manifest")?;
        if exact && !toc.interfaces.contains(&target) {
            return Err("wow_addons_incompatible");
        }
        if let Some(provider) = toc.wowi_id {
            if provider != release.id {
                return Err("wow_addons_identity");
            }
            identified = true;
        }
        for dependency in toc.dependencies {
            if !dependency.to_ascii_lowercase().starts_with("blizzard_")
                && !folders.contains_key(&dependency.to_ascii_lowercase())
            {
                dependencies.insert(dependency);
            }
        }
    }
    if !identified || files.is_empty() {
        return Err("wow_addons_identity");
    }
    files.sort_by(|a, b| a.stamp.path.cmp(&b.stamp.path));
    Ok(Package {
        release,
        files,
        folders: folders.into_values().collect(),
        dependencies: dependencies.into_iter().collect(),
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    pub id: String,
    pub client_version: String,
    pub release: Release,
    pub folders: Vec<String>,
    pub files: usize,
    pub bytes: usize,
    pub dependencies: Vec<String>,
    pub archive_sha256: String,
    pub content_sha256: String,
}
// This inspects a pinned package only. Deployment will consume the same native
// package validator and add its own staged plan, ownership and recovery journal.
pub async fn review(id: String, addon_id: u32) -> Result<Review> {
    // Keep concurrent ZIP/JSON buffers bounded across all callers.
    static LIMIT: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(2);
    let _permit = LIMIT.try_acquire().map_err(|_| "wow_addons_busy")?;
    let target_id = id.clone();
    let (_, version) = tauri::async_runtime::spawn_blocking(move || wow_addons::target(&target_id))
        .await
        .map_err(|_| "wow_addons_failed")??;
    let cancel = CancellationToken::new();
    let (release, bytes) = latest(addon_id, &cancel).await?;
    tauri::async_runtime::spawn_blocking(move || {
        let sha256 = digest(&bytes);
        let package = unpack(release, &bytes, &id, &version, &cancel)?;
        let manifest = serde_json::to_vec(
            &package
                .files
                .iter()
                .map(|file| &file.stamp)
                .collect::<Vec<_>>(),
        )
        .map_err(|_| "wow_addons_archive")?;
        Ok(Review {
            id,
            client_version: version,
            release: package.release,
            folders: package.folders,
            files: package.files.len(),
            bytes: package.files.iter().map(|file| file.data.len()).sum(),
            dependencies: package.dependencies,
            archive_sha256: sha256,
            content_sha256: digest(&manifest),
        })
    })
    .await
    .map_err(|_| "wow_addons_failed")?
}

#[cfg(test)]
#[path = "wow_addon_package_tests.rs"]
mod tests;
