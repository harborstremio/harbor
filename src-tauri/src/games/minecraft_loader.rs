use super::{minecraft_instances as instances, minecraft_instances::Result, minecraft_pack, minecraft_runtime as runtime};
use serde::Serialize;
use serde_json::Value;
use std::{collections::HashSet, sync::atomic::AtomicBool, time::Duration};

#[derive(Clone, Serialize)]
pub struct Release { pub version: String, pub stable: bool }

pub fn route_for(kind: &str, game: &str, loader: Option<&str>) -> Result<reqwest::Url> {
    if !instances::version(game) || loader.is_some_and(|v| !instances::version(v)) { return Err("instance_request"); }
    let base = match kind { "fabric" => "https://meta.fabricmc.net/v2/versions/loader/", "quilt" => "https://meta.quiltmc.org/v3/versions/loader/", _ => return Err("instance_request") };
    let mut url = reqwest::Url::parse(base).map_err(|_| "instance_request")?;
    { let mut path = url.path_segments_mut().map_err(|_| "instance_request")?; path.pop_if_empty().push(game); if let Some(loader) = loader { path.push(loader); } }
    Ok(url)
}

#[cfg(test)]
fn route(game: &str, loader: Option<&str>) -> Result<reqwest::Url> { route_for("fabric", game, loader) }

async fn metadata(kind: &str, game: &str, loader: Option<&str>, cancel: &AtomicBool) -> Result<Value> {
    let client = reqwest::Client::builder().user_agent("Harbor-Games/0.9 (https://harbor.site)").redirect(reqwest::redirect::Policy::none()).connect_timeout(Duration::from_secs(10)).timeout(Duration::from_secs(25)).build().map_err(|_| "instance_network")?;
    let mut response = runtime::cancellable(cancel, client.get(route_for(kind, game, loader)?).send()).await?.map_err(|_| "instance_network")?;
    // Fabric uses 400 (including an empty array) for unsupported game/loader pairs.
    if matches!(response.status().as_u16(), 400 | 404) { return if loader.is_none() { Ok(Value::Array(vec![])) } else { Err("instance_loader_version") }; }
    if !response.status().is_success() { return Err(if response.status().as_u16() == 429 { "instance_rate_limit" } else { "instance_network" }); }
    if response.content_length().is_some_and(|v| v > 4 * 1024 * 1024) { return Err("instance_limit"); }
    let mut bytes = Vec::new();
    while let Some(chunk) = runtime::cancellable(cancel, response.chunk()).await?.map_err(|_| "instance_network")? { if bytes.len() + chunk.len() > 4 * 1024 * 1024 { return Err("instance_limit"); } bytes.extend_from_slice(&chunk); }
    serde_json::from_slice(&bytes).map_err(|_| "instance_loader_version")
}

fn release(value: &Value, game: &str) -> Result<Release> {
    let version = value["loader"]["version"].as_str().filter(|v| instances::version(v)).ok_or("instance_loader_version")?;
    if value["intermediary"]["version"].as_str() != Some(game) || value["loader"]["maven"].as_str() != Some(format!("net.fabricmc:fabric-loader:{version}").as_str()) { return Err("instance_loader_version"); }
    Ok(Release { version: version.into(), stable: value["loader"]["stable"].as_bool().ok_or("instance_loader_version")? })
}

pub async fn versions(game: String) -> Result<Vec<Release>> {
    versions_for("fabric".into(), game).await
}

// Quilt's current endpoint is not ordered and has no stable flag. Keep the
// published semantic version identity and prefer a final release in the UI.
fn quilt_version(value: &str) -> Result<([u32; 3], Option<&str>)> {
    let core = value.split('+').next().ok_or("instance_loader_version")?;
    let (core, pre) = core.split_once('-').map_or((core, None), |(a,b)| (a,Some(b)));
    let parts = core.split('.').map(str::parse::<u32>).collect::<std::result::Result<Vec<_>,_>>().map_err(|_| "instance_loader_version")?;
    if parts.len() != 3 || pre.is_some_and(|p| p.is_empty() || p.split('.').any(str::is_empty)) { return Err("instance_loader_version"); }
    Ok(([parts[0],parts[1],parts[2]],pre))
}
fn quilt_release(value: &Value, game: &str) -> Result<Release> {
    let version = value["loader"]["version"].as_str().filter(|v| instances::version(v)).ok_or("instance_loader_version")?;
    if value["hashed"]["version"].as_str() != Some(game) || value["hashed"]["maven"].as_str() != Some(format!("org.quiltmc:hashed:{game}").as_str())
        || value["loader"]["maven"].as_str() != Some(format!("org.quiltmc:quilt-loader:{version}").as_str()) { return Err("instance_loader_version"); }
    Ok(Release { version: version.into(), stable: quilt_version(version)?.1.is_none() })
}
fn quilt_order(a: &Release, b: &Release) -> std::cmp::Ordering {
    let (ac,ap) = quilt_version(&a.version).expect("validated version"); let (bc,bp) = quilt_version(&b.version).expect("validated version");
    ac.cmp(&bc).then_with(|| a.stable.cmp(&b.stable)).then_with(|| {
        let mut a = ap.unwrap_or("").split('.'); let mut b = bp.unwrap_or("").split('.');
        loop { match (a.next(),b.next()) {
            (Some(a),Some(b)) => { let order = match (a.parse::<u32>(),b.parse::<u32>()) { (Ok(a),Ok(b)) => a.cmp(&b), (Ok(_),Err(_)) => std::cmp::Ordering::Less, (Err(_),Ok(_)) => std::cmp::Ordering::Greater, _ => a.cmp(b) }; if !order.is_eq() { return order; } },
            (a,b) => return a.is_some().cmp(&b.is_some()),
        } }
    })
}
pub async fn versions_for(kind: String, game: String) -> Result<Vec<Release>> {
    if matches!(kind.as_str(), "forge" | "neoforge") { return super::minecraft_forge::versions(&kind, &game, &AtomicBool::new(false)).await; }
    let value = metadata(&kind, &game, None, &AtomicBool::new(false)).await?;
    let values = value.as_array().filter(|v| v.len() <= 1024).ok_or("instance_loader_version")?;
    let mut seen = HashSet::new(); let mut result = Vec::new();
    for value in values { let item = if kind == "quilt" { quilt_release(value, &game)? } else { release(value, &game)? }; if seen.insert(item.version.clone()) { result.push(item); } }
    if kind == "quilt" { result.sort_by(|a,b| quilt_order(b,a)); }
    Ok(result)
}

pub async fn create(profile: String, path: String, name: String, game: String, loader: String, loader_version: String, operation: String) -> Result<instances::Instance> {
    if !instances::name(&name) || !instances::version(&game) || !matches!(loader.as_str(), "vanilla" | "fabric" | "quilt" | "forge" | "neoforge") || (loader == "vanilla" && !loader_version.is_empty()) { return Err("instance_request"); }
    let work = runtime::start(&profile, &operation)?; let cancel = work.cancellation();
    if matches!(loader.as_str(), "forge" | "neoforge") {
        // The selected installer must actually describe this game and a client
        // format Harbor can prepare, before any instance directory is created.
        super::minecraft_forge::prepare(&loader, &game, &loader_version, &cancel).await?;
    } else if loader != "vanilla" {
        let value = metadata(&loader, &game, Some(&loader_version), &cancel).await?;
        let selected = if loader == "quilt" { quilt_release(&value,&game)? } else { release(&value, &game)? };
        if selected.version != loader_version { return Err("instance_loader_version"); }
    }
    tokio::task::spawn_blocking(move || {
        // Retain the shared preparation lock through the actual atomic write,
        // even if the caller drops its waiting future.
        let _work = work; minecraft_pack::canceled(&cancel)?;
        instances::create_configured(&profile, &path, &name, &game, &loader, &loader_version, &cancel)
    }).await.map_err(|_| "instance_write")?
}

#[cfg(test)]
#[path = "minecraft_loader_tests.rs"]
mod tests;
