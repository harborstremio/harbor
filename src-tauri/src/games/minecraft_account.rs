use super::{minecraft_data::{self as data, Account, Status}, minecraft_store as store};
use reqwest::{Client, RequestBuilder};
use serde::Serialize;
use serde_json::{json, Value};
use std::{collections::HashMap, path::Path, sync::{Arc, LazyLock, Mutex, atomic::{AtomicBool, Ordering}}, time::Duration};

const DEVICE_ENDPOINT: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const TOKEN_ENDPOINT: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const PROFILE_ENDPOINT: &str = "https://api.minecraftservices.com/minecraft/profile";
const SCOPE: &str = "XboxLive.SignIn XboxLive.offline_access";
static CLIENT: LazyLock<Client> = LazyLock::new(|| Client::builder().timeout(Duration::from_secs(25)).connect_timeout(Duration::from_secs(10)).redirect(reqwest::redirect::Policy::none()).user_agent("Harbor/0.9 Minecraft integration").build().expect("Minecraft HTTP client"));
static FLOWS: LazyLock<Mutex<HashMap<String, Arc<DeviceFlow>>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
static ACCOUNT_WRITE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

struct DeviceFlow {
    profile: String,
    client_id: String,
    cancelled: AtomicBool,
    expires_at: u64,
    state: tokio::sync::Mutex<DeviceState>,
}
struct DeviceState { code: String, interval: u64, next_poll: u64, expires_at: u64 }
#[derive(Serialize)]
pub struct Challenge { pub flow: String, pub user_code: String, pub verification_uri: String, pub expires_at: u64, pub interval: u64 }
#[derive(Serialize)]
pub struct Poll { pub pending: bool, pub interval: u64, pub status: Option<Status> }

pub fn client_id() -> Option<String> {
    let value = std::env::var("HARBOR_MICROSOFT_CLIENT_ID").ok().or_else(|| option_env!("HARBOR_MICROSOFT_CLIENT_ID").map(String::from))?;
    uuid::Uuid::parse_str(value.trim()).ok().map(|v| v.hyphenated().to_string())
}
fn status_for(account: Option<Account>) -> Status {
    Status { configured: client_id().is_some(), updated_at: account.as_ref().map(|a| a.updated_at), account: account.map(|a| a.minecraft) }
}
pub fn status(root: &Path, profile: &str) -> Result<Status, &'static str> { Ok(status_for(store::read(root, profile)?)) }

async fn response(request: RequestBuilder) -> Result<(u16, Value), &'static str> {
    let mut response = request.send().await.map_err(|_| "minecraft_network")?;
    let status = response.status().as_u16();
    if response.content_length().is_some_and(|n| n > 1_048_576) { return Err("minecraft_response"); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "minecraft_network")? {
        if bytes.len() + chunk.len() > 1_048_576 { return Err("minecraft_response"); } bytes.extend_from_slice(&chunk);
    }
    if bytes.is_empty() && (200..300).contains(&status) { return Ok((status, Value::Null)); }
    let value = serde_json::from_slice(&bytes).map_err(|_| if status >= 500 { "minecraft_unavailable" } else { "minecraft_response" })?;
    Ok((status, value))
}
async fn checked(request: RequestBuilder) -> Result<Value, &'static str> {
    let (status, value) = response(request).await?;
    if !(200..300).contains(&status) { return Err(data::service_error(status, &value)); } Ok(value)
}
fn require_active(flow: &DeviceFlow) -> Result<(), &'static str> {
    if flow.cancelled.load(Ordering::Acquire) { return Err("minecraft_cancelled"); }
    if flow.expires_at <= data::now() { return Err("minecraft_expired"); } Ok(())
}
pub fn cancel_profile(profile: &str) {
    if let Ok(mut flows) = FLOWS.lock() { flows.retain(|_, flow| { if flow.profile == profile { flow.cancelled.store(true, Ordering::Release); false } else { true } }); }
}
pub fn cancel(profile: &str, flow_id: &str) {
    if let Ok(mut flows) = FLOWS.lock() { if flows.get(flow_id).is_some_and(|flow| flow.profile == profile) { if let Some(flow) = flows.remove(flow_id) { flow.cancelled.store(true, Ordering::Release); } } }
}
pub async fn begin(profile: String) -> Result<Challenge, &'static str> {
    if !data::valid_profile(&profile) { return Err("minecraft_store"); }
    let client_id = client_id().ok_or("minecraft_app_config")?;
    // Reserve the flow before I/O so a newer request or Cancel invalidates an in-flight start.
    let id = uuid::Uuid::new_v4().to_string();
    let flow = Arc::new(DeviceFlow { profile, client_id: client_id.clone(), cancelled: AtomicBool::new(false), expires_at: data::now() + 1800, state: tokio::sync::Mutex::new(DeviceState { code: String::new(), interval: 5, next_poll: 0, expires_at: data::now() + 1800 }) });
    { let mut flows = FLOWS.lock().map_err(|_| "minecraft_busy")?; flows.retain(|_, v| { if v.profile == flow.profile || v.expires_at <= data::now() { v.cancelled.store(true, Ordering::Release); false } else { true } }); if flows.len() >= 8 { return Err("minecraft_busy"); } flows.insert(id.clone(), flow.clone()); }
    let result = async {
        let body = checked(CLIENT.post(DEVICE_ENDPOINT).form(&[("client_id", client_id.as_str()), ("scope", SCOPE)])).await?;
        require_active(&flow)?;
        let code = data::text(&body, "device_code", 16_384)?.to_owned();
        let user_code = data::text(&body, "user_code", 30)?.to_owned();
        if !user_code.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-') { return Err("minecraft_response"); }
        let duration = body["expires_in"].as_u64().filter(|n| (30..=1800).contains(n)).ok_or("minecraft_response")?;
        let interval = body["interval"].as_u64().unwrap_or(5).clamp(5, 60);
        let mut state = flow.state.lock().await; state.code = code; state.interval = interval; state.next_poll = data::now() + interval; state.expires_at = data::now() + duration;
        Ok(Challenge { flow: id.clone(), user_code, verification_uri: "https://microsoft.com/devicelogin".into(), expires_at: data::now() + duration, interval })
    }.await;
    if result.is_err() { cancel(&flow.profile, &id); } result
}

async fn minecraft_session(msa: &str, flow: Option<&DeviceFlow>, launch: bool) -> Result<(String, u64, data::MinecraftProfile, Option<String>), &'static str> {
    let active = || flow.map(require_active).unwrap_or(Ok(()));
    active()?;
    let user = checked(CLIENT.post("https://user.auth.xboxlive.com/user/authenticate").header("x-xbl-contract-version", "1").json(&json!({"Properties":{"AuthMethod":"RPS","SiteName":"user.auth.xboxlive.com","RpsTicket":format!("d={msa}")},"RelyingParty":"http://auth.xboxlive.com","TokenType":"JWT"}))).await?;
    active()?;
    let user_token = data::text(&user, "Token", 131_072)?;
    let xsts = checked(CLIENT.post("https://xsts.auth.xboxlive.com/xsts/authorize").json(&json!({"Properties":{"SandboxId":"RETAIL","UserTokens":[user_token]},"RelyingParty":"rp://api.minecraftservices.com/","TokenType":"JWT"}))).await?;
    active()?;
    let xsts_token = data::text(&xsts, "Token", 131_072)?;
    let hash = xsts["DisplayClaims"]["xui"][0]["uhs"].as_str().filter(|s| !s.is_empty() && s.len() <= 40 && s.bytes().all(|c| c.is_ascii_digit())).ok_or("minecraft_response")?;
    if user["DisplayClaims"]["xui"][0]["uhs"].as_str() != Some(hash) { return Err("minecraft_response"); }
    // XUID is launch-only. Do not add it to Harbor's persisted account record.
    let xuid = if launch {
        let claims = if xsts["DisplayClaims"]["xui"][0]["xid"].is_string() { xsts.clone() } else {
            checked(CLIENT.post("https://xsts.auth.xboxlive.com/xsts/authorize").header("x-xbl-contract-version", "1").json(&json!({"Properties":{"SandboxId":"RETAIL","UserTokens":[user_token]},"RelyingParty":"https://xboxlive.com","TokenType":"JWT"}))).await?
        };
        if claims["DisplayClaims"]["xui"][0]["uhs"].as_str() != Some(hash) { return Err("minecraft_response"); }
        Some(claims["DisplayClaims"]["xui"][0]["xid"].as_str().filter(|v| !v.is_empty() && v.len() <= 20 && v.bytes().all(|b|b.is_ascii_digit())).ok_or("minecraft_response")?.to_owned())
    } else { None };
    let minecraft = checked(CLIENT.post("https://api.minecraftservices.com/launcher/login").json(&json!({"platform":"PC_LAUNCHER","xtoken":format!("XBL3.0 x={hash};{xsts_token}")}))).await?;
    active()?;
    let access = data::text(&minecraft, "access_token", 131_072)?.to_owned();
    let expires = minecraft["expires_in"].as_u64().filter(|n| (60..=172_800).contains(n)).ok_or("minecraft_response")?;
    let license = checked(CLIENT.get(format!("https://api.minecraftservices.com/entitlements/license?requestId={}", uuid::Uuid::new_v4())).bearer_auth(&access)).await?;
    active()?;
    if !data::has_license(&license) { return Err("minecraft_not_owned"); }
    let profile = data::parse_profile(&checked(CLIENT.get(PROFILE_ENDPOINT).bearer_auth(&access)).await?)?;
    Ok((access, data::now() + expires, profile, xuid))
}

pub async fn poll(root: &Path, profile: &str, flow_id: &str) -> Result<Poll, &'static str> {
    let flow = FLOWS.lock().map_err(|_| "minecraft_busy")?.get(flow_id).filter(|v| v.profile == profile).cloned().ok_or("minecraft_expired")?;
    require_active(&flow)?;
    let mut state = flow.state.lock().await; require_active(&flow)?;
    if state.expires_at <= data::now() { cancel(profile, flow_id); return Err("minecraft_expired"); }
    if state.code.is_empty() || state.next_poll > data::now() { return Ok(Poll { pending: true, interval: state.interval, status: None }); }
    state.next_poll = data::now() + state.interval;
    let (status, token) = response(CLIENT.post(TOKEN_ENDPOINT).form(&[("client_id", flow.client_id.as_str()), ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"), ("device_code", state.code.as_str())])).await?;
    require_active(&flow)?;
    if !(200..300).contains(&status) {
        if token["error"] == "authorization_pending" || token["error"] == "slow_down" {
            if token["error"] == "slow_down" { state.interval = (state.interval + 5).min(60); state.next_poll = data::now() + state.interval; }
            return Ok(Poll { pending: true, interval: state.interval, status: None });
        }
        cancel(profile, flow_id); return Err(data::service_error(status, &token));
    }
    let outcome = async {
        let msa = data::text(&token, "access_token", 131_072)?;
        let refresh_token = data::text(&token, "refresh_token", 131_072)?.to_owned();
        let (access_token, expires_at, minecraft, _) = minecraft_session(msa, Some(&flow), false).await?;
        let account = Account { schema: 1, harbor_profile: profile.into(), client_id: flow.client_id.clone(), refresh_token, access_token, expires_at, updated_at: data::now(), minecraft };
        let _write = ACCOUNT_WRITE.lock().await; require_active(&flow)?;
        store::write(root, &account)?;
        Ok(Poll { pending: false, interval: 0, status: Some(status_for(Some(account))) })
    }.await;
    cancel(profile, flow_id); outcome
}

async fn refresh_for(root: &Path, profile: &str, launch: bool) -> Result<(Account, Option<String>), &'static str> {
    let mut account = store::read(root, profile)?.ok_or("minecraft_reconnect")?;
    let mut xuid = None;
    if launch || account.expires_at <= data::now() + 90 {
        let current_client = client_id().ok_or("minecraft_app_config")?;
        if current_client != account.client_id { return Err("minecraft_reconnect"); }
        let token = checked(CLIENT.post(TOKEN_ENDPOINT).form(&[("client_id", current_client.as_str()), ("grant_type", "refresh_token"), ("refresh_token", account.refresh_token.as_str()), ("scope", SCOPE)])).await?;
        if let Some(refresh) = token.get("refresh_token") {
            account.refresh_token = refresh.as_str().filter(|v| !v.is_empty() && v.len() <= 131_072).ok_or("minecraft_response")?.into();
            // Keep a rotated Microsoft credential even if a later Xbox/Minecraft request fails.
            store::write(root, &account)?;
        }
        let (access, expires, minecraft, identity) = minecraft_session(data::text(&token, "access_token", 131_072)?, None, launch).await?;
        xuid = identity;
        if minecraft.id != account.minecraft.id { return Err("minecraft_reconnect"); }
        account.access_token = access; account.expires_at = expires; account.minecraft = minecraft;
        account.updated_at = data::now(); store::write(root, &account)?;
    }
    Ok((account, xuid))
}
async fn refreshed(root: &Path, profile: &str) -> Result<Account, &'static str> { Ok(refresh_for(root, profile, false).await?.0) }
pub async fn credentials(root: &Path, profile: &str) -> Result<super::minecraft_launch_data::Credentials, &'static str> {
    let _write = ACCOUNT_WRITE.lock().await;
    let (account, xuid) = refresh_for(root, profile, true).await?;
    Ok(super::minecraft_launch_data::Credentials { name: account.minecraft.name, uuid: account.minecraft.id, access: account.access_token, client: account.client_id, xuid: xuid.ok_or("minecraft_response")? })
}
pub async fn refresh(root: &Path, profile: &str) -> Result<Status, &'static str> {
    let _write = ACCOUNT_WRITE.lock().await;
    let mut account = refreshed(root, profile).await?;
    let minecraft = data::parse_profile(&checked(CLIENT.get(PROFILE_ENDPOINT).bearer_auth(&account.access_token)).await?)?;
    if minecraft.id != account.minecraft.id { return Err("minecraft_reconnect"); }
    account.minecraft = minecraft; account.updated_at = data::now(); store::write(root, &account)?; Ok(status_for(Some(account)))
}
pub async fn disconnect(root: &Path, profile: &str) -> Result<(), &'static str> {
    cancel_profile(profile); super::minecraft_runtime::cancel_profile(profile); let _write = ACCOUNT_WRITE.lock().await; store::remove(root, profile)
}

pub fn validate_skin(bytes: &[u8]) -> Result<(), &'static str> {
    if bytes.len() < 24 || bytes.len() > 1_048_576 || !bytes.starts_with(b"\x89PNG\r\n\x1a\n") { return Err("minecraft_skin"); }
    let width = u32::from_be_bytes(bytes[16..20].try_into().map_err(|_| "minecraft_skin")?);
    let height = u32::from_be_bytes(bytes[20..24].try_into().map_err(|_| "minecraft_skin")?);
    if width != 64 || height != 64 { return Err("minecraft_skin"); }
    image::load_from_memory_with_format(bytes, image::ImageFormat::Png).map_err(|_| "minecraft_skin")?; Ok(())
}
pub async fn apply_skin(root: &Path, profile: &str, png: String, variant: String) -> Result<Status, &'static str> {
    use base64::Engine;
    if !matches!(variant.as_str(), "classic" | "slim") || png.len() > 1_400_000 { return Err("minecraft_skin"); }
    let bytes = base64::engine::general_purpose::STANDARD.decode(png.strip_prefix("data:image/png;base64,").ok_or("minecraft_skin")?).map_err(|_| "minecraft_skin")?;
    validate_skin(&bytes)?;
    let _write = ACCOUNT_WRITE.lock().await; let mut account = refreshed(root, profile).await?;
    let form = reqwest::multipart::Form::new().text("variant", variant).part("file", reqwest::multipart::Part::bytes(bytes).file_name("skin.png").mime_str("image/png").map_err(|_| "minecraft_skin")?);
    checked(CLIENT.post("https://api.minecraftservices.com/minecraft/profile/skins").bearer_auth(&account.access_token).multipart(form)).await?;
    let minecraft = data::parse_profile(&checked(CLIENT.get(PROFILE_ENDPOINT).bearer_auth(&account.access_token)).await?)?;
    if minecraft.id != account.minecraft.id { return Err("minecraft_reconnect"); }
    account.minecraft = minecraft;
    account.updated_at = data::now(); store::write(root, &account)?; Ok(status_for(Some(account)))
}
pub async fn apply_cape(root: &Path, profile: &str, cape_id: Option<String>) -> Result<Status, &'static str> {
    let _write = ACCOUNT_WRITE.lock().await; let mut account = refreshed(root, profile).await?;
    let endpoint = "https://api.minecraftservices.com/minecraft/profile/capes/active";
    if let Some(id) = cape_id {
        if !account.minecraft.capes.iter().any(|cape| cape.id == id) { return Err("minecraft_cape"); }
        checked(CLIENT.put(endpoint).bearer_auth(&account.access_token).json(&json!({"capeId":id}))).await?;
    } else { checked(CLIENT.delete(endpoint).bearer_auth(&account.access_token)).await?; }
    let minecraft = data::parse_profile(&checked(CLIENT.get(PROFILE_ENDPOINT).bearer_auth(&account.access_token)).await?)?;
    if minecraft.id != account.minecraft.id { return Err("minecraft_reconnect"); }
    account.minecraft = minecraft;
    account.updated_at = data::now(); store::write(root, &account)?; Ok(status_for(Some(account)))
}

/** Fetch only a texture already returned for this account, never an arbitrary UI URL. */
pub async fn texture(root: &Path, profile: &str, kind: &str, id: &str) -> Result<String, &'static str> {
    use base64::Engine;
    let account = store::read(root, profile)?.ok_or("minecraft_reconnect")?;
    let url = match kind {
        "skin" => account.minecraft.skins.iter().find(|v| v.id == id).map(|v| v.url.as_str()),
        "cape" => account.minecraft.capes.iter().find(|v| v.id == id).map(|v| v.url.as_str()),
        _ => None,
    }.and_then(data::texture_url).ok_or("minecraft_skin")?;
    let mut response = CLIENT.get(url).send().await.map_err(|_| "minecraft_network")?;
    if !response.status().is_success() || response.content_length().is_some_and(|n| n > 1_048_576) { return Err("minecraft_skin"); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "minecraft_network")? { if bytes.len() + chunk.len() > 1_048_576 { return Err("minecraft_skin"); } bytes.extend_from_slice(&chunk); }
    if bytes.len() < 24 || !bytes.starts_with(b"\x89PNG\r\n\x1a\n") { return Err("minecraft_skin"); }
    let w = u32::from_be_bytes(bytes[16..20].try_into().map_err(|_| "minecraft_skin")?);
    let h = u32::from_be_bytes(bytes[20..24].try_into().map_err(|_| "minecraft_skin")?);
    if w != 64 || !matches!(h, 32 | 64) { return Err("minecraft_skin"); }
    Ok(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn cancelling_is_profile_scoped_and_interrupts_existing_flow_handles() {
        let id = uuid::Uuid::new_v4().to_string();
        let flow = Arc::new(DeviceFlow { profile: "cancel-test".into(), client_id: uuid::Uuid::new_v4().to_string(), cancelled: AtomicBool::new(false), expires_at: data::now() + 90, state: tokio::sync::Mutex::new(DeviceState { code: "never-sent".into(), interval: 5, next_poll: data::now() + 60, expires_at: data::now() + 90 }) });
        FLOWS.lock().unwrap().insert(id.clone(), flow.clone());
        cancel("different-profile", &id); assert!(require_active(&flow).is_ok());
        let pending = poll(Path::new("unused"), "cancel-test", &id).await.unwrap(); assert!(pending.pending); assert_eq!(pending.interval, 5);
        cancel("cancel-test", &id); assert_eq!(require_active(&flow).unwrap_err(), "minecraft_cancelled");
        assert!(poll(Path::new("unused"), "cancel-test", &id).await.is_err());
    }
    #[test]
    fn invalid_png_is_rejected_before_any_account_or_network_work() {
        assert!(validate_skin(b"not a png").is_err());
        let mut bomb = vec![0; 24]; bomb[..8].copy_from_slice(b"\x89PNG\r\n\x1a\n"); bomb[16..20].copy_from_slice(&u32::MAX.to_be_bytes()); bomb[20..24].copy_from_slice(&64_u32.to_be_bytes()); assert!(validate_skin(&bomb).is_err());
        let image = image::RgbaImage::new(64, 64); let mut buffer = std::io::Cursor::new(Vec::new()); image.write_to(&mut buffer, image::ImageFormat::Png).unwrap(); assert!(validate_skin(buffer.get_ref()).is_ok());
    }
}
