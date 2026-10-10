use super::*;
fn row(v: &str, patch: &str) -> String {
    format!(
        r#"<tr><td><a href="https://drive.google.com/uc?export=download&amp;id=abcdefghijklmnop123456">MC Command Center {v}</a></td><td>PC: {patch} / Mac: 1.128.90.1230</td><td><a href="https://deaderpool-mccc.com/changelogs/mccc{}.html">Changes</a></td></tr>"#,
        v.replace('.', "_")
    )
}
#[test]
fn official_release_rows_keep_versions_patch_and_source_linked() {
    let data = parse(
        &(row("2026.4.0", "1.127.41.1030")
            + &row("2026.10.0", "1.130.1.1030")
            + &row("2026.5.0", "1.128.90.1030")),
    )
    .unwrap();
    assert_eq!(data.releases.len(), 3);
    assert!(parse(&row("2026.5.0", "1.128.90.1030").replace("&amp;", "&")).is_ok());
    assert_eq!(data.releases[0].version, "2026.10.0");
    assert!(data.releases[0].changelog.ends_with("mccc2026_10_0.html"));
    assert!(!serde_json::to_string(&data)
        .unwrap()
        .contains("drive.google"));
    assert!(older_game("1.120.1.1020", &data.releases[0].game_patch).unwrap());
    assert!(!older_game("1.130.1.1030", &data.releases[0].game_patch).unwrap());
}
#[test]
fn changed_missing_ambiguous_or_unsafe_release_metadata_fails() {
    let good = row("2026.5.0", "1.128.90.1030");
    for html in [
        String::new(),
        good.clone() + &good,
        good.replace("drive.google.com", "drive.google.com.evil.test"),
        good.replace("https://drive", "http://drive"),
        good.replace("PC:", "mobile:"),
        good.replace("MC Command Center", "MC Woohoo"),
        good.replace("2026.5.0", "6.6.0(Legacy Edition Release)"),
    ] {
        assert!(parse(&html).is_err(), "{html}")
    }
    for href in [
        "https://drive.google.com/uc?export=download&id=abcdefghijklmnop123456&id=other",
        "https://user@drive.google.com/uc?export=download&id=abcdefghijklmnop123456",
        "https://drive.google.com/uc?export=download&id=short",
        "https://drive.google.com/uc?export=download&id=abcdefghijklmnop123456#hash",
    ] {
        assert!(download_id(href).is_none())
    }
}
#[test]
fn source_metadata_is_bounded_and_old_groups_remain_readable() {
    let old = serde_json::json!({"id":"c83d87c2-5f56-4c81-881a-dfb5d310f30c","title":"My mod","enabled":true,"files":[],"installedAt":1,"gameVersion":"1.128.90.1030"});
    let group: store::Group = serde_json::from_value(old).unwrap();
    assert!(group.source.is_none());
    let mut source = store::CreatorSource {
        provider: "mccc".into(),
        project: None,
        required_core: None,
        version: "2026.5.0".into(),
        game_patch: "1.128.90.1030".into(),
        archive_hash: "a".repeat(64),
    };
    assert!(source.validate().is_ok());
    source.provider = "unknown".into();
    assert!(source.validate().is_err());
}
#[test]
fn observed_creator_page_parses_when_supplied() {
    let Ok(path) = std::env::var("HARBOR_SIMS_CREATOR_PAGE") else {
        return;
    };
    let data = parse(&std::fs::read_to_string(path).unwrap()).unwrap();
    assert!(data.releases.len() >= 3);
    assert_eq!(data.releases[0].version, "2026.5.0");
}

#[test]
fn network_wait_and_size_limits_end_without_creating_an_import() {
    use std::sync::atomic::{AtomicBool, Ordering};
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    runtime.block_on(async {
  let cancel=AtomicBool::new(false);let check=||if cancel.load(Ordering::SeqCst){Err("sims_canceled")}else{Ok(())};
  let (result,())=tokio::join!(cancelable(&check,std::future::pending::<()>()),async{tokio::time::sleep(Duration::from_millis(20)).await;cancel.store(true,Ordering::SeqCst)});assert_eq!(result,Err("sims_canceled"));
  use tokio::io::{AsyncReadExt,AsyncWriteExt};
  for response in ["HTTP/1.1 200 OK\r\nContent-Length: 999999999\r\nConnection: close\r\n\r\n", "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\na\r\n0123456789\r\n0\r\n\r\n"] {
   let server=tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();let url=format!("http://{}/",server.local_addr().unwrap());let task=tokio::spawn(async move{let(mut stream,_)=server.accept().await.unwrap();let mut req=[0;1024];let _=stream.read(&mut req).await;let _=stream.write_all(response.as_bytes()).await;});
   assert_eq!(body(&client(None).unwrap(),&url,5,&||Ok(()),|_,_|Ok(())).await,Err("sims_limit"));task.await.unwrap();
  }
 });
}
