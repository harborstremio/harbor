use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const WORKER_JS: &str = include_str!("../relay/worker.js");
const SCRIPT_NAME: &str = "harbor-together-relay";
const CF_BASE: &str = "https://api.cloudflare.com/client/v4";

const NAMESPACE_RETRY_BACKOFF_MS: [u64; 6] = [1500, 2500, 4000, 6000, 8000, 10000];

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CfAccount {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct DeployResult {
    pub url: String,
    pub account_id: String,
    pub script_name: String,
    pub subdomain: String,
}

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("harbor/0.1")
        .build()
        .expect("reqwest client")
}

async fn cf_get(url: &str, token: &str) -> Result<Value, String> {
    let res = client()
        .get(url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("network error: {e}"))?;
    let text = res.text().await.map_err(|e| e.to_string())?;
    serde_json::from_str::<Value>(&text).map_err(|e| format!("bad json: {e} — {text}"))
}

fn extract_error(body: &Value) -> String {
    if let Some(arr) = body.get("errors").and_then(|v| v.as_array()) {
        if let Some(first) = arr.first() {
            let code = first.get("code").and_then(|v| v.as_i64()).unwrap_or(0);
            let msg = first
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            return format!("Cloudflare error {code}: {msg}");
        }
    }
    "Cloudflare request failed".to_string()
}

#[tauri::command]
pub async fn cf_list_accounts(api_token: String) -> Result<Vec<CfAccount>, String> {
    let body = cf_get(&format!("{CF_BASE}/accounts"), &api_token).await?;
    if !body
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(extract_error(&body));
    }
    let arr = body
        .get("result")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(arr
        .into_iter()
        .filter_map(|a| {
            Some(CfAccount {
                id: a.get("id").and_then(|v| v.as_str())?.to_string(),
                name: a
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Account")
                    .to_string(),
            })
        })
        .collect())
}

async fn ensure_subdomain(api_token: &str, account_id: &str) -> Result<String, String> {
    let url = format!("{CF_BASE}/accounts/{account_id}/workers/subdomain");
    let body = cf_get(&url, api_token).await?;
    if let Some(sub) = body.pointer("/result/subdomain").and_then(|v| v.as_str()) {
        if !sub.is_empty() {
            return Ok(sub.to_string());
        }
    }
    Err("This Cloudflare account doesn't have a workers.dev subdomain yet.".to_string())
}

#[tauri::command]
pub async fn cf_deploy_relay(
    api_token: String,
    account_id: String,
) -> Result<DeployResult, String> {
    let subdomain = ensure_subdomain(&api_token, &account_id).await?;
    let exists = script_exists(&api_token, &account_id).await?;

    let bindings = json!([
        { "type": "durable_object_namespace", "name": "ROOM", "class_name": "Room" }
    ]);

    let metadata_with_migrations = json!({
        "main_module": "worker.js",
        "compatibility_date": "2026-05-01",
        "bindings": bindings,
        "migrations": { "tag": "v1", "new_sqlite_classes": ["Room"] }
    });
    let metadata_no_migrations = json!({
        "main_module": "worker.js",
        "compatibility_date": "2026-05-01",
        "bindings": bindings,
    });

    let primary = if exists {
        metadata_no_migrations.clone()
    } else {
        metadata_with_migrations.clone()
    };
    let fallback = if exists {
        metadata_with_migrations
    } else {
        metadata_no_migrations
    };

    upload_with_retry(&api_token, &account_id, &primary, &fallback).await?;
    enable_subdomain_route(&api_token, &account_id).await?;

    Ok(DeployResult {
        url: format!("wss://{SCRIPT_NAME}.{subdomain}.workers.dev"),
        account_id,
        script_name: SCRIPT_NAME.to_string(),
        subdomain,
    })
}

async fn upload_with_retry(
    api_token: &str,
    account_id: &str,
    primary: &Value,
    fallback: &Value,
) -> Result<(), String> {
    let mut last_err: Option<String> = None;
    for attempt in 0..=NAMESPACE_RETRY_BACKOFF_MS.len() {
        let result = upload_worker(api_token, account_id, primary.to_string()).await;
        match result {
            Ok(()) => return Ok(()),
            Err(e) if needs_migration_fallback(&e) => {
                return upload_worker(api_token, account_id, fallback.to_string()).await;
            }
            Err(e) if is_namespace_propagating(&e) => {
                last_err = Some(e);
                if attempt == NAMESPACE_RETRY_BACKOFF_MS.len() {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(NAMESPACE_RETRY_BACKOFF_MS[attempt]))
                    .await;
            }
            Err(e) => return Err(e),
        }
    }
    Err(last_err.unwrap_or_else(|| "namespace still propagating".to_string()))
}

fn needs_migration_fallback(e: &str) -> bool {
    e.contains("10074")
        || e.contains("already depend")
        || e.contains("already dependedn")
        || e.contains("missing_migration")
}

fn is_namespace_propagating(e: &str) -> bool {
    e.contains("10065") || (e.contains("already in use") && e.contains("namespace"))
}

async fn script_exists(api_token: &str, account_id: &str) -> Result<bool, String> {
    let url = format!("{CF_BASE}/accounts/{account_id}/workers/scripts/{SCRIPT_NAME}");
    let res = client()
        .get(&url)
        .bearer_auth(api_token)
        .send()
        .await
        .map_err(|e| format!("network error: {e}"))?;
    Ok(res.status().is_success())
}

async fn upload_worker(api_token: &str, account_id: &str, metadata: String) -> Result<(), String> {
    let url = format!("{CF_BASE}/accounts/{account_id}/workers/scripts/{SCRIPT_NAME}");
    let metadata_part = Part::text(metadata)
        .mime_str("application/json")
        .map_err(|e| e.to_string())?;
    let worker_part = Part::text(WORKER_JS.to_string())
        .file_name("worker.js")
        .mime_str("application/javascript+module")
        .map_err(|e| e.to_string())?;
    let form = Form::new()
        .part("metadata", metadata_part)
        .part("worker.js", worker_part);

    let res = client()
        .put(&url)
        .bearer_auth(api_token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("network error: {e}"))?;

    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if status.is_success() {
        return Ok(());
    }
    let body: Value = serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));
    Err(extract_error(&body))
}

async fn enable_subdomain_route(api_token: &str, account_id: &str) -> Result<(), String> {
    let url = format!("{CF_BASE}/accounts/{account_id}/workers/scripts/{SCRIPT_NAME}/subdomain");
    let res = client()
        .post(&url)
        .bearer_auth(api_token)
        .json(&json!({ "enabled": true }))
        .send()
        .await
        .map_err(|e| format!("network error: {e}"))?;
    if res.status().is_success() {
        return Ok(());
    }
    let text = res.text().await.unwrap_or_default();
    let body: Value = serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));
    Err(extract_error(&body))
}

#[tauri::command]
pub async fn cf_delete_relay(api_token: String, account_id: String) -> Result<(), String> {
    let url = format!("{CF_BASE}/accounts/{account_id}/workers/scripts/{SCRIPT_NAME}");
    let res = client()
        .delete(&url)
        .bearer_auth(&api_token)
        .query(&[("force", "true")])
        .send()
        .await
        .map_err(|e| format!("network error: {e}"))?;
    if res.status().is_success() || res.status().as_u16() == 404 {
        return Ok(());
    }
    let text = res.text().await.unwrap_or_default();
    let body: Value = serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));
    Err(extract_error(&body))
}

#[tauri::command]
pub async fn cf_relay_status(api_token: String, account_id: String) -> Result<bool, String> {
    let url = format!("{CF_BASE}/accounts/{account_id}/workers/scripts/{SCRIPT_NAME}");
    let res = client()
        .get(&url)
        .bearer_auth(&api_token)
        .send()
        .await
        .map_err(|e| format!("network error: {e}"))?;
    Ok(res.status().is_success())
}
