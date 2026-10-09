use super::*;
fn folder() -> PathBuf {
    let root = std::env::var_os("HARBOR_GAME_TEST_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join(format!("hydra-snapshot-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(root.join("input")).unwrap();
    fs::write(root.join("input/CURRENT"), "MANIFEST-000001\n").unwrap();
    fs::write(root.join("input/MANIFEST-000001"), "fixture manifest").unwrap();
    fs::write(root.join("input/000002.log"), "fixture data").unwrap();
    root
}
#[test]
fn changed_or_canceled_snapshot_is_removed_without_changing_source() {
    let root = folder();
    let token = CancellationToken::new();
    let deadline = Instant::now() + std::time::Duration::from_secs(10);
    let changed = prepare_inner(
        &root.join("input"),
        &root.join("scratch"),
        &token,
        deadline,
        || {
            fs::write(root.join("input/000002.log"), "changed data").unwrap();
        },
    );
    assert!(matches!(changed, Err("hydra_changed")));
    assert_eq!(fs::read_dir(root.join("scratch")).unwrap().count(), 0);
    let canceled = prepare_inner(
        &root.join("input"),
        &root.join("scratch"),
        &token,
        deadline,
        || token.cancel(),
    );
    assert!(matches!(canceled, Err("hydra_canceled")));
    assert_eq!(fs::read_dir(root.join("scratch")).unwrap().count(), 0);
    assert_eq!(
        fs::read_to_string(root.join("input/000002.log")).unwrap(),
        "changed data"
    );
    fs::remove_dir_all(root).unwrap();
}
#[test]
fn unsafe_manifest_oversized_input_and_overlapping_destination_are_rejected() {
    let root = folder();
    let token = CancellationToken::new();
    let deadline = Instant::now() + std::time::Duration::from_secs(10);
    assert!(matches!(
        prepare(
            &root.join("input"),
            &root.join("input/scratch"),
            &token,
            deadline
        ),
        Err("hydra_path")
    ));
    assert!(!root.join("input/scratch").exists());
    fs::write(root.join("input/CURRENT"), "../MANIFEST-000001\n").unwrap();
    assert!(matches!(
        prepare(&root.join("input"), &root.join("scratch"), &token, deadline),
        Err("hydra_format")
    ));
    fs::write(root.join("input/CURRENT"), "MANIFEST-000001\n").unwrap();
    File::create(root.join("input/000003.ldb"))
        .unwrap()
        .set_len(MAX_BYTES + 1)
        .unwrap();
    assert!(matches!(
        prepare(&root.join("input"), &root.join("scratch"), &token, deadline),
        Err("hydra_limit")
    ));
    fs::remove_dir_all(root).unwrap();
}
#[test]
fn copied_bytes_and_fingerprint_are_stable_and_unrelated_files_are_excluded() {
    let root = folder();
    fs::write(root.join("input/LOG"), "not database data").unwrap();
    let token = CancellationToken::new();
    let deadline = Instant::now() + std::time::Duration::from_secs(10);
    let first = prepare(&root.join("input"), &root.join("scratch"), &token, deadline).unwrap();
    assert_eq!(fs::read_dir(&first.path).unwrap().count(), 4); // Three DB files plus the ownership marker.
    assert_eq!(
        fs::read(first.path.join("000002.log")).unwrap(),
        b"fixture data"
    );
    let fingerprint = first.fingerprint.clone();
    drop(first);
    let second = prepare(&root.join("input"), &root.join("scratch"), &token, deadline).unwrap();
    assert_eq!(fingerprint, second.fingerprint);
    drop(second);
    assert_eq!(fs::read_dir(root.join("scratch")).unwrap().count(), 0);
    fs::remove_dir_all(root).unwrap();
}
