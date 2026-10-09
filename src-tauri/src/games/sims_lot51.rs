//! Lot 51's public catalog and ordinary anonymous download form. Only metadata
//! and the validated archive redirect are consumed; remote commands never run.
use super::{
    sims_catalog as transport, sims_files as files, sims_package as package,
    sims_reviews as reviews, sims_store as store,
};
use package::Result;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    sync::OnceLock,
    time::{Duration, Instant},
};
const HOME: &str = "https://lot51.cc";
const MAX_PAGE: usize = 1024 * 1024;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub slug: String,
    pub title: String,
    pub subtitle: String,
    pub version: String,
    pub icon: String,
    pub image: String,
    pub page: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub projects: Vec<Project>,
    pub observed_at: u64,
    pub cached: bool,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Detail {
    pub project: Project,
    pub description: String,
    pub packs: Vec<String>,
    pub required_core: Option<String>,
    pub changelog: String,
    #[serde(skip)]
    form: BTreeMap<String, String>,
    #[serde(skip)]
    endpoint: String,
    #[serde(skip)]
    filename: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub project: String,
    pub version: String,
    pub target: Option<String>,
}
fn re(s: &str) -> Regex {
    Regex::new(s).expect("static Lot 51 expression")
}
fn decode(s: &str) -> String {
    let s = s.replace("&nbsp;", " ").replace("&bull;", " · ");
    quick_xml::escape::unescape(&s)
        .unwrap_or(std::borrow::Cow::Borrowed(&s))
        .into_owned()
}
fn text(s: &str) -> String {
    decode(&re(r"(?s)<[^>]*>").replace_all(s, " "))
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
fn attr(tag: &str, key: &str) -> Option<String> {
    re(&format!(
        r#"(?is)\b{}\s*=\s*["']([^"']*)["']"#,
        regex::escape(key)
    ))
    .captures(tag)
    .map(|c| decode(&c[1]))
}
fn clean_url(value: &str, host: &str) -> Option<reqwest::Url> {
    let u = reqwest::Url::parse(value).ok()?;
    (u.scheme() == "https"
        && u.host_str() == Some(host)
        && u.port().is_none()
        && u.username().is_empty()
        && u.password().is_none()
        && u.fragment().is_none())
    .then_some(u)
}
fn artwork(value: &str) -> Result<String> {
    let u = clean_url(value, "lot51.cc").ok_or("sims_creator_format")?;
    if value.len() > 2048 || !u.path().starts_with("/sites/default/files/") {
        return Err("sims_creator_format");
    }
    Ok(u.to_string())
}
pub fn parse_catalog(html: &str) -> Result<Catalog> {
    if html.len() > MAX_PAGE {
        return Err("sims_limit");
    }
    // DLC badges contain nested articles. Split by the provider's mod root,
    // rather than incorrectly stopping at the first closing article.
    let starts = re(r#"(?is)<article\b[^>]*class=["'][^"']*\bnode--type-mod\b[^"']*["'][^>]*>"#)
        .find_iter(html)
        .map(|m| m.start())
        .collect::<Vec<_>>();
    if starts.is_empty() || starts.len() > 50 {
        return Err("sims_creator_format");
    }
    let mut projects = Vec::new();
    for (index, start) in starts.iter().enumerate() {
        let card = &html[*start..starts.get(index + 1).copied().unwrap_or(html.len())];
        let link = re(r#"(?is)<a\b[^>]*class=["'][^"']*\bstretched-link\b[^"']*["'][^>]*>"#)
            .find(card)
            .ok_or("sims_creator_format")?;
        let page = attr(link.as_str(), "href").ok_or("sims_creator_format")?;
        let page = if page.starts_with("/mods/") {
            format!("{HOME}{page}")
        } else {
            page
        };
        let u = clean_url(&page, "lot51.cc").ok_or("sims_creator_format")?;
        let slug = u
            .path()
            .strip_prefix("/mods/")
            .filter(|s| store::creator_slug(s))
            .ok_or("sims_creator_format")?
            .to_string();
        if u.query().is_some() || projects.iter().any(|p: &Project| p.slug == slug) {
            return Err("sims_creator_format");
        }
        let title = re(r"(?is)<h2\b[^>]*>(.*?)</h2>")
            .captures(card)
            .map(|c| text(&c[1]))
            .ok_or("sims_creator_format")?;
        let subtitle = re(r#"(?is)<div\b[^>]*class=["'][^"']*field--name-field-subtitle\b[^"']*["'][^>]*>(.*?)</div>"#).captures(card).map(|c| text(&c[1])).unwrap_or_default();
        let version = badge(card)?;
        let without_packs = re(r#"(?is)<article\b[^>]*class=["'][^"']*\bnode--type-dlc\b[^"']*["'][^>]*>.*?</article>"#).replace_all(card, "");
        let icon = re(r#"(?is)field--name-field-icon\b[^>]*>\s*(<img\b[^>]*>)"#)
            .captures(&without_packs)
            .and_then(|c| attr(&c[1], "src"))
            .map(|v| artwork(&v))
            .transpose()?
            .unwrap_or_default();
        let image = re(r#"(?is)<img\b[^>]*class=["'][^"']*\bmod-accent-image\b[^"']*["'][^>]*>"#)
            .find(card)
            .and_then(|m| attr(m.as_str(), "src"))
            .map(|v| artwork(&v))
            .transpose()?
            .unwrap_or_else(|| icon.clone());
        if title.is_empty() || title.len() > 200 || subtitle.len() > 700 {
            return Err("sims_creator_format");
        }
        projects.push(Project {
            slug,
            title,
            subtitle,
            version,
            icon,
            image,
            page,
        });
    }
    Ok(Catalog {
        projects,
        observed_at: files::now(),
        cached: false,
    })
}
fn badge(html: &str) -> Result<String> {
    let v =
        re(r#"(?is)<span\b[^>]*class=["'][^"']*\btext-bg-primary\b[^"']*["'][^>]*>(.*?)</span>"#)
            .captures(html)
            .map(|c| text(&c[1]))
            .ok_or("sims_creator_format")?;
    store::creator_version(&v).ok_or("sims_creator_format")?;
    Ok(v)
}
pub fn parse_detail(project: Project, html: &str) -> Result<Detail> {
    if html.len() > MAX_PAGE {
        return Err("sims_limit");
    }
    let header =
        re(r#"(?is)<header\b[^>]*class=["'][^"']*\bmod-header\b[^"']*["'][^>]*>(.*?)</header>"#)
            .captures(html)
            .map(|c| c[1].to_string())
            .ok_or("sims_creator_format")?;
    if badge(&header)? != project.version {
        return Err("sims_creator_changed");
    }
    let name = re(r"(?is)<h1\b[^>]*>(.*?)</h1>")
        .captures(&header)
        .map(|c| text(&c[1]))
        .ok_or("sims_creator_format")?;
    if name != project.title {
        return Err("sims_creator_changed");
    }
    let packs = re(
        r#"(?is)<article\b[^>]*class=["'][^"']*\bnode--type-dlc\b[^"']*["'][^>]*>(.*?)</article>"#,
    )
    .captures_iter(&header)
    .map(|c| text(&c[1]))
    .filter(|v| !v.is_empty())
    .collect::<Vec<_>>();
    if packs.len() > 30 || packs.iter().any(|v| v.len() > 150) {
        return Err("sims_creator_format");
    }
    let body = re(r#"(?is)<div\b[^>]*class=["'][^"']*\bfield--name-body\b[^"']*["'][^>]*>\s*<p\b[^>]*>(.*?)</p>"#).captures(html).map(|c| text(&c[1])).unwrap_or_default();
    let description = body.chars().take(1500).collect::<String>();
    let plain = text(html);
    let required_core = re(r"requires Core Library\s*>=\s*([0-9.]+)")
        .captures(&plain)
        .map(|c| c[1].to_string());
    if plain.contains("requires Core Library")
        && required_core
            .as_deref()
            .and_then(store::creator_version)
            .is_none()
    {
        return Err("sims_creator_format");
    }
    let form_html = re(r#"(?is)<form\b[^>]*id=["']download-mod-form["'][^>]*>.*?</form>"#)
        .find(html)
        .ok_or("sims_creator_format")?;
    if attr(form_html.as_str(), "action").as_deref() != Some(&format!("/mods/{}", project.slug))
        || attr(form_html.as_str(), "method").as_deref() != Some("post")
    {
        return Err("sims_creator_format");
    }
    let mut form = BTreeMap::new();
    for tag in re(r"(?is)<(?:input|button)\b[^>]*>").find_iter(form_html.as_str()) {
        if let Some(name) = attr(tag.as_str(), "name") {
            let value = attr(tag.as_str(), "value").ok_or("sims_creator_format")?;
            if !matches!(name.as_str(), "core" | "op" | "form_build_id" | "form_id")
                || value.len() > 512
                || form.insert(name, value).is_some()
            {
                return Err("sims_creator_format");
            }
        }
    }
    if form.len() != 4
        || form.get("form_id").map(String::as_str) != Some("download_mod_form")
        || !form
            .get("form_build_id")
            .is_some_and(|v| v.starts_with("form-") && v.len() > 20)
    {
        return Err("sims_creator_format");
    }
    let json = re(r#"(?is)<script\b[^>]*data-drupal-selector=["']drupal-settings-json["'][^>]*>(.*?)</script>"#).captures(html).map(|c| c[1].to_string()).ok_or("sims_creator_format")?;
    let settings: serde_json::Value =
        serde_json::from_str(&json).map_err(|_| "sims_creator_format")?;
    let ajax = &settings["ajax"]["edit-submit"];
    let endpoint = format!("/mods/{}?ajax_form=1", project.slug);
    if ajax["url"].as_str() != Some(&endpoint)
        || ajax["httpMethod"].as_str() != Some("POST")
        || ajax["submit"]["_triggering_element_name"].as_str() != Some("op")
        || ajax["submit"]["_triggering_element_value"].as_str()
            != form.get("op").map(String::as_str)
    {
        return Err("sims_creator_format");
    }
    form.insert("_triggering_element_name".into(), "op".into());
    form.insert("_triggering_element_value".into(), form["op"].clone());
    form.insert("_drupal_ajax".into(), "1".into());
    let filename = re(r"\b(lot51_[a-zA-Z0-9_.-]+\.zip)\b")
        .captures(&plain)
        .map(|c| c[1].to_string())
        .ok_or("sims_creator_format")?;
    let changelog = format!("{}/releases/{}", project.page, project.version);
    Ok(Detail {
        project,
        description,
        packs,
        required_core,
        changelog,
        form,
        endpoint: format!("{HOME}{endpoint}&_wrapper_format=drupal_ajax"),
        filename,
    })
}
fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent("Harbor-Games/0.9 (https://harbor.site)")
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "sims_creator_network")
}
async fn page(url: &str, check: &dyn Fn() -> Result<()>) -> Result<String> {
    let client = client()?;
    let bytes = tokio::time::timeout(
        Duration::from_secs(15),
        transport::body(&client, url, MAX_PAGE, check, |_, _| Ok(())),
    )
    .await
    .map_err(|_| "sims_creator_network")??;
    String::from_utf8(bytes).map_err(|_| "sims_creator_format")
}
fn cached_catalog() -> Result<Catalog> {
    let catalog: Catalog = serde_json::from_str(include_str!("sims_lot51_catalog.json"))
        .map_err(|_| "sims_creator_format")?;
    if !catalog.cached || catalog.projects.len() > 50 {
        return Err("sims_creator_format");
    }
    for p in &catalog.projects {
        if !store::creator_slug(&p.slug)
            || store::creator_version(&p.version).is_none()
            || p.page != format!("{HOME}/mods/{}", p.slug)
        {
            return Err("sims_creator_format");
        }
        for image in [&p.image, &p.icon].into_iter().filter(|v| !v.is_empty()) {
            artwork(image)?;
        }
    }
    Ok(catalog)
}
pub async fn catalog(refresh: bool) -> Result<Catalog> {
    type Cache = Option<(Instant, Result<Catalog>)>;
    static CACHE: OnceLock<tokio::sync::Mutex<Cache>> = OnceLock::new();
    let mut cache = CACHE
        .get_or_init(|| tokio::sync::Mutex::new(None))
        .lock()
        .await;
    if let Some((at, value)) = &*cache {
        if at.elapsed()
            < Duration::from_secs(if value.as_ref().is_ok_and(|v| !v.cached) {
                900
            } else {
                30
            })
            && !(refresh && at.elapsed() >= Duration::from_secs(30))
        {
            return value.clone();
        }
    }
    // The public /mods route redirects to the catalog on the home page.
    let result = async { parse_catalog(&page(&format!("{HOME}/"), &|| Ok(())).await?) }
        .await
        .or_else(|_| cached_catalog());
    *cache = Some((Instant::now(), result.clone()));
    result
}
async fn detail_checked(slug: &str, check: &dyn Fn() -> Result<()>) -> Result<Detail> {
    if !store::creator_slug(slug) {
        return Err("sims_creator_format");
    }
    let catalog = transport::cancelable(check, catalog(false)).await??;
    if catalog.cached {
        return Err("sims_creator_network");
    }
    let project = catalog
        .projects
        .into_iter()
        .find(|p| p.slug == slug)
        .ok_or("sims_creator_changed")?;
    let html = page(&project.page, check).await?;
    parse_detail(project, &html)
}
pub async fn detail(slug: &str) -> Result<Detail> {
    detail_checked(slug, &|| Ok(())).await
}
fn redirect(json: &[u8], detail: &Detail) -> Result<String> {
    let commands: Vec<serde_json::Value> =
        serde_json::from_slice(json).map_err(|_| "sims_creator_format")?;
    if commands.len() > 30 {
        return Err("sims_creator_format");
    }
    let redirects = commands
        .iter()
        .filter(|c| c["command"] == "redirect")
        .collect::<Vec<_>>();
    let [command] = redirects.as_slice() else {
        return Err("sims_creator_changed");
    };
    let value = command["url"].as_str().ok_or("sims_creator_format")?;
    let u = clean_url(value, "download.lot51.cc").ok_or("sims_creator_format")?;
    if value.len() > 4096
        || u.path() != format!("/mods/{}/{}", detail.project.slug, detail.filename)
    {
        return Err("sims_creator_changed");
    }
    Ok(u.to_string())
}
async fn download(
    detail: &Detail,
    core: &str,
    work: &mut store::progress::Work<'_>,
) -> Result<Vec<u8>> {
    let check = work.cancellation_check();
    let client = client()?;
    let mut form = detail.form.clone();
    form.insert("core".into(), core.into());
    let response = transport::cancelable(
        &check,
        client
            .post(&detail.endpoint)
            .header("X-Requested-With", "XMLHttpRequest")
            .header("Referer", &detail.project.page)
            .form(&form)
            .send(),
    )
    .await?
    .map_err(|_| "sims_creator_network")?;
    let commands = transport::response_body(response, MAX_PAGE, &check, |_, _| Ok(())).await?;
    let url = redirect(&commands, detail)?;
    transport::body(&client, &url, 32 * 1024 * 1024, &check, |n, total| {
        work.downloading(&detail.project.title, n, total)
    })
    .await
}
fn validate_target(plan: &store::Plan, project: &str) -> Result<()> {
    let store::Action::Update { id } = &plan.action else {
        return Ok(());
    };
    let group = plan
        .before
        .groups
        .iter()
        .find(|g| &g.id == id)
        .ok_or("sims_lot51_target")?;
    if let Some(source) = &group.source {
        return if source.provider == "lot51" && source.project.as_deref() == Some(project) {
            Ok(())
        } else {
            Err("sims_lot51_target")
        };
    }
    // Manual linking needs an exact existing mod payload subset. Settings may differ.
    if plan
        .existing
        .iter()
        .filter(|f| matches!(package::kind(&f.name), "package" | "script"))
        .any(|old| {
            !plan
                .payload
                .iter()
                .any(|new| old.name.eq_ignore_ascii_case(&new.name))
        })
    {
        return Err("sims_lot51_target");
    }
    Ok(())
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
    files::validate(&path)?;
    files::idle()?;
    let detail = detail_checked(&request.project, &check).await?;
    if detail.project.version != request.version {
        return Err("sims_creator_changed");
    }
    let (state, pending) = store::snapshot(&path)?;
    if pending {
        return Err("sims_recovery");
    }
    if files::inventory(&path)?.partial {
        return Err("sims_adopt_scan");
    }
    let core = if let Some(minimum) = &detail.required_core {
        store::verified_core(&state, minimum, &check)?
            .source
            .ok_or("sims_creator_dependency")?
            .version
    } else {
        String::new()
    };
    let action = if let Some(id) = request.target {
        let g = state
            .groups
            .iter()
            .find(|g| g.id == id)
            .ok_or("sims_lot51_target")?;
        if g.source.as_ref().is_some_and(|s| {
            s.provider != "lot51" || s.project.as_deref() != Some(&request.project)
        }) {
            return Err("sims_lot51_target");
        }
        store::Action::Update { id }
    } else {
        if state.groups.iter().any(|g| {
            g.source.as_ref().is_some_and(|s| {
                s.provider == "lot51" && s.project.as_deref() == Some(&request.project)
            })
        }) {
            return Err("sims_lot51_target");
        }
        store::Action::Install {
            title: detail.project.title.clone(),
        }
    };
    let bytes = download(&detail, &core, &mut work).await?;
    let source = store::CreatorSource {
        provider: "lot51".into(),
        project: Some(request.project.clone()),
        required_core: detail.required_core.clone(),
        version: detail.project.version,
        game_patch: String::new(),
        archive_hash: files::stamp("archive.zip".into(), &bytes).hash,
    };
    work.reviewing()?;
    let import = package::unpack_zip_checked(&bytes, &check)?;
    if request.project == "core-library"
        && !import
            .files
            .iter()
            .any(|f| f.name.eq_ignore_ascii_case("lot51_core.ts4script"))
    {
        return Err("sims_creator_format");
    }
    let mut plan = store::plan_checked(&path, action, import.files, import.skipped, &check)?;
    validate_target(&plan, &request.project)?;
    if let Some(minimum) = &source.required_core {
        store::verified_core(&plan.before, minimum, &check)?;
    }
    plan.source = Some(source);
    reviews::hold_plan(profile, plan, &check)
}

#[cfg(test)]
#[path = "sims_lot51_tests.rs"]
mod tests;
