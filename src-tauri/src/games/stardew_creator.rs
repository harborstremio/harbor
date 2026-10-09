//! Verified release packaging is project-specific. Source-code ZIPs are never
//! installed; unsupported projects keep their creator's normal download route.
use super::{
    stardew_manifest::Result,
    stardew_package as package,
    stardew_progress::{Progress, Work},
    stardew_remote as remote, stardew_reviews,
};
use serde_json::Value;

const REPO: &str = "https://github.com/Annosz/UIInfoSuite2";
struct Release {
    url: String,
    file: String,
    version: String,
    size: usize,
    digest: Option<String>,
}
fn release(value: &Value) -> Result<Release> {
    if value["draft"] != false || value["prerelease"] != false {
        return Err("stardew_creator_release");
    }
    let tag = remote::text(value, "tag_name", 80)?;
    let version = tag
        .strip_prefix('v')
        .filter(|v| {
            !v.is_empty()
                && v.as_bytes()[0].is_ascii_digit()
                && v.bytes()
                    .all(|v| v.is_ascii_alphanumeric() || matches!(v, b'.' | b'-' | b'+'))
        })
        .ok_or("stardew_creator_release")?;
    if value["html_url"] != format!("{REPO}/releases/tag/{tag}") {
        return Err("stardew_creator_release");
    }
    let assets = value["assets"]
        .as_array()
        .ok_or("stardew_creator_release")?;
    let ready: Vec<_> = assets
        .iter()
        .filter(|asset| {
            asset["name"]
                .as_str()
                .is_some_and(|n| n.starts_with("UIInfoSuite2.") && n.ends_with(".zip"))
        })
        .collect();
    if ready.len() != 1 {
        return Err("stardew_creator_release");
    }
    let asset = ready[0];
    let file = remote::text(asset, "name", 180)?;
    let url = remote::text(asset, "browser_download_url", 600)?;
    if !package::component(&file)
        || url != format!("{REPO}/releases/download/{tag}/{file}")
        || asset["state"] != "uploaded"
    {
        return Err("stardew_creator_release");
    }
    let size = asset["size"]
        .as_u64()
        .filter(|&s| s > 0 && s <= package::MAX_ARCHIVE as u64)
        .ok_or("stardew_creator_release")? as usize;
    let digest = match asset.get("digest") {
        None | Some(Value::Null) => None,
        Some(Value::String(s))
            if s.starts_with("sha256:")
                && s.len() == 71
                && s[7..].bytes().all(|v| v.is_ascii_hexdigit()) =>
        {
            Some(s[7..].to_ascii_lowercase())
        }
        _ => return Err("stardew_creator_release"),
    };
    Ok(Release {
        url,
        file,
        version: version.into(),
        size,
        digest,
    })
}
fn unpack(
    bytes: &[u8],
    release: &Release,
    check: &dyn Fn() -> Result<()>,
) -> Result<package::Package> {
    if bytes.len() != release.size
        || release
            .digest
            .as_ref()
            .is_some_and(|h| h != &package::hash(bytes))
    {
        return Err("stardew_creator_changed");
    }
    let mut result = package::unpack(bytes, check)?;
    if !result
        .manifest
        .id
        .eq_ignore_ascii_case("Annosz.UiInfoSuite2")
        || result.manifest.version != release.version
        || !result
            .manifest
            .update_keys
            .iter()
            .any(|k| k.eq_ignore_ascii_case("GitHub:Annosz/UIInfoSuite2"))
    {
        return Err("stardew_creator_changed");
    }
    result.origin = Some(package::Origin {
        url: format!("{REPO}/releases/tag/v{}", release.version),
        file: release.file.clone(),
        sha256: result.archive_hash.clone(),
    });
    Ok(result)
}
pub async fn review(
    profile: &str,
    path: &str,
    operation: &str,
    project: &str,
    emit: &dyn Fn(Progress),
) -> Result<stardew_reviews::Review> {
    if project != "Annosz.UiInfoSuite2" {
        return Err("stardew_creator_release");
    }
    if !cfg!(windows) {
        return Err("stardew_platform");
    }
    let work = Work::start(profile, operation, emit)?;
    // Validate the selected installation first; release native folder/process
    // locks before network I/O. Planning reopens it and validates again.
    drop(super::stardew_guard::Guard::acquire(path)?);
    if super::stardew_store::snapshot(path)?.1 {
        return Err("stardew_recovery");
    }
    work.progress("downloading", 0, 0)?;
    let client = remote::client()?;
    let data = remote::json(
        &client,
        "https://api.github.com/repos/Annosz/UIInfoSuite2/releases/latest",
        &work,
    )
    .await?;
    let release = release(&data)?;
    let bytes = remote::bytes(&client, &release.url, package::MAX_ARCHIVE, &work, true).await?;
    let package = unpack(&bytes, &release, &|| work.check())?;
    stardew_reviews::prepare_package(profile, path, package, &work)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> Value {
        serde_json::json!({"draft":false,"prerelease":false,"tag_name":"v2.3.7","html_url":format!("{REPO}/releases/tag/v2.3.7"),"assets":[{"name":"UIInfoSuite2.v2.3.7.zip","browser_download_url":format!("{REPO}/releases/download/v2.3.7/UIInfoSuite2.v2.3.7.zip"),"state":"uploaded","size":604187,"digest":null}]})
    }
    #[test]
    fn stardew_creator_only_accepts_one_stable_ready_release() {
        assert_eq!(release(&fixture()).unwrap().version, "2.3.7");
        let mut v = fixture();
        let duplicate = v["assets"][0].clone();
        v["assets"].as_array_mut().unwrap().push(duplicate);
        assert!(release(&v).is_err());
        let mut v = fixture();
        v["prerelease"] = true.into();
        assert!(release(&v).is_err());
        let mut v = fixture();
        v["assets"][0]["browser_download_url"] = "https://example.org/mod.zip".into();
        assert!(release(&v).is_err());
        let mut v = fixture();
        v["assets"][0]["name"] = "Source code.zip".into();
        assert!(release(&v).is_err());
        let mut v = fixture();
        v["assets"][0]["digest"] = "sha256:bad".into();
        assert!(release(&v).is_err());
    }
    #[test]
    fn stardew_creator_real_zip_identity_digest_and_version() {
        let path = std::env::var("HARBOR_TEST_STARDEW_ZIP").expect("real creator ZIP fixture");
        let bytes = std::fs::read(path).unwrap();
        let mut r = release(&fixture()).unwrap();
        let parsed = unpack(&bytes, &r, &|| Ok(())).unwrap();
        assert!(parsed.origin.as_ref().unwrap().valid(
            &parsed.manifest.id,
            &parsed.manifest.version,
            &parsed.archive_hash
        ));
        r.version = "9.9.9".into();
        assert_eq!(
            unpack(&bytes, &r, &|| Ok(())).err(),
            Some("stardew_creator_changed")
        );
        r.version = "2.3.7".into();
        r.digest = Some("0".repeat(64));
        assert_eq!(
            unpack(&bytes, &r, &|| Ok(())).err(),
            Some("stardew_creator_changed")
        );
    }
}
