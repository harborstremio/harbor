//! Author-note links are navigation, not dependency or inclusion declarations.
use super::{attr, link, plain, re, Item};
use serde::Serialize;
use std::collections::BTreeSet;

#[derive(Clone, Debug, Default, Serialize)]
pub struct Links {
    pub partial: bool,
    pub items: Vec<Item>,
}

pub(super) fn author_html(html: &str) -> Result<String, bool> {
    let mut from = None;
    let mut depth = 0usize;
    let mut body = None;
    for tag in re(r"(?is)<(/?)div\b([^>]*)>")
        .captures_iter(html)
        .take(8192)
    {
        let id = attr(&tag[2], "id");
        if let Some(start) = from {
            if tag[1].is_empty() {
                // A missing closing tag must not swallow Downloads/Comments.
                if id
                    .as_deref()
                    .is_some_and(|s| s.starts_with("actualcontent"))
                {
                    break;
                }
                depth += 1;
            } else {
                depth -= 1;
                if depth == 0 {
                    body = Some(&html[start..tag.get(0).unwrap().start()]);
                    break;
                }
            }
        } else if tag[1].is_empty()
            && id.as_deref() == Some("actualcontent1")
            && attr(&tag[2], "class")
                .is_some_and(|s| s.split_whitespace().any(|v| v == "description"))
        {
            from = Some(tag.get(0).unwrap().end());
            depth = 1;
        }
    }
    let Some(body) = body else {
        return Err(from.is_some());
    };
    if body.len() > 256 * 1024 {
        return Err(true);
    }
    // Exclude provider ad containers, even if a rendered page supplies anchors.
    let mut clean = String::new();
    let mut last = 0;
    let mut skip = 0usize;
    for tag in re(r"(?is)<(/?)div\b([^>]*)>").captures_iter(body) {
        let span = tag.get(0).unwrap();
        if skip > 0 {
            if tag[1].is_empty() {
                skip += 1;
            } else {
                skip -= 1;
            }
            if skip == 0 {
                last = span.end();
            }
        } else if tag[1].is_empty()
            && (attr(&tag[2], "id").is_some_and(|s| s.starts_with("adslot"))
                || attr(&tag[2], "class")
                    .is_some_and(|s| s.split_whitespace().any(|v| v == "adslot")))
        {
            clean.push_str(&body[last..span.start()]);
            skip = 1;
        }
    }
    if skip != 0 {
        return Err(true);
    }
    clean.push_str(&body[last..]);
    Ok(clean)
}

pub(super) fn read(html: &str) -> Links {
    let mut output = Links::default();
    let clean = match author_html(html) {
        Ok(value) => value,
        Err(partial) => {
            output.partial = partial;
            return output;
        }
    };
    let mut seen = BTreeSet::new();
    for (index, anchor) in re(r"(?is)<a\b([^>]*)>(.*?)</a>")
        .captures_iter(&clean)
        .take(1025)
        .enumerate()
    {
        if index == 1024 || output.items.len() >= 128 {
            output.partial = true;
            break;
        }
        let title = plain(&anchor[2], 240);
        let Some(raw) = attr(&anchor[1], "href") else {
            continue;
        };
        if title.is_empty() || raw.starts_with('#') {
            continue;
        }
        let resolved = link(&raw);
        if resolved.is_none() {
            output.partial = true;
        }
        let (page, project) = resolved.map(|(u, p)| (Some(u), p)).unwrap_or_default();
        if !seen.insert((title.clone(), page.clone())) {
            continue;
        }
        output.items.push(Item {
            title,
            creator: String::new(),
            page,
            project,
            included: None,
        });
    }
    output
}

#[cfg(test)]
#[path = "sims_mts_notes_tests.rs"]
mod tests;
