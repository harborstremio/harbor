use super::*;
fn report(modern: &str, classic: &str) -> Report {
    parse(&format!(
        r#"{{"authenticated":true,"identity":"{}","modern":{modern},"classic":{classic}}}"#,
        "a".repeat(64)
    ))
    .unwrap()
}
fn root() -> std::path::PathBuf {
    let root = std::path::PathBuf::from(
        std::env::var_os("HARBOR_BATTLENET_TEST_ROOT").expect("Set owned test root"),
    );
    let root = root.join(uuid::Uuid::new_v4().to_string());
    std::fs::create_dir_all(&root).unwrap();
    root
}
#[test]
fn import_deduplicates_accounts_without_merging_editions() {
    let value = merge(&Status::default(), &uuid::Uuid::new_v4().to_string(), report(r#"[{"titleId":5730135},{"titleId":5730135},{"titleId":5198665}]"#, r#"[{"name":"Diablo II","icon":"diablo-ii"},{"name":"Diablo II: Lord of Destruction","icon":"diablo-ii"}]"#), 100).unwrap();
    let snapshot = value.snapshot.unwrap();
    assert_eq!(snapshot.modern.games.len(), 2);
    assert_eq!(snapshot.classic.games.len(), 2);
    assert_eq!(snapshot.classic.games[0].id, "battlenet:classic:d2");
    assert_eq!(snapshot.classic.games[1].id, "battlenet:classic:d2x");
    assert!(snapshot
        .modern
        .games
        .iter()
        .any(|g| g.id == "battlenet:osi"));
}
#[test]
fn duplicates_and_shared_ids_do_not_invent_expansion_or_edition_ownership() {
    let value = merge(&Status::default(), &uuid::Uuid::new_v4().to_string(), report(r#"[{"titleId":1096108883},{"titleId":999999}]"#, r#"[{"name":"Diablo II","icon":"diablo-ii"},{"name":"Diablo II","icon":"diablo-ii"},{"name":"Unknown localized edition","icon":"warcraft-iii"}]"#), 100).unwrap();
    assert_eq!(value.warnings, ["unresolved"]);
    let snapshot = value.snapshot.unwrap();
    assert!(snapshot.modern.games.is_empty());
    assert_eq!(snapshot.modern.unresolved, 2);
    assert_eq!(snapshot.classic.games.len(), 1);
    assert_eq!(snapshot.classic.unresolved, 1);
}
#[test]
fn partial_refresh_retains_failed_partition_and_its_timestamp() {
    let id = uuid::Uuid::new_v4().to_string();
    let old = merge(
        &Status::default(),
        &id,
        report(
            r#"[{"titleId":4613486}]"#,
            r#"[{"name":"Warcraft III","icon":"warcraft-iii"}]"#,
        ),
        100,
    )
    .unwrap();
    let next = merge(&old, &id, report("[]", "null"), 200).unwrap();
    let snapshot = next.snapshot.unwrap();
    assert!(snapshot.modern.games.is_empty());
    assert_eq!(snapshot.modern.updated_at, 200);
    assert_eq!(snapshot.classic.games.len(), 1);
    assert_eq!(snapshot.classic.updated_at, 100);
    assert_eq!(next.warnings, ["classic"]);
    assert!(merge(
        &old,
        &uuid::Uuid::new_v4().to_string(),
        report("[]", "null"),
        200
    )
    .is_err());
    assert!(merge(&old, &id, report("null", "null"), 200).is_err());
    assert_eq!(
        merge(
            &old,
            &id,
            parse(r#"{"authenticated":false,"modern":[],"classic":[]}"#).unwrap(),
            200
        )
        .unwrap_err(),
        "battlenet_account_expired"
    );
}
#[test]
fn successful_account_replacement_does_not_retain_previous_owned_titles() {
    let old = merge(
        &Status::default(),
        &uuid::Uuid::new_v4().to_string(),
        report(r#"[{"titleId":4613486}]"#, "[]"),
        100,
    )
    .unwrap();
    let next = merge(
        &old,
        &uuid::Uuid::new_v4().to_string(),
        report("[]", "[]"),
        200,
    )
    .unwrap();
    assert!(next.snapshot.unwrap().modern.games.is_empty());
}
#[test]
fn refresh_cannot_mix_two_battlenet_accounts() {
    let id = uuid::Uuid::new_v4().to_string();
    let old = merge(
        &Status::default(),
        &id,
        report(r#"[{"titleId":4613486}]"#, "[]"),
        100,
    )
    .unwrap();
    let mut changed = report("[]", "null");
    changed.identity = Some("b".repeat(64));
    assert_eq!(
        merge(&old, &id, changed, 200).unwrap_err(),
        "battlenet_account_changed"
    );
    assert_eq!(old.snapshot.unwrap().modern.games[0].id, "battlenet:fen");
}
#[test]
fn projection_rejects_secrets_malformed_and_oversized_payloads() {
    let valid = serde_json::json!({"authenticated":true,"identity":"a".repeat(64),"modern":[],"classic":[]});
    assert!(parse(&valid.to_string()).is_ok());
    let mut secret = valid.clone();
    secret["accountToken"] = serde_json::json!("secret");
    assert!(parse(&secret.to_string()).is_err());
    let mut classic_secret = valid.clone();
    classic_secret["classic"] =
        serde_json::json!([{"name":"Diablo II","icon":"diablo-ii","cdKeys":["secret"]}]);
    assert!(parse(&classic_secret.to_string()).is_err());
    let mut invalid_id = valid.clone();
    invalid_id["modern"] = serde_json::json!([{"titleId":-1}]);
    assert!(parse(&invalid_id.to_string()).is_err());
    let mut control = valid.clone();
    control["classic"] = serde_json::json!([{"name":"bad\nname","icon":"diablo-ii"}]);
    assert!(parse(&control.to_string()).is_err());
    let mut oversized = valid;
    oversized["modern"] = serde_json::json!(vec![serde_json::json!({"titleId":1}); LIMIT + 1]);
    assert!(parse(&oversized.to_string()).is_err());
}
#[test]
fn persistence_preferences_and_profile_isolation_survive_reopen() {
    let root = root();
    let a = begin(&root, "one", &uuid::Uuid::new_v4().to_string(), true).unwrap();
    let saved = finish(&root, &a, report(r#"[{"titleId":4613486}]"#, "[]")).unwrap();
    preferences(&root, "one", false, true).unwrap();
    let restored = status(&root, "one").unwrap();
    assert_eq!(restored.connection, saved.connection);
    assert!(!restored.import_installed && restored.import_uninstalled);
    assert!(status(&root, "two").unwrap().snapshot.is_none());
    assert_eq!(
        restored.snapshot.unwrap().modern.games[0].id,
        "battlenet:fen"
    );
    assert_eq!(disconnect(&root, "one").unwrap(), saved.connection);
    let disconnected = status(&root, "one").unwrap();
    assert!(disconnected.snapshot.is_none());
    assert!(disconnected.import_uninstalled);
}
#[test]
fn cancellation_and_disconnect_win_over_late_results() {
    let root = root();
    let request = uuid::Uuid::new_v4().to_string();
    cancel(&root, "one", &request);
    assert!(begin(&root, "one", &request, true).is_err());
    let a = begin(&root, "one", &uuid::Uuid::new_v4().to_string(), true).unwrap();
    assert!(begin(&root, "one", &uuid::Uuid::new_v4().to_string(), true).is_err());
    cancel(&root, "two", &a.request);
    assert!(active(&root, &a));
    cancel(&root, "one", &a.request);
    assert!(!active(&root, &a));
    assert!(finish(&root, &a, report("[]", "[]")).is_err());
    let b = begin(&root, "one", &uuid::Uuid::new_v4().to_string(), true).unwrap();
    disconnect(&root, "one").unwrap();
    assert!(finish(&root, &b, report("[]", "[]")).is_err());
    assert!(status(&root, "one").unwrap().snapshot.is_none());
}
#[test]
fn failed_refresh_keeps_persisted_library_and_releases_operation() {
    let root = root();
    let a = begin(&root, "one", &uuid::Uuid::new_v4().to_string(), true).unwrap();
    finish(&root, &a, report(r#"[{"titleId":4613486}]"#, "[]")).unwrap();
    let b = begin(&root, "one", &uuid::Uuid::new_v4().to_string(), false).unwrap();
    assert!(finish(&root, &b, report("null", "null")).is_err());
    assert_eq!(
        status(&root, "one")
            .unwrap()
            .snapshot
            .unwrap()
            .modern
            .games
            .len(),
        1
    );
    let c = begin(&root, "one", &uuid::Uuid::new_v4().to_string(), false).unwrap();
    cancel(&root, "one", &c.request);
}
