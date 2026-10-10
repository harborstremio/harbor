use super::*;
fn body(value: &str) -> String {
    format!(r#"<div class="bulmatab description" id="actualcontent1">{value}</div>"#)
}
fn anchor(name: &str, url: &str) -> String {
    format!(r#"<a href="{url}">{name}</a>"#)
}
#[test]
fn only_author_note_links_survive_with_no_dependency_claims() {
    let inside = anchor(
        "White <b>Paneling</b>",
        "http://www.modthesims.info/download.php?t=573245",
    );
    let html = anchor("Navigation", "https://example.com/nav") + &body(&format!(
        "<div>{inside}</div><div id='adslot-test'><div>{}</div></div>{}<a href='#section'>Jump</a><a href='https://example.com/image'><img src='photo.jpg'></a>",
        anchor("Ad", "https://example.com/ad"), anchor("Guide", "https://example.com/guide?a=1&amp;b=2")))
        + &anchor("Download tab", "https://example.com/download");
    let result = read(&html);
    assert!(!result.partial);
    assert_eq!(result.items.len(), 2);
    assert_eq!(result.items[0].title, "White Paneling");
    assert_eq!(result.items[0].project.as_deref(), Some("573245"));
    assert_eq!(
        result.items[1].page.as_deref(),
        Some("https://example.com/guide?a=1&b=2")
    );
    assert!(result
        .items
        .iter()
        .all(|item| item.included.is_none() && item.creator.is_empty()));
}
#[test]
fn malformed_description_boundaries_never_include_another_tab() {
    let link = anchor("Wrong tab", "https://example.com/file");
    for html in [
        format!("<div id='actualcontent1' class='description'><div>{link}"),
        format!("<div id='actualcontent1' class='description'><div id='actualcontent3'>{link}</div></div>"),
    ] { let value = read(&html); assert!(value.partial && value.items.is_empty()); }
    assert!(read(&format!(
        "<div id='actualcontent2' class='description'>{link}</div>"
    ))
    .items
    .is_empty());
    assert!(read(&format!("<div id='actualcontent1'>{link}</div>"))
        .items
        .is_empty());
}
#[test]
fn invalid_urls_stay_nonclickable_and_limits_stay_visible() {
    let value = read(&body(&anchor("Broken link", "javascript:alert(1)")));
    assert!(value.partial);
    assert_eq!(value.items[0].title, "Broken link");
    assert!(value.items[0].page.is_none());
    let many = (0..129)
        .map(|n| anchor(&format!("Item{n}"), "https://example.com/a"))
        .collect::<String>();
    let value = read(&body(&many));
    assert!(value.partial);
    assert_eq!(value.items.len(), 128);
    let value = read(&body(&"<a href='#skip'>Skip</a>".repeat(1025)));
    assert!(value.partial && value.items.is_empty());
    assert!(read(&body(&"x".repeat(256 * 1024 + 1))).partial);
}
#[test]
fn structured_destinations_take_priority_and_inert_markup_is_not_read() {
    let declared = "<section id='scroll_ccincluded'><p>The following custom content is included in the downloadable files:<ol><li class='ccLink'><a href='/d/573245/'>Declared item</a></li></ol></section>";
    let description = body(
        &(anchor("Same source", "/d/573245/") + &anchor("Guide", "https://example.com/guide")),
    );
    let html = format!("{declared}{description}<script>{description}</script><!--{description}-->");
    let value = super::super::read(&html);
    assert_eq!(value.items.len(), 1);
    assert_eq!(value.notes.items.len(), 1);
    assert_eq!(value.notes.items[0].title, "Guide");
    let duplicate = body(&(anchor("A", "/d/573245/").repeat(2) + &anchor("B", "/d/573245/")));
    assert_eq!(read(&duplicate).items.len(), 2);
}
#[test]
#[ignore = "Requires original creator HTML via HARBOR_SIMS_CC_FIXTURES"]
fn original_mini_luxury_house_retains_all_four_creator_wall_links() {
    let root = std::path::PathBuf::from(std::env::var("HARBOR_SIMS_CC_FIXTURES").unwrap());
    let value =
        super::super::read(&std::fs::read_to_string(root.join("mts-mini-luxury.html")).unwrap());
    assert!(!value.listed && value.items.is_empty());
    assert!(!value.notes.partial);
    assert_eq!(
        value
            .notes
            .items
            .iter()
            .map(|i| i.project.as_deref())
            .collect::<Vec<_>>(),
        [
            Some("558495"),
            Some("573245"),
            Some("596269"),
            Some("582907")
        ]
    );
    assert!(value.notes.items.iter().all(|item| item.included.is_none()));
    assert_eq!(value.notes.items[1].title, "White Paneling + Paint Walls");
    let html = std::fs::read_to_string(root.join("mts-mini-luxury.html")).unwrap();
    let detail = super::super::super::parse(&html, "615928").unwrap();
    assert!(detail.body.contains("Lot Price (furnished): 32,556"));
    assert!(!detail.body.contains("Advertisement"));
    assert!(detail.gallery.len() >= 8 && detail.gallery[0].contains("MTS_Hagraven-"));
}

#[test]
fn full_creator_description_and_gallery_keep_provider_scope() {
    let html = body("<h2>A creator’s instructions</h2><p>Use the file for your game.</p><script>bad()</script><div id='adslot-test'><a href='https://example.com/ad'>Ad</a></div>") + "<div id='actualcontent3'>Download navigation</div>";
    let text = super::super::super::creator_body(&html);
    assert!(text.contains("A creator’s instructions\n\nUse the file for your game."));
    assert!(!text.contains("bad()") && !text.contains("Ad") && !text.contains("navigation"));
    let gallery = "<a class='downloadthumb' rel='carouselimages' href='https://thumbs.modthesims2.com/img/1/MTS_creator.png?cb=12'></a><a class='downloadthumb' rel='carouselimages' href='https://evil.example/img/1.png'></a><a href='https://thumbs.modthesims2.com/img/1/ad.png'></a>";
    assert_eq!(
        super::super::super::creator_gallery(gallery),
        vec!["https://thumbs.modthesims2.com/img/1/MTS_creator.png?cb=12"]
    );
}
