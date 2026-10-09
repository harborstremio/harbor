use super::*;
use super::super::tests::fixture;
use serde_json::json;

#[tokio::test]
async fn ad_prepare_posts_only_to_fixed_api_with_bearer_auth_and_keeps_real_filename() {
    let (api, calls, worker) = fixture("ad", vec![(200, json!({"status":"success","data":{
        "link":"http://download.test/file?token=signed","filename":"Projects/Game.part1.zip","filesize":1024,
        "streams":[{"link":"https://wrong.test/video"}]
    }}))]);
    let value = api.ad_prepare("https://host.test/file?id=one&part=2#fixture-key", "a&b").await.unwrap();
    assert_eq!(value.name, "Game.part1.zip"); assert_eq!(value.expected_bytes, Some(1024));
    assert_eq!(value.url.as_deref(), Some("http://download.test/file?token=signed")); assert!(value.delayed_id.is_none());
    worker.join().unwrap(); let calls = calls.lock().unwrap();
    assert!(calls[0].starts_with("POST /v4/link/unlock "));
    assert!(calls[0].to_lowercase().contains("authorization: bearer fixture-secret"));
    assert!(calls[0].contains("link=https%3A%2F%2Fhost.test%2Ffile%3Fid%3Done%26part%3D2%23fixture-key&password=a%26b"));
    assert!(!calls[0].lines().next().unwrap().contains("fixture-secret"));
}

#[tokio::test]
async fn ad_delayed_flow_never_unlocks_again_when_checking_status() {
    let (api, calls, worker) = fixture("ad", vec![
        (200,json!({"status":"success","data":{"filename":"Game.zip","filesize":0,"delayed":123}})),
        (200,json!({"status":"success","data":{"status":1,"time_left":45}})),
        (200,json!({"status":"success","data":{"status":2,"time_left":0,"link":"https://download.test/game"}})),
        (200,json!({"status":"success","data":{"status":3}})),
    ]);
    let value = api.ad_prepare("https://host.test/game", "").await.unwrap();
    assert_eq!(value.delayed_id.as_deref(),Some("123")); assert!(value.url.is_none()); assert!(value.expected_bytes.is_none());
    let waiting = api.ad_status("123").await.unwrap(); assert_eq!(waiting.status,"preparing"); assert_eq!(waiting.seconds,Some(45));
    let ready = api.ad_status("123").await.unwrap(); assert_eq!(ready.status,"ready"); assert_eq!(ready.url.as_deref(),Some("https://download.test/game"));
    assert_eq!(api.ad_status("123").await.unwrap().status,"failed");
    worker.join().unwrap(); let calls=calls.lock().unwrap();
    assert!(!calls[0].contains("password="));
    assert!(calls.iter().skip(1).all(|v|v.starts_with("POST /v4/link/delayed ")&&v.ends_with("id=123")&&!v.contains("host.test")));
}

#[test]
fn ad_rejects_ambiguous_or_unsafe_files_without_guessing_streams_or_downloads() {
    for value in [json!({}),json!({"filename":"Game.zip","streams":[{"link":"https://wrong.test/video"}]}),
        json!({"filename":"","link":"https://download.test/a"}),json!({"filename":"..","link":"https://download.test/a"}),
        json!({"filename":"Game\nzip","link":"https://download.test/a"}),json!({"filename":"Game.zip","link":"file:///local"}),
        json!({"filename":"Game.zip","link":"https://user:pass@download.test/a"}),
        json!({"filename":"Game.zip","delayed":0}),json!({"filename":"Game.zip","delayed":"../other"}),
        json!({"filename":"x".repeat(1001),"link":"https://download.test/a"})] { assert!(prepared(value).is_err()); }
    for id in ["","0","-1","../1","1.2","1\n","9007199254740992"] { assert!(delayed_id(id).is_err()); }
    for value in [json!({"status":2}),json!({"status":9}),json!({"status":2,"link":"javascript:alert(1)"})] { assert!(delayed(value).is_err()); }
    assert!(delayed(json!({"status":1,"time_left":-1})).unwrap().seconds.is_none());
}

#[tokio::test]
async fn ad_provider_errors_are_actionable_bounded_and_never_echo_payloads() {
    for (http, code, expected) in [(401,"AUTH_BLOCKED","cloud_auth_blocked"),(200,"AUTH_BAD_APIKEY","cloud_key"),
        (200,"LINK_PASS_PROTECTED","cloud_password"),(200,"LINK_HOST_NOT_SUPPORTED","cloud_unsupported"),
        (200,"LINK_DOWN","cloud_missing"),(200,"DELAYED_INVALID_ID","cloud_missing"),
        (200,"LINK_HOST_LIMIT_REACHED","cloud_quota"),(200,"LINK_TOO_MANY_DOWNLOADS","cloud_rate_limit"),
        (200,"unknown","cloud_service")] {
        let (api, _, worker)=fixture("ad",vec![(http,json!({"status":"error","error":{"code":code,"message":"private secret payload"}}))]);
        assert_eq!(api.ad_prepare("https://host.test/game","").await.unwrap_err(),expected);worker.join().unwrap();
    }
    for value in [json!({}),json!({"status":"success"}),json!({"data":{}}),json!({"status":"success","data":[]})] { assert!(envelope(value).is_err()); }
}

#[tokio::test]
async fn ad_does_not_advertise_unimplemented_account_file_commands() {
    let request=|| Request{provider:"ad".into(),key:"test".into(),parent:String::new(),page:0,file:String::new()};
    assert_eq!(super::super::list(request()).await.unwrap_err(),"cloud_provider");
    assert_eq!(super::super::resolve(request()).await.unwrap_err(),"cloud_provider");
}
