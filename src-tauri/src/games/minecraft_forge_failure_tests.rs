use super::{
    minecraft_forge_data as data, minecraft_forge_process as process,
    minecraft_instances as instances, minecraft_java, minecraft_runtime as runtime,
    minecraft_runtime_data::File,
};
use serde_json::Value;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};

fn fixtures() -> (PathBuf, data::Setup, Vec<File>) {
    let root = PathBuf::from(std::env::var_os("HARBOR_MINECRAFT_FORGE_FIXTURES").unwrap());
    let record: Value =
        serde_json::from_slice(&fs::read(root.join("forge-receipt.json")).unwrap()).unwrap();
    let installer = File {
        path: "forge-installers/forge-1.20.1-47.4.23.jar".into(),
        url: record["url"].as_str().unwrap().into(),
        sha1: record["sha1"].as_str().unwrap().into(),
        size: record["size"].as_u64().unwrap(),
    };
    let setup = data::parse(
        &fs::read(root.join("forge-installer.jar")).unwrap(),
        installer,
        "1.20.1",
        "forge",
        "47.4.23",
    )
    .unwrap();
    let inputs =
        serde_json::from_slice(&fs::read(root.join("forge-inputs.json")).unwrap()).unwrap();
    (root, setup, inputs)
}

fn stage_inputs(root: &Path, inputs: &[File], case: &str) -> PathBuf {
    let destination = root.join(format!("failure-{case}-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&destination).unwrap();
    let cache = root.join("forge-inputs");
    for file in inputs {
        assert!(runtime::verified(&cache, file, &AtomicBool::new(false)).unwrap());
        let mut output = instances::create_file(&destination, &file.path).unwrap();
        output
            .write_all(&fs::read(cache.join(&file.path)).unwrap())
            .unwrap();
    }
    destination
}

fn unpublished(destination: &Path, setup: &data::Setup) {
    assert!(!destination.join("forge-receipt.json").exists());
    assert!(setup
        .outputs
        .iter()
        .all(|file| !destination.join(&file.path).exists()));
    assert!(!fs::read_dir(destination).unwrap().any(|entry| entry
        .unwrap()
        .file_name()
        .to_string_lossy()
        .starts_with(".forge-stage-")));
}

#[tokio::test]
#[ignore = "Explicit opt-in: real official processor failure/cancellation tests in isolated fixture folders"]
async fn minecraft_forge_processor_failures_never_publish_a_ready_receipt() {
    let (root, setup, inputs) = fixtures();
    let java_path = PathBuf::from(std::env::var_os("HARBOR_MINECRAFT_FORGE_JAVA").unwrap());
    let java = minecraft_java::probe(&java_path, false, &AtomicBool::new(false))
        .await
        .unwrap();
    assert_eq!(java.major, 17);
    for case in [
        "canceled-before",
        "bad-input",
        "failed-java",
        "bad-output",
        "canceled-java",
    ] {
        let destination = stage_inputs(&root, &inputs, case);
        let mut plan = setup.clone();
        let mut selected = inputs.clone();
        let cancel = Arc::new(AtomicBool::new(case == "canceled-before"));
        let started = Arc::new(AtomicBool::new(false));
        if case == "bad-input" {
            selected[0].sha1 = "0".repeat(40);
        }
        if case == "failed-java" {
            plan.processors[0].args = vec!["--task".into(), "HARBOR_FIXTURE_UNKNOWN".into()];
        }
        if case == "bad-output" {
            plan.processors[0].outputs[0].sha1 = Some("0".repeat(40));
        }
        let stop = cancel.clone();
        let event = started.clone();
        let outcome = process::install(
            &destination,
            &destination,
            &java,
            &plan,
            &selected,
            "1.20.1",
            "forge",
            "47.4.23",
            cancel.clone(),
            move |done, _| {
                if case == "canceled-java" && done == 1 && !event.swap(true, Ordering::Relaxed) {
                    let stop = stop.clone();
                    tokio::spawn(async move {
                        tokio::time::sleep(Duration::from_millis(30)).await;
                        stop.store(true, Ordering::Relaxed);
                    });
                }
            },
        )
        .await;
        let error = outcome.err().expect("Invalid preparation must fail");
        assert_eq!(
            error,
            match case {
                "bad-input" | "bad-output" => "instance_integrity",
                "failed-java" => "runtime_processor",
                _ => "instance_canceled",
            },
            "{case}"
        );
        if case == "canceled-java" {
            assert!(started.load(Ordering::Relaxed));
        }
        unpublished(&destination, &setup);
        for file in &inputs {
            assert!(
                runtime::verified(&destination, file, &AtomicBool::new(false)).unwrap(),
                "{case}: {}",
                file.path
            );
        }
        eprintln!(
            "{case}: rejected, inputs preserved, no generated outputs or ready receipt; {}",
            destination.display()
        );
    }
}
