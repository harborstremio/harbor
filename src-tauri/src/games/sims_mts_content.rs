//! Creator declarations from the provider's own CC sections. These are not
//! archive contents or local-installation evidence.
use super::{attr, plain, project, re};
use serde::Serialize;

#[path = "sims_mts_notes.rs"]
mod notes;
pub(super) fn author_html(html: &str) -> Result<String, bool> {
    notes::author_html(html)
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct List {
    pub listed: bool,
    pub partial: bool,
    pub items: Vec<Item>,
    pub notes: notes::Links,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub title: String,
    pub creator: String,
    pub page: Option<String>,
    pub project: Option<String>,
    pub included: Option<bool>,
}

fn link(raw: &str) -> Option<(String, Option<String>)> {
    // attr already decodes &amp;, so ordinary query separators are valid here.
    let decoded = quick_xml::escape::unescape(raw).unwrap_or(std::borrow::Cow::Borrowed(raw));
    let value = decoded.trim();
    if value.len() > 2048 || value.chars().any(char::is_control) {
        return None;
    }
    let mut url = reqwest::Url::parse("https://modthesims.info/")
        .ok()?
        .join(value)
        .ok()?;
    if !matches!(url.scheme(), "https" | "http")
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return None;
    }
    let host = url.domain()?;
    // External links are opened only by the user. Never pass local addresses,
    // executable schemes or credentials to the OS opener.
    if !host.contains('.')
        || host.ends_with('.')
        || host.ends_with(".localhost")
        || host.ends_with(".local")
    {
        return None;
    }
    if matches!(host, "modthesims.info" | "www.modthesims.info") {
        url.set_scheme("https").ok()?;
        if let Ok(id) = project(url.as_str()) {
            return Some((format!("https://modthesims.info/d/{id}/"), Some(id)));
        }
    }
    // A relative provider path is meaningful, but arbitrary text is not a URL.
    if !value.starts_with('/')
        && !value.starts_with("https://")
        && !value.starts_with("http://")
        && !value.starts_with("download.php?")
    {
        return None;
    }
    Some((url.into(), None))
}

fn section(html: &str, output: &mut List) {
    let intro = re(r"(?is)<p\b[^>]*>(.*?)(?:</p>|<ol\b|<ul\b)")
        .captures(html)
        .map(|c| plain(&c[1], 400).to_ascii_lowercase())
        .unwrap_or_default();
    let included = if intro
        .starts_with("the following custom content is not included in the downloadable files")
    {
        Some(false)
    } else if intro
        .starts_with("the following custom content is included in the downloadable files")
    {
        Some(true)
    } else {
        None
    };
    let mut parsed = 0;
    for li in re(r"(?is)<li\b([^>]*)>(.*?)</li>").captures_iter(html) {
        parsed += 1;
        if output.items.len() == 256 {
            output.partial = true;
            break;
        }
        if !attr(&li[1], "class").is_some_and(|v| v.split_whitespace().any(|c| c == "ccLink")) {
            output.partial = true;
            continue;
        }
        let anchor = re(r"(?is)<a\b([^>]*)>(.*?)</a>").captures(&li[2]);
        let title = anchor
            .as_ref()
            .map(|a| plain(&a[2], 240))
            .unwrap_or_default();
        if title.is_empty() {
            output.partial = true;
            continue;
        }
        let creator = re(r"(?is)<span\b([^>]*)>(.*?)</span>")
            .captures_iter(&li[2])
            .find(|s| {
                attr(&s[1], "class").is_some_and(|v| v.split_whitespace().any(|c| c == "ccAuthor"))
            })
            .map(|s| plain(&s[2], 120))
            .unwrap_or_default();
        let resolved = anchor
            .as_ref()
            .and_then(|a| attr(&a[1], "href"))
            .and_then(|v| link(&v));
        if resolved.is_none() {
            output.partial = true;
        }
        let (page, project) = resolved.map(|(u, p)| (Some(u), p)).unwrap_or_default();
        // Different sliders often share one creator page. Keep every named item.
        output.items.push(Item {
            title,
            creator,
            page,
            project,
            included,
        });
    }
    if parsed == 0 || re(r"(?is)<li\b").find_iter(html).count() != parsed {
        output.partial = true;
    }
}

pub fn read(html: &str) -> List {
    let mut output = List::default();
    let clean = re(r"(?is)<!--.*?-->|<script\b[^>]*>.*?</script\s*>|<style\b[^>]*>.*?</style\s*>")
        .replace_all(html, "");
    let mut start = None;
    let mut depth = 0usize;
    let mut sections = 0;
    for tag in re(r"(?is)<(/?)section\b([^>]*)>")
        .captures_iter(&clean)
        .take(8192)
    {
        if let Some(from) = start {
            if tag[1].is_empty() {
                depth += 1;
            } else {
                depth -= 1;
                if depth == 0 {
                    section(&clean[from..tag.get(0).unwrap().start()], &mut output);
                    start = None;
                }
            }
        } else if tag[1].is_empty()
            && attr(&tag[2], "id").is_some_and(|id| id.starts_with("scroll_cc"))
        {
            output.listed = true;
            sections += 1;
            if sections > 16 {
                output.partial = true;
                break;
            }
            start = Some(tag.get(0).unwrap().end());
            depth = 1;
        }
    }
    if start.is_some() {
        output.partial = true;
    }
    output.notes = notes::read(&clean);
    // Structured declarations already provide the stronger context for a link.
    output.notes.items.retain(|note| {
        !output
            .items
            .iter()
            .any(|item| note.page.is_some() && note.page == item.page)
    });
    output
}

#[cfg(test)]
#[path = "sims_mts_content_tests.rs"]
mod tests;
