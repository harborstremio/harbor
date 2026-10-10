use super::*;

const YT_DLP_EXTRACTION: &[&str] = &[
    "PYZ.pyz",
    "base_library.zip",
    "Cryptodome",
    "certifi",
    "curl_cffi",
    "python3.14",
    "setuptools",
    "websockets",
    "yt_dlp_ejs",
];

const FOREIGN_EXTRACTION: &[&str] = &[
    "PYZ.pyz",
    "base_library.zip",
    "Cryptodome",
    "certifi",
    "python3.14",
    "setuptools",
];

const AN_HOUR: Duration = Duration::from_secs(3600);

fn now() -> SystemTime {
    SystemTime::now()
}

fn an_hour_later() -> SystemTime {
    SystemTime::now() + AN_HOUR + Duration::from_secs(1)
}

fn fixture() -> PathBuf {
    let root = std::env::temp_dir().join(format!("harbor-ytdlp-sweep-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&root).unwrap();
    root
}

fn extraction(root: &Path, name: &str, contents: &[&str]) -> PathBuf {
    let dir = root.join(name);
    std::fs::create_dir_all(&dir).unwrap();
    for entry in contents {
        std::fs::write(dir.join(entry), b"payload").unwrap();
    }
    dir
}

#[test]
fn only_prefixed_directories_are_swept() {
    let root = fixture();
    let cache = extraction(&root, "harbor-trailers", YT_DLP_EXTRACTION);
    let unprefixed = extraction(&root, "MEI42", YT_DLP_EXTRACTION);
    let infixed = extraction(&root, "tmp_MEI42", YT_DLP_EXTRACTION);
    let orphan = extraction(&root, "_MEI42", YT_DLP_EXTRACTION);

    assert_eq!(purge_extractions(&root, AN_HOUR, true, an_hour_later()), 1);
    assert!(cache.is_dir());
    assert!(unprefixed.is_dir());
    assert!(infixed.is_dir());
    assert!(!orphan.exists());
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn attribution_spares_an_extraction_that_is_not_yt_dlp() {
    let root = fixture();
    let foreign = extraction(&root, "_MEIfmpeg", FOREIGN_EXTRACTION);
    let empty = extraction(&root, "_MEIempty", &[]);
    let ours = extraction(&root, "_MEIours", YT_DLP_EXTRACTION);

    assert_eq!(purge_extractions(&root, AN_HOUR, true, an_hour_later()), 1);
    assert!(foreign.is_dir());
    assert!(empty.is_dir());
    assert!(!ours.exists());
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn attribution_reads_only_the_names_a_real_bundle_leaves_at_the_top_level() {
    let root = fixture();
    let ours = extraction(&root, "_MEIours", YT_DLP_EXTRACTION);
    let foreign = extraction(&root, "_MEIfmpeg", FOREIGN_EXTRACTION);
    let buried = extraction(&root, "_MEIburied", FOREIGN_EXTRACTION);
    extraction(&buried, "nested", &["yt_dlp_ejs"]);

    assert!(is_ytdlp_extraction(&ours));
    assert!(!is_ytdlp_extraction(&foreign));
    assert!(!is_ytdlp_extraction(&buried));
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn harbors_own_directory_is_swept_without_attribution() {
    let root = fixture();
    let foreign = extraction(&root, "_MEIfmpeg", FOREIGN_EXTRACTION);
    let ours = extraction(&root, "_MEIours", YT_DLP_EXTRACTION);

    assert_eq!(purge_extractions(&root, AN_HOUR, false, an_hour_later()), 2);
    assert!(!foreign.exists());
    assert!(!ours.exists());
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn the_age_threshold_is_honoured() {
    let root = fixture();
    let orphan = extraction(&root, "_MEIfresh", YT_DLP_EXTRACTION);

    assert_eq!(purge_extractions(&root, AN_HOUR, true, now()), 0);
    assert!(orphan.is_dir());
    let just_short = SystemTime::now() + AN_HOUR - Duration::from_secs(5);
    assert_eq!(purge_extractions(&root, AN_HOUR, true, just_short), 0);
    assert!(orphan.is_dir());
    assert_eq!(purge_extractions(&root, AN_HOUR, true, an_hour_later()), 1);
    assert!(!orphan.exists());
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn a_file_named_like_an_extraction_is_left_alone() {
    let root = fixture();
    let decoy = root.join("_MEI42");
    std::fs::write(&decoy, b"yt_dlp_ejs").unwrap();

    assert_eq!(purge_extractions(&root, AN_HOUR, false, an_hour_later()), 0);
    assert!(decoy.is_file());
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn a_directory_that_cannot_be_read_removes_nothing() {
    let root = fixture();
    let absent = root.join("absent");

    assert_eq!(purge_extractions(&absent, AN_HOUR, true, an_hour_later()), 0);
    assert_eq!(
        purge_extractions(&absent, Duration::ZERO, false, an_hour_later()),
        0
    );
    assert!(!is_ytdlp_extraction(&absent));
    std::fs::remove_dir_all(&root).unwrap();
    assert_eq!(purge_extractions(&root, AN_HOUR, true, an_hour_later()), 0);
}

#[test]
fn a_clock_behind_the_directory_spares_it() {
    let root = fixture();
    let orphan = extraction(&root, "_MEIskewed", YT_DLP_EXTRACTION);

    assert_eq!(
        purge_extractions(&root, AN_HOUR, true, SystemTime::UNIX_EPOCH),
        0
    );
    assert!(orphan.is_dir());
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn the_shared_sweep_is_confined_to_the_darwin_user_temp_directory() {
    assert!(is_darwin_user_temp(Path::new(
        "/var/folders/p4/fj12jx0d7633vkdyjr438sww0000gn/T/"
    )));
    assert!(is_darwin_user_temp(Path::new(
        "/private/var/folders/p4/fj12jx0d7633vkdyjr438sww0000gn/T"
    )));
    assert!(!is_darwin_user_temp(Path::new("/tmp")));
    assert!(!is_darwin_user_temp(Path::new("/var/tmp")));
    assert!(!is_darwin_user_temp(Path::new("/var/foldersnope")));
    assert!(!is_darwin_user_temp(Path::new("/Users/js/scratch")));
    assert!(!is_darwin_user_temp(Path::new("")));
}

#[cfg(unix)]
#[test]
fn a_symlinked_extraction_is_neither_followed_nor_removed() {
    let root = fixture();
    let outside = fixture();
    let bait = extraction(&outside, "_MEIbait", YT_DLP_EXTRACTION);
    let keepsake = outside.join("keep.txt");
    std::fs::write(&keepsake, b"payload").unwrap();
    let link = root.join("_MEIlink");
    std::os::unix::fs::symlink(&outside, &link).unwrap();

    assert_eq!(purge_extractions(&root, AN_HOUR, false, an_hour_later()), 0);
    assert!(std::fs::symlink_metadata(&link).unwrap().is_symlink());
    assert!(keepsake.is_file());
    assert!(bait.is_dir());
    std::fs::remove_file(&link).unwrap();
    std::fs::remove_dir_all(&root).unwrap();
    std::fs::remove_dir_all(&outside).unwrap();
}

#[cfg(unix)]
#[test]
fn a_symlinked_sweep_root_is_refused() {
    let real = fixture();
    let victim = extraction(&real, "_MEIvictim", YT_DLP_EXTRACTION);
    let link = std::env::temp_dir().join(format!("harbor-ytdlp-root-{}", uuid::Uuid::new_v4()));
    std::os::unix::fs::symlink(&real, &link).unwrap();

    assert_eq!(purge_extractions(&link, AN_HOUR, false, an_hour_later()), 0);
    assert!(victim.is_dir());
    std::fs::remove_file(&link).unwrap();
    std::fs::remove_dir_all(&real).unwrap();
}

#[cfg(unix)]
#[test]
fn an_unreadable_extraction_survives_attribution() {
    use std::os::unix::fs::PermissionsExt;
    let root = fixture();
    let sealed = extraction(&root, "_MEIsealed", YT_DLP_EXTRACTION);
    std::fs::set_permissions(&sealed, std::fs::Permissions::from_mode(0o000)).unwrap();
    let is_sealed = std::fs::read_dir(&sealed).is_err();
    let removed = purge_extractions(&root, AN_HOUR, true, an_hour_later());
    std::fs::set_permissions(&sealed, std::fs::Permissions::from_mode(0o755)).ok();

    assert!(is_sealed, "chmod 000 left the directory readable");
    assert_eq!(removed, 0);
    assert!(sealed.is_dir());
    std::fs::remove_dir_all(&root).unwrap();
}

#[cfg(windows)]
#[test]
fn an_extraction_that_cannot_be_removed_is_not_counted() {
    use std::os::windows::fs::OpenOptionsExt;
    let root = fixture();
    let locked = extraction(&root, "_MEIlocked", YT_DLP_EXTRACTION);
    let handle = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .open(locked.join("yt_dlp_ejs"))
        .unwrap();

    assert_eq!(purge_extractions(&root, AN_HOUR, true, an_hour_later()), 0);
    assert!(locked.is_dir());
    drop(handle);
    assert_eq!(purge_extractions(&root, AN_HOUR, false, an_hour_later()), 1);
    assert!(!locked.exists());
    std::fs::remove_dir_all(&root).unwrap();
}

#[cfg(windows)]
fn process_count(name: &str) -> usize {
    let output = std::process::Command::new("tasklist")
        .args(["/FI", &format!("IMAGENAME eq {name}"), "/FO", "CSV", "/NH"])
        .output()
        .expect("query process list");
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| {
            line.to_ascii_lowercase()
                .contains(&format!("\"{}\"", name.to_ascii_lowercase()))
        })
        .count()
}

#[cfg(windows)]
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn timed_out_process_guard_kills_child() {
    let baseline = process_count("ping.exe");
    let process = std::process::Command::new("ping")
        .args(["-n", "30", "127.0.0.1"])
        .spawn()
        .expect("start timeout probe");
    let guard = KillProcessOnDrop(Some(process));
    let run = async move {
        let _guard = guard;
        std::future::pending::<()>().await;
    };
    assert!(tokio::time::timeout(Duration::from_millis(150), run)
        .await
        .is_err());
    tokio::time::sleep(Duration::from_millis(500)).await;
    assert_eq!(process_count("ping.exe"), baseline);
}
