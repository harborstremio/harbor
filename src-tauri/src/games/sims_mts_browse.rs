//! Explicit, paginated Sims discovery. Browse and detail share MTS's page
//! request interval; filters never fan out or scrape the disallowed forum search.
use super::{
    sims_catalog as catalog, sims_files as files,
    sims_mts::{self as mts, attr, plain, re},
    sims_package::Result,
    sims_store as store,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeSet, VecDeque},
    sync::OnceLock,
    time::{Duration, Instant},
};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Query {
    #[serde(default = "default_game")]
    pub game: u8,
    pub category: u16,
    pub sort: u8,
    pub query: String,
    pub page: u16,
}
fn default_game() -> u8 {
    4
}
impl Query {
    fn checked(mut self) -> Result<Self> {
        self.query = self.query.trim().into();
        let categories: &[u16] = match self.game {
            2 => &[38, 145, 485, 143, 342, 385, 380, 414, 229, 415, 519, 139],
            3 => &[
                38, 588, 145, 649, 143, 342, 385, 380, 414, 229, 519, 139, 508,
            ],
            4 => &[38, 145, 485, 143, 342, 385, 380, 414, 229, 747, 519, 139],
            _ => return Err("sims_mts_browse"),
        };
        if !categories.contains(&self.category)
            || ![0, 3, 7].contains(&self.sort)
            || self.query.chars().count() > 160
            || self.query.chars().any(char::is_control)
            || self.page == 0
            || self.page > 1000
        {
            return Err("sims_mts_browse");
        }
        Ok(self)
    }
    fn url(&self) -> String {
        let mut url = reqwest::Url::parse(&format!(
            "https://modthesims.info/downloads/ts{}/{}/page/{}/",
            self.game, self.category, self.page
        ))
        .expect("fixed MTS URL");
        url.query_pairs_mut()
            .append_pair("showType", "1")
            .append_pair("csort", &self.sort.to_string())
            .append_pair("tag", &self.query);
        url.into()
    }
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub metrics: mts::metrics::Metrics,
    pub picked: bool,
    pub game: u8,
    pub id: String,
    pub title: String,
    pub creator: String,
    pub image: String,
    pub page: String,
    pub description: String,
    pub category: String,
    pub updated: String,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub query: Query,
    pub projects: Vec<Project>,
    pub next: bool,
    pub total: Option<u64>,
    pub url: String,
    pub observed_at: u64,
    pub stale: bool,
}
fn class_body<'a>(html: &'a str, class: &str) -> Option<&'a str> {
    re(r"(?is)<(p|span)\b[^>]*>")
        .find_iter(html)
        .find_map(|tag| {
            if !attr(tag.as_str(), "class")?
                .split_whitespace()
                .any(|c| c == class)
            {
                return None;
            }
            let end_tag = if tag.as_str()[1..].to_ascii_lowercase().starts_with('p') {
                "</p>"
            } else {
                "</span>"
            };
            let rest = &html[tag.end()..];
            let end = rest.find(end_tag)?;
            Some(&rest[..end])
        })
}
fn image(html: &str) -> String {
    // Animated creator covers omit `featuredimage`; keep their original media
    // scoped to the thumbnail wrapper so pack badges cannot become cover art.
    let wrapper = re(r"(?is)<div\b[^>]*>")
        .find_iter(html)
        .find(|tag| {
            attr(tag.as_str(), "class")
                .is_some_and(|value| value.split_whitespace().any(|c| c == "thumbnailwrapper"))
        })
        .and_then(|tag| html[tag.end()..].split_once("</div>").map(|(body, _)| body));
    let source = wrapper.unwrap_or(html);
    re(r"(?is)<img\b[^>]*>")
        .find_iter(source)
        .filter(|tag| {
            wrapper.is_some()
                || attr(tag.as_str(), "class")
                    .is_some_and(|c| c.split_whitespace().any(|c| c == "featuredimage"))
        })
        .find_map(|tag| {
            let value = attr(tag.as_str(), "src")?;
            let value = if value.starts_with("//") {
                format!("https:{value}")
            } else {
                value
            };
            let url = mts::url(&value)?;
            (value.len() <= 2048
                && matches!(
                    url.host_str(),
                    Some("thumbs.modthesims2.com" | "thumbs2.modthesims2.com")
                )
                && url.path().starts_with("/img/"))
            .then_some(value)
        })
        .unwrap_or_default()
}
fn project(html: &str, game: u8) -> Result<Project> {
    let title = class_body(html, "downloadtitle").ok_or("sims_creator_format")?;
    let a = re(r"(?is)<a\b[^>]*>")
        .find(title)
        .ok_or("sims_creator_format")?;
    let href = attr(a.as_str(), "href").ok_or("sims_creator_format")?;
    let url = reqwest::Url::parse("https://modthesims.info")
        .unwrap()
        .join(&href)
        .map_err(|_| "sims_creator_format")?;
    let id = mts::project(url.as_str())?;
    let title_body = &title[a.end()..];
    let title = plain(title_body.split("</a>").next().unwrap_or(title_body), 200);
    let creator = plain(
        class_body(html, "downloadcreatorname").ok_or("sims_creator_format")?,
        120,
    );
    if title.is_empty() || creator.is_empty() {
        return Err("sims_creator_format");
    }
    // Each card must explicitly identify its game, not merely sit beside global
    // navigation containing links to all three games.
    if !re(r"(?is)<img\b[^>]*>")
        .find_iter(html)
        .any(|tag| attr(tag.as_str(), "title").as_deref() == Some(&format!("Sims {game}")))
    {
        return Err("sims_creator_format");
    }
    let preview = re(r#"(?is)<a\b[^>]*>\s*more\.{3}\s*</a>"#)
        .replace_all(class_body(html, "downloadPreview").unwrap_or(""), "");
    let description = re(r"^:!:\s*").replace(&plain(&preview, 280), "").into_owned();
    let byline = plain(class_body(html, "downloadcreator").unwrap_or(""), 260);
    let updated = re(r"(?i)\bupdated\s+(.+)$").captures(&byline)
        .map(|capture| capture[1].to_owned()).unwrap_or_default();
    Ok(Project {
        metrics: mts::metrics::card(html),
        picked: re(r"(?is)<(?:i|svg)\b[^>]*>").find_iter(html).any(|tag| matches!(attr(tag.as_str(), "title").as_deref(), Some("Picked upload!" | "Featured upload!"))),
        game,
        page: format!("https://modthesims.info/d/{id}/"),
        id,
        title,
        creator,
        image: image(html),
        description,
        updated,
        category: plain(class_body(html, "forumtitles").unwrap_or(""), 160),
    })
}
fn parse(html: &str, query: Query) -> Result<Page> {
    if !class_body(html, "headingtitle")
        .is_some_and(|s| plain(s, 60) == format!("Sims {}", query.game))
    {
        return Err("sims_creator_format");
    }
    let total = re(r"\(([0-9,]+) found\)")
        .captures(html)
        .and_then(|c| c[1].replace(',', "").parse::<u64>().ok())
        .or_else(|| {
            // Empty searches omit the count. Require the provider's explicit
            // empty-result message, not just a page without download cards.
            re(r#"(?is)<div\b[^>]*class=["']message-body["'][^>]*>\s*No downloads found\.\s+Try another category, filter or search\.\s*</div>"#)
                .is_match(html).then_some(0)
        });
    let mut projects = Vec::new();
    let mut ids = BTreeSet::new();
    for tag in re(r"(?is)<li\b[^>]*>").find_iter(html) {
        if !attr(tag.as_str(), "class")
            .is_some_and(|s| s.split_whitespace().any(|c| c == "smol-card-component"))
        {
            continue;
        }
        let rest = &html[tag.end()..];
        let end = rest.find("</li>").ok_or("sims_creator_format")?;
        let item = project(&rest[..end], query.game)?;
        if !ids.insert(item.id.clone()) || projects.len() >= 40 {
            return Err("sims_creator_format");
        }
        projects.push(item);
    }
    if (projects.is_empty() && total != Some(0)) || (!projects.is_empty() && total == Some(0)) {
        return Err("sims_creator_format");
    }
    let next = re(r"(?is)<a\b[^>]*>").find_iter(html).any(|tag| {
        attr(tag.as_str(), "title").is_some_and(|s| s.starts_with("Next Page - Results "))
    });
    Ok(Page {
        url: query.url(),
        query,
        projects,
        next,
        total,
        observed_at: files::now(),
        stale: false,
    })
}
type Cached = VecDeque<(Query, Instant, Page)>;
pub async fn browse(
    profile: String,
    operation: String,
    query: Query,
    refresh: bool,
    emit: impl Fn(store::progress::Progress),
) -> Result<Page> {
    let query = query.checked()?;
    let mut work = store::progress::Work::start(&profile, &operation, &emit)?;
    work.reviewing()?;
    let check = work.cancellation_check();
    static CACHE: OnceLock<tokio::sync::Mutex<Cached>> = OnceLock::new();
    let mut cache = catalog::cancelable(
        &check,
        CACHE
            .get_or_init(|| tokio::sync::Mutex::new(VecDeque::new()))
            .lock(),
    )
    .await?;
    let previous = cache.iter().find(|(q, _, _)| q == &query).cloned();
    if let Some((_, at, value)) = &previous {
        if at.elapsed() < Duration::from_secs(if refresh { 30 } else { 900 }) {
            check()?;
            return Ok(value.clone());
        }
    }
    let result = async {
        let bytes = mts::page_bytes(&query.url(), &check, &mut |waiting| {
            if waiting {
                work.waiting()
            } else {
                work.reviewing()
            }
        })
        .await?;
        parse(
            std::str::from_utf8(&bytes).map_err(|_| "sims_creator_format")?,
            query.clone(),
        )
    }
    .await;
    check()?;
    match result {
        Ok(value) => {
            cache.retain(|(q, _, _)| q != &query);
            if cache.len() >= 12 {
                cache.pop_front();
            }
            cache.push_back((query, Instant::now(), value.clone()));
            Ok(value)
        }
        Err(e) => {
            if let Some((_, _, mut value)) = previous {
                value.stale = true;
                Ok(value)
            } else {
                Err(e)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn query() -> Query {
        Query {
            game: 4,
            category: 38,
            sort: 3,
            query: String::new(),
            page: 1,
        }
    }
    #[test]
    fn public_browse_uses_exact_sims4_cards_and_original_art() {
        let Ok(path) = std::env::var("HARBOR_TEST_MTS_BROWSE") else {
            return;
        };
        let html = std::fs::read_to_string(path).unwrap();
        let result = parse(&html, query()).unwrap();
        assert_eq!(result.projects.len(), 20);
        assert!(result.next);
        assert!(result.total.unwrap() > 10000);
        assert!(result.projects.iter().all(|p| p
            .image
            .starts_with("https://thumbs2.modthesims2.com/img/")
            && !p.title.is_empty()
            && !p.creator.is_empty()));
        assert!(parse(&html.replace(">Sims 4 <i", ">Sims 3 <i"), query()).is_err());
    }
    #[test]
    fn query_bounds_and_host_validation() {
        let mut q = query();
        q.query = "hair & furniture".into();
        assert!(q
            .clone()
            .checked()
            .unwrap()
            .url()
            .contains("tag=hair+%26+furniture"));
        q.category = 1;
        assert!(q.checked().is_err());
        let mut q = query();
        q.page = 0;
        assert!(q.checked().is_err());
        assert!(
            image("<img class='featuredimage' src='https://evil.example/img/a.png'>").is_empty()
        );
        assert!(parse(
            "<span class='headingtitle'>Sims 4</span>provider unavailable",
            query()
        )
        .is_err());
        assert!(
            parse("<span class='headingtitle'>Sims 4</span>(0 found)", query())
                .unwrap()
                .projects
                .is_empty()
        );
    }
    #[test]
    fn actual_empty_search_is_distinct_from_a_broken_page() {
        let Ok(path) = std::env::var("HARBOR_TEST_MTS_EMPTY") else {
            return;
        };
        let html = std::fs::read_to_string(path).unwrap();
        let page = parse(&html, query()).unwrap();
        assert_eq!(page.total, Some(0));
        assert!(page.projects.is_empty());
        assert!(!page.next);
        assert!(parse(
            &html.replace("No downloads found.", "Provider unavailable."),
            query()
        )
        .is_err());
    }
    #[test]
    fn games_validate_their_own_filters_and_preserve_legacy_queries() {
        let old: Query =
            serde_json::from_str(r#"{"category":38,"sort":3,"query":"","page":1}"#).unwrap();
        assert_eq!(old.game, 4);
        for (game, category) in [(2, 415), (3, 588), (3, 649), (4, 747)] {
            let q = Query {
                game,
                category,
                ..query()
            }
            .checked()
            .unwrap();
            assert!(q.url().contains(&format!("/ts{game}/{category}/")));
        }
        assert!(Query {
            game: 2,
            category: 747,
            ..query()
        }
        .checked()
        .is_err());
        assert!(Query {
            game: 3,
            category: 485,
            ..query()
        }
        .checked()
        .is_err());
        assert!(Query { game: 1, ..query() }.checked().is_err());
    }
    #[test]
    #[ignore = "Requires original provider HTML via HARBOR_SIMS_GAME_FIXTURES"]
    fn original_sims_catalogs_do_not_mix_games() {
        let root = std::path::PathBuf::from(std::env::var("HARBOR_SIMS_GAME_FIXTURES").unwrap());
        for game in [2, 3] {
            let html =
                std::fs::read_to_string(root.join(format!("mts-sims{game}-browse.html"))).unwrap();
            let page = parse(&html, Query { game, ..query() }).unwrap();
            assert!(page.projects.len() >= 10);
            assert!(page
                .projects
                .iter()
                .all(|p| p.game == game && !p.image.is_empty()));
            assert!(page.total.unwrap() > 1000);
            assert!(parse(&html, query()).is_err());
            let mixed = html.replacen(&format!("title=\"Sims {game}\""), "title=\"Sims 4\"", 1);
            assert!(parse(&mixed, Query { game, ..query() }).is_err());
        }
    }
}
