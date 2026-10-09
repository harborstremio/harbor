//! Local Pokémon workspace. Engine transforms bytes; only reviewed commits write selected saves.
use super::pokemon_files::{atomic, commit_file, digest, read};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::OnceLock,
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    sync::Mutex,
};
const MAX: usize = 16 * 1024 * 1024;
struct Session {
    profile: String,
    workspace: Option<String>,
    path: PathBuf,
    original: Vec<u8>,
    draft: Vec<u8>,
    review: Option<String>,
    summary: Value,
    draft_summary: Value,
    changes: Vec<Value>,
}
static SESSIONS: OnceLock<Mutex<HashMap<String, Session>>> = OnceLock::new();
static ENGINE: OnceLock<Mutex<()>> = OnceLock::new();
fn sessions() -> &'static Mutex<HashMap<String, Session>> {
    SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}
fn string<'a>(value: &'a Value, key: &str) -> Result<&'a str, String> {
    value[key]
        .as_str()
        .filter(|v| !v.is_empty() && v.len() < 4096)
        .ok_or_else(|| "pokemon_request".into())
}
fn identifier(value: &str) -> Result<&str, String> {
    uuid::Uuid::parse_str(value).map_err(|_| "pokemon_request")?;
    Ok(value)
}
async fn engine(path: &Path, request: Value) -> Result<Value, String> {
    let _guard = ENGINE.get_or_init(|| Mutex::new(())).lock().await;
    let bytes = serde_json::to_vec(&request).map_err(|_| "pokemon_request")?;
    if bytes.len() > 48 * 1024 * 1024 {
        return Err("pokemon_request".into());
    }
    let mut command = tokio::process::Command::new(path);
    command
        .kill_on_drop(true)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    let mut child = command.spawn().map_err(|_| "pokemon_engine_start")?;
    let mut input = child.stdin.take().ok_or("pokemon_engine_start")?;
    let output = child.stdout.take().ok_or("pokemon_engine_start")?;
    let operation = async {
        input
            .write_all(&bytes)
            .await
            .map_err(|_| "pokemon_engine_io")?;
        input.shutdown().await.map_err(|_| "pokemon_engine_io")?;
        drop(input);
        let mut bytes = Vec::new();
        output
            .take(48 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .await
            .map_err(|_| "pokemon_engine_io")?;
        if bytes.len() > 48 * 1024 * 1024 {
            return Err("pokemon_engine_output".into());
        }
        let status = child.wait().await.map_err(|_| "pokemon_engine_io")?;
        let response: Value =
            serde_json::from_slice(&bytes).map_err(|_| "pokemon_engine_output")?;
        if response["ok"] != true {
            return Err(response["error"]
                .as_str()
                .unwrap_or("pokemon_engine_failed")
                .chars()
                .take(1000)
                .collect());
        }
        if !status.success() {
            return Err("pokemon_engine_failed".into());
        }
        Ok(response["data"].clone())
    };
    tokio::time::timeout(Duration::from_secs(45), operation)
        .await
        .map_err(|_| "pokemon_engine_timeout")?
}
async fn bank_list(root: &Path) -> Result<Value, String> {
    let mut entries = tokio::fs::read_dir(root.join("bank"))
        .await
        .map_err(|_| "pokemon_read")?;
    let mut result = Vec::new();
    let mut unreadable = 0;
    let mut scanned = 0;
    let mut truncated = false;
    while let Some(entry) = entries.next_entry().await.map_err(|_| "pokemon_read")? {
        if scanned >= 10000 {
            truncated = true;
            break;
        }
        if entry.path().extension().and_then(|v| v.to_str()) != Some("json") {
            continue;
        }
        scanned += 1;
        let value = read(&entry.path(), 256 * 1024)
            .await
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok());
        let Some(mut value) = value.filter(|value| {
            value["id"].as_str().is_some_and(|id| {
                uuid::Uuid::parse_str(id).is_ok()
                    && entry.path().file_stem().and_then(|s| s.to_str()) == Some(id)
            }) && value["info"].is_object()
                && value["info"]["species"].as_u64().is_some_and(|id| id > 0)
                && value["info"]["nickname"].is_string()
                && value["info"]["format"].is_string()
                && value["info"]["level"].as_u64().is_some()
                && value["box"].as_u64().is_some()
                && value["data"]
                    .as_str()
                    .and_then(|data| STANDARD.decode(data).ok())
                    .is_some_and(|bytes| !bytes.is_empty() && bytes.len() <= 65536)
        }) else {
            unreadable += 1;
            continue;
        };
        value.as_object_mut().unwrap().remove("data");
        result.push(value);
    }
    result.sort_by_key(|v| v["added"].as_u64().unwrap_or(0));
    Ok(json!({"bank":result,"unreadableEntries":unreadable,"bankTruncated":truncated}))
}
fn draft_path(root: &Path, path: &Path) -> PathBuf {
    root.join("drafts").join(format!(
        "{}.json",
        digest(path.to_string_lossy().as_bytes())
    ))
}
async fn store_draft(
    root: &Path,
    session: &Session,
    candidate: &[u8],
    changes: &[Value],
) -> Result<(), String> {
    let value = json!({"path":session.path,"originalHash":digest(&session.original),"candidate":STANDARD.encode(candidate),"changes":changes,"at":now()});
    atomic(
        &draft_path(root, &session.path),
        &serde_json::to_vec(&value).map_err(|_| "pokemon_write")?,
    )
    .await
}
async fn remove_draft(root: &Path, session: &Session) -> Result<(), String> {
    match tokio::fs::remove_file(draft_path(root, &session.path)).await {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("pokemon_write".into()),
    }
}
fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn clean(value: &mut Value) {
    if let Some(obj) = value.as_object_mut() {
        obj.remove("candidate");
        obj.remove("exported");
    }
}
pub async fn dispatch(
    root: PathBuf,
    engine_path: PathBuf,
    profile: String,
    mut request: Value,
) -> Result<Value, String> {
    let op = string(&request, "op")?.to_owned();
    if op == "sources" {
        return Ok(
            json!({"sourcePath":engine_path.parent().ok_or("pokemon_engine_missing")?.join("sources").join("README.md")}),
        );
    }
    if op == "bank_folder" {
        return Ok(json!({"sourcePath":root.join("bank")}));
    }
    if op == "status" {
        let mut result = bank_list(&root).await?;
        result["ready"] = json!(engine_path.is_file());
        return Ok(result);
    }
    if op == "open" {
        let selected = PathBuf::from(string(&request, "path")?);
        let bytes = read(&selected, MAX).await?;
        let path = tokio::fs::canonicalize(&selected)
            .await
            .map_err(|_| "pokemon_path")?;
        let mut summary = engine(&engine_path, json!({"op":"inspect", "data":STANDARD.encode(&bytes), "name":path.file_name().and_then(|v| v.to_str())})).await?;
        clean(&mut summary);
        let id = uuid::Uuid::new_v4().to_string();
        let workspace = request["workspace"]
            .as_str()
            .map(identifier)
            .transpose()?
            .map(str::to_owned);
        let mut state = sessions().lock().await;
        let previous = state
            .iter()
            .find(|(_, s)| s.profile == profile && s.path == path);
        let replace = if let Some((id, prior)) = previous {
            // Reloading this window can leave its native session alive. Resume the durable
            // draft under a new token; another window must not silently take it over.
            if workspace.is_none() || workspace != prior.workspace {
                return Err("pokemon_save_open".into());
            }
            Some(id.clone())
        } else {
            None
        };
        if state.len() >= 8 && replace.is_none() {
            return Err("pokemon_session_limit".into());
        }
        let mut session = Session {
            profile,
            workspace,
            path: path.clone(),
            original: bytes.clone(),
            draft: bytes,
            review: None,
            summary: summary.clone(),
            draft_summary: summary.clone(),
            changes: Vec::new(),
        };
        let draft_file = draft_path(&root, &path);
        let mut draft_skipped = false;
        if draft_file.is_file() {
            let saved = read(&draft_file, 28 * 1024 * 1024)
                .await
                .ok()
                .and_then(|raw| serde_json::from_slice::<Value>(&raw).ok());
            if let Some(saved) = saved.filter(|v| {
                v["path"].as_str() == path.to_str()
                    && v["originalHash"].as_str() == Some(digest(&session.original).as_str())
            }) {
                if let Some(candidate) = saved["candidate"]
                    .as_str()
                    .and_then(|data| STANDARD.decode(data).ok())
                    .filter(|data| data.len() <= MAX)
                {
                    if let Ok(mut recovered)=engine(&engine_path,json!({"op":"inspect","data":STANDARD.encode(&candidate),"name":path.file_name().and_then(|v|v.to_str())})).await {
                        clean(&mut recovered); session.draft=candidate;session.draft_summary=recovered;session.review=Some(uuid::Uuid::new_v4().to_string());session.changes=saved["changes"].as_array().cloned().unwrap_or_default();
                    } else { draft_skipped=true; }
                } else {
                    draft_skipped = true;
                }
            } else {
                draft_skipped = true;
            }
            // Keep an incompatible old draft recoverable; never apply it to newer game progress.
            if draft_skipped {
                tokio::fs::rename(
                    &draft_file,
                    root.join("trash")
                        .join(format!("{}.draft.json", uuid::Uuid::new_v4())),
                )
                .await
                .map_err(|_| "pokemon_write")?;
            }
        }
        let response = json!({"session":id,"name":path.file_name().and_then(|v|v.to_str()),"summary":session.draft_summary,"review":session.review,"changes":session.changes,"draftSkipped":draft_skipped});
        if let Some(previous) = replace {
            state.remove(&previous);
        }
        state.insert(id, session);
        return Ok(response);
    }
    if op == "import_file" {
        let path = PathBuf::from(string(&request, "path")?);
        let bytes = read(&path, 65536).await?;
        let format = path
            .extension()
            .and_then(|s| s.to_str())
            .map(str::to_uppercase);
        let info = engine(&engine_path, json!({"op":"entity","entity":STANDARD.encode(&bytes),"entityFormat":format,"name":path.file_name().and_then(|s|s.to_str())})).await?;
        let id = uuid::Uuid::new_v4().to_string();
        let value = json!({"id":id,"data":STANDARD.encode(bytes),"info":info["info"],"image":info["image"],"added":now(),"box":0});
        atomic(
            &root.join("bank").join(format!("{id}.json")),
            &serde_json::to_vec(&value).map_err(|_| "pokemon_write")?,
        )
        .await?;
        return bank_list(&root).await;
    }
    if op == "entry_move" || op == "entry_trash" || op == "entry_restore" {
        let entry = identifier(string(&request, "entry")?)?;
        let source = root
            .join(if op == "entry_restore" {
                "trash"
            } else {
                "bank"
            })
            .join(format!("{entry}.json"));
        let mut value: Value = serde_json::from_slice(&read(&source, 256 * 1024).await?)
            .map_err(|_| "pokemon_bank_entry")?;
        if op == "entry_move" {
            let box_id = request["box"]
                .as_u64()
                .filter(|b| *b < 1000)
                .ok_or("pokemon_request")?;
            value["box"] = json!(box_id);
            atomic(
                &source,
                &serde_json::to_vec(&value).map_err(|_| "pokemon_write")?,
            )
            .await?;
        } else {
            let destination = root
                .join(if op == "entry_restore" {
                    "bank"
                } else {
                    "trash"
                })
                .join(format!("{entry}.json"));
            if destination.exists() {
                return Err("pokemon_bank_entry".into());
            }
            tokio::fs::rename(&source, &destination)
                .await
                .map_err(|_| "pokemon_write")?;
        }
        return bank_list(&root).await;
    }
    let id = string(&request, "session")?.to_owned();
    let mut state = sessions().lock().await;
    let session = state
        .get_mut(&id)
        .filter(|s| s.profile == profile)
        .ok_or("pokemon_session")?;
    if op == "history" {
        let mut entries = tokio::fs::read_dir(root.join("backups"))
            .await
            .map_err(|_| "pokemon_read")?;
        let mut result = Vec::new();
        while let Some(entry) = entries.next_entry().await.map_err(|_| "pokemon_read")? {
            if result.len() >= 2000 {
                break;
            }
            if entry.path().extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            if let Ok(bytes) = read(&entry.path(), 16384).await {
                if let Ok(value) = serde_json::from_slice::<Value>(&bytes) {
                    if value["path"].as_str() == session.path.to_str() {
                        result.push(json!({"id":value["id"],"at":value["at"]}));
                    }
                }
            }
        }
        result.sort_by_key(|v| std::cmp::Reverse(v["at"].as_u64().unwrap_or(0)));
        return Ok(json!({"history":result}));
    }
    if op == "close" {
        state.remove(&id);
        return Ok(json!({}));
    }
    if op == "discard" {
        remove_draft(&root, session).await?;
        session.changes.clear();
        session.draft = session.original.clone();
        session.draft_summary = session.summary.clone();
        session.review = None;
        return Ok(json!({"summary":session.summary,"review":null,"changes":[]}));
    }
    if op == "commit" {
        if session.review.as_deref() != Some(string(&request, "review")?) {
            return Err("pokemon_review_changed".into());
        }
        let _lease =
            super::save_activity::acquire(&session.path).map_err(|_| "pokemon_save_running")?;
        let receipt = commit_file(
            &session.path,
            &root.join("backups"),
            &session.original,
            &session.draft,
        )
        .await?;
        let backup = receipt["id"].as_str().ok_or("pokemon_backup")?;
        let _ = remove_draft(&root, session).await;
        session.original = session.draft.clone();
        session.review = None;
        session.changes.clear();
        let summary = session.draft_summary.clone();
        session.summary = summary.clone();
        return Ok(json!({"summary":summary,"review":null,"backup":backup,"changes":[]}));
    }
    if op == "restore" {
        let backup = identifier(string(&request, "backup")?)?;
        let receipt: Value = serde_json::from_slice(
            &read(&root.join("backups").join(format!("{backup}.json")), 16384).await?,
        )
        .map_err(|_| "pokemon_backup")?;
        if receipt["path"].as_str() != session.path.to_str()
            || digest(&session.original) != digest(&read(&session.path, MAX).await?)
        {
            return Err("pokemon_save_changed".into());
        }
        let original = read(&root.join("backups").join(format!("{backup}.sav")), MAX).await?;
        if receipt["originalHash"].as_str() != Some(digest(&original).as_str()) {
            return Err("pokemon_backup".into());
        }
        let mut summary=engine(&engine_path,json!({"op":"inspect","data":STANDARD.encode(&original),"name":session.path.file_name().and_then(|s|s.to_str())})).await?;
        clean(&mut summary);
        let changes = vec![json!({"operation":"restore","differences":[],"transfer":null})];
        store_draft(&root, session, &original, &changes).await?;
        session.draft = original;
        session.changes = changes;
        let token = uuid::Uuid::new_v4().to_string();
        session.review = Some(token.clone());
        session.draft_summary = summary.clone();
        return Ok(json!({"summary":summary,"review":token,"changes":session.changes}));
    }
    if op == "deposit" {
        let exported = engine(&engine_path,json!({"op":"export","data":STANDARD.encode(&session.draft),"name":session.path.file_name().and_then(|s|s.to_str()),"box":request["box"],"slot":request["slot"]})).await?["exported"].clone();
        let info=engine(&engine_path,json!({"op":"entity","entity":exported["data"],"entityFormat":exported["format"],"name":exported["fileName"]})).await?;
        let entry = uuid::Uuid::new_v4().to_string();
        let value = json!({"id":entry,"data":exported["data"],"info":info["info"],"image":info["image"],"added":now(),"box":0});
        atomic(
            &root.join("bank").join(format!("{entry}.json")),
            &serde_json::to_vec(&value).map_err(|_| "pokemon_write")?,
        )
        .await?;
        return bank_list(&root).await;
    }
    if op == "import" {
        let entry = identifier(string(&request, "entry")?)?;
        let value: Value = serde_json::from_slice(
            &read(&root.join("bank").join(format!("{entry}.json")), 256 * 1024).await?,
        )
        .map_err(|_| "pokemon_bank_entry")?;
        request["entity"] = value["data"].clone();
        request["entityFormat"] = value["info"]["format"].clone();
    }
    if ![
        "detail",
        "edit",
        "move",
        "release",
        "create",
        "import",
        "export",
        "export_info",
    ]
    .contains(&op.as_str())
    {
        return Err("pokemon_request".into());
    }
    request["data"] = json!(STANDARD.encode(&session.draft));
    request["name"] = json!(session.path.file_name().and_then(|s| s.to_str()));
    if op == "export_info" {
        request["op"] = json!("export");
    }
    let mut result = engine(&engine_path, request.clone()).await?;
    if op == "export_info" {
        return Ok(
            json!({"fileName":result["exported"]["fileName"],"format":result["exported"]["format"]}),
        );
    }
    if op == "export" {
        let path = PathBuf::from(string(&request, "path")?);
        // Export writes to the explicitly selected destination; never overwrite an existing file.
        let bytes = STANDARD
            .decode(
                result["exported"]["data"]
                    .as_str()
                    .ok_or("pokemon_export")?,
            )
            .map_err(|_| "pokemon_export")?;
        let mut file = tokio::fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(path)
            .await
            .map_err(|_| "pokemon_export_exists")?;
        file.write_all(&bytes).await.map_err(|_| "pokemon_write")?;
        file.sync_all().await.map_err(|_| "pokemon_write")?;
        return Ok(json!({}));
    }
    if let Some(candidate) = result["candidate"].as_str() {
        let bytes = STANDARD
            .decode(candidate)
            .map_err(|_| "pokemon_engine_output")?;
        if bytes.len() > MAX {
            return Err("pokemon_engine_output".into());
        }
        if session.changes.len() >= 200 {
            return Err("pokemon_draft_limit".into());
        }
        let mut changes = session.changes.clone();
        changes.push(json!({"operation":op,"box":request["box"],"slot":request["slot"],"name":result["detail"]["entity"]["nickname"],"differences":result["differences"],"transfer":result["transfer"]}));
        store_draft(&root, session, &bytes, &changes).await?;
        session.draft = bytes;
        session.changes = changes;
        session.review = Some(uuid::Uuid::new_v4().to_string());
    }
    clean(&mut result);
    session.draft_summary = result.clone();
    Ok(json!({"summary":result,"review":session.review,"changes":session.changes}))
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    #[tokio::test]
    async fn damaged_bank_entries_are_reported_and_preserved() {
        let root = std::env::temp_dir().join(format!("pokemon-bank-test-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(root.join("bank")).await.unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let good = json!({"id":id,"data":STANDARD.encode([1,2,3]),"info":{"species":25,"nickname":"Pikachu","format":"PK3","level":5},"box":0,"added":1});
        atomic(
            &root.join("bank").join(format!("{id}.json")),
            &serde_json::to_vec(&good).unwrap(),
        )
        .await
        .unwrap();
        let broken = root
            .join("bank")
            .join(format!("{}.json", uuid::Uuid::new_v4()));
        let incomplete = root
            .join("bank")
            .join(format!("{}.json", uuid::Uuid::new_v4()));
        atomic(&broken, b"{broken").await.unwrap();
        atomic(&incomplete, b"{}").await.unwrap();
        let listing = bank_list(&root).await.unwrap();
        assert_eq!(listing["bank"].as_array().unwrap().len(), 1);
        assert_eq!(listing["unreadableEntries"], 2);
        assert_eq!(listing["bankTruncated"], false);
        assert!(listing["bank"][0].get("data").is_none());
        assert_eq!(read(&broken, 256).await.unwrap(), b"{broken");
        assert_eq!(read(&incomplete, 256).await.unwrap(), b"{}");
        let canonical = root.canonicalize().unwrap();
        assert!(canonical.starts_with(std::env::temp_dir().canonicalize().unwrap()));
        assert!(canonical
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("pokemon-bank-test-"));
        tokio::fs::remove_dir_all(canonical).await.unwrap();
    }
    #[tokio::test]
    #[ignore = "requires POKEMON_ENGINE and POKEMON_FIXTURE disposable fixture paths"]
    async fn real_engine_drafts_bank_review_commit_and_restore() {
        let engine = PathBuf::from(std::env::var("POKEMON_ENGINE").expect("set POKEMON_ENGINE"));
        let fixture = PathBuf::from(std::env::var("POKEMON_FIXTURE").expect("set POKEMON_FIXTURE"));
        let temp = tokio::fs::canonicalize(std::env::temp_dir()).await.unwrap();
        let root = temp.join(format!("harbor-pokemon-test-{}", uuid::Uuid::new_v4()));
        for folder in ["bank", "backups", "trash", "drafts"] {
            tokio::fs::create_dir_all(root.join(folder)).await.unwrap();
        }
        let path = root.join("Emerald.sav");
        let original = read(&fixture, MAX).await.unwrap();
        atomic(&path, &original).await.unwrap();
        let call = |request: Value| {
            dispatch(
                root.clone(),
                engine.clone(),
                "fixture-profile".into(),
                request,
            )
        };
        let workspace = uuid::Uuid::new_v4().to_string();
        let opened = call(json!({"op":"open","path":path,"workspace":workspace}))
            .await
            .unwrap();
        let id = opened["session"].as_str().unwrap();
        let edited =
            call(json!({"op":"edit","session":id,"box":0,"slot":0,"edit":{"nickname":"Harbor"}}))
                .await
                .unwrap();
        assert_eq!(edited["changes"].as_array().unwrap().len(), 1);
        assert_eq!(read(&path, MAX).await.unwrap(), original);
        assert!(dispatch(
            root.clone(),
            engine.clone(),
            "different-profile".into(),
            json!({"op":"detail","session":id,"box":0,"slot":0})
        )
        .await
        .is_err());
        let detail = call(json!({"op":"detail","session":id,"box":0,"slot":1}))
            .await
            .unwrap();
        assert_eq!(detail["changes"], edited["changes"]);
        assert_eq!(
            call(json!({"op":"open","path":path,"workspace":uuid::Uuid::new_v4().to_string()}))
                .await
                .unwrap_err(),
            "pokemon_save_open"
        );
        let resumed = call(json!({"op":"open","path":path,"workspace":workspace}))
            .await
            .unwrap();
        assert_eq!(
            call(json!({"op":"detail","session":id,"box":0,"slot":0}))
                .await
                .unwrap_err(),
            "pokemon_session"
        );
        let id = resumed["session"].as_str().unwrap();
        assert!(resumed["review"].is_string());
        assert_eq!(resumed["changes"], edited["changes"]);
        assert!(call(json!({"op":"commit","session":id,"review":"stale"}))
            .await
            .is_err());
        let deposited = call(json!({"op":"deposit","session":id,"box":0,"slot":0}))
            .await
            .unwrap();
        let entry = deposited["bank"][0]["id"].as_str().unwrap();
        let imported = call(json!({"op":"import","session":id,"box":0,"slot":1,"entry":entry}))
            .await
            .unwrap();
        assert_eq!(imported["changes"].as_array().unwrap().len(), 2);
        assert!(
            call(json!({"op":"import","session":id,"box":0,"slot":0,"entry":entry}))
                .await
                .is_err()
        );
        let running = super::super::save_activity::acquire(&path).unwrap();
        assert_eq!(
            call(json!({"op":"commit","session":id,"review":imported["review"]}))
                .await
                .unwrap_err(),
            "pokemon_save_running"
        );
        assert_eq!(read(&path, MAX).await.unwrap(), original);
        drop(running);
        let committed = call(json!({"op":"commit","session":id,"review":imported["review"]}))
            .await
            .unwrap();
        assert!(committed["review"].is_null());
        assert_ne!(read(&path, MAX).await.unwrap(), original);
        let history = call(json!({"op":"history","session":id})).await.unwrap();
        assert_eq!(history["history"].as_array().unwrap().len(), 1);
        let restored = call(json!({"op":"restore","session":id,"backup":committed["backup"]}))
            .await
            .unwrap();
        assert_eq!(restored["changes"][0]["operation"], "restore");
        call(json!({"op":"commit","session":id,"review":restored["review"]}))
            .await
            .unwrap();
        assert_eq!(read(&path, MAX).await.unwrap(), original);
        call(json!({"op":"entry_trash","entry":entry}))
            .await
            .unwrap();
        let back = call(json!({"op":"entry_restore","entry":entry}))
            .await
            .unwrap();
        assert_eq!(back["bank"].as_array().unwrap().len(), 1);
        let changed =
            call(json!({"op":"edit","session":id,"box":0,"slot":0,"edit":{"nickname":"Draft"}}))
                .await
                .unwrap();
        atomic(&path, b"newer external data").await.unwrap();
        assert_eq!(
            call(json!({"op":"commit","session":id,"review":changed["review"]}))
                .await
                .unwrap_err(),
            "pokemon_save_changed"
        );
        assert_eq!(read(&path, MAX).await.unwrap(), b"newer external data");
        call(json!({"op":"discard","session":id})).await.unwrap();
        call(json!({"op":"close","session":id})).await.unwrap();
        let resolved = tokio::fs::canonicalize(&root).await.unwrap();
        assert!(resolved.starts_with(&temp));
        assert!(resolved
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("harbor-pokemon-test-"));
        tokio::fs::remove_dir_all(resolved).await.unwrap();
    }
}
