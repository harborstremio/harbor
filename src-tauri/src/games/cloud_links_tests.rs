use super::*;
use super::super::tests::fixture;
use serde_json::json;

#[tokio::test]
async fn source_links_use_fixed_authenticated_endpoints_and_preserve_every_file() {
    let (rd, requests, worker) = fixture("rd", vec![(200, json!([
        {"download":"https://cdn.test/one","filename":"Game.part1.rar","filesize":200},
        {"download":"https://cdn.test/two","filename":"Game.part2.rar","filesize":0}
    ]))]);
    let files = rd.resolve_link("https://host.test/file?id=a&part=2#fixture-key").await.unwrap();
    assert_eq!(files.len(), 2);
    assert_eq!(files[0].name, "Game.part1.rar");
    assert_eq!(files[0].expected_bytes, Some(200));
    assert_eq!(files[1].expected_bytes, None);
    worker.join().unwrap();
    let requests = requests.lock().unwrap();
    assert!(requests[0].starts_with("POST /unrestrict/link "));
    assert!(requests[0].contains("link=https%3A%2F%2Fhost.test%2Ffile%3Fid%3Da%26part%3D2%23fixture-key"));
    assert!(requests[0].to_ascii_lowercase().contains("authorization: bearer fixture-secret"));
    assert!(!requests[0].contains("remote=1"));
    assert!(!requests[0].lines().next().unwrap().contains("fixture-secret"));

    let (pm, requests, worker) = fixture("pm", vec![(200, json!({"status":"success","location":"https://wrong.test/legacy","content":[
        {"path":"Projects/Game.zip","size":456,"link":"https://cdn.test/archive","stream_link":"https://wrong.test/stream"},
        {"path":"Projects/readme.txt","size":12,"link":"https://cdn.test/readme"}
    ]}))]);
    let files = pm.resolve_link("http://host.test/project#part%2Fone").await.unwrap();
    assert_eq!(files.len(), 2);
    assert_eq!(files[0].name, "Game.zip");
    assert_eq!(files[0].url, "https://cdn.test/archive");
    assert_eq!(files[1].name, "readme.txt");
    worker.join().unwrap();
    let requests = requests.lock().unwrap();
    assert!(requests[0].starts_with("POST /transfer/directdl "));
    assert!(requests[0].contains("src=http%3A%2F%2Fhost.test%2Fproject%23part%252Fone"));
    assert!(!requests[0].contains("/transfer/create"));
}

#[test]
fn source_link_review_rejects_unsafe_links_bad_metadata_and_bounds() {
    for link in ["magnet:?xt=urn:btih:aaaa", "file:///private", "https://user:secret@host.test/", "javascript:alert(1)", "https://host.test/a\nb"] {
        assert_eq!(source_link(link).unwrap_err(), "cloud_link");
    }
    assert!(source_link(&format!("https://host.test/{}", "a".repeat(16384))).is_err());
    assert!(downloads(json!({"download":"http://cdn.test/file","filename":"Game.zip"}), "rd").is_err());
    assert!(downloads(json!({"download":"https://cdn.test/file","filename":""}), "rd").is_err());
    assert!(downloads(json!({"content":[{"path":"Game.zip","stream_link":"https://cdn.test/video"}]}), "pm").is_err());
    assert_eq!(downloads(json!({"content":[]}), "pm").unwrap_err(), "cloud_missing");
    assert_eq!(downloads(json!(vec![json!({});2001]), "rd").unwrap_err(), "cloud_limit");
    let entry=json!({"download":"https://cdn.test/file","filename":"Game.zip","filesize":123});
    assert_eq!(downloads(json!([entry.clone(),entry]), "rd").unwrap().len(),1);
}

#[tokio::test]
async fn source_link_errors_do_not_expose_secrets_or_invent_files() {
    for (status,body,expected) in [
        (401,json!({"error":"fixture-secret"}),"cloud_key"),
        (429,json!({}),"cloud_rate_limit"),
        (200,json!({"error":"private provider details","error_code":16}),"cloud_service"),
        (200,json!({"status":"error","message":"private provider details"}),"cloud_service"),
    ] {
        let (api,_,worker)=fixture("rd",vec![(status,body)]);
        assert_eq!(api.resolve_link("https://host.test/file").await.unwrap_err(),expected);
        worker.join().unwrap();
    }
    assert_eq!(resolve(LinkRequest{provider:"tb".into(),key:"key".into(),url:"https://host.test/file".into()}).await.unwrap_err(),"cloud_provider");
}
