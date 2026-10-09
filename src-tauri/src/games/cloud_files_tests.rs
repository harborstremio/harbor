use super::*;
use serde_json::json;
use std::{
    io::{Read, Write},
    net::TcpListener,
    sync::{Arc, Mutex},
};

pub(super) fn fixture(
    provider: &str,
    replies: Vec<(u16, Value)>,
) -> (Api, Arc<Mutex<Vec<String>>>, std::thread::JoinHandle<()>) {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let requests = Arc::new(Mutex::new(Vec::new()));
    let capture = requests.clone();
    let worker = std::thread::spawn(move || {
        for (status, body) in replies {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut bytes = Vec::new();
            loop {
                let mut part = [0u8; 1024];
                let n = socket.read(&mut part).unwrap();
                if n == 0 {
                    break;
                }
                bytes.extend_from_slice(&part[..n]);
                if let Some(end) = bytes.windows(4).position(|v| v == b"\r\n\r\n") {
                    let head = String::from_utf8_lossy(&bytes[..end]).to_ascii_lowercase();
                    let length = head
                        .lines()
                        .find_map(|v| v.strip_prefix("content-length: "))
                        .and_then(|v| v.parse::<usize>().ok())
                        .unwrap_or(0);
                    if bytes.len() >= end + 4 + length {
                        break;
                    }
                }
            }
            capture
                .lock()
                .unwrap()
                .push(String::from_utf8(bytes).unwrap());
            let body = body.to_string();
            write!(socket,"HTTP/1.1 {status} Fixture\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
        }
    });
    let request = Request {
        provider: provider.into(),
        key: "fixture-secret".into(),
        parent: String::new(),
        page: 0,
        file: String::new(),
    };
    let mut api = Api::new(&request).unwrap();
    api.base = format!("http://{address}");
    (api, requests, worker)
}

#[tokio::test]
async fn real_debrid_preserves_split_links_and_resolves_actual_archive_name() {
    let info = json!({"status":"downloaded","filename":"Game","files":[{"path":"/game.bin","bytes":500,"selected":1}],"links":["https://rd.test/part-one","https://rd.test/part-two"]});
    let (api, requests, worker) = fixture(
        "rd",
        vec![
            (
                200,
                json!([{"id":"ABC","filename":"Game","status":"downloaded","bytes":500}]),
            ),
            (200, info.clone()),
            (200, info),
            (
                200,
                json!({"download":"https://cdn.test/opaque","filename":"Game.part02.rar","filesize":250}),
            ),
        ],
    );
    assert_eq!(api.list("", 2).await.unwrap().entries[0].kind, "torrent");
    let page = api.list("ABC", 0).await.unwrap();
    assert_eq!(page.entries.len(), 2);
    assert!(page.entries[1].name.is_empty());
    assert_eq!(page.entries[1].bytes, None);
    let result = api.resolve("ABC", "link:1").await.unwrap();
    assert_eq!(result.name, "Game.part02.rar");
    assert_eq!(result.expected_bytes, Some(250));
    worker.join().unwrap();
    let requests = requests.lock().unwrap();
    assert!(requests[0].starts_with("GET /torrents?limit=100&page=3 "));
    assert!(requests[3].starts_with("POST /unrestrict/link "));
    assert!(requests[3].contains("link=https%3A%2F%2Frd.test%2Fpart-two"));
    for r in requests.iter() {
        assert!(r
            .to_ascii_lowercase()
            .contains("authorization: bearer fixture-secret"));
        assert!(!r.lines().next().unwrap().contains("fixture-secret"));
        assert!(!r.starts_with("DELETE"));
    }
}

#[tokio::test]
async fn torbox_requires_file_availability_and_keeps_nonvideo_files() {
    let info = json!({"success":true,"data":{"id":7,"name":"Game","download_state":"completed","download_present":true,"files":[{"id":4,"name":"Game/setup.exe","size":128},{"id":5,"name":"Game/assets.bin","size":999}]}});
    let (api, requests, worker) = fixture(
        "tb",
        vec![
            (
                200,
                json!({"success":true,"data":[{"id":7,"name":"Not downloaded","download_state":"completed","download_present":false,"download_finished":false}]}),
            ),
            (200, info.clone()),
            (200, info),
            (
                200,
                json!({"success":true,"data":"https://cdn.test/game.bin?token=short-lived"}),
            ),
        ],
    );
    assert!(!api.list("", 1).await.unwrap().entries[0].ready);
    let page = api.list("7", 0).await.unwrap();
    assert_eq!(page.entries.len(), 2);
    let file = api.resolve("7", "5").await.unwrap();
    assert_eq!(file.name, "assets.bin");
    worker.join().unwrap();
    let requests = requests.lock().unwrap();
    assert!(requests[0].contains("offset=100"));
    assert!(requests[3].contains("torrent_id=7&file_id=5&zip_link=false&redirect=false"));
    assert!(!file.url.contains("fixture-secret"));
}

#[tokio::test]
async fn premiumize_uses_folder_hierarchy_and_original_link() {
    let (api, requests, worker) = fixture(
        "pm",
        vec![
            (
                200,
                json!({"status":"success","name":"Root","content":[{"id":"folder_1","name":"Games","type":"folder"},{"id":"file_1","name":"readme.txt","type":"file","size":20}]}),
            ),
            (
                200,
                json!({"status":"success","id":"file_1","name":"game.zip","size":250,"link":"https://cdn.test/original.zip","stream_link":"https://cdn.test/video.mp4"}),
            ),
        ],
    );
    let page = api.list("folder_1", 0).await.unwrap();
    assert_eq!(page.entries[0].kind, "folder");
    assert_eq!(page.entries[1].name, "readme.txt");
    let file = api.resolve("", "file_1").await.unwrap();
    assert_eq!(file.url, "https://cdn.test/original.zip");
    worker.join().unwrap();
    let requests = requests.lock().unwrap();
    assert!(requests[0].starts_with("GET /folder/list?id=folder_1 "));
    assert!(requests[1].starts_with("GET /item/details?id=file_1 "));
    assert!(!requests[0].contains("apikey="));
}

#[tokio::test]
async fn provider_failures_are_not_empty_success_and_do_not_echo_keys() {
    let (api, _, worker) = fixture(
        "rd",
        vec![
            (401, json!({"error":"fixture-secret"})),
            (429, json!({})),
            (200, json!({"error_code":9})),
            (302, json!({})),
            (200, json!({"unexpected":true})),
        ],
    );
    for expected in [
        "cloud_key",
        "cloud_rate_limit",
        "cloud_service",
        "cloud_network",
        "cloud_metadata",
    ] {
        assert_eq!(api.list("", 0).await.unwrap_err(), expected);
    }
    worker.join().unwrap();
}

#[test]
fn preparing_libraries_are_truthful_and_metadata_is_bounded() {
    assert_eq!(
        rd_files(json!({"status":"downloading"})).unwrap().label,
        "preparing"
    );
    assert_eq!(
        tb_files(&json!({"download_present":false})).unwrap().label,
        "preparing"
    );
    assert!(!tb_ready(&json!({"download_state":"completed"})));
    let matched=rd_files(json!({"status":"downloaded","files":[{"selected":1,"path":"game.zip","bytes":200},{"selected":0,"path":"other"}],"links":["https://x.test/file"]})).unwrap();
    assert_eq!(matched.entries[0].name, "game.zip");
    assert!(pm_files(json!({"content":vec![json!({});10001]})).is_err());
    assert!(url("file:///private/game.zip").is_err());
    assert!(url("https://user:key@host.test/game.zip").is_err());
    assert!(!identifier("../escape"));
    assert!(!identifier(".."));
}
