//! Explicit imports from public Mod The Sims pages. A page is the source of
//! file choices; caller-provided download URLs are never accepted.
use super::{
    sims_catalog as catalog, sims_files as files, sims_package as package, sims_reviews as reviews,
    sims_store as store,
};
use package::Result;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    sync::OnceLock,
    time::{Duration, Instant},
};

const PAGE_LIMIT: usize = 1024 * 1024;
const ARCHIVE_LIMIT: usize = 64 * 1024 * 1024;
const INTERVAL: Duration = Duration::from_secs(30);

#[path = "sims_mts_content.rs"]
mod content;
#[path = "sims_mts_metrics.rs"]
pub(super) mod metrics;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Download {
    pub version: String,
    pub name: String,
    pub supported: bool,
    #[serde(skip)]
    url: String,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Detail {
    pub metrics: metrics::Metrics,
    pub game: u8,
    pub project: String,
    pub title: String,
    pub creator: String,
    pub description: String,
    pub body: String,
    pub gallery: Vec<String>,
    pub image: String,
    pub page: String,
    pub packs: Vec<String>,
    pub files: Vec<Download>,
    pub content: content::List,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub project: String,
    pub version: String,
    pub target: Option<String>,
}
pub(super) fn number(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 12
        && !value.starts_with('0')
        && value.bytes().all(|v| v.is_ascii_digit())
}
pub(super) fn version(value: &str) -> bool {
    value
        .split_once('.')
        .is_some_and(|(id, revision)| number(id) && number(revision))
}
pub(super) fn url(value: &str) -> Option<reqwest::Url> {
    let u = reqwest::Url::parse(value).ok()?;
    (u.scheme() == "https"
        && u.port().is_none()
        && u.username().is_empty()
        && u.password().is_none())
    .then_some(u)
}
pub fn project(value: &str) -> Result<String> {
    if value.len() > 1024 {
        return Err("sims_mts_page");
    }
    let u = url(value.trim()).ok_or("sims_mts_page")?;
    if !matches!(
        u.host_str(),
        Some("modthesims.info" | "www.modthesims.info")
    ) {
        return Err("sims_mts_page");
    }
    let id = if u.path() == "/download.php" {
        let pairs = u.query_pairs().collect::<Vec<_>>();
        if pairs.len() != 1 || pairs[0].0 != "t" {
            return Err("sims_mts_page");
        }
        pairs[0].1.to_string()
    } else {
        if u.query().is_some() {
            return Err("sims_mts_page");
        }
        let parts = u.path().split('/').collect::<Vec<_>>();
        if !(parts.len() == 3 || parts.len() == 4) || parts[1] != "d" {
            return Err("sims_mts_page");
        }
        parts[2].to_owned()
    };
    number(&id).then_some(id).ok_or("sims_mts_page")
}
pub(super) fn re(pattern: &str) -> Regex {
    Regex::new(pattern).expect("static MTS expression")
}
pub(super) fn plain(value: &str, max: usize) -> String {
    let stripped = re(r"(?s)<[^>]*>")
        .replace_all(value, " ")
        .replace("&nbsp;", " ")
        .replace("&raquo;", " › ")
        .replace("&ldquo;", "\"")
        .replace("&rdquo;", "\"")
        .replace("&lsquo;", "’")
        .replace("&rsquo;", "’")
        .replace("&hellip;", "…");
    quick_xml::escape::unescape(&stripped)
        .unwrap_or(std::borrow::Cow::Borrowed(&stripped))
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(max)
        .collect()
}
pub(super) fn attr(tag: &str, key: &str) -> Option<String> {
    // Attribute names are fixed code, never user input. Require a complete
    // attribute so data-href cannot masquerade as href.
    static ATTRS: OnceLock<Vec<(&str, Regex)>> = OnceLock::new();
    let expression = &ATTRS
        .get_or_init(|| {
            [
                "property", "content", "class", "href", "id", "src", "alt", "title", "rel",
            ]
            .into_iter()
            .map(|name| {
                (
                    name,
                    re(&format!(
                        r#"(?is)(?:^|\s){}\s*=\s*(?:"([^"]*)"|'([^']*)')"#,
                        name
                    )),
                )
            })
            .collect()
        })
        .iter()
        .find(|(name, _)| *name == key)?
        .1;
    let found = expression.captures(tag)?;
    Some(
        found
            .get(1)
            .or_else(|| found.get(2))?
            .as_str()
            .replace("&amp;", "&"),
    )
}
fn meta(html: &str, name: &str, max: usize) -> String {
    re(r"(?is)<meta\b[^>]*>")
        .find_iter(html)
        .take(128)
        .find_map(|m| {
            (attr(m.as_str(), "property").as_deref() == Some(name))
                .then(|| attr(m.as_str(), "content"))
                .flatten()
        })
        .map(|v| plain(&v, max))
        .unwrap_or_default()
}
fn download_link(value: &str) -> Option<String> {
    let u = url(value)?;
    if u.host_str() != Some("chii.modthesims.info")
        || u.path() != "/getfile.php"
        || u.fragment().is_some()
    {
        return None;
    }
    let q = u.query_pairs().collect::<Vec<_>>();
    if q.len() != 2 {
        return None;
    }
    let id = q.iter().find(|(k, _)| k == "file")?.1.as_ref();
    let revision = q.iter().find(|(k, _)| k == "v")?.1.as_ref();
    (number(id) && number(revision)).then(|| format!("{id}.{revision}"))
}
fn pack_modal(html: &str) -> &str {
    let mut start = None;
    let mut depth = 0;
    for tag in re(r"(?is)<(/?)div\b([^>]*)>")
        .captures_iter(html)
        .take(8192)
    {
        if start.is_none() {
            if tag[1].is_empty() && attr(&tag[2], "id").as_deref() == Some("epiconsmodal") {
                start = Some(tag.get(0).unwrap().end());
                depth = 1;
            }
        } else if tag[1].is_empty() {
            depth += 1;
        } else {
            depth -= 1;
            if depth == 0 {
                return &html[start.unwrap()..tag.get(0).unwrap().start()];
            }
        }
    }
    ""
}
fn creator_body(html: &str) -> String {
    let inert = re(r"(?is)<!--.*?-->|<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>")
        .replace_all(html, "");
    let Ok(body) = content::author_html(&inert) else {
        return String::new();
    };
    let lines = re(r"(?is)<br\s*/?>|</(?:p|div|li|h[1-6]|tr)>").replace_all(&body, "\n");
    lines
        .lines()
        .map(|line| plain(line, 4000))
        .filter(|line| !line.is_empty() && line != "Advertisement:")
        .collect::<Vec<_>>()
        .join("\n\n")
        .chars()
        .take(24000)
        .collect()
}
fn creator_gallery(html: &str) -> Vec<String> {
    let mut values = Vec::new();
    for tag in re(r"(?is)<a\b([^>]*)>").captures_iter(html).take(4096) {
        if !attr(&tag[1], "class")
            .is_some_and(|s| s.split_whitespace().any(|v| v == "downloadthumb"))
            || attr(&tag[1], "rel").as_deref() != Some("carouselimages")
        {
            continue;
        }
        let Some(src) = attr(&tag[1], "href") else {
            continue;
        };
        let src = if src.starts_with("//") {
            format!("https:{src}")
        } else {
            src
        };
        if src.len() > 2048
            || !url(&src).is_some_and(|u| {
                matches!(
                    u.host_str(),
                    Some("thumbs.modthesims2.com" | "thumbs2.modthesims2.com")
                ) && u.path().starts_with("/img/")
            })
        {
            continue;
        }
        if !values.contains(&src) {
            values.push(src);
        }
        if values.len() >= 24 {
            break;
        }
    }
    values
}

pub fn parse(html: &str, id: &str) -> Result<Detail> {
    if html.len() > PAGE_LIMIT || !number(id) {
        return Err("sims_limit");
    }
    let heading = re(r"(?is)<h1\b[^>]*>(.*?)</h1>")
        .captures(html)
        .ok_or("sims_mts_page")?;
    let game = re(r"(?is)<img\b[^>]*>")
        .find_iter(&heading[1])
        .find_map(|tag| {
            let src = attr(tag.as_str(), "src")?;
            let src = src.strip_prefix("https:").unwrap_or(&src);
            match src {
                "//static.modthesims2.com/images/sims4logo_60px.jpg" => Some(4),
                "//static.modthesims2.com/9404_090602124427ts3_60px.jpg" => Some(3),
                "//static.modthesims2.com/9405_090602124724ts2_60px.jpg" => Some(2),
                _ => None,
            }
        })
        .ok_or("sims_mts_page")?;
    let title = plain(
        &re(r"(?is)<svg\b.*?</svg>").replace_all(&heading[1], ""),
        200,
    );
    if title.is_empty() || project(&meta(html, "og:url", 1024)).ok().as_deref() != Some(id) {
        return Err("sims_mts_page");
    }
    let mut downloads: Vec<Download> = Vec::new();
    for a in re(r"(?is)<a\b([^>]+)>(.*?)</a>")
        .captures_iter(html)
        .take(4096)
    {
        if !attr(&a[1], "class").is_some_and(|v| v.split_whitespace().any(|c| c == "downloadlink"))
        {
            continue;
        }
        let href = attr(&a[1], "href").ok_or("sims_creator_format")?;
        let ver = download_link(&href).ok_or("sims_creator_format")?;
        let name = plain(&a[2], 240);
        // Each file has a second generic Download button. Only the named link
        // determines the format; neither the extension nor markup validates bytes.
        if name.eq_ignore_ascii_case("download") {
            continue;
        }
        if name.is_empty() || name.contains(['/', '\\']) {
            return Err("sims_creator_format");
        }
        if let Some(prior) = downloads.iter().find(|f| f.version == ver) {
            if prior.name != name {
                return Err("sims_creator_format");
            }
            continue;
        }
        if downloads.len() >= 64 {
            return Err("sims_limit");
        }
        downloads.push(Download {
            version: ver,
            supported: game == 4 && name.to_ascii_lowercase().ends_with(".zip"),
            name,
            url: href,
        });
    }
    if downloads.is_empty() {
        return Err("sims_creator_format");
    }
    let image = meta(html, "og:image", 1024);
    let image = if url(&image).is_some_and(|u| {
        matches!(
            u.host_str(),
            Some("thumbs.modthesims2.com" | "thumbs2.modthesims2.com")
        ) && u.path().starts_with("/img/")
    }) {
        image
    } else {
        String::new()
    };
    let mut packs = Vec::new();
    // The page repeats the same pack badges in a disclosure and sidebar.
    for image in re(r"(?is)<img\b[^>]*>")
        .find_iter(pack_modal(html))
        .take(1024)
    {
        let Some(src) = attr(image.as_str(), "src") else {
            continue;
        };
        if !src.starts_with("//static.modthesims2.com//games/") {
            continue;
        }
        if let Some(name) = attr(image.as_str(), "alt")
            .map(|v| plain(&v, 100))
            .filter(|v| !v.is_empty() && v != "Sims 4")
        {
            if !packs.contains(&name) && packs.len() < 64 {
                packs.push(name);
            }
        }
    }
    Ok(Detail {
        metrics: metrics::detail(html),
        game,
        project: id.into(),
        title,
        creator: meta(html, "og:author", 120),
        description: meta(html, "og:description", 600),
        body: creator_body(html),
        gallery: creator_gallery(html),
        image,
        page: format!("https://modthesims.info/d/{id}/"),
        packs,
        files: downloads,
        content: content::read(html),
    })
}
fn client(page: bool) -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent("Harbor/1.0")
        .timeout(Duration::from_secs(45))
        .redirect(reqwest::redirect::Policy::custom(move |attempt| {
            let allowed = if page {
                matches!(
                    attempt.url().host_str(),
                    Some("modthesims.info" | "www.modthesims.info")
                )
            } else {
                matches!(
                    attempt.url().host_str(),
                    Some("chii.modthesims.info" | "skuld.modthesims2.com")
                )
            };
            if attempt.previous().len() < 3 && allowed && url(attempt.url().as_str()).is_some() {
                attempt.follow()
            } else {
                attempt.error("unsupported MTS redirect")
            }
        }))
        .build()
        .map_err(|_| "sims_creator_network")
}
#[derive(Default)]
struct Cache {
    pages: VecDeque<(String, Instant, Result<Detail>)>,
}
pub(super) async fn page_bytes(
    page: &str,
    check: &dyn Fn() -> Result<()>,
    waiting: &mut dyn FnMut(bool) -> Result<()>,
) -> Result<Vec<u8>> {
    static GATE: OnceLock<tokio::sync::Mutex<Option<Instant>>> = OnceLock::new();
    waiting(true)?;
    let mut last = catalog::cancelable(
        check,
        GATE.get_or_init(|| tokio::sync::Mutex::new(None)).lock(),
    )
    .await?;
    if let Some(previous) = *last {
        if let Some(wait) = INTERVAL.checked_sub(previous.elapsed()) {
            catalog::cancelable(check, tokio::time::sleep(wait)).await?;
        }
    }
    waiting(false)?;
    check()?;
    *last = Some(Instant::now());
    catalog::body(&client(true)?, page, PAGE_LIMIT, check, |_, _| Ok(())).await
}
async fn detail_checked(
    id: &str,
    refresh: bool,
    check: &dyn Fn() -> Result<()>,
    waiting: &mut dyn FnMut(bool) -> Result<()>,
) -> Result<Detail> {
    if !number(id) {
        return Err("sims_mts_page");
    }
    static CACHE: OnceLock<tokio::sync::Mutex<Cache>> = OnceLock::new();
    let mut cache = catalog::cancelable(
        check,
        CACHE
            .get_or_init(|| tokio::sync::Mutex::new(Cache::default()))
            .lock(),
    )
    .await?;
    if let Some((_, at, result)) = cache.pages.iter().find(|(key, _, _)| key == id) {
        if at.elapsed() < Duration::from_secs(if refresh || result.is_err() { 30 } else { 300 }) {
            return result.clone();
        }
    }
    let result = async {
        let bytes = page_bytes(&format!("https://modthesims.info/d/{id}/"), check, waiting).await?;
        parse(
            std::str::from_utf8(&bytes).map_err(|_| "sims_creator_format")?,
            id,
        )
    }
    .await;
    check()?;
    cache.pages.retain(|(key, _, _)| key != id);
    if cache.pages.len() >= 8 {
        cache.pages.pop_front();
    }
    cache
        .pages
        .push_back((id.into(), Instant::now(), result.clone()));
    result
}
pub async fn detail(
    profile: String,
    page: String,
    operation: String,
    emit: impl Fn(store::progress::Progress),
) -> Result<Detail> {
    let mut work = store::progress::Work::start(&profile, &operation, &emit)?;
    work.reviewing()?;
    detail_checked(
        &project(&page)?,
        true,
        &work.cancellation_check(),
        &mut |waiting| {
            if waiting {
                work.waiting()
            } else {
                work.reviewing()
            }
        },
    )
    .await
}
fn action(
    state: &store::State,
    detail: &Detail,
    selected: &Download,
    target: Option<&str>,
) -> Result<store::Action> {
    // Browsing another Sims catalog never authorizes writing to a Sims4 folder.
    if detail.game != 4 {
        return Err("sims_mts_page");
    }
    if let Some(id) = target {
        let group = state
            .groups
            .iter()
            .find(|g| g.id == id)
            .ok_or("sims_lot51_target")?;
        if !group
            .source
            .as_ref()
            .is_some_and(|s| s.provider == "mts" && s.project.as_deref() == Some(&detail.project))
        {
            return Err("sims_lot51_target");
        }
        Ok(store::Action::Update { id: id.into() })
    } else {
        if state.groups.iter().any(|g| {
            g.source.as_ref().is_some_and(|s| {
                s.provider == "mts"
                    && s.project.as_deref() == Some(&detail.project)
                    && s.version == selected.version
            })
        }) {
            return Err("sims_creator_changed");
        }
        let mut title = format!("{} · {}", detail.title, selected.name);
        while title.len() > 200 {
            title.pop();
        }
        Ok(store::Action::Install { title })
    }
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
    let detail = detail_checked(&request.project, false, &check, &mut |waiting| {
        if waiting {
            work.waiting()
        } else {
            work.reviewing()
        }
    })
    .await?;
    if detail.game != 4 {
        return Err("sims_mts_page");
    }
    let selected = detail
        .files
        .iter()
        .find(|f| f.version == request.version)
        .ok_or("sims_creator_changed")?;
    if !selected.supported {
        return Err("sims_mts_zip");
    }
    let (state, pending) = store::snapshot(&path)?;
    if pending {
        return Err("sims_recovery");
    }
    let intended = action(&state, &detail, selected, request.target.as_deref())?;
    let bytes = catalog::body(
        &client(false)?,
        &selected.url,
        ARCHIVE_LIMIT,
        &check,
        |n, total| work.downloading(&selected.name, n, total),
    )
    .await?;
    work.reviewing()?;
    let source = store::CreatorSource {
        provider: "mts".into(),
        project: Some(detail.project.clone()),
        required_core: None,
        version: selected.version.clone(),
        game_patch: String::new(),
        archive_hash: files::stamp("archive.zip".into(), &bytes).hash,
    };
    let mut plan = if store::tray::format::contains_tray(&bytes, &check)? {
        // A creation is one complete Tray export. It cannot replace a Mods group.
        if request.target.is_some() {
            return Err("sims_lot51_target");
        }
        let import = store::tray::format::unpack_zip_checked(bytes, &check)?;
        let mut title = detail.title.clone();
        while title.len() > 200 {
            title.pop();
        }
        let mut plan = store::tray::plan_import_checked(&path, title, import, &check)?;
        plan.tray.as_mut().ok_or("sims_request")?.item.source = Some(source.clone());
        plan
    } else {
        let import = package::unpack_zip_checked(&bytes, &check)?;
        store::plan_checked(&path, intended, import.files, import.skipped, &check)?
    };
    // Revalidate the selected managed group after download and local reads.
    action(&plan.before, &detail, selected, request.target.as_deref())?;
    plan.source = Some(source);
    reviews::hold_plan(profile, plan, &check)
}

#[cfg(test)]
#[path = "sims_mts_tests.rs"]
mod tests;
