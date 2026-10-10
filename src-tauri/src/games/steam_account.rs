use super::steam_account_store::{self as storage, AccountRecord};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

type Result<T> = std::result::Result<T, &'static str>;
const API: &str = "https://api.steampowered.com/";
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnedGame {
    pub app_id: u32,
    pub name: String,
    pub minutes: u64,
    pub recent_minutes: u64,
    pub last_played: u64,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamAccountSnapshot {
    pub steam_id: String,
    pub name: String,
    pub avatar: String,
    pub games: Vec<OwnedGame>,
    pub library_visible: bool,
    pub updated_at: u64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamAccountStatus {
    pub connected: bool,
    pub remembered: bool,
    pub snapshot: Option<SteamAccountSnapshot>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamAchievement {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub locked_icon: String,
    pub hidden: bool,
    pub unlocked: bool,
    pub unlocked_at: u64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamAchievements {
    pub steam_id: String,
    pub app_id: u32,
    pub items: Vec<SteamAchievement>,
    pub updated_at: u64,
}

struct Session {
    key: Option<String>,
    remembered: bool,
    snapshot: Option<SteamAccountSnapshot>,
    generation: u64,
    busy: bool,
}
fn sessions() -> &'static Mutex<HashMap<String, Session>> {
    static VALUE: OnceLock<Mutex<HashMap<String, Session>>> = OnceLock::new();
    VALUE.get_or_init(|| Mutex::new(HashMap::new()))
}
fn cache() -> &'static Mutex<HashMap<String, SteamAchievements>> {
    static VALUE: OnceLock<Mutex<HashMap<String, SteamAchievements>>> = OnceLock::new();
    VALUE.get_or_init(|| Mutex::new(HashMap::new()))
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
pub fn valid_id(value: &str) -> bool {
    value.len() == 17
        && value
            .parse::<u64>()
            .is_ok_and(|id| (76561197960265728..=76561202255233023).contains(&id))
}
pub fn valid_key(value: &str) -> bool {
    value.len() == 32 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}
fn profile_key(root: &Path, profile: &str) -> Result<String> {
    if profile.is_empty() || profile.len() > 160 || profile.chars().any(char::is_control) {
        return Err("steam_account_profile");
    }
    Ok(format!("{}\0{}", root.display(), profile))
}
fn initialize<'a>(
    map: &'a mut HashMap<String, Session>,
    key: &str,
    root: &Path,
    profile: &str,
) -> Result<&'a mut Session> {
    if !map.contains_key(key) {
        let held = storage::read(root, profile)?;
        map.insert(
            key.into(),
            Session {
                key: held.as_ref().and_then(|value| value.key.clone()),
                remembered: held.as_ref().is_some_and(|value| value.key.is_some()),
                snapshot: held.map(|value| value.snapshot),
                generation: 0,
                busy: false,
            },
        );
    }
    map.get_mut(key).ok_or("steam_account_store")
}
pub fn status(root: PathBuf, profile: String) -> Result<SteamAccountStatus> {
    let identity = profile_key(&root, &profile)?;
    let mut map = sessions().lock().map_err(|_| "steam_account_store")?;
    let session = initialize(&mut map, &identity, &root, &profile)?;
    Ok(SteamAccountStatus {
        connected: session.key.is_some(),
        remembered: session.remembered,
        snapshot: session.snapshot.clone(),
    })
}
pub fn disconnect(root: PathBuf, profile: String) -> Result<()> {
    let identity = profile_key(&root, &profile)?;
    let mut map = sessions().lock().map_err(|_| "steam_account_store")?;
    storage::remove(&root, &profile)?;
    let old = map
        .get(&identity)
        .map(|session| session.generation)
        .unwrap_or(0);
    map.insert(
        identity.clone(),
        Session {
            key: None,
            remembered: false,
            snapshot: None,
            generation: old + 1,
            busy: false,
        },
    );
    cache()
        .lock()
        .map_err(|_| "steam_account_store")?
        .retain(|key, _| !key.starts_with(&format!("{identity}\0")));
    Ok(())
}

fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .connect_timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("Harbor-Games/1.0")
        .build()
        .map_err(|_| "steam_account_network")
}
async fn request(
    client: &reqwest::Client,
    path: &str,
    key: &str,
    params: &[(&str, String)],
) -> Result<Value> {
    request_url(client, &format!("{API}{path}"), key, params).await
}
async fn request_url(
    client: &reqwest::Client,
    url: &str,
    key: &str,
    params: &[(&str, String)],
) -> Result<Value> {
    let response = client
        .get(url)
        .header("x-webapi-key", key)
        .query(params)
        .send()
        .await
        .map_err(|_| "steam_account_network")?;
    match response.status().as_u16() {
        401 | 403 => return Err("steam_account_key"),
        429 => return Err("steam_account_rate"),
        200 => {}
        _ => return Err("steam_account_network"),
    }
    if response
        .content_length()
        .is_some_and(|size| size > 8 * 1024 * 1024)
    {
        return Err("steam_account_limit");
    }
    let mut bytes = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(part) = stream.next().await {
        let part = part.map_err(|_| "steam_account_network")?;
        if bytes.len() + part.len() > 8 * 1024 * 1024 {
            return Err("steam_account_limit");
        }
        bytes.extend_from_slice(&part);
    }
    serde_json::from_slice(&bytes).map_err(|_| "steam_account_response")
}
fn text(value: &Value, max: usize) -> String {
    value
        .as_str()
        .unwrap_or_default()
        .trim()
        .chars()
        .take(max)
        .collect()
}
fn image(value: &Value) -> String {
    let value = text(value, 2000);
    let Ok(url) = reqwest::Url::parse(&value) else {
        return String::new();
    };
    let host = url.host_str().unwrap_or_default();
    if url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && [
            "steamstatic.com",
            "steamcdn-a.akamaihd.net",
            "avatars.steamstatic.com",
            "avatars.akamai.steamstatic.com",
            "avatars.steamusercontent.com",
        ]
        .iter()
        .any(|base| host == *base || host.ends_with(&format!(".{base}")))
    {
        value
    } else {
        String::new()
    }
}
fn account_target(input: &str) -> Result<(String, bool)> {
    let input = input.trim();
    if valid_id(input) {
        return Ok((input.into(), false));
    }
    let url = reqwest::Url::parse(input).map_err(|_| "steam_account_id")?;
    if url.scheme() != "https"
        || url.host_str() != Some("steamcommunity.com")
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("steam_account_id");
    }
    let parts: Vec<_> = url
        .path_segments()
        .ok_or("steam_account_id")?
        .filter(|part| !part.is_empty())
        .collect();
    if parts.len() != 2 {
        return Err("steam_account_id");
    }
    if parts[0] == "profiles" && valid_id(parts[1]) {
        return Ok((parts[1].into(), false));
    }
    if parts[0] == "id"
        && !parts[1].is_empty()
        && parts[1].len() <= 100
        && parts[1]
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"_-".contains(&byte))
    {
        return Ok((parts[1].into(), true));
    }
    Err("steam_account_id")
}
pub(crate) fn parse_owned(value: &Value) -> Result<(bool, Vec<OwnedGame>)> {
    let root = value
        .get("response")
        .and_then(Value::as_object)
        .ok_or("steam_account_response")?;
    let Some(total) = root.get("game_count").and_then(Value::as_u64) else {
        return Ok((false, vec![]));
    };
    if total > 20_000 {
        return Err("steam_account_limit");
    }
    let rows = match root.get("games").and_then(Value::as_array) {
        Some(rows) => rows,
        None if total == 0 => return Ok((true, vec![])),
        _ => return Err("steam_account_response"),
    };
    if rows.len() > 20_000 {
        return Err("steam_account_limit");
    }
    let mut seen = HashSet::new();
    let mut games = Vec::new();
    for row in rows {
        let Some(id) = row["appid"]
            .as_u64()
            .filter(|id| *id > 0 && *id <= u32::MAX as u64)
        else {
            continue;
        };
        let name = text(&row["name"], 240);
        if name.is_empty() || !seen.insert(id) {
            continue;
        }
        games.push(OwnedGame {
            app_id: id as u32,
            name,
            minutes: row["playtime_forever"].as_u64().unwrap_or(0),
            recent_minutes: row["playtime_2weeks"].as_u64().unwrap_or(0),
            last_played: row["rtime_last_played"].as_u64().unwrap_or(0),
        });
    }
    if total > 0 && games.is_empty() {
        return Err("steam_account_response");
    }
    games.sort_by(|a, b| {
        b.last_played
            .cmp(&a.last_played)
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok((true, games))
}
async fn fetch_snapshot(target: &str, key: &str) -> Result<SteamAccountSnapshot> {
    let client = client()?;
    let (mut steam_id, vanity) = account_target(target)?;
    if vanity {
        let data = request(
            &client,
            "ISteamUser/ResolveVanityURL/v1/",
            key,
            &[("vanityurl", steam_id)],
        )
        .await?;
        steam_id = text(&data["response"]["steamid"], 20);
        if data["response"]["success"] != 1 || !valid_id(&steam_id) {
            return Err("steam_account_id");
        }
    }
    let player_params = [("steamids", steam_id.clone())];
    let owned_params = [(
        "input_json",
        json!({"steamid":steam_id,"include_appinfo":true,"include_played_free_games":true})
            .to_string(),
    )];
    let (player, owned) = tokio::join!(
        request(
            &client,
            "ISteamUser/GetPlayerSummaries/v2/",
            key,
            &player_params
        ),
        request(
            &client,
            "IPlayerService/GetOwnedGames/v1/",
            key,
            &owned_params
        )
    );
    let player = player?;
    let person = player["response"]["players"]
        .as_array()
        .and_then(|rows| rows.iter().find(|row| row["steamid"] == steam_id))
        .ok_or("steam_account_id")?;
    let name = text(&person["personaname"], 160);
    if name.is_empty() {
        return Err("steam_account_response");
    }
    let (library_visible, games) = parse_owned(&owned?)?;
    Ok(SteamAccountSnapshot {
        steam_id,
        name,
        avatar: image(&person["avatarfull"]),
        games,
        library_visible,
        updated_at: now(),
    })
}

pub async fn connect(
    root: PathBuf,
    profile: String,
    target: String,
    key: String,
    remember: bool,
) -> Result<SteamAccountStatus> {
    let key = key.trim().to_string();
    if !valid_key(&key) {
        return Err("steam_account_key");
    }
    account_target(&target)?;
    let identity = profile_key(&root, &profile)?;
    let generation = {
        let mut map = sessions().lock().map_err(|_| "steam_account_store")?;
        let session = initialize(&mut map, &identity, &root, &profile)?;
        if session.busy {
            return Err("steam_account_busy");
        }
        session.busy = true;
        session.generation += 1;
        session.generation
    };
    let result = fetch_snapshot(&target, &key).await;
    let mut map = sessions().lock().map_err(|_| "steam_account_store")?;
    let session = map.get_mut(&identity).ok_or("steam_account_disconnected")?;
    if session.generation != generation {
        return Err("steam_account_disconnected");
    }
    session.busy = false;
    let snapshot = result?;
    let record = AccountRecord {
        version: 1,
        profile,
        steam_id: snapshot.steam_id.clone(),
        key: remember.then(|| key.clone()),
        snapshot: snapshot.clone(),
    };
    storage::write(&root, &record)?;
    session.key = Some(key);
    session.remembered = remember;
    session.snapshot = Some(snapshot.clone());
    cache()
        .lock()
        .map_err(|_| "steam_account_store")?
        .retain(|entry, _| !entry.starts_with(&format!("{identity}\0")));
    Ok(SteamAccountStatus {
        connected: true,
        remembered: remember,
        snapshot: Some(snapshot),
    })
}
pub async fn refresh(root: PathBuf, profile: String) -> Result<SteamAccountStatus> {
    let identity = profile_key(&root, &profile)?;
    let (key, id, remember) = {
        let mut map = sessions().lock().map_err(|_| "steam_account_store")?;
        let session = initialize(&mut map, &identity, &root, &profile)?;
        (
            session.key.clone().ok_or("steam_account_disconnected")?,
            session
                .snapshot
                .as_ref()
                .ok_or("steam_account_disconnected")?
                .steam_id
                .clone(),
            session.remembered,
        )
    };
    connect(root, profile, id, key, remember).await
}
pub fn owns(root: PathBuf, profile: String, app_id: u32) -> Result<bool> {
    Ok(status(root, profile)?.snapshot.is_some_and(|snapshot| {
        snapshot.library_visible && snapshot.games.iter().any(|game| game.app_id == app_id)
    }))
}

pub(crate) fn parse_achievements(
    steam_id: &str,
    app_id: u32,
    schema: &Value,
    progress: &Value,
) -> Result<SteamAchievements> {
    let stats = &progress["playerstats"];
    if stats["success"] != true {
        return Err("steam_achievements_private");
    }
    if stats["steamID"].as_str().is_some_and(|id| id != steam_id) {
        return Err("steam_account_response");
    }
    let definitions = schema["game"]["availableGameStats"]["achievements"].as_array();
    let states = stats["achievements"].as_array();
    if definitions.is_none() && schema.get("game").and_then(Value::as_object).is_none() {
        return Err("steam_account_response");
    }
    if definitions.is_some_and(|rows| !rows.is_empty()) && states.is_none() {
        return Err("steam_account_response");
    }
    let mut items = Vec::new();
    let mut seen = HashSet::new();
    for definition in definitions.into_iter().flatten().take(5000) {
        let id = text(&definition["name"], 200);
        let name = text(&definition["displayName"], 240);
        if id.is_empty() || name.is_empty() || !seen.insert(id.clone()) {
            continue;
        }
        let state = states.and_then(|rows| rows.iter().find(|row| row["apiname"] == id));
        let unlocked = state.is_some_and(|row| row["achieved"] == 1);
        items.push(SteamAchievement {
            id,
            name,
            description: text(&definition["description"], 1500),
            icon: image(&definition["icon"]),
            locked_icon: image(&definition["icongray"]),
            hidden: definition["hidden"] == 1,
            unlocked,
            unlocked_at: if unlocked {
                state
                    .and_then(|row| row["unlocktime"].as_u64())
                    .unwrap_or(0)
            } else {
                0
            },
        });
    }
    Ok(SteamAchievements {
        steam_id: steam_id.into(),
        app_id,
        items,
        updated_at: now(),
    })
}
pub async fn achievements(
    root: PathBuf,
    profile: String,
    app_id: u32,
) -> Result<SteamAchievements> {
    if app_id == 0 {
        return Err("steam_account_response");
    }
    let identity = profile_key(&root, &profile)?;
    let (key, id, generation) = {
        let mut map = sessions().lock().map_err(|_| "steam_account_store")?;
        let session = initialize(&mut map, &identity, &root, &profile)?;
        (
            session.key.clone().ok_or("steam_account_disconnected")?,
            session
                .snapshot
                .as_ref()
                .ok_or("steam_account_disconnected")?
                .steam_id
                .clone(),
            session.generation,
        )
    };
    let cache_key = format!("{identity}\0{id}\0{app_id}");
    if let Some(held) = cache()
        .lock()
        .map_err(|_| "steam_account_store")?
        .get(&cache_key)
        .filter(|value| now().saturating_sub(value.updated_at) < 600)
    {
        return Ok(held.clone());
    }
    let client = client()?;
    let schema_params = [("appid", app_id.to_string()), ("l", "english".into())];
    let progress_params = [
        ("appid", app_id.to_string()),
        ("steamid", id.clone()),
        ("l", "english".into()),
    ];
    let (schema, progress) = tokio::join!(
        request(
            &client,
            "ISteamUserStats/GetSchemaForGame/v2/",
            &key,
            &schema_params
        ),
        request(
            &client,
            "ISteamUserStats/GetPlayerAchievements/v1/",
            &key,
            &progress_params
        )
    );
    let result = parse_achievements(&id, app_id, &schema?, &progress?)?;
    let map = sessions().lock().map_err(|_| "steam_account_store")?;
    if !map
        .get(&identity)
        .is_some_and(|session| session.generation == generation && session.key.is_some())
    {
        return Err("steam_account_disconnected");
    }
    let mut cache = cache().lock().map_err(|_| "steam_account_store")?;
    if cache.len() >= 80 {
        if let Some(oldest) = cache
            .iter()
            .min_by_key(|(_, value)| value.updated_at)
            .map(|(key, _)| key.clone())
        {
            cache.remove(&oldest);
        }
    }
    cache.insert(cache_key, result.clone());
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn native_http_keeps_key_in_header_and_refuses_redirects_and_oversized_bodies() {
        use std::{
            io::{Read, Write},
            net::TcpListener,
        };
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let worker = std::thread::spawn(move || {
            for index in 0..3 {
                let (mut socket, _) = listener.accept().unwrap();
                socket
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();
                let mut bytes = Vec::new();
                loop {
                    let mut part = [0u8; 1024];
                    let n = socket.read(&mut part).unwrap();
                    bytes.extend_from_slice(&part[..n]);
                    if n == 0 || bytes.windows(4).any(|part| part == b"\r\n\r\n") {
                        break;
                    }
                }
                let request = String::from_utf8(bytes).unwrap();
                assert!(!request.lines().next().unwrap().contains(&"A".repeat(32)));
                assert!(request
                    .to_ascii_lowercase()
                    .contains(&format!("x-webapi-key: {}", "a".repeat(32))));
                let reply=match index{0=>"HTTP/1.1 200 OK\r\nContent-Length: 15\r\nConnection: close\r\n\r\n{\"response\":{}}",1=>"HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1:1/steal\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",_=>"HTTP/1.1 200 OK\r\nContent-Length: 9000000\r\nConnection: close\r\n\r\n"};
                socket.write_all(reply.as_bytes()).unwrap();
            }
        });
        let client = client().unwrap();
        let key = "A".repeat(32);
        let url = format!("http://{address}/fixture");
        assert_eq!(
            request_url(
                &client,
                &url,
                &key,
                &[("steamid", "76561198000000001".into())]
            )
            .await
            .unwrap(),
            json!({"response":{}})
        );
        assert_eq!(
            request_url(&client, &url, &key, &[]).await.unwrap_err(),
            "steam_account_network"
        );
        assert_eq!(
            request_url(&client, &url, &key, &[]).await.unwrap_err(),
            "steam_account_limit"
        );
        worker.join().unwrap();
    }
    #[test]
    fn identity_and_keys_are_bounded_and_never_accept_arbitrary_hosts() {
        assert!(valid_id("76561198000000001"));
        assert!(!valid_id("18446744073709551615"));
        assert!(valid_key(&"A".repeat(32)));
        assert!(!valid_key(&"x".repeat(32)));
        assert_eq!(
            account_target("https://steamcommunity.com/id/valve").unwrap(),
            ("valve".into(), true)
        );
        assert!(account_target("https://evil.test/profiles/76561198000000001").is_err());
        assert!(account_target("https://steamcommunity.com/id/x/other").is_err());
    }
    #[test]
    fn private_libraries_are_distinct_from_zero_and_owned_records_dedupe() {
        assert!(!parse_owned(&json!({"response":{}})).unwrap().0);
        assert_eq!(
            parse_owned(&json!({"response":{"game_count":0}}))
                .unwrap()
                .1
                .len(),
            0
        );
        let data = json!({"response":{"game_count":2,"games":[{"appid":42,"name":"One","playtime_forever":90},{"appid":42,"name":"Duplicate"}]}});
        assert_eq!(parse_owned(&data).unwrap().1.len(), 1);
        assert!(parse_owned(&json!({"response":{"game_count":5,"games":[]}})).is_err());
        assert!(parse_owned(&json!({})).is_err());
    }
    #[test]
    fn achievements_join_exact_keys_and_preserve_hidden_state() {
        let schema = json!({"game":{"availableGameStats":{"achievements":[{"name":"A_1","displayName":"A","hidden":1},{"name":"A_2","displayName":"A"}]}}});
        let progress = json!({"playerstats":{"success":true,"steamID":"76561198000000001","achievements":[{"apiname":"A_2","achieved":1,"unlocktime":123}]}});
        let result = parse_achievements("76561198000000001", 42, &schema, &progress).unwrap();
        assert!(result.items[0].hidden && !result.items[0].unlocked);
        assert!(result.items[1].unlocked);
        assert_eq!(result.items[1].unlocked_at, 123);
        assert!(parse_achievements("76561198000000002", 42, &schema, &progress).is_err());
        assert!(parse_achievements(
            "76561198000000001",
            42,
            &schema,
            &json!({"playerstats":{"success":true}})
        )
        .is_err());
    }
}
