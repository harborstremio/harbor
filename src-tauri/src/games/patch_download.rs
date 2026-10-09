//! Creator files are inspected as data. Archive paths are never used as output paths.
use reqwest::{redirect::Policy, Url};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{collections::HashMap, fs, io::{Cursor, Read}, path::Path, sync::{Arc, Mutex, OnceLock}, time::Duration};

const MAX_BYTES: usize = 64 * 1024 * 1024;
const MAX_PAGE: usize = 2 * 1024 * 1024;
type Result<T> = std::result::Result<T, &'static str>;

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct DownloadFile { pub name: String, pub path: String, pub bytes: usize, pub sha256: String }
#[derive(Serialize)]
pub struct DownloadLink { pub name: String, pub url: String }
#[derive(Serialize)]
pub struct DownloadReview { pub files: Vec<DownloadFile>, pub links: Vec<DownloadLink>, pub notes: Vec<String> }

fn url(value: &str) -> Result<Url> {
    let value = Url::parse(value).map_err(|_| "patch_download_url")?;
    if value.scheme() != "https" || !value.username().is_empty() || value.password().is_some() || value.port().is_some() { return Err("patch_download_url"); }
    Ok(value)
}
fn format(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"BPS1") { Some("bps") } else if bytes.starts_with(b"UPS1") { Some("ups") } else if bytes.starts_with(b"PATCH") { Some("ips") } else { None }
}
fn save(root: &Path, name: &str, bytes: &[u8]) -> Result<DownloadFile> {
    let ext = format(bytes).ok_or("patch_unsupported")?;
    let hash = format!("{:x}", Sha256::digest(bytes));
    let path = root.join(format!("{hash}.{ext}"));
    // A content-addressed file is reused only if its contents still match.
    if !path.exists() {
        let mut retained=0u64;
        for entry in fs::read_dir(root).map_err(|_|"patch_write_failed")?.take(4096) {
            let entry=entry.map_err(|_|"patch_read_failed")?;
            let name=entry.file_name().to_string_lossy().into_owned();
            let (stem,ext)=name.rsplit_once('.').unwrap_or(("",""));
            if stem.len()!=64 || !stem.bytes().all(|b|b.is_ascii_hexdigit()) || !["bps","ips","ups"].contains(&ext) || !entry.file_type().map_err(|_|"patch_read_failed")?.is_file(){continue;}
            let meta=entry.metadata().map_err(|_|"patch_read_failed")?;
            if meta.modified().ok().and_then(|v|v.elapsed().ok()).is_some_and(|age|age>Duration::from_secs(7*24*60*60)) {fs::remove_file(entry.path()).map_err(|_|"patch_write_failed")?;} else {retained=retained.saturating_add(meta.len());}
        }
        if retained.saturating_add(bytes.len() as u64)>512*1024*1024 {return Err("patch_too_large");}
        use std::io::Write;
        let mut file=fs::OpenOptions::new().write(true).create_new(true).open(&path).map_err(|_|"patch_write_failed")?;
        if file.write_all(bytes).and_then(|_|file.sync_all()).is_err(){drop(file);let _=fs::remove_file(&path);return Err("patch_write_failed");}
    }
    else if fs::read(&path).map_err(|_| "patch_read_failed")? != bytes { return Err("patch_inputs_changed"); }
    Ok(DownloadFile { name: name.rsplit(['/', '\\']).next().unwrap_or("Patch").chars().take(200).collect(), path: path.to_string_lossy().into_owned(), bytes: bytes.len(), sha256: hash })
}
pub fn inspect(root: &Path, name: &str, bytes: &[u8]) -> Result<DownloadReview> {
    if bytes.len() > MAX_BYTES { return Err("patch_too_large"); }
    fs::create_dir_all(root).map_err(|_| "patch_write_failed")?;
    let mut result = DownloadReview { files: vec![], links: vec![], notes: vec![] };
    if format(bytes).is_some() { result.files.push(save(root,name,bytes)?); return Ok(result); }
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|_| "patch_download_empty")?;
    if archive.len() > 2048 { return Err("patch_too_large"); }
    let mut total=0usize;
    for index in 0..archive.len() {
        let mut file=archive.by_index(index).map_err(|_| "patch_invalid")?;
        let name=file.name().to_string();
        let ext=name.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
        if !["bps","ips","ups","txt","md"].contains(&ext.as_str()) { continue; }
        let note=["txt","md"].contains(&ext.as_str());
        if note && (result.notes.len()>=8 || file.size()>32*1024) {continue;}
        let cap=if note { 32*1024 } else { MAX_BYTES };
        if file.size()>cap as u64 || total.saturating_add(file.size() as usize)>MAX_BYTES { return Err("patch_too_large"); }
        let mut data=vec![];
        file.by_ref().take(cap as u64+1).read_to_end(&mut data).map_err(|_| "patch_invalid")?;
        if data.len()>cap { return Err("patch_too_large"); }
        total+=data.len();
        if ["txt","md"].contains(&ext.as_str()) { if result.notes.len()<8 { result.notes.push(String::from_utf8_lossy(&data).into_owned()); } }
        else { if result.files.len()>=32 { return Err("patch_too_large"); } result.files.push(save(root,&name,&data)?); }
    }
    if result.files.is_empty() { return Err("patch_download_empty"); }
    Ok(result)
}
fn links(base: &Url, bytes: &[u8]) -> DownloadReview {
    let text=String::from_utf8_lossy(bytes);
    let pattern=regex::Regex::new(r#"(?is)<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>(.*?)</a>"#).unwrap();
    let tags=regex::Regex::new(r"<[^>]+>").unwrap();
    let mut found=vec![];
    for capture in pattern.captures_iter(&text) {
        let Ok(link)=base.join(&capture[1].replace("&amp;","&")) else {continue};
        let Ok(link)=url(link.as_str()) else {continue};
        let path=link.path().to_ascii_lowercase();
        let downloadable=[".zip",".bps",".ips",".ups"].iter().any(|ext|path.ends_with(ext)) || (link.host_str()==Some("www.mediafire.com") && path.starts_with("/file/"));
        if !downloadable || found.iter().any(|v:&DownloadLink|v.url==link.as_str()) {continue;}
        let label=tags.replace_all(&capture[2],"").trim().replace("&amp;","&");
        found.push(DownloadLink {name:if label.is_empty(){link.path_segments().and_then(Iterator::last).unwrap_or("Patch").to_string()}else{label.chars().take(160).collect()},url:link.into()});
        if found.len()==32 {break;}
    }
    DownloadReview {files:vec![],links:found,notes:vec![]}
}
fn pending() -> &'static Mutex<HashMap<String,Arc<tokio::sync::Notify>>> {
    static PENDING: OnceLock<Mutex<HashMap<String,Arc<tokio::sync::Notify>>>>=OnceLock::new();
    PENDING.get_or_init(||Mutex::new(HashMap::new()))
}
pub fn cancel(id:&str) {if let Ok(map)=pending().lock(){if let Some(notify)=map.get(id){notify.notify_one();}}}
pub async fn download(root: &Path, input: String, id:String) -> Result<DownloadReview> {
    static PERMIT: tokio::sync::Semaphore=tokio::sync::Semaphore::const_new(1);
    let _permit=PERMIT.try_acquire().map_err(|_|"patch_busy")?;
    if id.len()>80 || id.is_empty(){return Err("patch_invalid");}
    let notify=Arc::new(tokio::sync::Notify::new());
    pending().lock().map_err(|_|"patch_busy")?.insert(id.clone(),notify.clone());
    let result=tokio::select! {
        result=tokio::time::timeout(Duration::from_secs(120),download_inner(root,input))=>result.unwrap_or(Err("patch_download_failed")),
        _=notify.notified()=>Err("patch_cancelled"),
    };
    if let Ok(mut map)=pending().lock(){map.remove(&id);}
    result
}
async fn download_inner(root: &Path, input: String) -> Result<DownloadReview> {
    let mut target=url(&input)?;
    if matches!(target.host_str(),Some("mediafire.com"|"www.mediafire.com")) {
        let review=super::source_public_files::review(super::source_public_files::Request {url:input.clone(),file:String::new()}).await.map_err(|_|"patch_download_failed")?;
        let file=review.selected_id.or_else(||review.files.first().map(|file|file.id.clone())).ok_or("patch_download_empty")?;
        let result=super::source_public_files::prepare(super::source_public_files::Request {url:input,file}).await.map_err(|_|"patch_download_failed")?;
        target=url(&result.url)?;
    }
    let client=reqwest::Client::builder().timeout(Duration::from_secs(90)).redirect(Policy::none()).user_agent("Harbor/0.9 (ROM patch download)").build().map_err(|_|"patch_download_failed")?;
    for _ in 0..6 {
        crate::http_fetch::validate_target(&target,false).await.map_err(|_|"patch_download_url")?;
        let mut response=client.get(target.clone()).send().await.map_err(|_|"patch_download_failed")?;
        if response.status().is_redirection() {
            target=url(target.join(response.headers().get("location").and_then(|v|v.to_str().ok()).ok_or("patch_download_failed")?).map_err(|_|"patch_download_url")?.as_str())?;continue;
        }
        if !response.status().is_success() {return Err("patch_download_failed");}
        let html=response.headers().get("content-type").and_then(|v|v.to_str().ok()).is_some_and(|v|v.contains("text/html"));
        let max=if html {MAX_PAGE}else{MAX_BYTES};
        if response.content_length().is_some_and(|size|size>max as u64) {return Err("patch_too_large");}
        let mut data=vec![];
        while let Some(chunk)=response.chunk().await.map_err(|_|"patch_download_failed")? {if data.len()+chunk.len()>max{return Err("patch_too_large");}data.extend_from_slice(&chunk);}
        return if html {Ok(links(&target,&data))} else {inspect(root,target.path_segments().and_then(Iterator::last).unwrap_or("Patch"),&data)};
    }
    Err("patch_download_failed")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn rejects_non_https_and_credentials(){for value in ["file:///C:/a","http://example.com/a","https://user:pass@example.com/a","https://example.com:9000/a"]{assert!(url(value).is_err());}}
    #[test] fn recognizes_only_patch_headers(){assert_eq!(format(b"UPS1123"),Some("ups"));assert_eq!(format(b"MZfake.ips"),None);}
    #[test] fn resolves_creator_links(){let result=links(&url("https://example.com/hack/").unwrap(),br#"<a href="../files/new.zip">New <b>version</b></a><a href="https://bad/a.exe">Bad</a><a href="../files/new.zip">Duplicate</a>"#);assert_eq!(result.links.len(),1);assert_eq!(result.links[0].name,"New version");assert_eq!(result.links[0].url,"https://example.com/files/new.zip");}
    #[test] fn zip_keeps_only_verified_patch_data_and_bounded_notes(){
        use std::io::Write;
        let root=std::env::temp_dir().join(format!("harbor-patch-download-{}",uuid::Uuid::new_v4()));
        let mut archive=zip::ZipWriter::new(Cursor::new(vec![]));
        for (name,data) in [("../../patch.ips",b"PATCH\0\0\x01\0\x02XYEOF".as_slice()),("setup.exe",b"MZ"),("readme.txt",b"Use the required original game")]{archive.start_file(name,zip::write::SimpleFileOptions::default()).unwrap();archive.write_all(data).unwrap();}
        let bytes=archive.finish().unwrap().into_inner();
        let result=inspect(&root,"creator.zip",&bytes).unwrap();
        assert_eq!(result.files.len(),1);assert_eq!(result.notes.len(),1);
        assert_eq!(Path::new(&result.files[0].path).parent(),Some(root.as_path()));
        assert_eq!(fs::read_dir(&root).unwrap().count(),1);
        assert_eq!(inspect(&root,"again.zip",&bytes).unwrap().files[0].sha256,result.files[0].sha256);
        fs::write(&result.files[0].path,b"modified").unwrap();assert!(inspect(&root,"again.zip",&bytes).is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test] fn archive_without_patches_is_not_an_installable_hack(){
        use std::io::Write;
        let root=std::env::temp_dir().join(format!("harbor-patch-download-{}",uuid::Uuid::new_v4()));
        let mut archive=zip::ZipWriter::new(Cursor::new(vec![]));archive.start_file("game.gba",zip::write::SimpleFileOptions::default()).unwrap();archive.write_all(b"game data").unwrap();
        assert!(matches!(inspect(&root,"game.zip",&archive.finish().unwrap().into_inner()),Err("patch_download_empty")));
        fs::remove_dir_all(root).unwrap();
    }
}
