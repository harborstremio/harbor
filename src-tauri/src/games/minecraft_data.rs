use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Serialize, Deserialize)]
pub struct Skin {
    pub id: String,
    pub url: String,
    pub variant: String,
    pub active: bool,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Cape {
    pub id: String,
    pub url: String,
    pub name: String,
    pub active: bool,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct MinecraftProfile {
    pub id: String,
    pub name: String,
    pub skins: Vec<Skin>,
    pub capes: Vec<Cape>,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Account {
    pub schema: u32,
    pub harbor_profile: String,
    pub client_id: String,
    pub refresh_token: String,
    pub access_token: String,
    pub expires_at: u64,
    pub updated_at: u64,
    pub minecraft: MinecraftProfile,
}
#[derive(Serialize)]
pub struct Status {
    pub configured: bool,
    pub account: Option<MinecraftProfile>,
    pub updated_at: Option<u64>,
}
pub fn valid_profile(profile: &str) -> bool {
    !profile.is_empty() && profile.len() <= 120 && !profile.chars().any(char::is_control)
}
pub fn now() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()
}
pub fn text<'a>(value: &'a Value, key: &str, max: usize) -> Result<&'a str, &'static str> {
    value.get(key).and_then(Value::as_str).filter(|s| !s.is_empty() && s.len() <= max).ok_or("minecraft_response")
}
pub fn texture_url(value: &str) -> Option<String> {
    let mut url = reqwest::Url::parse(value).ok()?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str()? != "textures.minecraft.net" || url.port().is_some() || !url.username().is_empty() || url.password().is_some() || url.query().is_some() || url.fragment().is_some() { return None; }
    let hash = url.path().strip_prefix("/texture/")?;
    if !(32..=128).contains(&hash.len()) || !hash.bytes().all(|c| c.is_ascii_hexdigit()) { return None; }
    url.set_scheme("https").ok()?; Some(url.to_string())
}
pub fn parse_profile(value: &Value) -> Result<MinecraftProfile, &'static str> {
    let id = text(value, "id", 36)?;
    let uuid = uuid::Uuid::parse_str(id).map_err(|_| "minecraft_response")?;
    let name = text(value, "name", 16)?;
    if name.len() < 3 || !name.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_') { return Err("minecraft_response"); }
    let skins = value.get("skins").and_then(Value::as_array).ok_or("minecraft_response")?.iter().take(20).filter_map(|v| {
        let id = text(v, "id", 36).ok()?; uuid::Uuid::parse_str(id).ok()?;
        let variant = text(v, "variant", 16).ok()?;
        if !matches!(variant, "CLASSIC" | "SLIM") { return None; }
        Some(Skin { id: id.into(), url: texture_url(text(v, "url", 300).ok()?)?, variant: variant.to_lowercase(), active: v["state"] == "ACTIVE" })
    }).collect();
    let capes = value.get("capes").and_then(Value::as_array).ok_or("minecraft_response")?.iter().take(100).filter_map(|v| {
        let id = text(v, "id", 36).ok()?; uuid::Uuid::parse_str(id).ok()?;
        Some(Cape { id: id.into(), url: texture_url(text(v, "url", 300).ok()?)?, name: v["alias"].as_str().unwrap_or("Minecraft").chars().take(80).collect(), active: v["state"] == "ACTIVE" })
    }).collect();
    Ok(MinecraftProfile { id: uuid.simple().to_string(), name: name.into(), skins, capes })
}
pub fn has_license(value: &Value) -> bool {
    value["items"].as_array().is_some_and(|items| items.iter().any(|item| matches!(item["name"].as_str(), Some("game_minecraft" | "product_minecraft"))))
}
pub fn service_error(status: u16, body: &Value) -> &'static str {
    if status == 429 { return "minecraft_rate_limit"; }
    if status >= 500 { return "minecraft_unavailable"; }
    match body["XErr"].as_u64() {
        Some(2148916233) => "minecraft_xbox_profile",
        Some(2148916235 | 2148916236 | 2148916237 | 2148916238) => "minecraft_xbox_restricted",
        _ => match body["error"].as_str() {
            Some("authorization_declined" | "access_denied") => "minecraft_declined",
            Some("expired_token" | "invalid_grant") => "minecraft_reconnect",
            Some("unauthorized_client" | "invalid_client") => "minecraft_app_config",
            _ if status == 401 => "minecraft_reconnect",
            _ if status == 403 => "minecraft_app_config",
            _ if status == 404 => "minecraft_no_profile",
            _ => "minecraft_response",
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn profile_keeps_only_mojang_textures_and_actual_cosmetic_states() {
        let hash = "a".repeat(64);
        let value = json!({"id":"123456781234123412341234567890ab","name":"HarborTest","skins":[{"id":"12345678-1234-1234-1234-1234567890ab","state":"ACTIVE","variant":"SLIM","url":format!("http://textures.minecraft.net/texture/{hash}")}],"capes":[{"id":"12345678-1234-1234-1234-1234567890ac","state":"INACTIVE","alias":"Example","url":format!("https://textures.minecraft.net/texture/{hash}")}]});
        let profile = parse_profile(&value).unwrap(); assert_eq!(profile.skins[0].variant, "slim"); assert!(profile.skins[0].url.starts_with("https://")); assert!(!profile.capes[0].active);
        for bad in [format!("https://textures.minecraft.net.evil.test/texture/{hash}"), format!("https://textures.minecraft.net/texture/{hash}?token=secret"), "file:///C:/secret".into()] { assert!(texture_url(&bad).is_none()); }
        assert!(parse_profile(&json!({"id":"bad","name":"HarborTest","skins":[],"capes":[]})).is_err());
    }
    #[test]
    fn license_and_failure_states_do_not_invent_ownership_or_expose_provider_messages() {
        assert!(!has_license(&json!({"items":[{"name":"other_product"}]})));
        assert!(has_license(&json!({"items":[{"name":"game_minecraft"}]})));
        assert_eq!(service_error(401, &json!({"error_description":"private credential"})), "minecraft_reconnect");
        assert_eq!(service_error(401, &json!({"XErr":2148916238_u64})), "minecraft_xbox_restricted");
        assert_eq!(service_error(429, &json!({})), "minecraft_rate_limit");
    }
}
