use super::*;
fn item(title: &str, href: &str) -> String {
    format!(
        r#"<li class="autolink ccLink"><a href="{href}">{title}</a> by <span class="ccAuthor">Jo &amp; Co</span></li>"#
    )
}
fn included(items: &str) -> String {
    format!(
        r#"<section id="scroll_ccincluded"><p>The following custom content is <em>included</em> in the downloadable files:<ol>{items}</ol></section>"#
    )
}
#[test]
fn declarations_do_not_merge_distinct_items_sharing_a_page() {
    let source = included(
        &(item(
            "Left shoulder",
            "https://modthesims.info/d/613257/name.html",
        ) + &item(
            "Right shoulder",
            "https://modthesims.info/d/613257/name.html",
        )),
    );
    let value = read(&source);
    assert!(value.listed && !value.partial);
    assert_eq!(value.items.len(), 2);
    assert_eq!(value.items[0].project.as_deref(), Some("613257"));
    assert_eq!(
        value.items[0].page.as_deref(),
        Some("https://modthesims.info/d/613257/")
    );
    assert_eq!(value.items[0].creator, "Jo & Co");
    assert_eq!(value.items[0].included, Some(true));
    assert_ne!(value.items[0].title, value.items[1].title);
}
#[test]
fn declaration_labels_require_explicit_provider_text_and_stay_scoped() {
    let included = included(&item("Included", "https://example.com/item"));
    let separate = included
        .replace("scroll_ccincluded", "scroll_ccnotincluded")
        .replace("is <em>included</em>", "is <em>not included</em>");
    let unknown = included.replace(
        "is <em>included</em> in the downloadable files",
        "may be included in some files",
    );
    let value = read(
        &(included
            + &separate
            + &unknown
            + &item("Unrelated recommendation", "https://example.com/ad")),
    );
    assert_eq!(
        value.items.iter().map(|v| v.included).collect::<Vec<_>>(),
        [Some(true), Some(false), None]
    );
    assert_eq!(value.items.len(), 3);
    assert!(!value.partial);
    assert!(!read("<p>No structured section</p>").listed);
}
#[test]
fn links_allow_only_public_web_navigation_and_exact_mts_identity() {
    for raw in [
        "javascript:alert(1)",
        "data:text/html,evil",
        "file:///C:/secret",
        "steam://run/1",
        "https://user:password@example.com/",
        "http://127.0.0.1/",
        "http://[::1]/",
        "https://localhost/",
        "http://printer.local/",
        "http://machine.localhost/",
        "https://example.com:444/",
        "bad url",
        "https://example.com/\nmalformed",
    ] {
        assert!(link(raw).is_none(), "{raw}");
    }
    assert_eq!(
        link("/d/613257/title.html").unwrap().1.as_deref(),
        Some("613257")
    );
    assert_eq!(
        link("http://modthesims.info/download.php?t=613257")
            .unwrap()
            .0,
        "https://modthesims.info/d/613257/"
    );
    assert_eq!(
        link("https://example.com/file?a=1&amp;b=2").unwrap().0,
        "https://example.com/file?a=1&b=2"
    );
    assert_eq!(
        link("https://modthesims.info.evil.test/d/613257/")
            .unwrap()
            .1,
        None
    );
    let values = read(&included(&item("Keep the name", "javascript:evil")));
    assert!(values.partial);
    assert_eq!(values.items[0].title, "Keep the name");
    assert!(values.items[0].page.is_none());
}
#[test]
fn markup_gaps_and_limits_remain_visible() {
    let row = item("A", "https://example.com/a");
    let value = read(&included(&row.repeat(257)));
    assert!(value.partial);
    assert_eq!(value.items.len(), 256);
    let value = read(&included("<li class='ccLink'>unrecognized structure</li>"));
    assert!(value.partial && value.items.is_empty());
    assert!(read("<section id='scroll_ccincluded'><ol>").partial);
    assert!(read(&included("")).partial);
    let value = read(&format!(
        "<!-- {} --><script>{}</script><style>{}</style>{}",
        included(&row),
        included(&row),
        included(&row),
        included(&row)
    ));
    assert_eq!(value.items.len(), 1);
    assert!(!value.partial);
    let title = "界".repeat(400);
    assert_eq!(
        read(&included(&item(&title, "https://example.com/a"))).items[0]
            .title
            .chars()
            .count(),
        240
    );
}
#[test]
#[ignore = "Requires original public creator HTML via HARBOR_SIMS_CC_FIXTURES"]
fn observed_creator_list_keeps_all_twenty_nine_items_and_duplicate_destinations() {
    let root = std::path::PathBuf::from(std::env::var("HARBOR_SIMS_CC_FIXTURES").unwrap());
    for file in ["../tray-images/echron.html", "mts-cc-current.html"] {
        let value = read(&std::fs::read_to_string(root.join(file)).unwrap());
        assert!(value.listed && !value.partial, "{file}");
        assert_eq!(value.items.len(), 29);
        assert!(value.items.iter().all(|v| v.included == Some(true)));
        assert_eq!(
            value
                .items
                .iter()
                .filter(|v| v.project.as_deref() == Some("614161"))
                .count(),
            2
        );
        assert_eq!(
            value.items.iter().filter(|v| v.project.is_some()).count(),
            4
        );
        assert_eq!(value.items[10].project.as_deref(), Some("613257"));
        assert_eq!(value.items[10].creator, "HFO");
    }
}
