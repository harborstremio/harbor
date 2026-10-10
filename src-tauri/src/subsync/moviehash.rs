use std::collections::HashMap;

const CHUNK: u64 = 65536;

#[derive(serde::Serialize)]
pub struct MovieHash {
    pub hash: String,
    pub size: u64,
}

fn sum_u64_le(buf: &[u8]) -> u64 {
    let mut sum: u64 = 0;
    let mut i = 0;
    while i + 8 <= buf.len() {
        let mut v = [0u8; 8];
        v.copy_from_slice(&buf[i..i + 8]);
        sum = sum.wrapping_add(u64::from_le_bytes(v));
        i += 8;
    }
    sum
}

fn hash_from_ends(size: u64, head: &[u8], tail: &[u8]) -> String {
    let h = size
        .wrapping_add(sum_u64_le(head))
        .wrapping_add(sum_u64_le(tail));
    format!("{:016x}", h)
}

fn local_path(url: &str) -> Option<std::path::PathBuf> {
    if let Some(rest) = url.strip_prefix("file://") {
        let trimmed = rest.trim_start_matches('/');
        return Some(std::path::PathBuf::from(trimmed));
    }
    if url.starts_with("http://") || url.starts_with("https://") {
        return None;
    }
    let pb = std::path::PathBuf::from(url);
    if pb.is_absolute() {
        Some(pb)
    } else {
        None
    }
}

fn local_hash(path: &std::path::Path) -> Result<MovieHash, String> {
    use std::io::{Read, Seek, SeekFrom};
    let mut f = std::fs::File::open(path).map_err(|e| format!("open: {}", e))?;
    let size = f.metadata().map_err(|e| format!("stat: {}", e))?.len();
    if size < CHUNK * 2 {
        return Err("file too small to hash".into());
    }
    let mut head = vec![0u8; CHUNK as usize];
    f.read_exact(&mut head)
        .map_err(|e| format!("read head: {}", e))?;
    f.seek(SeekFrom::Start(size - CHUNK))
        .map_err(|e| format!("seek: {}", e))?;
    let mut tail = vec![0u8; CHUNK as usize];
    f.read_exact(&mut tail)
        .map_err(|e| format!("read tail: {}", e))?;
    Ok(MovieHash {
        hash: hash_from_ends(size, &head, &tail),
        size,
    })
}

fn total_from_content_range(h: &str) -> Option<u64> {
    h.rsplit('/')
        .next()
        .and_then(|s| s.trim().parse::<u64>().ok())
}

async fn range_get(
    client: &reqwest::Client,
    url: &str,
    headers: &HashMap<String, String>,
    range: &str,
) -> Result<reqwest::Response, String> {
    let mut req = client.get(url).header(reqwest::header::RANGE, range);
    for (k, v) in headers {
        req = req.header(k.as_str(), v.as_str());
    }
    req.send().await.map_err(|e| format!("request: {}", e))
}

async fn http_hash(
    url: &str,
    headers: &HashMap<String, String>,
    size_hint: u64,
) -> Result<MovieHash, String> {
    let client = reqwest::Client::builder()
        .user_agent("Harbor")
        .build()
        .map_err(|e| format!("client: {}", e))?;

    let head_resp = range_get(&client, url, headers, "bytes=0-65535").await?;
    if head_resp.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        return Err(format!("range unsupported: {}", head_resp.status()));
    }
    let size = if size_hint >= CHUNK * 2 {
        size_hint
    } else {
        head_resp
            .headers()
            .get(reqwest::header::CONTENT_RANGE)
            .and_then(|h| h.to_str().ok())
            .and_then(total_from_content_range)
            .ok_or_else(|| "unknown size".to_string())?
    };
    if size < CHUNK * 2 {
        return Err("file too small to hash".into());
    }
    let head = head_resp
        .bytes()
        .await
        .map_err(|e| format!("head body: {}", e))?;
    if head.len() < CHUNK as usize {
        return Err("short head".into());
    }

    let tail_range = format!("bytes={}-{}", size - CHUNK, size - 1);
    let tail_resp = range_get(&client, url, headers, &tail_range).await?;
    if tail_resp.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        return Err(format!("range unsupported (tail): {}", tail_resp.status()));
    }
    let tail = tail_resp
        .bytes()
        .await
        .map_err(|e| format!("tail body: {}", e))?;
    if tail.len() < CHUNK as usize {
        return Err("short tail".into());
    }

    Ok(MovieHash {
        hash: hash_from_ends(size, &head[..CHUNK as usize], &tail[..CHUNK as usize]),
        size,
    })
}

#[tauri::command]
pub async fn compute_moviehash(
    url: String,
    headers: Option<HashMap<String, String>>,
    size: Option<u64>,
) -> Result<MovieHash, String> {
    if let Some(path) = local_path(&url) {
        return local_hash(&path);
    }
    let hdrs = headers.unwrap_or_default();
    http_hash(&url, &hdrs, size.unwrap_or(0)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_ends_hash_equals_size() {
        let head = vec![0u8; CHUNK as usize];
        let tail = vec![0u8; CHUNK as usize];
        assert_eq!(hash_from_ends(131072, &head, &tail), "0000000000020000");
    }

    #[test]
    fn wrapping_sum_matches_manual() {
        let buf = vec![1u8; CHUNK as usize];
        let per = 0x0101010101010101u64;
        let n = CHUNK / 8;
        let ones = per.wrapping_mul(n);
        let expect = 200000u64.wrapping_add(ones).wrapping_add(ones);
        assert_eq!(
            hash_from_ends(200000, &buf, &buf),
            format!("{:016x}", expect)
        );
    }
}
