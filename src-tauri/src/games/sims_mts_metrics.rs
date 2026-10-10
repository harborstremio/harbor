//! Provider-labelled project counts only. Missing metrics stay absent.
use super::{attr, plain, re};
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Metrics {
    // Provider-rounded labels are useful, but must not become invented exact counts.
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub rounded: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub downloads: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub favorites: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comments: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thanks: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub views: Option<u64>,
}
fn count(value: &str) -> Option<u64> {
    let compact = value.replace(',', "");
    if compact.is_empty() || compact.len() > 12 || !compact.bytes().all(|c| c.is_ascii_digit()) {
        return None;
    }
    compact.parse().ok()
}
pub fn card(html: &str) -> Metrics {
    let mut metrics = Metrics::default();
    for tag in re(r"(?is)<(i|svg)\b([^>]*)>").captures_iter(html).take(100) {
        let key = attr(&tag[2], "title").unwrap_or_default();
        let closing = format!("</{}>", &tag[1].to_ascii_lowercase());
        let rest = &html[tag.get(0).unwrap().end()..];
        let Some((_, tail)) = rest.split_once(&closing) else {
            continue;
        };
        let text = tail.split('<').next().unwrap_or("").trim();
        let (name, value) = match key.as_str() {
            "Comments" => ("comments", &mut metrics.comments),
            "Favourited" => ("favorites", &mut metrics.favorites),
            "Downloads" | "Downloaded" => ("downloads", &mut metrics.downloads),
            "Views" => ("views", &mut metrics.views),
            _ => continue,
        };
        *value = count(text);
        if value.is_none() && re(r"^[0-9]{1,4}(?:\.[0-9]{1,2})?[kKmMbB]$").is_match(text) {
            metrics.rounded.insert(name.into(), text.into());
        }
    }
    metrics
}
pub fn detail(html: &str) -> Metrics {
    let section = re(r"(?is)<div\b([^>]*)>")
        .captures_iter(html)
        .find_map(|tag| {
            if attr(&tag[1], "id").as_deref() != Some("statistics_bar") {
                return None;
            }
            html[tag.get(0).unwrap().end()..]
                .split_once("</div>")
                .map(|(body, _)| body)
        })
        .unwrap_or("");
    let text = plain(section, 1000);
    let read = |pattern: &str| {
        re(pattern)
            .captures(&text)
            .and_then(|value| count(&value[1]))
    };
    Metrics {
        rounded: BTreeMap::new(),
        downloads: read(r"Downloaded\s+([0-9,]+)\s+times"),
        favorites: read(r"([0-9,]+)\s+Favourited"),
        thanks: read(r"([0-9,]+)\s+Thanks"),
        views: read(r"([0-9,]+)\s+Views"),
        comments: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_metric_meaning_and_missing_values() {
        let values = card(
            r#"<i title="Comments"></i> 13 <i title="Views"></i> 21.8k <i title="Favourited"></i> 98"#,
        );
        assert_eq!(values.comments, Some(13));
        assert_eq!(values.favorites, Some(98));
        assert_eq!(values.views, None);
        assert_eq!(values.rounded.get("views").map(String::as_str), Some("21.8k"));
        assert_eq!(values.downloads, None);
        assert_eq!(card(r#"<i title="Comments"></i> 0"#).comments, Some(0));
        assert_eq!(card(r#"<i title="Comments"></i> -3"#).comments, None);
    }
    #[test]
    fn browse_downloaded_counts_preserve_provider_precision() {
        let values = card(r#"<i title="Downloaded"></i> 6.2m <i title="Comments"></i> 1.2k <i title="Favourited"></i> 2.2k"#);
        assert_eq!(values.downloads, None);
        assert_eq!(values.rounded.get("downloads").map(String::as_str), Some("6.2m"));
        assert_eq!(values.rounded.get("comments").map(String::as_str), Some("1.2k"));
        assert_eq!(card(r#"<i title="Downloaded"></i> 12,456"#).downloads, Some(12456));
        assert!(card(r#"<i title="Downloaded"></i> unavailable"#).rounded.is_empty());
        assert!(card(r#"<i title="Downloaded"></i> -1.2m"#).rounded.is_empty());
    }
    #[test]
    fn detail_uses_only_project_statistics_not_recommendations() {
        let html = r#"<div id="statistics_bar">Downloaded <span>14,805</span> times <span>267</span> Thanks <span>84</span> Favourited <span>21,878</span> Views</div><aside>Downloaded 999999 times</aside>"#;
        let values = detail(html);
        assert_eq!(values.downloads, Some(14805));
        assert_eq!(values.thanks, Some(267));
        assert_eq!(values.favorites, Some(84));
        assert_eq!(values.views, Some(21878));
        assert_eq!(detail("Downloaded 123 times").downloads, None);
    }
}
