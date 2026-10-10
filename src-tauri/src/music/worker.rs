use super::worker_policy::{
    read_json_limited, render_template, resolve_entry, validate_header_name, validate_id,
    validate_manifest, validate_request, validate_url,
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use tauri::Manager;
use tokio::io::AsyncWriteExt;

const WORKER_FLAG: &str = "--harbor-music-connector-worker";
const MAX_MANIFEST_BYTES: u64 = 64 * 1024;
const MAX_ENTRY_BYTES: u64 = 256 * 1024;
const MAX_RESPONSE_BYTES: usize = 2 * 1024 * 1024;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConnectorManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub permissions: ConnectorPermissions,
    pub entry: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConnectorPermissions {
    pub domains: Vec<String>,
    #[serde(default)]
    pub allow_insecure_http: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConnectorWorkerRequest {
    pub operation: String,
    #[serde(default)]
    pub params: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectorWorkerResponse {
    pub status: u16,
    pub content_type: Option<String>,
    pub body: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WorkerProgram {
    operations: BTreeMap<String, WorkerOperation>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WorkerOperation {
    method: String,
    url: String,
    #[serde(default)]
    headers: BTreeMap<String, String>,
    body: Option<String>,
}

#[derive(Deserialize, Serialize)]
struct WorkerEnvelope {
    ok: bool,
    response: Option<ConnectorWorkerResponse>,
    error: Option<String>,
}

pub fn initialize(app: &tauri::AppHandle) -> Result<(), String> {
    std::fs::create_dir_all(connectors_dir(app)?).map_err(|error| error.to_string())
}

pub async fn run(
    app: &tauri::AppHandle,
    connector_id: &str,
    request: ConnectorWorkerRequest,
) -> Result<ConnectorWorkerResponse, String> {
    validate_request(&request)?;
    let (manifest_path, entry_path, manifest) = load_package(app, connector_id)?;
    validate_manifest(&manifest)?;
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let mut command = tokio::process::Command::new(executable);
    command
        .arg(WORKER_FLAG)
        .arg(&manifest_path)
        .arg(&entry_path)
        .current_dir(
            manifest_path
                .parent()
                .ok_or_else(|| "Connector package path is invalid".to_string())?,
        )
        .env_clear()
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    preserve_runtime_environment(&mut command);
    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let payload = serde_json::to_vec(&request).map_err(|error| error.to_string())?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Connector worker stdin is unavailable".to_string())?;
    stdin
        .write_all(&payload)
        .await
        .map_err(|error| error.to_string())?;
    drop(stdin);
    let output = tokio::time::timeout(Duration::from_secs(25), child.wait_with_output())
        .await
        .map_err(|_| "Connector worker timed out".to_string())?
        .map_err(|error| error.to_string())?;
    if output.stdout.len() > MAX_RESPONSE_BYTES + 64 * 1024 {
        return Err("Connector worker response is too large".to_string());
    }
    let envelope = serde_json::from_slice::<WorkerEnvelope>(&output.stdout).map_err(|error| {
        let stderr = String::from_utf8_lossy(&output.stderr);
        format!("Connector worker returned invalid output: {error}; {stderr}")
    })?;
    if envelope.ok {
        envelope
            .response
            .ok_or_else(|| "Connector worker returned no response".to_string())
    } else {
        Err(envelope
            .error
            .unwrap_or_else(|| "Connector worker failed".to_string()))
    }
}

pub fn try_run_from_args() -> bool {
    let args = std::env::args().collect::<Vec<_>>();
    let Some(index) = args.iter().position(|argument| argument == WORKER_FLAG) else {
        return false;
    };
    let result = args
        .get(index + 1)
        .zip(args.get(index + 2))
        .ok_or_else(|| "Connector worker paths are missing".to_string())
        .and_then(|(manifest_path, entry_path)| {
            run_child(Path::new(manifest_path), Path::new(entry_path))
        });
    let envelope = match result {
        Ok(response) => WorkerEnvelope {
            ok: true,
            response: Some(response),
            error: None,
        },
        Err(error) => WorkerEnvelope {
            ok: false,
            response: None,
            error: Some(error),
        },
    };
    let _ = serde_json::to_writer(std::io::stdout(), &envelope);
    true
}

fn run_child(manifest_path: &Path, entry_path: &Path) -> Result<ConnectorWorkerResponse, String> {
    let manifest = read_json_limited::<ConnectorManifest>(manifest_path, MAX_MANIFEST_BYTES)?;
    validate_manifest(&manifest)?;
    let expected_entry = resolve_entry(
        manifest_path
            .parent()
            .ok_or_else(|| "Connector package path is invalid".to_string())?,
        &manifest.entry,
    )?;
    let supplied_entry = entry_path
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if supplied_entry != expected_entry {
        return Err("Connector worker entry does not match its manifest".to_string());
    }
    let program = read_json_limited::<WorkerProgram>(&supplied_entry, MAX_ENTRY_BYTES)?;
    let mut input = Vec::new();
    std::io::stdin()
        .take(256 * 1024)
        .read_to_end(&mut input)
        .map_err(|error| error.to_string())?;
    let request = serde_json::from_slice::<ConnectorWorkerRequest>(&input)
        .map_err(|error| error.to_string())?;
    validate_request(&request)?;
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|error| error.to_string())?
        .block_on(execute(&manifest, &program, &request))
}

async fn execute(
    manifest: &ConnectorManifest,
    program: &WorkerProgram,
    request: &ConnectorWorkerRequest,
) -> Result<ConnectorWorkerResponse, String> {
    let operation = program
        .operations
        .get(&request.operation)
        .ok_or_else(|| "Connector operation is not defined".to_string())?;
    let method = match operation.method.to_ascii_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        _ => return Err("Connector worker only permits GET and POST".to_string()),
    };
    let rendered_url = render_template(&operation.url, &request.params, true)?;
    let url = url::Url::parse(&rendered_url)
        .map_err(|_| "Connector operation produced an invalid URL".to_string())?;
    validate_url(&url, &manifest.permissions)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .no_proxy()
        .build()
        .map_err(|error| error.to_string())?;
    let mut builder = client.request(method, url);
    for (name, value) in &operation.headers {
        validate_header_name(name)?;
        let value = render_template(value, &request.params, false)?;
        if value.contains(['\r', '\n']) {
            return Err("Connector header contains a line break".to_string());
        }
        builder = builder.header(name, value);
    }
    if let Some(body) = &operation.body {
        let body = render_template(body, &request.params, false)?;
        if body.len() > 256 * 1024 {
            return Err("Connector request body is too large".to_string());
        }
        builder = builder.body(body);
    }
    let response = builder.send().await.map_err(|error| error.to_string())?;
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let mut bytes = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| error.to_string())?;
        if bytes.len().saturating_add(chunk.len()) > MAX_RESPONSE_BYTES {
            return Err("Connector response is larger than 2 MB".to_string());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(ConnectorWorkerResponse {
        status,
        content_type,
        body: String::from_utf8_lossy(&bytes).into_owned(),
    })
}

fn load_package(
    app: &tauri::AppHandle,
    connector_id: &str,
) -> Result<(PathBuf, PathBuf, ConnectorManifest), String> {
    validate_id(connector_id)?;
    let package_dir = connectors_dir(app)?.join(connector_id);
    let manifest_path = package_dir.join("manifest.json");
    let manifest = read_json_limited::<ConnectorManifest>(&manifest_path, MAX_MANIFEST_BYTES)?;
    if manifest.id != connector_id {
        return Err("Connector manifest id does not match its directory".to_string());
    }
    let entry_path = resolve_entry(&package_dir, &manifest.entry)?;
    Ok((manifest_path, entry_path, manifest))
}

fn connectors_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("connectors"))
}

fn preserve_runtime_environment(command: &mut tokio::process::Command) {
    for name in ["SystemRoot", "WINDIR", "TEMP", "TMP"] {
        if let Some(value) = std::env::var_os(name) {
            command.env(name, value);
        }
    }
}
