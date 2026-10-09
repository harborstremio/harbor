use super::*;
use std::{cell::Cell, fs, path::PathBuf};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let parent = std::env::var_os("HARBOR_SIMS_PROOF_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let root = parent.join(format!("harbor-sims-duplicates-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("Mods")).unwrap();
        fs::create_dir(root.join("saves")).unwrap();
        fs::write(
            root.join("Options.ini"),
            "[options]\nmodsdisabled = 0\nscriptmodsenabled = 1",
        )
        .unwrap();
        fs::write(root.join("GameVersion.txt"), "1.120.123.1020").unwrap();
        Self(root.canonicalize().unwrap())
    }
    fn path(&self) -> &str {
        self.0.to_str().unwrap()
    }
    fn put(&self, name: &str, bytes: &[u8]) {
        let p = self.0.join("Mods").join(name);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, bytes).unwrap();
    }
    fn scan(&self) -> Report {
        scan(
            "proof",
            self.path(),
            &uuid::Uuid::new_v4().to_string(),
            |_| {},
        )
        .unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        if self
            .0
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("harbor-sims-duplicates-")
            && files::directory(&self.0).is_ok()
        {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}

#[test]
fn renamed_copies_are_found_without_treating_names_settings_or_formats_as_matches() {
    let f = Fixture::new();
    f.put("clothes/top.package", b"same bytes");
    f.put("renamed.package", b"same bytes");
    f.put("other/top.package", b"new bytes!");
    f.put("only.package", b"a different length");
    f.put("one.ts4script", b"script bytes");
    f.put("two.ts4script", b"script bytes");
    f.put("wrong-type.package", b"script bytes");
    f.put("settings.cfg", b"same bytes");
    f.put("settings2.cfg", b"same bytes");
    let report = f.scan();
    assert_eq!(report.matches.len(), 2);
    assert_eq!(report.checked_files, 7);
    assert!(!report.partial);
    assert_eq!(
        report.matches[0]
            .copies
            .iter()
            .map(|v| v.path.as_str())
            .collect::<Vec<_>>(),
        ["clothes/top.package", "renamed.package"]
    );
    assert!(report
        .matches
        .iter()
        .flat_map(|m| &m.copies)
        .all(|c| c.group_id.is_none()));
    assert_eq!(
        fs::read(f.0.join("Mods/renamed.package")).unwrap(),
        b"same bytes"
    );
    assert_eq!(
        fs::read_dir(&f.0).unwrap().count(),
        4,
        "read-only scan must not create a store"
    );
}

fn dbpf() -> Vec<u8> {
    let mut b = vec![0u8; 96];
    b[..4].copy_from_slice(b"DBPF");
    b[4..8].copy_from_slice(&2u32.to_le_bytes());
    b[8..12].copy_from_slice(&1u32.to_le_bytes());
    b[36..40].copy_from_slice(&1u32.to_le_bytes());
    b[44..48].copy_from_slice(&36u32.to_le_bytes());
    b[64..72].copy_from_slice(&97u64.to_le_bytes());
    b.push(1);
    for v in [0u32, 0x03b33ddf, 0, 0, 1, 96, 0x8000_0001, 1, 0x0001_0000] {
        b.extend_from_slice(&v.to_le_bytes());
    }
    b
}

#[test]
fn managed_copy_uses_current_hash_and_reviewed_disable_removes_it_from_next_scan() {
    let f = Fixture::new();
    let b = dbpf();
    let plan = store::plan(
        f.path(),
        store::Action::Install {
            title: "My mod".into(),
        },
        vec![super::super::sims_package::Payload {
            name: "original.package".into(),
            bytes: b.clone(),
        }],
        vec![],
    )
    .unwrap();
    let state = store::Store::connect(f.path())
        .unwrap()
        .apply(plan)
        .unwrap();
    let id = &state.groups[0].id;
    f.put("duplicate.package", &b);
    let report = f.scan();
    assert_eq!(report.matches.len(), 1);
    let managed = report.matches[0]
        .copies
        .iter()
        .find(|c| c.group_id.is_some())
        .unwrap();
    assert_eq!(managed.group_id.as_ref().unwrap(), id);
    assert_eq!(managed.group_title.as_deref(), Some("My mod"));
    let review = sims_reviews::review(
        "proof".into(),
        f.path().into(),
        store::Action::Disable { id: id.clone() },
        vec![],
    )
    .unwrap();
    sims_reviews::apply("proof".into(), review.token).unwrap();
    assert!(f.scan().matches.is_empty());
    assert_eq!(fs::read(f.0.join("Mods/duplicate.package")).unwrap(), b);
}

#[test]
fn unreadable_invalid_paths_and_scan_bounds_are_never_reported_as_complete() {
    let f = Fixture::new();
    f.put("a.package", b"same");
    f.put("b.package", b"same");
    let mut work = store::progress::Work::silent();
    let r = scan_checked(f.path(), &mut work, 4, Duration::from_secs(60)).unwrap();
    assert!(r.partial);
    assert_eq!(r.skipped_files, 1);
    assert_eq!(r.checked_files, 1);
    assert!(r.matches.is_empty());
    f.put("a/b/c/d/e/f/g/h/i/deep.package", b"same");
    let r = f.scan();
    assert!(r.partial);
    assert_eq!(r.matches.len(), 1);
    assert_eq!(
        scan_checked(f.path(), &mut work, 100, Duration::ZERO).unwrap_err(),
        "sims_limit"
    );
    assert!(scan(
        "proof",
        f.0.join("Mods").to_str().unwrap(),
        &uuid::Uuid::new_v4().to_string(),
        |_| {}
    )
    .is_err());
}

#[test]
fn cancellation_stops_inventory_and_hashing_and_releases_the_job() {
    let f = Fixture::new();
    f.put("a.package", b"same");
    f.put("b.package", b"same");
    let id = uuid::Uuid::new_v4().to_string();
    let stopped = Cell::new(false);
    let result = scan("proof", f.path(), &id, |p| {
        if p.file.is_some() {
            stopped.set(store::progress::cancel("proof", &id));
        }
    });
    assert!(stopped.get());
    assert_eq!(result.unwrap_err(), "sims_canceled");
    assert!(!store::progress::cancel("proof", &id));
    assert_eq!(
        scan("proof", f.path(), &id, |_| {}).unwrap().matches.len(),
        1
    );
    let calls = Cell::new(0);
    assert_eq!(
        files::inventory_checked(f.path(), &|| {
            calls.set(calls.get() + 1);
            if calls.get() > 2 {
                Err("sims_canceled")
            } else {
                Ok(())
            }
        })
        .unwrap_err(),
        "sims_canceled"
    );
}

#[test]
fn content_changed_during_hashing_is_not_used_for_a_match() {
    let f = Fixture::new();
    f.put("changed.package", &vec![1; 600_000]);
    let path = f.0.join("Mods/changed.package");
    let calls = Cell::new(0);
    let result = hash(&path, 600_000, &|| {
        calls.set(calls.get() + 1);
        if calls.get() == 3 {
            fs::write(&path, b"changed").unwrap();
        }
        Ok(())
    });
    assert_eq!(result.unwrap_err(), "sims_changed");
}
