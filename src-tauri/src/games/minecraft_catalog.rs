use super::modrinth;
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(default)]
pub struct Request { pub kind: String, pub r#type: String, pub query: String, pub loader: String, pub game: String, pub category: String, pub offset: u32, pub sort: String }
impl Default for Request { fn default() -> Self { Self { kind:"search".into(), r#type:"modpack".into(), query:String::new(), loader:String::new(), game:String::new(), category:String::new(), offset:0, sort:"downloads".into() } } }
pub fn route(args: &Request) -> modrinth::Result<reqwest::Url> {
    if !["mod", "modpack", "resourcepack", "shader"].contains(&args.r#type.as_str()) || args.query.len() > 200 || args.offset > 10000 || !["relevance", "downloads", "updated", "newest"].contains(&args.sort.as_str()) || !args.loader.is_empty() && !["fabric", "forge", "neoforge", "quilt", "iris", "optifine", "canvas", "minecraft"].contains(&args.loader.as_str()) || args.game.len() > 60 || !args.game.bytes().all(|c| c.is_ascii_alphanumeric() || b"._ -".contains(&c)) || args.category.len() > 60 || !args.category.bytes().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-') { return Err("mods_request"); }
    let path = match args.kind.as_str() { "search" => "search".into(), "games" => "tag/game_version".into(), "categories" => "tag/category".into(), "project" if modrinth::identifier(&args.query) => format!("project/{}",args.query), "versions" if modrinth::identifier(&args.query) => format!("project/{}/version",args.query), "version" if modrinth::identifier(&args.query) => format!("version/{}",args.query), _ => return Err("mods_request") };
    let mut url = reqwest::Url::parse(&format!("{}/{path}",modrinth::API)).map_err(|_|"mods_request")?;
    if args.kind == "search" {
        let mut facets = vec![vec![format!("project_type:{}",args.r#type)]];
        if !args.loader.is_empty() { facets.push(vec![format!("categories:{}",args.loader)]); } if !args.game.is_empty() { facets.push(vec![format!("versions:{}",args.game)]); } if !args.category.is_empty() { facets.push(vec![format!("categories:{}",args.category)]); }
        url.query_pairs_mut().append_pair("query",&args.query).append_pair("facets",&serde_json::json!(facets).to_string()).append_pair("index",&args.sort).append_pair("offset",&args.offset.to_string()).append_pair("limit","24");
    }
    if args.kind == "versions" { if !args.loader.is_empty() { url.query_pairs_mut().append_pair("loaders",&serde_json::json!([args.loader]).to_string()); } if !args.game.is_empty() { url.query_pairs_mut().append_pair("game_versions",&serde_json::json!([args.game]).to_string()); } url.query_pairs_mut().append_pair("include_changelog","false"); }
    Ok(url)
}
pub async fn request(args: Request) -> modrinth::Result<serde_json::Value> { modrinth::json(&modrinth::client()?,route(&args)?).await }

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn catalog_filters_are_optional_and_cannot_change_the_provider() {
        let mut args = Request::default(); let url=route(&args).unwrap(); assert_eq!(url.host_str(),Some("api.modrinth.com")); assert!(!url.query().unwrap().contains("versions"));
        args.r#type="shader".into();args.loader="iris".into();args.game="1.21.1".into();args.offset=24;
        let pairs:std::collections::HashMap<_,_>=route(&args).unwrap().query_pairs().into_owned().collect();assert_eq!(pairs["facets"],r#"[["project_type:shader"],["categories:iris"],["versions:1.21.1"]]"#);assert_eq!(pairs["offset"],"24");
        args.kind="project".into();args.query="../version/secret".into();assert!(route(&args).is_err());args.query="sodium".into();args.loader="bad\"loader".into();assert!(route(&args).is_err());
    }
    #[test] fn release_notes_use_one_exact_version_without_bulk_changelogs() {
        let mut args = Request { kind: "version".into(), query: "A1b2C3d4".into(), ..Request::default() };
        assert_eq!(route(&args).unwrap().as_str(), "https://api.modrinth.com/v2/version/A1b2C3d4");
        for value in ["../project/private", "https://example.com", "A1b2?token=bad", ""] { args.query=value.into();assert!(route(&args).is_err()); }
        args.kind="versions".into();args.query="project123".into();
        assert!(route(&args).unwrap().query_pairs().any(|(key,value)|key=="include_changelog" && value=="false"));
    }
}
