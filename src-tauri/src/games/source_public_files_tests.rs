use super::*;
use serde_json::json;
use std::{io::{Read, Write}, net::TcpListener, sync::{Arc, Mutex}};

fn file(id: &str) -> Value { json!({"success":true,"id":id,"name":"Community project.zip","size":1024,"hash_sha256":"a".repeat(64),"availability":"","can_download":true,"download_speed_limit":500000}) }
fn fixture(replies: Vec<(u16, Value)>) -> (Api, Arc<Mutex<Vec<String>>>, std::thread::JoinHandle<()>) {
    let _=rustls::crypto::ring::default_provider().install_default();
    let listener=TcpListener::bind("127.0.0.1:0").unwrap(); let address=listener.local_addr().unwrap();
    listener.set_nonblocking(true).unwrap();
    let calls=Arc::new(Mutex::new(Vec::new())); let capture=calls.clone();
    let worker=std::thread::spawn(move||{
        for (status,body) in replies {
            let deadline=std::time::Instant::now()+Duration::from_secs(5);
            let mut socket=loop { match listener.accept() { Ok((socket,_))=>break socket, Err(error) if error.kind()==std::io::ErrorKind::WouldBlock&&std::time::Instant::now()<deadline=>std::thread::sleep(Duration::from_millis(5)), Err(error)=>panic!("missing fixture request: {error}") } };
            socket.set_nonblocking(false).unwrap();
            socket.set_read_timeout(Some(Duration::from_secs(5))).unwrap(); let mut bytes=Vec::new();
            while !bytes.windows(4).any(|value|value==b"\r\n\r\n") { let mut part=[0;1024]; let size=socket.read(&mut part).unwrap(); if size==0 {break} bytes.extend_from_slice(&part[..size]); }
            capture.lock().unwrap().push(String::from_utf8(bytes).unwrap()); let body=body.to_string();
            write!(socket,"HTTP/1.1 {status} Fixture\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
        }
    });
    let mut api=Api::new().unwrap();api.base=format!("http://{address}");(api,calls,worker)
}

#[test]
fn accepts_only_canonical_public_file_and_list_routes() {
    for url in ["https://pixeldrain.com/u/AbC123", "http://www.pixeldrain.com/api/file/AbC123/info", "https://pixeldrain.com/api/file/AbC123?download"] { let value=target(url).unwrap();assert_eq!(value.id,"AbC123");assert!(!value.list); }
    let list=target("https://pixeldrain.com/l/ListID#item=62").unwrap();assert!(list.list);assert_eq!(list.selected,Some(62));
    for url in ["https://pixeldrain.com.evil/u/abc", "https://evil/u/abc", "https://user:pass@pixeldrain.com/u/abc", "https://pixeldrain.com:8443/u/abc", "file:///u/abc", "https://pixeldrain.com/api/user/files", "https://pixeldrain.com/u/a%2Fb", "https://pixeldrain.com/u/ab\ncd", "https://pixeldrain.com/u/", "https://pixeldrain.com/d/secret"] {assert!(target(url).is_err(),"{url}")}
    assert!(target(&format!("https://pixeldrain.com/u/{}","a".repeat(65))).is_err());
}
#[test]
fn file_facts_are_exact_bounded_and_never_turn_restrictions_into_available() {
    let value=parse_file(&file("ID")).unwrap();assert_eq!(value.bytes,Some(1024));assert_eq!(value.sha256.as_deref(),Some("a".repeat(64).as_str()));assert_eq!(value.state,"available");
    for (code,state) in [("file_rate_limited_captcha_required","review"),("virus_detected_captcha_required","restricted"),("transfer_limit_exceeded","limited"),("unavailable_for_legal_reasons","restricted"),("not_found","missing"),("unknown_future_limit","review")] {let mut v=file("ID");v["availability"]=json!(code);assert_eq!(parse_file(&v).unwrap().state,state)}
    let mut v=file("ID");v["abuse_type"]=json!("malware");assert_eq!(parse_file(&v).unwrap().state,"restricted");
    v["abuse_type"]=json!("");v["can_download"]=json!(false);assert_eq!(parse_file(&v).unwrap().state,"review");v.as_object_mut().unwrap().remove("can_download");assert_eq!(parse_file(&v).unwrap().state,"unknown");
    for (key,bad) in [("id",json!("../escape")),("name",json!("..")),("name",json!("secret\nname")),("size",json!(-1)),("hash_sha256",json!("invalid"))] {let mut v=file("ID");v[key]=bad;assert!(parse_file(&v).is_err())}
}
#[tokio::test]
async fn list_review_retains_order_and_selected_member_beyond_the_first_page() {
    let files=(0..80).map(|n|{let mut v=file(&format!("file{n}"));v["detail_href"]=json!("https://evil.invalid/private");v}).collect::<Vec<_>>();
    let (api,calls,worker)=fixture(vec![(200,json!({"success":true,"id":"ListID","title":"Community files","file_count":80,"files":files}))]);
    let result=api.review(&target("https://pixeldrain.com/l/ListID#item=62").unwrap()).await.unwrap();assert_eq!(result.files.len(),80);assert_eq!(result.selected_id.as_deref(),Some("file62"));assert_eq!(result.files[79].id,"file79");
    worker.join().unwrap();let calls=calls.lock().unwrap();assert_eq!(calls.len(),1);assert!(calls[0].starts_with("GET /list/ListID "));assert!(!calls[0].contains("Authorization"));assert!(!calls[0].contains("evil"));
}
#[tokio::test]
async fn selected_download_rechecks_metadata_and_endpoint_without_following_provider_links() {
    let mut fresh=file("FileID");fresh["name"]=json!("Projects/Real 日本.zip");fresh["hash_sha256"]=json!("b".repeat(64));
    let (api,calls,worker)=fixture(vec![(200,json!({"success":true,"id":"ListID","title":"Projects","file_count":1,"files":[file("FileID")]})),(200,fresh),(206,json!("first byte"))]);
    let result=api.prepare(&target("https://pixeldrain.com/l/ListID").unwrap(),"FileID").await.unwrap();assert_eq!(result.name,"Real 日本.zip");assert_eq!(result.expected_bytes,Some(1024));assert_eq!(result.expected_sha256,Some("b".repeat(64)));assert_eq!(result.url,"https://pixeldrain.com/api/file/FileID?download");
    worker.join().unwrap();let calls=calls.lock().unwrap();assert_eq!(calls.len(),3);assert!(calls[1].starts_with("GET /file/FileID/info "));assert!(calls[2].starts_with("GET /file/FileID?download "));assert!(calls[2].to_ascii_lowercase().contains("range: bytes=0-0"));assert!(calls.iter().all(|v|!v.to_ascii_lowercase().contains("referer:")&&!v.to_ascii_lowercase().contains("authorization:")));
}
#[tokio::test]
async fn unavailable_files_never_probe_payload_and_removed_members_are_not_substituted() {
    for (field,value,expected) in [("availability",json!("file_rate_limited_captcha_required"),"public_review"),("abuse_type",json!("malware"),"public_restricted"),("availability",json!("download_limit_exceeded"),"public_rate_limit")] {
        let mut v=file("FileID");v[field]=value;let(api,calls,worker)=fixture(vec![(200,v)]);assert_eq!(api.prepare(&target("https://pixeldrain.com/u/FileID").unwrap(),"FileID").await.unwrap_err(),expected);worker.join().unwrap();assert_eq!(calls.lock().unwrap().len(),1);
    }
    let(api,_,worker)=fixture(vec![(200,json!({"success":true,"id":"ListID","title":"List","files":[file("OtherID")]}))]);assert_eq!(api.prepare(&target("https://pixeldrain.com/l/ListID").unwrap(),"FileID").await.unwrap_err(),"public_missing");worker.join().unwrap();
}
#[tokio::test]
async fn errors_and_identity_changes_remain_actionable_without_echoing_provider_payloads() {
    for (status,code,expected) in [(403,"file_rate_limited_captcha_required","public_review"),(451,"unavailable_for_legal_reasons","public_restricted"),(429,"ip_rate_limit_reached","public_rate_limit"),(404,"not_found","public_missing")] {
        let(api,_,worker)=fixture(vec![(status,json!({"success":false,"value":code,"message":"private user details"}))]);assert_eq!(api.info("FileID").await.unwrap_err(),expected);worker.join().unwrap();
    }
    let(api,_,worker)=fixture(vec![(200,file("OtherID"))]);assert_eq!(api.info("FileID").await.unwrap_err(),"public_metadata");worker.join().unwrap();
    let(api,_,worker)=fixture(vec![(200,file("FileID")),(403,json!({"success":false,"value":"hotlink_detected"}))]);assert_eq!(api.prepare(&target("https://pixeldrain.com/u/FileID").unwrap(),"FileID").await.unwrap_err(),"public_review");worker.join().unwrap();
    let(api,_,worker)=fixture(vec![(200,file("FileID")),(403,json!({"success":false,"value":"virus_detected_captcha_required","message":"private"}))]);assert_eq!(api.prepare(&target("https://pixeldrain.com/u/FileID").unwrap(),"FileID").await.unwrap_err(),"public_restricted");worker.join().unwrap();
}

#[tokio::test]
#[ignore = "explicit read-only public metadata acceptance; never downloads a payload"]
async fn live_public_metadata_contract() {
    let url=std::env::var("HARBOR_PIXELDRAIN_TEST_URL").expect("explicit public file/list URL");
    let result=review(Request {url, file:String::new()}).await.unwrap();
    assert!(!result.files.is_empty());assert!(result.files.iter().all(|file|valid_id(&file.id)&&!file.name.is_empty()));
    println!("public metadata accepted: {} files; no payload requested",result.files.len());
}
