use super::minecraft_instances::{self as instances, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

pub const MAX_FILE: u64 = 512 * 1024 * 1024;
pub const MAX_TOTAL: u64 = 8 * 1024 * 1024 * 1024;
pub const MAX_FILES: usize = 40_000;
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct File { pub path: String, pub url: String, pub sha1: String, pub size: u64 }
#[derive(Clone, Serialize, Deserialize)]
pub struct Runtime {
    pub schema: u8, pub game: String, pub loader: String, pub loader_version: String,
    pub java: u32, pub version: String, pub main: String, pub asset_index: String,
    #[serde(default)] pub version_type: String,
    pub jvm: Vec<String>, pub args: Vec<String>, pub classpath: Vec<String>,
    pub natives: Vec<String>, pub files: Vec<File>, pub platform: String,
}
pub fn platform() -> String { format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH) }
pub fn host(url: &str) -> Result<reqwest::Url> {
    let url = reqwest::Url::parse(url).map_err(|_| "runtime_metadata")?;
    if url.scheme() != "https" || url.port().is_some() || !url.username().is_empty() || url.password().is_some() || url.query().is_some() || url.fragment().is_some()
        || !matches!(url.host_str(), Some("piston-meta.mojang.com" | "piston-data.mojang.com" | "launchermeta.mojang.com" | "launcher.mojang.com" | "libraries.minecraft.net" | "resources.download.minecraft.net" | "meta.fabricmc.net" | "maven.fabricmc.net" | "meta.quiltmc.org" | "maven.quiltmc.org" | "maven.minecraftforge.net" | "files.minecraftforge.net" | "maven.neoforged.net")) { return Err("runtime_metadata"); }
    Ok(url)
}
pub fn text<'a>(v: &'a Value, key: &str) -> Result<&'a str> { v.get(key).and_then(Value::as_str).filter(|v| !v.is_empty() && v.len() <= 2048 && !v.chars().any(char::is_control)).ok_or("runtime_metadata") }
pub fn digest(v: &str) -> bool { v.len() == 40 && v.bytes().all(|c| c.is_ascii_hexdigit()) }
pub fn file(v: &Value, path: String) -> Result<File> {
    instances::relative(&path)?;
    let sha1 = text(v, "sha1")?.to_lowercase(); let url = text(v, "url")?.to_string();
    let size = v["size"].as_u64().filter(|n| *n > 0 && *n <= MAX_FILE).ok_or("runtime_metadata")?;
    if !digest(&sha1) { return Err("runtime_metadata"); } host(&url)?;
    Ok(File { path, sha1, url, size })
}

// Mojang rules are ordered; the last matching action wins. Unknown rule kinds
// fail closed instead of accidentally enabling unsupported launch features.
pub fn allowed(value: &Value, os: &str, arch: &str, version: &str) -> Result<bool> {
    let Some(rules) = value.get("rules") else { return Ok(true); };
    let rules = rules.as_array().filter(|v| v.len() <= 32).ok_or("runtime_metadata")?;
    let mut allowed = false;
    for rule in rules {
        let object = rule.as_object().ok_or("runtime_metadata")?;
        if object.keys().any(|k| !["action", "os", "features"].contains(&k.as_str())) { return Err("runtime_rules"); }
        let action = match text(rule, "action")? { "allow" => true, "disallow" => false, _ => return Err("runtime_rules") };
        let mut matches = true;
        if let Some(spec) = rule.get("os") {
            let spec = spec.as_object().ok_or("runtime_metadata")?;
            if spec.keys().any(|k| !["name", "arch", "version"].contains(&k.as_str())) { return Err("runtime_rules"); }
            for (key, current) in [("name", os), ("arch", arch), ("version", version)] {
                if let Some(test) = spec.get(key) {
                    let test = test.as_str().filter(|v| v.len() <= 128).ok_or("runtime_rules")?;
                    if key == "name" { matches &= test == current; }
                    else { matches &= regex::Regex::new(test).map_err(|_| "runtime_rules")?.is_match(current); }
                }
            }
        }
        if let Some(features) = rule.get("features") {
            for (key, expected) in features.as_object().ok_or("runtime_metadata")? {
                if !["is_demo_user", "has_custom_resolution", "has_quick_plays_support", "is_quick_play_singleplayer", "is_quick_play_multiplayer", "is_quick_play_realms"].contains(&key.as_str()) { return Err("runtime_rules"); }
                matches &= expected.as_bool().ok_or("runtime_metadata")? == false;
            }
        }
        if matches { allowed = action; }
    }
    Ok(allowed)
}
pub fn arguments(value: &Value, os: &str, arch: &str, version: &str) -> Result<Vec<String>> {
    let mut result = Vec::new();
    for item in value.as_array().filter(|v| v.len() <= 256).ok_or("runtime_legacy")? {
        if let Some(s) = item.as_str() { result.push(s.to_string()); }
        else if allowed(item, os, arch, version)? {
            match &item["value"] { Value::String(s) => result.push(s.clone()), Value::Array(values) => for value in values { result.push(value.as_str().ok_or("runtime_metadata")?.to_string()); }, _ => return Err("runtime_metadata") }
        }
    }
    if result.len() > 512 || result.iter().any(|v| v.len() > 4096 || v.chars().any(char::is_control)) { return Err("runtime_metadata"); }
    Ok(result)
}
pub fn base(value: &Value, instance: &instances::Instance, os: &str, arch: &str, os_version: &str) -> Result<Runtime> {
    if text(value, "id")? != instance.game_version { return Err("runtime_metadata"); }
    let java = value["javaVersion"]["majorVersion"].as_u64().unwrap_or(8);
    if !(8..=40).contains(&java) { return Err("runtime_metadata"); }
    let main = text(value, "mainClass")?.to_string();
    if !main.starts_with("net.minecraft.") { return Err("runtime_metadata"); }
    let asset_index = text(&value["assetIndex"], "id")?.to_string(); instances::relative(&asset_index)?;
    if asset_index.contains('/') { return Err("runtime_metadata"); }
    let client = file(&value["downloads"]["client"], "client.jar".into())?;
    let mut result = Runtime { schema: 1, game: instance.game_version.clone(), loader: instance.loader.clone(), loader_version: instance.loader_version.clone(), java: java as u32,
        version: instance.game_version.clone(), version_type: text(value, "type")?.into(), main, asset_index: asset_index.clone(), jvm: arguments(&value["arguments"]["jvm"], os, arch, os_version)?, args: arguments(&value["arguments"]["game"], os, arch, os_version)?,
        classpath: Vec::new(), natives: Vec::new(), files: vec![client, file(&value["assetIndex"], format!("assets/indexes/{asset_index}.json"))?], platform: platform() };
    for lib in value["libraries"].as_array().filter(|v| v.len() <= 1024).ok_or("runtime_metadata")? {
        if !allowed(lib, os, arch, os_version)? { continue; }
        if !lib["downloads"]["artifact"].is_null() {
            let artifact = &lib["downloads"]["artifact"];
            let entry = file(artifact, format!("libraries/{}", text(artifact, "path")?))?;
            result.classpath.push(entry.path.clone()); result.files.push(entry);
        }
        if let Some(classifier) = lib["natives"][os].as_str() {
            if arch == "aarch64" && !classifier.contains("arm64") && !classifier.contains("aarch64") { return Err("runtime_platform"); }
            let classifier = classifier.replace("${arch}", if arch == "x86" { "32" } else { "64" });
            let artifact = &lib["downloads"]["classifiers"][&classifier];
            let entry = file(artifact, format!("libraries/{}", text(artifact, "path")?))?;
            result.natives.push(entry.path.clone()); result.files.push(entry);
        }
    }
    result.classpath.push("client.jar".into());
    if let Some(logging) = value.get("logging").and_then(|v| v.get("client")) {
        let entry = file(&logging["file"], format!("logging/{}", text(&logging["file"], "id")?))?;
        result.jvm.push(text(logging, "argument")?.replace("${path}", &format!("${{runtime_root}}/{}", entry.path))); result.files.push(entry);
    }
    validate(&mut result)?; Ok(result)
}
pub fn maven(name: &str) -> Result<String> {
    let parts: Vec<_> = name.split(':').collect();
    if parts.len() < 3 || parts.len() > 4 || parts.iter().any(|v| v.is_empty() || v.len() > 200 || !v.bytes().all(|c| c.is_ascii_alphanumeric() || b".-_+".contains(&c))) { return Err("runtime_metadata"); }
    let classifier = if parts.len() == 4 { format!("-{}", parts[3]) } else { String::new() };
    let path = format!("{}/{}/{}/{}-{}{classifier}.jar", parts[0].replace('.', "/"), parts[1], parts[2], parts[1], parts[2]); instances::relative(&path)?; Ok(path)
}
pub fn loader_profile(runtime: &mut Runtime, value: &Value) -> Result<()> {
    let (main, group, artifact) = match runtime.loader.as_str() {
        "fabric" => ("net.fabricmc.loader.impl.launch.knot.KnotClient", "net.fabricmc", "fabric-loader"),
        "quilt" => ("org.quiltmc.loader.impl.launch.knot.KnotClient", "org.quiltmc", "quilt-loader"),
        _ => return Err("runtime_loader"),
    };
    let identity = format!("{}-{}-{}", artifact, runtime.loader_version, runtime.game);
    let coordinate = format!("{group}:{artifact}:{}", runtime.loader_version);
    let libraries = value["libraries"].as_array().filter(|v| v.len() <= 128).ok_or("runtime_metadata")?;
    if text(value,"inheritsFrom")? != runtime.game || text(value,"mainClass")? != main || text(value,"id")? != identity
        || libraries.iter().filter(|v| v["name"].as_str() == Some(&coordinate)).count() != 1 { return Err("runtime_metadata"); }
    runtime.version = identity; runtime.main = main.into(); Ok(())
}
pub fn loader_library(loader: &str, value: &Value) -> Result<(String, String)> {
    let relative = maven(text(value,"name")?)?; let base = host(text(value,"url")?)?;
    let allowed = (base.host_str() == Some("maven.fabricmc.net") && base.path() == "/")
        || (loader == "quilt" && base.host_str() == Some("maven.quiltmc.org") && base.path() == "/repository/release/");
    if !allowed { return Err("runtime_metadata"); }
    Ok((format!("libraries/{relative}"), base.join(&relative).map_err(|_| "runtime_metadata")?.to_string()))
}
pub fn assets(runtime: &mut Runtime, index: &Value) -> Result<()> {
    if index["virtual"].as_bool().unwrap_or(false) || index["map_to_resources"].as_bool().unwrap_or(false) { return Err("runtime_legacy"); }
    let objects = index["objects"].as_object().filter(|v| v.len() <= MAX_FILES).ok_or("runtime_metadata")?;
    for object in objects.values() {
        let hash = text(object, "hash")?.to_lowercase(); if !digest(&hash) { return Err("runtime_metadata"); }
        let size = object["size"].as_u64().filter(|v| *v > 0 && *v <= MAX_FILE).ok_or("runtime_metadata")?;
        runtime.files.push(File { path: format!("assets/objects/{}/{}", &hash[..2], hash), url: format!("https://resources.download.minecraft.net/{}/{}", &hash[..2], hash), sha1: hash, size });
    }
    validate(runtime)
}
pub fn validate(runtime: &mut Runtime) -> Result<()> {
    let mut paths = HashMap::<String, (String, u64)>::new(); let mut total = 0_u64;
    for file in &runtime.files {
        instances::relative(&file.path)?; host(&file.url)?;
        if !digest(&file.sha1) || file.size == 0 || file.size > MAX_FILE { return Err("runtime_metadata"); }
        let key = file.path.to_ascii_lowercase();
        if let Some(held) = paths.get(&key) { if held != &(file.sha1.clone(), file.size) { return Err("runtime_metadata"); } }
        else { paths.insert(key, (file.sha1.clone(), file.size)); total = total.checked_add(file.size).ok_or("runtime_limit")?; }
    }
    if paths.len() > MAX_FILES || total > MAX_TOTAL { return Err("runtime_limit"); }
    for path in paths.keys() { let mut parts = path.rsplitn(2, '/'); parts.next(); let mut parent = parts.next(); while let Some(p) = parent { if paths.contains_key(p) { return Err("runtime_metadata"); } parent = p.rsplit_once('/').map(|v| v.0); } }
    let mut seen = HashSet::new(); runtime.files.retain(|f| seen.insert(f.path.to_ascii_lowercase()));
    if runtime.classpath.iter().chain(&runtime.natives).any(|p| !paths.contains_key(&p.to_ascii_lowercase())) { return Err("runtime_metadata"); }
    Ok(())
}
