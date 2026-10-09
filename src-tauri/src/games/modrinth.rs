use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

pub type Result<T> = std::result::Result<T, &'static str>;
pub const API: &str = "https://api.modrinth.com/v2";
pub fn identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 100
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
pub fn environment(loader: &str, game: &str) -> Result<()> {
    if !["fabric", "forge", "neoforge", "quilt"].contains(&loader)
        || game.is_empty()
        || game.len() > 60
        || !game
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b".-_ ".contains(&b))
    {
        return Err("mods_environment");
    }
    Ok(())
}
pub fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent("Harbor-Games/0.9 (https://harbor.site)")
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "mods_network")
}
pub async fn json(client: &reqwest::Client, url: reqwest::Url) -> Result<Value> {
    let mut response = client.get(url).send().await.map_err(|_| "mods_network")?;
    if response.status().as_u16() == 429 {
        return Err("mods_rate_limit");
    }
    if !response.status().is_success() {
        return Err("mods_network");
    }
    if response.content_length().unwrap_or(0) > 4 * 1024 * 1024 {
        return Err("mods_metadata");
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "mods_network")? {
        if body.len() + chunk.len() > 4 * 1024 * 1024 {
            return Err("mods_metadata");
        }
        body.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&body).map_err(|_| "mods_metadata")
}
pub fn route(
    kind: &str,
    query: &str,
    loader: &str,
    game: &str,
    offset: u32,
    sort: &str,
) -> Result<reqwest::Url> {
    let path = match kind {
        "search" => "search".into(),
        "games" => "tag/game_version".into(),
        "project" if identifier(query) => format!("project/{query}"),
        "versions" if identifier(query) => format!("project/{query}/version"),
        "version" if identifier(query) => format!("version/{query}"),
        _ => return Err("mods_request"),
    };
    let mut url = reqwest::Url::parse(&format!("{API}/{path}")).map_err(|_| "mods_request")?;
    if kind == "search" || kind == "versions" {
        environment(loader, game)?;
        if kind == "search" {
            if query.len() > 200
                || offset > 10000
                || !["relevance", "downloads", "updated", "newest"].contains(&sort)
            {
                return Err("mods_request");
            }
            let facets = serde_json::json!([
                ["project_type:mod"],
                [format!("categories:{loader}")],
                [format!("versions:{game}")]
            ])
            .to_string();
            url.query_pairs_mut()
                .append_pair("query", query)
                .append_pair("facets", &facets)
                .append_pair("limit", "24")
                .append_pair("offset", &offset.to_string())
                .append_pair("index", sort);
        } else {
            url.query_pairs_mut()
                .append_pair("loaders", &serde_json::json!([loader]).to_string())
                .append_pair("game_versions", &serde_json::json!([game]).to_string())
                .append_pair("include_changelog", "false");
        }
    }
    Ok(url)
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Dependency {
    pub project_id: Option<String>,
    pub version_id: Option<String>,
    pub dependency_type: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Package {
    pub project: String,
    pub version: String,
    pub name: String,
    pub number: String,
    pub filename: String,
    pub url: String,
    pub bytes: u64,
    pub sha512: String,
    pub dependencies: Vec<Dependency>,
    pub enabled: bool,
}
pub fn filename(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 200
        && name.ends_with(".jar")
        && !name.starts_with('.')
        && !name
            .chars()
            .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
        && ![
            "con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7",
            "com8", "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
        ]
        .contains(
            &name
                .split('.')
                .next()
                .unwrap_or("")
                .to_ascii_lowercase()
                .as_str(),
        )
}
pub fn valid_package(p: &Package) -> bool {
    identifier(&p.project)
        && identifier(&p.version)
        && filename(&p.filename)
        && p.bytes > 0
        && p.bytes <= 128 * 1024 * 1024
        && p.sha512.len() == 128
        && p.sha512.bytes().all(|b| b.is_ascii_hexdigit())
        && p.dependencies.len() <= 64
        && p.name.len() <= 300
        && p.number.len() <= 200
        && reqwest::Url::parse(&p.url).ok().is_some_and(|u| {
            u.scheme() == "https"
                && u.host_str() == Some("cdn.modrinth.com")
                && u.username().is_empty()
                && u.password().is_none()
                && u.port().is_none()
                && u.query().is_none()
                && u.fragment().is_none()
                && u.path()
                    .starts_with(&format!("/data/{}/versions/{}/", p.project, p.version))
        })
}
pub fn package(value: Value, loader: &str, game: &str) -> Result<Package> {
    let string = |key| {
        value
            .get(key)
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string()
    };
    let includes = |key: &str, needle: &str| {
        value
            .get(key)
            .and_then(Value::as_array)
            .is_some_and(|a| a.iter().any(|v| v.as_str() == Some(needle)))
    };
    if !includes("loaders", loader) || !includes("game_versions", game) {
        return Err("mods_incompatible");
    }
    let files = value
        .get("files")
        .and_then(Value::as_array)
        .ok_or("mods_metadata")?;
    let file = files
        .iter()
        .find(|f| f["primary"].as_bool() == Some(true))
        .or_else(|| (files.len() == 1).then(|| &files[0]))
        .ok_or("mods_metadata")?;
    let dependencies: Vec<Dependency> = serde_json::from_value(
        value
            .get("dependencies")
            .cloned()
            .unwrap_or(serde_json::json!([])),
    )
    .map_err(|_| "mods_metadata")?;
    let p = Package {
        project: string("project_id"),
        version: string("id"),
        name: string("name"),
        number: string("version_number"),
        filename: file["filename"].as_str().unwrap_or("").into(),
        url: file["url"].as_str().unwrap_or("").into(),
        bytes: file["size"].as_u64().unwrap_or(0),
        sha512: file["hashes"]["sha512"]
            .as_str()
            .unwrap_or("")
            .to_ascii_lowercase(),
        dependencies,
        enabled: true,
    };
    if !valid_package(&p) {
        return Err("mods_metadata");
    }
    Ok(p)
}
pub async fn version(
    client: &reqwest::Client,
    id: &str,
    loader: &str,
    game: &str,
) -> Result<Package> {
    package(
        json(client, route("version", id, loader, game, 0, "")?).await?,
        loader,
        game,
    )
}
pub async fn latest(
    client: &reqwest::Client,
    project: &str,
    loader: &str,
    game: &str,
) -> Result<Package> {
    let value = json(client, route("versions", project, loader, game, 0, "")?).await?;
    // Dependencies use stable releases; beta/alpha versions must be explicitly selected.
    let version = value
        .as_array()
        .and_then(|a| {
            a.iter()
                .find(|v| v["version_type"].as_str() == Some("release"))
        })
        .ok_or("mods_dependency")?;
    package(version.clone(), loader, game)
}
