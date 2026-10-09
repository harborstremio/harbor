use super::minecraft_instances::{self as instances, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};

pub const MAX_ARCHIVE: u64 = 256 * 1024 * 1024;
pub const MAX_UNPACKED: u64 = 2 * 1024 * 1024 * 1024;
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Java { pub path: String, pub major: u32, pub version: String, pub vendor: String, pub arch: String, pub managed: bool }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config { pub java: Java, pub memory_mib: u32 }
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Package { pub major: u32, pub version: String, pub name: String, pub bytes: u64, pub sha256: String, pub url: String, pub os: String, pub arch: String }
pub fn platform() -> Result<(&'static str, &'static str)> {
    let os = match std::env::consts::OS { "windows" => "windows", "linux" => "linux", "macos" => "mac", _ => return Err("runtime_platform") };
    let arch = match std::env::consts::ARCH { "x86_64" => "x64", "aarch64" => "aarch64", _ => return Err("runtime_platform") }; Ok((os, arch))
}
pub fn major(value: &str) -> Option<u32> {
    let value = value.strip_prefix("1.").unwrap_or(value); let number: u32 = value.split(['.', '_', '-', '+']).next()?.parse().ok()?;
    (8..=40).contains(&number).then_some(number)
}
pub fn parse_probe(path: &Path, output: &str, managed: bool) -> Result<Java> {
    let get = |key: &str| -> Result<String> { let prefix = format!("{key} = "); let value = output.lines().find_map(|line| line.trim().strip_prefix(&prefix)).filter(|v| !v.is_empty() && v.len() <= 200 && !v.chars().any(char::is_control)).ok_or("java_invalid")?; Ok(value.into()) };
    let version = get("java.version")?; let java_major = major(&version).ok_or("java_invalid")?; let arch = get("os.arch")?;
    if !matches!(arch.as_str(), "amd64" | "x86_64" | "aarch64" | "arm64" | "x86") { return Err("java_invalid"); }
    Ok(Java { path: path.to_string_lossy().into_owned(), major: java_major, version, vendor: get("java.vendor")?, arch, managed })
}
pub fn compatible(java: &Java, required: u32) -> Result<()> {
    if java.major != required { return Err("java_version"); }
    let (_, arch) = platform()?;
    if (arch == "x64" && !matches!(java.arch.as_str(), "amd64" | "x86_64")) || (arch == "aarch64" && !matches!(java.arch.as_str(), "aarch64" | "arm64")) { return Err("java_arch"); } Ok(())
}
pub fn memory(value: u32) -> Result<u32> { if !(1024..=32768).contains(&value) || value % 256 != 0 { return Err("java_memory"); } Ok(value) }
pub fn executable(value: &str) -> Result<PathBuf> {
    // Canonical Windows disk paths use this prefix. UNC shares remain excluded.
    #[cfg(windows)]
    let value = value.strip_prefix("\\\\?\\").filter(|v| v.as_bytes().get(1) == Some(&b':')).unwrap_or(value);
    let input = Path::new(value);
    if value.len() > 4096 || value.chars().any(char::is_control) || !input.is_absolute() || value.starts_with("\\\\") || value.starts_with("//") { return Err("java_path"); }
    let path = input.canonicalize().map_err(|_| "java_path")?;
    #[cfg(windows)]
    if path.to_string_lossy().starts_with("\\\\?\\UNC\\") { return Err("java_path"); }
    let name = path.file_name().and_then(|v| v.to_str()).unwrap_or("").to_lowercase();
    if !matches!(name.as_str(), "java" | "java.exe") || !path.is_file() { return Err("java_path"); } Ok(path)
}
pub fn download_url(value: &str, redirects: bool) -> Result<reqwest::Url> {
    let url = reqwest::Url::parse(value).map_err(|_| "java_metadata")?;
    if url.scheme() != "https" || url.port().is_some() || !url.username().is_empty() || url.password().is_some() || url.fragment().is_some() { return Err("java_metadata"); }
    match url.host_str() {
        Some("api.adoptium.net") if url.path().starts_with("/v3/assets/latest/") => (),
        Some("github.com") if url.path().starts_with("/adoptium/temurin") && url.path().contains("-binaries/releases/download/") && url.query().is_none() => (),
        Some("release-assets.githubusercontent.com" | "objects.githubusercontent.com") if redirects => (),
        _ => return Err("java_metadata"),
    } Ok(url)
}
pub fn package(value: &Value, requested: u32, os: &str, arch: &str) -> Result<Package> {
    if !(8..=40).contains(&requested) { return Err("java_metadata"); }
    let rows = value.as_array().filter(|v| v.len() <= 100).ok_or("java_metadata")?;
    let record = rows.iter().find(|v| v["version"]["major"].as_u64() == Some(requested as u64) && v["binary"]["os"] == os && v["binary"]["architecture"] == arch && v["binary"]["image_type"] == "jre" && v["binary"]["jvm_impl"] == "hotspot" && v["vendor"] == "eclipse").ok_or("java_unavailable")?;
    let package = &record["binary"]["package"];
    let string = |v: &Value, key: &str| v[key].as_str().filter(|s| !s.is_empty() && s.len() <= 2048 && !s.chars().any(char::is_control)).map(str::to_string).ok_or("java_metadata");
    let name = string(package, "name")?; instances::relative(&name)?;
    if name.contains('/') || !(name.ends_with(if os == "windows" { ".zip" } else { ".tar.gz" })) { return Err("java_metadata"); }
    let bytes = package["size"].as_u64().filter(|v| *v > 0 && *v <= MAX_ARCHIVE).ok_or("java_metadata")?;
    let sha256 = string(package, "checksum")?.to_lowercase(); if sha256.len() != 64 || !sha256.bytes().all(|v| v.is_ascii_hexdigit()) { return Err("java_metadata"); }
    let url = string(package, "link")?; let parsed = download_url(&url, false)?;
    if parsed.host_str() != Some("github.com") || !parsed.path().starts_with(&format!("/adoptium/temurin{requested}-binaries/releases/download/")) { return Err("java_metadata"); }
    Ok(Package { major: requested, version: string(&record["version"], "openjdk_version")?, name, bytes, sha256, url, os: os.into(), arch: arch.into() })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn minecraft_java_version_probe_keeps_only_required_properties() {
        let text = "java.version = 17.0.20\njava.vendor = Microsoft\nos.arch = amd64\nuser.name = ignored\n";
        let value = parse_probe(Path::new("java"), text, false).unwrap(); assert_eq!(value.major,17); assert_eq!(value.vendor,"Microsoft");
        assert_eq!(major("1.8.0_504"),Some(8)); assert_eq!(major("25-ea"),Some(25)); assert_eq!(major("version"),None);
        assert!(parse_probe(Path::new("java"),"java.version = 17",false).is_err()); assert!(memory(100).is_err()); assert!(memory(4096).is_ok()); assert!(memory(65536).is_err());
    }
    #[test] fn minecraft_java_provider_identity_is_exact() {
        if let Some(root) = std::env::var_os("HARBOR_MINECRAFT_JAVA_FIXTURE") { let value:Value=serde_json::from_slice(&std::fs::read(PathBuf::from(root).join("25.json")).unwrap()).unwrap(); let pack=package(&value,25,"windows","x64").unwrap(); assert_eq!(pack.major,25); assert!(pack.name.ends_with(".zip")); assert!(package(&value,21,"windows","x64").is_err()); }
        for bad in ["https://evil.test/runtime.zip","https://github.com/else/temurin25-binaries/releases/download/v/a.zip","http://github.com/adoptium/temurin25-binaries/releases/download/v/a.zip","https://github.com@evil.test/adoptium/temurin25-binaries/releases/download/v/a.zip"] { assert!(download_url(bad,false).is_err()); }
    }
}
