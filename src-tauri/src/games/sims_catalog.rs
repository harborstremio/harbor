//! Public creator releases are resolved again natively before a reviewed import.
use super::{
    sims_files as files, sims_package as package, sims_reviews as reviews, sims_store as store,
};
use package::Result;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{
    sync::OnceLock,
    time::{Duration, Instant},
};

pub const PAGE: &str = "https://deaderpool-mccc.com/downloads.html";
const MAX_DOWNLOAD: usize = 32 * 1024 * 1024;
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Release {
    pub version: String,
    pub game_patch: String,
    pub changelog: String,
    #[serde(skip)]
    pub download: String,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub releases: Vec<Release>,
    pub observed_at: u64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub version: String,
    pub target: Option<String>,
}
fn has_core<'a>(names: impl Iterator<Item = &'a str>) -> bool {
    let names = names.map(str::to_ascii_lowercase).collect::<Vec<_>>();
    ["mc_cmd_center.package", "mc_cmd_center.ts4script"]
        .iter()
        .all(|name| names.iter().any(|n| n == name))
}
pub(super) fn action(
    state: &store::State,
    folder: &files::Folder,
    target: Option<&str>,
) -> Result<store::Action> {
    if folder.partial {
        return Err("sims_adopt_scan");
    }
    if let Some(target) = target {
        let group = state
            .groups
            .iter()
            .find(|g| g.id == target)
            .ok_or("sims_creator_target")?;
        if group.source.as_ref().is_some_and(|s| s.provider != "mccc")
            || (group.source.is_none() && !has_core(group.files.iter().map(|f| f.name.as_str())))
        {
            return Err("sims_creator_target");
        }
        return Ok(store::Action::Update {
            id: group.id.clone(),
        });
    }
    // Filename hints only prevent a second installation; they never confer source identity.
    if state.groups.iter().any(|g| {
        g.source.as_ref().is_some_and(|s| s.provider == "mccc")
            || g.files.iter().any(|f| core_hint(&f.name))
    }) || folder
        .files
        .iter()
        .any(|f| core_hint(f.path.rsplit('/').next().unwrap_or("")))
    {
        return Err("sims_creator_existing");
    }
    Ok(store::Action::Install {
        title: "MC Command Center".into(),
    })
}
fn core_hint(name: &str) -> bool {
    name.eq_ignore_ascii_case("mc_cmd_center.package")
        || name.eq_ignore_ascii_case("mc_cmd_center.ts4script")
}
pub(super) fn validate_link(plan: &store::Plan) -> Result<()> {
    let store::Action::Update { id } = &plan.action else {
        return Ok(());
    };
    let group = plan
        .before
        .groups
        .iter()
        .find(|g| &g.id == id)
        .ok_or("sims_creator_target")?;
    if let Some(source) = &group.source {
        return if source.provider == "mccc" {
            Ok(())
        } else {
            Err("sims_creator_target")
        };
    }
    if !has_core(plan.existing.iter().map(|f| f.name.as_str()))
        || plan
            .existing
            .iter()
            .filter(|f| matches!(package::kind(&f.name), "package" | "script"))
            .any(|old| {
                !plan
                    .payload
                    .iter()
                    .any(|new| new.name.eq_ignore_ascii_case(&old.name))
            })
    {
        return Err("sims_creator_target");
    }
    Ok(())
}
fn expression(value: &str) -> Regex {
    Regex::new(value).expect("static creator expression")
}
fn plain(value: &str) -> String {
    let text = expression(r"(?s)<[^>]*>")
        .replace_all(value, " ")
        .replace("&nbsp;", " ");
    quick_xml::escape::unescape(&text)
        .unwrap_or(std::borrow::Cow::Borrowed(&text))
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
fn version(value: &str, count: usize) -> Option<Vec<u32>> {
    let parts = value
        .split('.')
        .map(|p| {
            if !p.is_empty() && p.len() <= 6 && p.bytes().all(|b| b.is_ascii_digit()) {
                p.parse().ok()
            } else {
                None
            }
        })
        .collect::<Option<Vec<u32>>>()?;
    (parts.len() == count).then_some(parts)
}
pub fn older_game(game: &str, patch: &str) -> Result<bool> {
    Ok(version(game, 4).ok_or("sims_folder")? < version(patch, 4).ok_or("sims_creator_format")?)
}
fn download_id(value: &str) -> Option<String> {
    let url = reqwest::Url::parse(value).ok()?;
    if url.scheme() != "https"
        || url.host_str() != Some("drive.google.com")
        || url.path() != "/uc"
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return None;
    }
    let pairs = url.query_pairs().collect::<Vec<_>>();
    if pairs.len() != 2
        || pairs
            .iter()
            .filter(|(k, v)| k == "export" && v == "download")
            .count()
            != 1
    {
        return None;
    }
    let id = pairs.iter().find(|(k, _)| k == "id")?.1.to_string();
    (id.len() >= 16
        && id.len() <= 120
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-'))
    .then_some(id)
}
pub fn parse(html: &str) -> Result<Catalog> {
    if html.len() > 256 * 1024 {
        return Err("sims_limit");
    }
    let rows = expression(r"(?is)<tr\b[^>]*>(.*?)</tr>");
    let links = expression(r#"(?is)<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>(.*?)</a>"#);
    let title = expression(r"^MC Command Center (20\d{2}\.\d{1,2}\.\d{1,2})$");
    let patch = expression(r"\bPC:\s*(1\.\d{1,6}\.\d{1,6}\.\d{1,6})\b");
    let mut releases = Vec::new();
    for row in rows.captures_iter(html).take(40) {
        let Some(game) = patch.captures(&plain(&row[1])).map(|v| v[1].to_string()) else {
            continue;
        };
        for link in links.captures_iter(&row[1]) {
            let name = plain(&link[2]);
            let Some(release) = title.captures(&name).map(|v| v[1].to_string()) else {
                continue;
            };
            // HTML permits raw query ampersands; decode only the URL separator entity.
            let href = link[1].replace("&amp;", "&");
            let id = download_id(&href).ok_or("sims_creator_format")?;
            if releases.iter().any(|v: &Release| v.version == release) {
                return Err("sims_creator_format");
            }
            let log = links
                .captures_iter(&row[1])
                .find_map(|a| {
                    let url = reqwest::Url::parse(&a[1]).ok()?;
                    (url.scheme() == "https"
                        && url.host_str() == Some("deaderpool-mccc.com")
                        && url.path()
                            == format!("/changelogs/mccc{}.html", release.replace('.', "_"))
                        && url.query().is_none()
                        && url.fragment().is_none()
                        && url.port().is_none()
                        && url.username().is_empty()
                        && url.password().is_none())
                    .then(|| url.to_string())
                })
                .unwrap_or_else(|| PAGE.into());
            releases.push(Release {
                version: release,
                game_patch: game.clone(),
                changelog: log,
                download: format!("https://drive.google.com/uc?export=download&id={id}"),
            });
        }
    }
    if releases.is_empty() || releases.len() > 12 {
        return Err("sims_creator_format");
    }
    releases.sort_by(|a, b| version(&b.version, 3).cmp(&version(&a.version, 3)));
    Ok(Catalog {
        releases,
        observed_at: files::now(),
    })
}
fn client(download: Option<&str>) -> Result<reqwest::Client> {
    let id = download
        .map(|v| download_id(v).ok_or("sims_creator_format"))
        .transpose()?;
    reqwest::Client::builder()
        .user_agent("Harbor-Games/0.9 (https://harbor.site)")
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::custom(move |attempt| {
            let u = attempt.url();
            let valid = id.as_ref().is_some_and(|id| {
                u.scheme() == "https"
                    && u.host_str() == Some("drive.usercontent.google.com")
                    && u.path() == "/download"
                    && u.port().is_none()
                    && u.username().is_empty()
                    && u.password().is_none()
                    && u.fragment().is_none()
                    && u.query_pairs()
                        .filter(|(k, v)| k == "id" && v == id)
                        .count()
                        == 1
            });
            if attempt.previous().len() < 3 && valid {
                attempt.follow()
            } else {
                attempt.error("unsupported creator redirect")
            }
        }))
        .build()
        .map_err(|_| "sims_creator_network")
}
pub(super) async fn cancelable<T>(
    check: &dyn Fn() -> Result<()>,
    future: impl std::future::Future<Output = T>,
) -> Result<T> {
    tokio::pin!(future);
    loop {
        check()?;
        tokio::select! { value=&mut future => {check()?; return Ok(value)}, _=tokio::time::sleep(Duration::from_millis(100))=>{} }
    }
}
pub(super) async fn body(
    client: &reqwest::Client,
    url: &str,
    max: usize,
    check: &dyn Fn() -> Result<()>,
    progress: impl FnMut(u64, u64) -> Result<()>,
) -> Result<Vec<u8>> {
    let response = cancelable(check, client.get(url).send())
        .await?
        .map_err(|_| "sims_creator_network")?;
    response_body(response, max, check, progress).await
}
pub(super) async fn response_body(
    mut response: reqwest::Response,
    max: usize,
    check: &dyn Fn() -> Result<()>,
    mut progress: impl FnMut(u64, u64) -> Result<()>,
) -> Result<Vec<u8>> {
    if !response.status().is_success() {
        return Err("sims_creator_network");
    }
    let total = response.content_length().unwrap_or(0);
    if total > max as u64 {
        return Err("sims_limit");
    }
    let mut bytes = Vec::new();
    progress(0, total)?;
    while let Some(chunk) = cancelable(check, response.chunk())
        .await?
        .map_err(|_| "sims_creator_network")?
    {
        if bytes.len().saturating_add(chunk.len()) > max {
            return Err("sims_limit");
        }
        bytes.extend_from_slice(&chunk);
        progress(bytes.len() as u64, total)?;
    }
    if total != 0 && bytes.len() as u64 != total {
        return Err("sims_creator_network");
    }
    check()?;
    Ok(bytes)
}
pub async fn catalog(refresh: bool) -> Result<Catalog> {
    type Cache = Option<(Instant, Result<Catalog>)>;
    static CACHE: OnceLock<tokio::sync::Mutex<Cache>> = OnceLock::new();
    let mut cache = CACHE
        .get_or_init(|| tokio::sync::Mutex::new(None))
        .lock()
        .await;
    if let Some((at, value)) = &*cache {
        if at.elapsed() < Duration::from_secs(if value.is_ok() { 900 } else { 30 })
            && !(refresh && at.elapsed() >= Duration::from_secs(30))
        {
            return value.clone();
        }
    }
    let result = async {
        let bytes = tokio::time::timeout(
            Duration::from_secs(15),
            body(&client(None)?, PAGE, 256 * 1024, &|| Ok(()), |_, _| Ok(())),
        )
        .await
        .map_err(|_| "sims_creator_network")??;
        parse(std::str::from_utf8(&bytes).map_err(|_| "sims_creator_format")?)
    }
    .await;
    *cache = Some((Instant::now(), result.clone()));
    result
}
pub async fn review(
    profile: String,
    path: String,
    request: Request,
    operation: String,
    emit: impl Fn(store::progress::Progress),
) -> Result<reviews::Review> {
    let mut work = store::progress::Work::start(&profile, &operation, &emit)?;
    let _parser = reviews::parse_guard()?;
    work.reviewing()?;
    let check = work.cancellation_check();
    let folder = files::validate(&path)?;
    files::idle()?;
    let catalog = cancelable(&check, catalog(false)).await??;
    let selected = catalog
        .releases
        .iter()
        .find(|v| v.version == request.version)
        .ok_or("sims_creator_changed")?;
    if older_game(&folder.game_version, &selected.game_patch)? {
        return Err("sims_creator_patch");
    }
    let (state, pending) = store::snapshot(&path)?;
    if pending {
        return Err("sims_recovery");
    }
    let action = action(&state, &files::inventory(&path)?, request.target.as_deref())?;
    let bytes = body(
        &client(Some(&selected.download))?,
        &selected.download,
        MAX_DOWNLOAD,
        &check,
        |n, total| work.downloading("MC Command Center", n, total),
    )
    .await?;
    let source = store::CreatorSource {
        provider: "mccc".into(),
        project: None,
        required_core: None,
        version: selected.version.clone(),
        game_patch: selected.game_patch.clone(),
        archive_hash: files::stamp("archive.zip".into(), &bytes).hash,
    };
    work.reviewing()?;
    let import = package::unpack_zip_checked(&bytes, &check)?;
    if !["mc_cmd_center.package", "mc_cmd_center.ts4script"]
        .iter()
        .all(|name| {
            import
                .files
                .iter()
                .any(|f| f.name.eq_ignore_ascii_case(name))
        })
    {
        return Err("sims_creator_format");
    }
    let mut plan = store::plan_checked(&path, action, import.files, import.skipped, &check)?;
    validate_link(&plan)?;
    if older_game(&plan.version, &selected.game_patch)? {
        return Err("sims_creator_patch");
    }
    plan.source = Some(source);
    reviews::hold_plan(profile, plan, &check)
}

#[cfg(test)]
#[path = "sims_catalog_tests.rs"]
mod tests;
