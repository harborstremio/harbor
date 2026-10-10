use super::super::super::{sims_reviews, sims_saves};
use super::*;
fn fixture() -> (Fixture, State, Vec<String>) {
    let f = Fixture::new();
    let mut state = snapshot(f.path()).unwrap().0;
    for i in 0..5 {
        let p = plan(
            f.path(),
            Action::Install {
                title: format!("Group {i}"),
            },
            vec![Payload {
                name: format!("group-{i}.package"),
                bytes: dbpf(i),
            }],
            vec![],
        )
        .unwrap();
        state = Store::connect(f.path()).unwrap().apply(p).unwrap();
    }
    let selected = state.groups[..3].iter().map(|g| g.id.clone()).collect();
    let last = state.groups[4].id.clone();
    state = Store::connect(f.path())
        .unwrap()
        .apply(plan(f.path(), Action::Disable { id: last }, vec![], vec![]).unwrap())
        .unwrap();
    fs::write(f.0.join("Mods/unmanaged.package"), dbpf(9)).unwrap();
    fs::write(
        f.0.join("saves/Slot_00000001.save"),
        "household before testing",
    )
    .unwrap();
    (f, state, selected)
}
fn start(ids: Vec<String>) -> Action {
    Action::StartTest {
        groups: ids,
        backup_folder: None,
    }
}
fn apply(f: &Fixture, action: Action) -> State {
    Store::connect(f.path())
        .unwrap()
        .apply(trouble::plan(f.path(), action).unwrap())
        .unwrap()
}
fn view(state: &State) -> trouble::View {
    trouble::view(state, "1.120.123.1020").unwrap().unwrap()
}
#[test]
fn guided_test_persists_narrows_from_observations_and_restores_the_initial_enabled_selection() {
    let (f, before, selected) = fixture();
    let culprit = selected[2].clone();
    let mut state = apply(&f, start(selected.clone()));
    assert_eq!(view(&state).phase, trouble::Phase::Baseline);
    assert_eq!(view(&state).fixed_enabled, 1);
    assert_eq!(snapshot(f.path()).unwrap().0, state);
    assert_eq!(
        plan(
            f.path(),
            Action::Remove {
                id: selected[0].clone()
            },
            vec![],
            vec![]
        )
        .err()
        .unwrap(),
        "sims_test_active"
    );
    assert_eq!(
        adopt::plan(
            f.path(),
            Action::Adopt {
                title: "Unmanaged".into()
            },
            vec![f
                .0
                .join("Mods/unmanaged.package")
                .to_string_lossy()
                .into_owned()]
        )
        .err()
        .unwrap(),
        "sims_test_active"
    );
    let mut answer = false;
    loop {
        let v = view(&state);
        if v.phase == trouble::Phase::Suspect {
            assert_eq!(v.testing, vec![culprit.clone()]);
            break;
        }
        if v.phase == trouble::Phase::Test {
            answer = v.testing.contains(&culprit);
        }
        state = apply(
            &f,
            Action::AnswerTest {
                id: v.id,
                round: v.round,
                present: answer,
            },
        );
        assert_eq!(state.groups[3].enabled, true);
        assert_eq!(state.groups[4].enabled, false);
    }
    let pending = trouble::plan(
        f.path(),
        Action::RestoreTest {
            id: view(&state).id,
        },
    )
    .unwrap();
    let current_folder = Store::connect(f.path())
        .unwrap()
        .path(&location(&state.groups[3]))
        .unwrap();
    fs::write(current_folder.join("settings.cfg"), "changed while playing").unwrap();
    // A fixed group's runtime settings do not invalidate the tested package files.
    state = Store::connect(f.path()).unwrap().apply(pending).unwrap();
    assert!(state.troubleshoot.is_none());
    assert_eq!(state.groups, before.groups);
    assert_eq!(
        fs::read_to_string(current_folder.join("settings.cfg")).unwrap(),
        "changed while playing"
    );
    assert_eq!(
        fs::read(f.0.join("Mods/unmanaged.package")).unwrap(),
        dbpf(9)
    );
}
#[test]
fn stale_answers_patch_changes_and_external_packages_block_steps_but_patch_change_allows_restore() {
    let (f, before, selected) = fixture();
    let state = apply(&f, start(selected.clone()));
    let v = view(&state);
    let action = Action::AnswerTest {
        id: v.id.clone(),
        round: v.round,
        present: false,
    };
    let stale = trouble::plan(f.path(), action.clone()).unwrap();
    let state = apply(&f, action.clone());
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(stale).err(),
        Some("sims_changed")
    );
    assert_eq!(
        trouble::plan(f.path(), action).err().unwrap(),
        "sims_changed"
    );
    let v = view(&state);
    fs::write(f.0.join("GameVersion.txt"), "1.121.0.0").unwrap();
    assert!(
        trouble::view(&state, "1.121.0.0")
            .unwrap()
            .unwrap()
            .version_changed
    );
    assert_eq!(
        trouble::plan(
            f.path(),
            Action::AnswerTest {
                id: v.id.clone(),
                round: v.round,
                present: true
            }
        )
        .err()
        .unwrap(),
        "sims_changed"
    );
    let store = Store::connect(f.path()).unwrap();
    let changed = store
        .path(&location(&state.groups[3]))
        .unwrap()
        .join("group-3.package");
    fs::write(&changed, dbpf(7)).unwrap();
    assert_eq!(
        trouble::plan(f.path(), Action::RestoreTest { id: v.id.clone() })
            .err()
            .unwrap(),
        "sims_changed"
    );
    fs::write(&changed, dbpf(3)).unwrap();
    drop(store);
    assert_eq!(
        apply(&f, Action::RestoreTest { id: v.id }).groups,
        before.groups
    );
}
#[test]
fn starting_review_cancels_without_changes_and_creates_a_real_save_checkpoint_only_on_apply() {
    let (f, before, selected) = fixture();
    let mut action = start(selected);
    if let Action::StartTest { backup_folder, .. } = &mut action {
        *backup_folder = Some("".into());
    }
    let review =
        sims_reviews::review("test-proof".into(), f.path().into(), action.clone(), vec![]).unwrap();
    assert_eq!(review.changes.len(), 3);
    assert_eq!(snapshot(f.path()).unwrap().0, before);
    sims_reviews::discard("test-proof", &review.token);
    assert!(!f.0.join("HarborSimsSaves").exists());
    let review =
        sims_reviews::review("test-proof".into(), f.path().into(), action, vec![]).unwrap();
    let result = sims_reviews::apply("test-proof".into(), review.token).unwrap();
    assert!(result.save_backup.is_some());
    let context = sims_saves::context(f.path()).unwrap();
    let backups = sims_saves::list(f.path(), "test-proof".into(), context.vault).unwrap();
    assert_eq!(backups.len(), 1);
    assert_eq!(
        fs::read_to_string(f.0.join("saves/Slot_00000001.save")).unwrap(),
        "household before testing"
    );
    assert_eq!(
        result.troubleshooting.unwrap().phase,
        trouble::Phase::Baseline
    );
}
#[test]
#[ignore = "Owned worker for guided-test journal boundaries"]
fn interruption_worker() {
    let root = std::env::var("HARBOR_TEST_ROOT").unwrap();
    let store = Store::connect(&root).unwrap();
    if std::env::var("HARBOR_TEST_RECOVER").ok().as_deref() == Some("1") {
        store.recover().unwrap();
    } else {
        let action: Action =
            serde_json::from_str(&std::env::var("HARBOR_TEST_ACTION").unwrap()).unwrap();
        store.apply(trouble::plan(&root, action).unwrap()).unwrap();
    }
    panic!("Checkpoint not reached");
}
fn interrupt(f: &Fixture, action: &Action, phase: &str, recover: bool) {
    use std::process::{Command, Stdio};
    struct Owned(std::process::Child);
    impl Drop for Owned {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }
    let marker = f.0.join("owned-interrupt-marker");
    if marker.exists() {
        fs::remove_file(&marker).unwrap();
    }
    let worker = format!(
        "{}::interruption_worker",
        module_path!().split_once("::").unwrap().1
    );
    let mut cmd = Command::new(std::env::current_exe().unwrap());
    cmd.args(["--exact", &worker, "--ignored", "--nocapture"])
        .env("HARBOR_TEST_ROOT", f.path())
        .env("HARBOR_TEST_ACTION", serde_json::to_string(action).unwrap())
        .env("HARBOR_TEST_RECOVER", if recover { "1" } else { "0" })
        .env("HARBOR_SAVE_INTERRUPT_PHASE", phase)
        .env("HARBOR_SAVE_INTERRUPT_MARKER", &marker)
        .stdout(Stdio::null())
        .stderr(Stdio::inherit());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    let mut child = Owned(cmd.spawn().unwrap());
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(15);
    while !marker.exists() {
        assert!(
            child.0.try_wait().unwrap().is_none(),
            "Worker exited before {phase}"
        );
        assert!(std::time::Instant::now() < deadline);
        std::thread::sleep(std::time::Duration::from_millis(25));
    }
    assert_eq!(Store::connect(f.path()).err().unwrap(), "sims_busy");
    child.0.kill().unwrap();
    child.0.wait().unwrap();
}
#[test]
fn killed_test_start_answer_finish_and_rollback_restore_both_session_and_file_state() {
    for step in ["start", "answer", "finish", "rollback"] {
        let (f, initial, selected) = fixture();
        let (before, action) = if step == "start" {
            (initial, start(selected))
        } else {
            let state = apply(&f, start(selected));
            let v = view(&state);
            let action = if step == "answer" {
                Action::AnswerTest {
                    id: v.id,
                    round: 0,
                    present: false,
                }
            } else if step == "finish" {
                Action::AnswerTest {
                    id: v.id,
                    round: 0,
                    present: true,
                }
            } else {
                Action::RestoreTest { id: v.id }
            };
            (state, action)
        };
        interrupt(
            &f,
            &action,
            if step == "finish" {
                "modsState"
            } else if step == "rollback" {
                "modsMove3"
            } else {
                "modsMove1"
            },
            false,
        );
        if step == "rollback" {
            interrupt(&f, &action, "modsRollback1", true);
        }
        assert!(snapshot(f.path()).unwrap().1);
        let store = Store::connect(f.path()).unwrap();
        assert_eq!(store.recover().unwrap(), before);
        for group in &before.groups {
            verify_owned(
                group,
                &files::tree(&store.path(&location(group)).unwrap()).unwrap(),
            )
            .unwrap();
        }
    }
}
