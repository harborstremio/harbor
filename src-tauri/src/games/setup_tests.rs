use super::*;

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let root = base.join(format!("setup-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        Self(dunce::canonicalize(root).unwrap())
    }
    fn file(&self, name: &str) -> PathBuf {
        let path = self.0.join(name);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, b"fixture only, never execute").unwrap();
        path
    }
    fn manager(&self) -> Arc<Setups> {
        Setups::load(self.0.join("state"), |_| {}).unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        if self
            .0
            .file_name()
            .is_some_and(|name| name.to_string_lossy().starts_with("setup-test-"))
        {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}
fn source(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[test]
fn rom_setup_candidates_preserve_pc_archives_and_never_become_executables() {
    let fixture = Fixture::new();
    for name in ["Homebrew.gba", "Disc.chd", "Set.m3u", "Handheld.nds", "Console.rvz"] {
        let path = fixture.file(name);
        let (plan, _) = inspect("rom-review", &source(&path)).unwrap();
        assert_eq!(plan.entries.len(), 1);
        assert_eq!(plan.entries[0].kind, SetupKind::Rom);
        assert!(plan.entries[0].engine.is_none());
    }
    for name in ["Installer.iso", "Download.zip"] {
        let path = fixture.file(name);
        let (plan, _) = inspect("rom-review", &source(&path)).unwrap();
        assert_eq!(plan.entries[0].kind, SetupKind::Archive);
    }
    let readme = fixture.file("README.md");
    assert!(inspect("rom-review", &source(&readme)).unwrap().0.entries.is_empty());
}

#[test]
fn shortcut_application_icon_reads_ico_and_invalidates_replaced_or_missing_files() {
    use base64::Engine;
    let fixture = Fixture::new();
    let path = fixture.0.join("original.ico");
    let make = |color: [u8; 4]| {
        let mut png = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut png, 16, 16);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            encoder.write_header().unwrap().write_image_data(&color.repeat(256)).unwrap();
        }
        let mut ico = vec![0,0,1,0,1,0,16,16,0,0,1,0,32,0];
        ico.extend_from_slice(&(png.len() as u32).to_le_bytes());
        ico.extend_from_slice(&22u32.to_le_bytes()); ico.extend(png); ico
    };
    fs::write(&path,make([20,100,150,255])).unwrap();
    let first=application_icon(&path,0).expect("ICO decoded");
    assert_eq!(application_icon(&path,0),Some(first.clone()));
    let bytes=base64::engine::general_purpose::STANDARD.decode(first.strip_prefix("data:image/png;base64,").unwrap()).unwrap();
    let reader=png::Decoder::new(std::io::Cursor::new(&bytes)).read_info().unwrap();
    assert_eq!((reader.info().width,reader.info().height),(96,96));assert!(bytes.len()<=64*1024);
    fs::remove_file(&path).unwrap();fs::write(&path,make([200,40,60,255])).unwrap();
    assert_ne!(application_icon(&path,0).as_ref(),Some(&first));
    assert!(application_icon(&path,-42).is_none());
    fs::remove_file(&path).unwrap();assert!(application_icon(&path,0).is_none());
    assert!(application_icon(Path::new("relative.ico"),0).is_none());
    fs::write(&path,b"corrupt ICO").unwrap();assert!(application_icon(&path,0).is_none());
    let file=File::create(&path).unwrap();file.set_len(8*1024*1024+1).unwrap();drop(file);
    assert!(application_icon(&path,0).is_none());
}

#[test]
#[ignore = "requires an explicitly supplied installed executable; resource reads only"]
fn shortcut_application_icon_reads_real_executable_without_launching_it() {
    use base64::Engine;
    let path=PathBuf::from(std::env::var_os("HARBOR_SETUP_ICON_EXE").unwrap());
    let image=application_icon(&path,0).expect("original embedded application icon");
    let bytes=base64::engine::general_purpose::STANDARD.decode(image.strip_prefix("data:image/png;base64,").unwrap()).unwrap();
    let reader=png::Decoder::new(std::io::Cursor::new(&bytes)).read_info().unwrap();
    assert_eq!((reader.info().width,reader.info().height),(96,96));assert!(bytes.len()<=64*1024);
    if let Some(output)=std::env::var_os("HARBOR_SETUP_ICON_PNG"){fs::write(output,bytes).unwrap();}
}

// A structurally valid PE container for read-only classification, never executed.
fn pe_fixture(path: &Path, inno: bool) {
    let mut bytes = vec![0u8; 1024];
    bytes[..2].copy_from_slice(b"MZ");
    bytes[60..64].copy_from_slice(&64u32.to_le_bytes());
    bytes[64..68].copy_from_slice(b"PE\0\0");
    bytes[68..70].copy_from_slice(&0x14cu16.to_le_bytes());
    bytes[70..72].copy_from_slice(&1u16.to_le_bytes());
    bytes[84..86].copy_from_slice(&224u16.to_le_bytes());
    bytes[86..88].copy_from_slice(&2u16.to_le_bytes());
    bytes[88..90].copy_from_slice(&0x10bu16.to_le_bytes());
    bytes[328..332].copy_from_slice(&512u32.to_le_bytes());
    bytes[332..336].copy_from_slice(&512u32.to_le_bytes());
    if inno {
        let marker = b"Inno Setup Setup Data (5.5.0) (u)\0";
        bytes[600..600 + marker.len()].copy_from_slice(marker);
    }
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, bytes).unwrap();
}

#[test]
fn engine_detection_requires_a_pe_container_and_actual_inno_data_marker() {
    let fixture = Fixture::new();
    let installer = fixture.0.join("installer.exe");
    pe_fixture(&installer, true);
    let mut file = File::open(&installer).unwrap();
    let mut budget = ENGINE_FILE_LIMIT;
    assert_eq!(
        installer_engine(&mut file, &mut budget),
        Some(SetupEngine::Inno)
    );
    assert_eq!(budget, ENGINE_FILE_LIMIT - 1024);
    let (plan, _) = inspect("one", &source(&installer)).unwrap();
    assert_eq!(plan.entries[0].engine, Some(SetupEngine::Inno));
    let renamed = fixture.0.join("download.exe");
    fs::copy(&installer, &renamed).unwrap();
    let (plan, _) = inspect("one", &source(&renamed)).unwrap();
    assert_eq!(plan.entries[0].kind, SetupKind::Installer);
    assert_eq!(plan.entries[0].engine, Some(SetupEngine::Inno));
    fs::write(&renamed, b"MZ Inno Setup Setup Data (5.5.0) (u)").unwrap();
    assert_eq!(
        installer_engine(&mut File::open(&renamed).unwrap(), &mut budget),
        None
    );
    pe_fixture(&renamed, false);
    assert_eq!(
        installer_engine(&mut File::open(&renamed).unwrap(), &mut budget),
        None
    );
    let mut bytes = fs::read(&installer).unwrap();
    bytes[86..88].copy_from_slice(&0x2002u16.to_le_bytes()); // DLL, not a setup executable.
    fs::write(&renamed, bytes).unwrap();
    assert_eq!(
        installer_engine(&mut File::open(&renamed).unwrap(), &mut budget),
        None
    );
    assert_eq!(
        installer_engine(&mut File::open(&installer).unwrap(), &mut 0),
        None
    );
}

#[cfg(windows)]
#[test]
fn icons_require_current_profile_bound_prepared_game_files() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    let game = fixture.0.join("Game.exe");
    pe_fixture(&game, false);
    let plan = manager.inspect("one", &source(&game)).unwrap();
    let id = &plan.entries[0].id;
    assert_eq!(manager.icon("two", &plan.token, id).unwrap_err(), "setup_selection");
    assert_eq!(manager.icon("one", &plan.token, "unknown").unwrap_err(), "setup_selection");
    assert_eq!(manager.icon("one", &plan.token, id).unwrap(), None, "iconless PE does not receive a generic application icon");
    assert_eq!(manager.icon("one", &plan.token, id).unwrap(), None);
    OpenOptions::new().append(true).open(&game).unwrap().write_all(b"changed").unwrap();
    assert_eq!(manager.icon("one", &plan.token, id).unwrap_err(), "setup_changed", "cached null still requires file revalidation");
    let plan = manager.inspect("one", &source(&game)).unwrap();
    manager.plans.lock().unwrap().get_mut(&plan.token).unwrap().created -= PLAN_TTL;
    assert_eq!(manager.icon("one", &plan.token, &plan.entries[0].id).unwrap_err(), "setup_expired");
    let installer = fixture.0.join("setup.exe");
    pe_fixture(&installer, true);
    let plan = manager.inspect("one", &source(&installer)).unwrap();
    assert_eq!(manager.icon("one", &plan.token, &plan.entries[0].id).unwrap_err(), "setup_selection");
}

#[cfg(windows)]
#[test]
#[ignore = "requires an explicitly supplied installed executable; never launches it"]
fn prepared_game_icon_reads_real_embedded_art() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    let executable = PathBuf::from(std::env::var_os("HARBOR_SETUP_ICON_EXE").unwrap());
    let plan = manager.inspect("one", &source(&executable)).unwrap();
    let image = manager.icon("one", &plan.token, &plan.entries[0].id).unwrap().expect("embedded icon");
    assert_eq!(manager.icon("one", &plan.token, &plan.entries[0].id).unwrap().as_ref(), Some(&image));
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD.decode(image.strip_prefix("data:image/png;base64,").unwrap()).unwrap();
    let reader = png::Decoder::new(std::io::Cursor::new(&bytes)).read_info().unwrap();
    assert_eq!((reader.info().width, reader.info().height), (96,96));
    assert!(bytes.len() <= 64 * 1024);
    if let Some(output) = std::env::var_os("HARBOR_SETUP_ICON_PNG") { fs::write(output, bytes).unwrap(); }
}

#[test]
fn managed_arguments_keep_monitorable_progress_and_error_and_reboot_protection() {
    let arguments = managed_arguments(Path::new("D:/Games/Some Game")).unwrap();
    assert_eq!(arguments, "/DIR=\"D:/Games/Some Game\" /SILENT /NORESTART /NOCLOSEAPPLICATIONS /NOFORCECLOSEAPPLICATIONS");
    assert!(!arguments.contains("SUPPRESSMSGBOXES"));
    assert!(!arguments.contains("NOCANCEL"));
    assert!(managed_arguments(Path::new("D:/Games/bad\"path")).is_err());
}

#[test]
fn managed_destinations_are_plain_empty_separate_and_never_overwrite() {
    let fixture = Fixture::new();
    fixture.file("downloads/setup.exe");
    let source_root = fixture.0.join("downloads");
    let target = fixture.0.join("installed game");
    let mut accepted = ManagedDestination::prepare(&source(&target), &source_root).unwrap();
    accepted.cleanup_empty = false;
    accepted.validate().unwrap();
    drop(accepted);
    assert!(ManagedDestination::prepare(&source(&target), &source_root).is_ok());
    fs::write(target.join("save.dat"), b"keep saved game").unwrap();
    assert_eq!(
        ManagedDestination::prepare(&source(&target), &source_root).unwrap_err(),
        "setup_destination"
    );
    assert_eq!(
        fs::read(target.join("save.dat")).unwrap(),
        b"keep saved game"
    );
    for invalid in [
        source(&source_root.join("nested")),
        source(&fixture.0),
        source(&fixture.0.join("downloads/../bypass")),
        source(&fixture.0.join("missing/child")),
        "relative/path".into(),
    ] {
        assert!(
            ManagedDestination::prepare(&invalid, &source_root).is_err(),
            "{invalid}"
        );
    }
}

#[test]
fn activity_reports_observed_contents_and_marks_partial_scans() {
    let fixture = Fixture::new();
    fs::create_dir(fixture.0.join("install")).unwrap();
    let root = fixture.0.join("install");
    assert_eq!(
        destination_activity(&root).unwrap(),
        SetupActivity::default()
    );
    fixture.file("install/data/first.bin");
    fixture.file("install/data/second.bin");
    assert_eq!(
        destination_activity(&root).unwrap(),
        SetupActivity {
            bytes: 54,
            files: 2,
            truncated: false
        }
    );
    fixture.file("install/a/b/c/d/e/f/g/not-observed.bin");
    let activity = destination_activity(&root).unwrap();
    assert_eq!(activity.files, 2);
    assert_eq!(activity.bytes, 54);
    assert!(activity.truncated);
}

#[cfg(windows)]
#[test]
fn managed_reservation_revalidates_engine_and_rejects_shared_destination() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    let installer = fixture.file("downloads/setup.exe");
    let target = source(&fixture.0.join("managed"));
    let plan = manager.inspect("one", &source(&installer)).unwrap();
    assert_eq!(
        manager
            .reserve_destination("one", &plan.token, &plan.entries[0].id, Some(&target))
            .unwrap_err(),
        "setup_engine"
    );
    assert!(!Path::new(&target).exists());
    pe_fixture(&installer, true);
    let plan = manager.inspect("one", &source(&installer)).unwrap();
    let (job, file, destination) = manager
        .reserve_destination("one", &plan.token, &plan.entries[0].id, Some(&target))
        .unwrap();
    assert_eq!(job.destination, Some(target.clone()));
    assert_eq!(job.engine, Some(SetupEngine::Inno));
    assert_eq!(job.activity, Some(SetupActivity::default()));
    assert!(job.game_candidates.is_empty());
    assert!(fs::rename(&target, fixture.0.join("moved")).is_err());
    drop(file);
    let other = fixture.0.join("downloads/setup-second.exe");
    pe_fixture(&other, true);
    let next = manager.inspect("two", &source(&other)).unwrap();
    assert_eq!(
        manager
            .reserve_destination("two", &next.token, &next.entries[0].id, Some(&target))
            .unwrap_err(),
        "setup_busy"
    );
    drop(destination);
    let restored = fixture.manager();
    let restored_job = &restored.list("one").unwrap()[0];
    assert_eq!(restored_job.status, SetupStatus::Interrupted);
    assert_eq!(restored_job.destination.as_deref(), Some(target.as_str()));
    assert_eq!(restored_job.engine, Some(SetupEngine::Inno));
}

#[cfg(windows)]
#[test]
fn final_candidates_require_valid_game_executables_and_exclude_installers_helpers() {
    let fixture = Fixture::new();
    pe_fixture(&fixture.0.join("install/bin/Game.exe"), false);
    pe_fixture(&fixture.0.join("install/setup.exe"), true);
    pe_fixture(&fixture.0.join("install/renamed-inno.exe"), true);
    pe_fixture(&fixture.0.join("install/unins000.exe"), false);
    pe_fixture(&fixture.0.join("install/vc_redist.x64.exe"), false);
    pe_fixture(&fixture.0.join("install/dxwebsetup.exe"), false);
    pe_fixture(&fixture.0.join("install/QuickSFV.EXE"), false);
    pe_fixture(&fixture.0.join("install/_Redist/helper.exe"), false);
    pe_fixture(&fixture.0.join("install/_CommonRedist/sub/component.exe"), false);
    fixture.file("install/bogus.exe");
    let (paths, truncated) = installed_candidates("one", &fixture.0.join("install")).unwrap();
    assert!(!truncated);
    assert_eq!(paths.len(), 1);
    assert!(paths[0].ends_with("Game.exe"));
    let installed = plain_path(Path::new(&paths[0])).unwrap();
    let root = plain_path(&fixture.0.join("install")).unwrap();
    assert!(installed.starts_with(&root));
    assert_eq!(installed, plain_path(&root.join("bin/Game.exe")).unwrap());
}

#[cfg(windows)]
#[test]
fn recovery_rescans_saved_destination_without_clearing_verification_or_truncation() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    let installer = fixture.0.join("downloads/setup.exe");
    pe_fixture(&installer, true);
    let destination = source(&fixture.0.join("installed"));
    let plan = manager.inspect("one", &source(&installer)).unwrap();
    let (job, file, held) = manager.reserve_destination("one", &plan.token, &plan.entries[0].id, Some(&destination)).unwrap();
    drop((file, held));
    assert_eq!(manager.recover("two", &job.id, None).unwrap_err(), "setup_plan");
    assert_eq!(manager.recover("one", &job.id, None).unwrap_err(), "setup_busy");
    manager.finish(&job.id, SetupStatus::External, Some(0), Some("setup_verification_unknown")).unwrap();
    pe_fixture(&Path::new(&destination).join("Game.exe"), false);
    pe_fixture(&Path::new(&destination).join("_Redist/QuickSFV.EXE"), false);
    pe_fixture(&Path::new(&destination).join("_Redist/dxwebsetup.exe"), false);
    fs::create_dir_all(Path::new(&destination).join("data/a/b/c/d/e/f")).unwrap();
    let recovered = manager.recover("one", &job.id, None).unwrap();
    assert_eq!(recovered.destination.as_deref(), Some(destination.as_str()));
    assert_eq!(recovered.game_candidates.len(), 1);
    assert!(recovered.game_candidates[0].ends_with("Game.exe"));
    assert!(recovered.scan_truncated, "incomplete data subtrees must not authorize automatic selection");
    assert!(recovered.root_candidates_complete, "deep data does not make the independent root scan incomplete");
    assert_eq!(recovered.root_game_candidates, recovered.game_candidates);
    assert_eq!(recovered.status, SetupStatus::External);
    assert_eq!(recovered.error.as_deref(), Some("setup_verification_unknown"));
    assert_eq!(recovered.exit_code, Some(0));
    assert_eq!(fixture.manager().list("one").unwrap()[0].game_candidates, recovered.game_candidates);
    assert_eq!(manager.recover("one", &job.id, Some(&source(&fixture.0))).unwrap_err(), "setup_destination");
    assert_eq!(manager.recover("one", &job.id, Some(&source(&installer))).unwrap_err(), "setup_destination");
    let download_child = fixture.0.join("downloads/unpacked");
    pe_fixture(&download_child.join("Other.exe"), false);
    assert_eq!(manager.recover("one", &job.id, Some(&source(&download_child))).unwrap_err(), "setup_destination");
}

#[cfg(windows)]
#[test]
fn recovery_accepts_explicit_existing_folder_and_does_not_mutate_on_store_failure() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    let installer = fixture.0.join("downloads/setup.exe");
    pe_fixture(&installer, true);
    let plan = manager.inspect("one", &source(&installer)).unwrap();
    let (job, file) = manager.reserve("one", &plan.token, &plan.entries[0].id).unwrap();
    drop(file);
    manager.finish(&job.id, SetupStatus::Finished, Some(0), None).unwrap();
    assert_eq!(manager.recover("one", &job.id, None).unwrap_err(), "setup_destination");
    let installed = fixture.0.join("installed");
    pe_fixture(&installed.join("Game.exe"), false);
    let recovered = manager.recover("one", &job.id, Some(&source(&installed))).unwrap();
    assert_eq!(recovered.status, SetupStatus::Finished);
    assert!(!recovered.scan_truncated);
    assert!(recovered.root_candidates_complete);
    assert_eq!(recovered.root_game_candidates, recovered.game_candidates);
    assert_eq!(recovered.game_candidates.len(), 1);
    let other = fixture.0.join("other");
    pe_fixture(&other.join("Other.exe"), false);
    let state = fixture.0.join("state");
    fs::rename(&state, fixture.0.join("saved-state")).unwrap();
    fs::write(&state, b"store unavailable").unwrap();
    assert_eq!(manager.recover("one", &job.id, Some(&source(&other))).unwrap_err(), "setup_store");
    let unchanged = manager.list("one").unwrap().remove(0);
    assert_eq!(unchanged.destination, recovered.destination);
    assert_eq!(unchanged.game_candidates, recovered.game_candidates);
    assert_eq!(unchanged.updated_at, recovered.updated_at);
}

#[cfg(windows)]
#[test]
fn root_discovery_ignores_nested_games_and_reports_its_own_candidate_limit() {
    let fixture = Fixture::new();
    let installed = fixture.0.join("installed");
    pe_fixture(&installed.join("Game.exe"), false);
    pe_fixture(&installed.join("nested/Other.exe"), false);
    let (root, truncated) = installed_candidates_in("one", &installed, false).unwrap();
    assert!(!truncated);
    assert_eq!(root.len(), 1);
    assert!(root[0].ends_with("Game.exe"));
    for index in 0..MAX_GAME_CANDIDATES {
        pe_fixture(&installed.join(format!("Extra{index}.exe")), false);
    }
    let (root, truncated) = installed_candidates_in("one", &installed, false).unwrap();
    assert_eq!(root.len(), MAX_GAME_CANDIDATES);
    assert!(truncated, "a capped root list must not authorize automatic selection");
}

#[cfg(windows)]
#[test]
#[ignore = "requires an explicitly supplied existing setup store; writes only a fixture copy"]
fn recovery_of_existing_install_uses_only_a_copied_job_store() {
    let store_path = PathBuf::from(std::env::var_os("HARBOR_SETUP_RECOVERY_STORE").unwrap());
    let job_id = std::env::var("HARBOR_SETUP_RECOVERY_JOB").unwrap();
    let expected = PathBuf::from(std::env::var_os("HARBOR_SETUP_RECOVERY_EXE").unwrap());
    let fixture = Fixture::new();
    let copied_root = fixture.0.join("state");
    fs::create_dir(&copied_root).unwrap();
    fs::write(copied_root.join("jobs.json"), fs::read(store_path).unwrap()).unwrap();
    let manager = fixture.manager();
    let previous = manager.jobs.lock().unwrap().iter().find(|job| job.id == job_id).unwrap().clone();
    let recovered = manager.recover(&previous.profile, &job_id, None).unwrap();
    assert_eq!(recovered.status, previous.status);
    assert_eq!(recovered.error, previous.error);
    assert!(recovered.root_candidates_complete);
    assert_eq!(recovered.root_game_candidates.len(), 1);
    assert_eq!(plain_path(Path::new(&recovered.root_game_candidates[0])).unwrap(), plain_path(&expected).unwrap());
    assert_eq!(fixture.manager().list(&previous.profile).unwrap().iter().find(|job| job.id == job_id).unwrap().root_game_candidates, recovered.root_game_candidates);
}

#[test]
fn legacy_job_records_default_new_managed_fields_without_changing_status() {
    let json = serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(), "profile": "one", "source": "source",
        "installer": "setup.exe", "startedAt": 1, "updatedAt": 2,
        "status": "finished", "exitCode": 0, "error": null
    });
    let job: SetupJob = serde_json::from_value(json).unwrap();
    assert_eq!(job.status, SetupStatus::Finished);
    assert!(job.destination.is_none());
    assert!(job.engine.is_none());
    assert!(job.activity.is_none());
    assert!(job.game_candidates.is_empty());
    assert!(!job.scan_truncated);
    assert!(job.root_game_candidates.is_empty());
    assert!(!job.root_candidates_complete);
}

#[test]
fn inspect_is_read_only_classifies_candidates_and_ignores_helpers() {
    let fixture = Fixture::new();
    for name in [
        "download/setup.exe",
        "download/install-game.exe",
        "download/package.msi",
        "download/Game.exe",
        "download/content.zip",
        "download/content.7z",
        "download/split.7z.001",
        "download/split.7z.002",
        "download/split.zip.001",
        "download/split.zip.002",
        "download/not-an-archive.001",
        "download/content.rar",
        "download/content.r00",
        "download/content.r01",
        "download/content.s00",
        "download/content.iso",
        "download/content.xz",
        "download/content.bz2",
        "download/content.torrent",
        "download/unins000.exe",
        "download/vc_redist.x64.exe",
        "download/DXSETUP.exe",
        "download/readme.txt",
        "download/sub/another.exe",
    ] {
        fixture.file(name);
    }
    let (plan, _) = inspect("one", &source(&fixture.0.join("download"))).unwrap();
    assert!(!plan.truncated);
    assert_eq!(plan.entries.len(), 19);
    assert_eq!(
        plan.entries
            .iter()
            .filter(|entry| entry.kind == SetupKind::Installer)
            .count(),
        3
    );
    assert_eq!(
        plan.entries
            .iter()
            .filter(|entry| entry.kind == SetupKind::Game)
            .count(),
        2
    );
    assert_eq!(
        plan.entries
            .iter()
            .filter(|entry| entry.kind == SetupKind::ExternalArchive)
            .count(),
        2
    );
    assert!(plan.entries.iter().any(|entry| entry.relative_path == "content.7z" && entry.kind == SetupKind::Archive));
    assert!(plan.entries.iter().any(|entry| entry.relative_path == "content.rar" && entry.kind == SetupKind::Archive));
    assert!(plan.entries.iter().any(|entry| entry.relative_path == "content.iso" && entry.kind == SetupKind::Archive));
    for name in ["content.r00", "content.r01", "content.s00"] {
        assert!(plan.entries.iter().any(|entry| entry.relative_path == name && entry.kind == SetupKind::Archive));
    }
    for name in ["split.7z.001", "split.7z.002", "split.zip.001", "split.zip.002"] {
        assert!(plan.entries.iter().any(|entry| entry.relative_path == name && entry.kind == SetupKind::Archive));
    }
    assert!(!plan.entries.iter().any(|entry| entry.relative_path == "not-an-archive.001"));
    assert!(plan.entries.iter().any(|entry| entry.relative_path == "content.torrent" && entry.kind == SetupKind::Torrent));
    let names: Vec<_> = plan
        .entries
        .iter()
        .map(|entry| entry.relative_path.to_lowercase())
        .collect();
    let mut sorted = names.clone();
    sorted.sort();
    assert_eq!(names, sorted);
    assert!(plan.entries.iter().all(|entry| entry.bytes == 27));
    assert!(!fixture.0.join("state").exists());
    let (single, _) = inspect("one", &source(&fixture.0.join("download/content.zip"))).unwrap();
    assert_eq!(
        single.entries.len(),
        1,
        "explicit file must not scan its siblings"
    );
    assert_eq!(single.entries[0].kind, SetupKind::Archive);
    let (single, _) = inspect("one", &source(&fixture.file("disc/Game.ISO"))).unwrap();
    assert_eq!(single.entries.len(), 1);
    assert_eq!(single.entries[0].kind, SetupKind::Archive);
}

#[test]
fn bounded_inspection_rejects_roots_and_relative_paths() {
    let fixture = Fixture::new();
    assert_eq!(
        inspect("", &source(&fixture.0)).unwrap_err(),
        "setup_profile"
    );
    assert_eq!(
        inspect("one", "relative/setup.exe").unwrap_err(),
        "setup_path"
    );
    let root = fixture.0.ancestors().last().unwrap();
    assert_eq!(inspect("one", &source(root)).unwrap_err(), "setup_path");
    for index in 0..MAX_CANDIDATES + 20 {
        fixture.file(&format!("many/game-{index:04}.exe"));
    }
    let (plan, _) = inspect("one", &source(&fixture.0.join("many"))).unwrap();
    assert!(plan.truncated);
    assert_eq!(plan.entries.len(), MAX_CANDIDATES);
    fixture.file("deep/a/b/c/d/e/f/g/setup.exe");
    let (deep, _) = inspect("one", &source(&fixture.0.join("deep"))).unwrap();
    assert!(deep.truncated);
    assert!(deep.entries.is_empty());
}

#[test]
fn plans_are_profile_bound_installer_only_single_use_and_expire() {
    let fixture = Fixture::new();
    fixture.file("download/setup.exe");
    fixture.file("download/game.exe");
    let manager = fixture.manager();
    let plan = manager
        .inspect("one", &source(&fixture.0.join("download")))
        .unwrap();
    let installer = plan
        .entries
        .iter()
        .find(|entry| entry.kind == SetupKind::Installer)
        .unwrap();
    let game = plan
        .entries
        .iter()
        .find(|entry| entry.kind == SetupKind::Game)
        .unwrap();
    assert_eq!(
        manager
            .reserve("two", &plan.token, &installer.id)
            .unwrap_err(),
        "setup_selection"
    );
    assert_eq!(
        manager.reserve("one", &plan.token, &game.id).unwrap_err(),
        "setup_selection"
    );
    assert_eq!(
        manager.reserve("one", &plan.token, "missing").unwrap_err(),
        "setup_selection"
    );
    let (job, file) = manager.reserve("one", &plan.token, &installer.id).unwrap();
    #[cfg(windows)]
    {
        assert!(fs::write(&installer.path, b"replacement").is_err());
        assert!(fs::rename(&installer.path, fixture.0.join("replaced.exe")).is_err());
    }
    drop(file);
    assert_eq!(job.status, SetupStatus::Running);
    assert_eq!(job.source, source(&fixture.0.join("download")));
    assert_eq!(
        manager
            .reserve("one", &plan.token, &installer.id)
            .unwrap_err(),
        "setup_expired"
    );
    let next = manager
        .inspect("one", &source(&fixture.0.join("download/setup.exe")))
        .unwrap();
    assert_eq!(
        manager
            .reserve("one", &next.token, &next.entries[0].id)
            .unwrap_err(),
        "setup_busy"
    );
    manager
        .finish(&job.id, SetupStatus::Finished, Some(0), None)
        .unwrap();
    manager
        .plans
        .lock()
        .unwrap()
        .get_mut(&next.token)
        .unwrap()
        .created = Instant::now() - PLAN_TTL;
    assert_eq!(
        manager
            .reserve("one", &next.token, &next.entries[0].id)
            .unwrap_err(),
        "setup_expired"
    );
    assert!(manager.list("two").unwrap().is_empty());
}

#[test]
fn reviewed_file_replacement_or_changes_are_rejected() {
    let fixture = Fixture::new();
    let path = fixture.file("setup.exe");
    let manager = fixture.manager();
    let plan = manager.inspect("one", &source(&path)).unwrap();
    // Preserve both length and modification time; file identity must still catch replacement.
    let metadata = fs::metadata(&path).unwrap();
    let renamed = fixture.0.join("original.exe");
    fs::rename(&path, &renamed).unwrap();
    fs::copy(&renamed, &path).unwrap();
    File::options()
        .write(true)
        .open(&path)
        .unwrap()
        .set_times(fs::FileTimes::new().set_modified(metadata.modified().unwrap()))
        .unwrap();
    assert_eq!(
        manager
            .reserve("one", &plan.token, &plan.entries[0].id)
            .unwrap_err(),
        "setup_changed"
    );
    let plan = manager.inspect("one", &source(&path)).unwrap();
    fs::write(&path, b"different fixture").unwrap();
    assert_eq!(
        manager
            .reserve("one", &plan.token, &plan.entries[0].id)
            .unwrap_err(),
        "setup_changed"
    );
    let plan = manager.inspect("one", &source(&path)).unwrap();
    fs::remove_file(&path).unwrap();
    assert_eq!(
        manager
            .reserve("one", &plan.token, &plan.entries[0].id)
            .unwrap_err(),
        "setup_changed"
    );
}

#[test]
fn job_history_survives_restart_without_claiming_installation() {
    let fixture = Fixture::new();
    let path = fixture.file("setup.exe");
    let events = Arc::new(Mutex::new(Vec::new()));
    let seen = events.clone();
    let manager = Setups::load(fixture.0.join("state"), move |job| {
        seen.lock().unwrap().push(job)
    })
    .unwrap();
    let plan = manager.inspect("one", &source(&path)).unwrap();
    let (job, file) = manager
        .reserve("one", &plan.token, &plan.entries[0].id)
        .unwrap();
    drop(file);
    let completed = manager
        .finish(&job.id, SetupStatus::Finished, Some(0), None)
        .unwrap();
    assert!(completed.updated_at > job.updated_at);
    assert_eq!(completed.exit_code, Some(0));
    let plan = manager.inspect("two", &source(&path)).unwrap();
    let (_, file) = manager
        .reserve("two", &plan.token, &plan.entries[0].id)
        .unwrap();
    drop(file);
    drop(manager);
    let restored = fixture.manager();
    assert_eq!(
        restored.list("one").unwrap()[0].status,
        SetupStatus::Finished
    );
    assert_eq!(
        restored.list("two").unwrap()[0].status,
        SetupStatus::Interrupted
    );
    assert_eq!(restored.list("two").unwrap()[0].exit_code, None);
    assert_eq!(events.lock().unwrap().len(), 1);
    assert!(!fs::read_to_string(fixture.0.join("state/jobs.json"))
        .unwrap()
        .contains("installed"));
}

#[test]
fn persistence_failure_prevents_a_start_and_corrupt_store_is_preserved() {
    let fixture = Fixture::new();
    let path = fixture.file("setup.exe");
    let manager = fixture.manager();
    let plan = manager.inspect("one", &source(&path)).unwrap();
    fs::create_dir(fixture.0.join("state/jobs.json")).unwrap();
    assert_eq!(
        manager
            .reserve("one", &plan.token, &plan.entries[0].id)
            .unwrap_err(),
        "setup_store"
    );
    assert!(manager.list("one").unwrap().is_empty());
    assert!(manager.plans.lock().unwrap().contains_key(&plan.token));
    fs::remove_dir(fixture.0.join("state/jobs.json")).unwrap();
    fs::write(fixture.0.join("state/jobs.json"), b"invalid user data").unwrap();
    assert!(matches!(
        Setups::load(fixture.0.join("state"), |_| {}),
        Err("setup_store")
    ));
    assert_eq!(
        fs::read(fixture.0.join("state/jobs.json")).unwrap(),
        b"invalid user data"
    );
}

#[cfg(windows)]
#[test]
fn windows_junctions_are_not_followed_or_accepted_as_replacements() {
    let fixture = Fixture::new();
    fixture.file("outside/setup.exe");
    fs::create_dir(fixture.0.join("download")).unwrap();
    let junction = fixture.0.join("download/link");
    // All paths are generated inside this fixture; mklink makes a directory junction without elevation.
    let output = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(source(&junction).replace('/', "\\"))
        .arg(source(&fixture.0.join("outside")).replace('/', "\\"))
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let (plan, _) = inspect("one", &source(&fixture.0.join("download"))).unwrap();
    assert!(plan.entries.is_empty());
    assert_eq!(
        inspect("one", &source(&junction.join("setup.exe"))).unwrap_err(),
        "setup_path"
    );
    assert_eq!(
        ManagedDestination::prepare(&source(&junction), &fixture.0.join("another-source"))
            .unwrap_err(),
        "setup_destination"
    );
    // Remove only the junction, never recursively traverse its destination during fixture cleanup.
    fs::remove_dir(&junction).unwrap();
    let path = fixture.file("download/install/setup.exe");
    let manager = fixture.manager();
    let plan = manager.inspect("one", &source(&path)).unwrap();
    fs::rename(
        fixture.0.join("download/install"),
        fixture.0.join("original"),
    )
    .unwrap();
    let output = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(source(&fixture.0.join("download/install")).replace('/', "\\"))
        .arg(source(&fixture.0.join("original")).replace('/', "\\"))
        .output()
        .unwrap();
    assert!(output.status.success());
    assert_eq!(
        manager
            .reserve("one", &plan.token, &plan.entries[0].id)
            .unwrap_err(),
        "setup_changed"
    );
    fs::remove_dir(fixture.0.join("download/install")).unwrap();
}

#[test]
fn cached_plans_and_history_are_bounded() {
    let fixture = Fixture::new();
    let path = fixture.file("setup.exe");
    let manager = fixture.manager();
    for _ in 0..MAX_PLANS + 4 {
        manager.inspect("one", &source(&path)).unwrap();
    }
    assert_eq!(manager.plans.lock().unwrap().len(), MAX_PLANS);
    // Seed a full history to exercise bounded reserve without hundreds of disk writes.
    let mut history = manager.jobs.lock().unwrap();
    for index in 0..MAX_JOBS {
        history.push(SetupJob {
            id: uuid::Uuid::new_v4().to_string(),
            profile: "one".into(),
            source: source(&path),
            installer: source(&path),
            started_at: index as u64,
            updated_at: index as u64,
            status: SetupStatus::Finished,
            exit_code: Some(0),
            error: None,
            engine: None,
            destination: None,
            activity: None,
            progress: None,
            game_candidates: Vec::new(),
            scan_truncated: false,
            root_game_candidates: Vec::new(),
            root_candidates_complete: false,
            reconnected_at: None,
            recovery: None,
        });
    }
    let oldest = history[0].id.clone();
    drop(history);
    let plan = manager.inspect("one", &source(&path)).unwrap();
    let (_, file) = manager
        .reserve("one", &plan.token, &plan.entries[0].id)
        .unwrap();
    drop(file);
    let jobs = manager.list("one").unwrap();
    assert_eq!(jobs.len(), MAX_JOBS);
    assert!(!jobs.iter().any(|job| job.id == oldest));
}

#[test]
fn controlled_setup_process_reports_exit_and_outlives_callers() {
    // Opt-in path is a locally compiled tiny fixture, never a downloaded installer.
    let Some(executable) = std::env::var_os("HARBOR_SETUP_TEST_EXE") else {
        return;
    };
    let fixture = Fixture::new();
    let installer = fixture
        .0
        .join(if cfg!(windows) { "setup.exe" } else { "setup" });
    fs::copy(executable, &installer).unwrap();
    let events = Arc::new(Mutex::new(Vec::new()));
    let seen = events.clone();
    let manager = Setups::load(fixture.0.join("state"), move |job| {
        seen.lock().unwrap().push(job)
    })
    .unwrap();
    let plan = manager.inspect("one", &source(&installer)).unwrap();
    let job = manager
        .start("one", &plan.token, &plan.entries[0].id, None)
        .unwrap();
    assert_eq!(job.status, SetupStatus::Running);
    drop(manager); // The tracking thread owns its state; closing the UI does not kill the process.
    let deadline = Instant::now() + Duration::from_secs(15);
    loop {
        if events
            .lock()
            .unwrap()
            .iter()
            .any(|event| event.id == job.id && event.status == SetupStatus::Finished)
        {
            break;
        }
        assert!(
            Instant::now() < deadline,
            "controlled process did not complete"
        );
        std::thread::sleep(Duration::from_millis(25));
    }
    assert_eq!(
        fs::read_to_string(fixture.0.join("setup-proof.txt")).unwrap(),
        "controlled process finished"
    );
    let restored = fixture.manager();
    assert_eq!(restored.list("one").unwrap()[0].exit_code, Some(0));
    // A second run fails deliberately, proving a nonzero exit is not a completed setup.
    fs::write(fixture.0.join("fail-next.txt"), b"fail").unwrap();
    let plan = restored.inspect("one", &source(&installer)).unwrap();
    let failed = restored
        .start("one", &plan.token, &plan.entries[0].id, None)
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(15);
    loop {
        let state = restored
            .list("one")
            .unwrap()
            .into_iter()
            .find(|job| job.id == failed.id)
            .unwrap();
        if state.status != SetupStatus::Running {
            assert_eq!(state.status, SetupStatus::Failed);
            assert_eq!(state.exit_code, Some(7));
            break;
        }
        assert!(Instant::now() < deadline);
        std::thread::sleep(Duration::from_millis(25));
    }
}

#[cfg(windows)]
#[test]
fn controlled_managed_setup_tracks_files_and_returns_only_validated_games() {
    let Some(executable) = std::env::var_os("HARBOR_SETUP_TEST_EXE") else {
        return;
    };
    let fixture = Fixture::new();
    let installer = fixture.0.join("download/setup.exe");
    fs::create_dir(installer.parent().unwrap()).unwrap();
    fs::copy(executable, &installer).unwrap();
    let mut trailer = [0u8; 64];
    let marker = b"Inno Setup Setup Data (5.5.0) (u)\0";
    trailer[..marker.len()].copy_from_slice(marker);
    OpenOptions::new()
        .append(true)
        .open(&installer)
        .unwrap()
        .write_all(&trailer)
        .unwrap();
    let events = Arc::new(Mutex::new(Vec::new()));
    let seen = Arc::clone(&events);
    let manager = Setups::load(fixture.0.join("state"), move |job| {
        seen.lock().unwrap().push(job)
    })
    .unwrap();
    let plan = manager.inspect("one", &source(&installer)).unwrap();
    assert_eq!(plan.entries[0].engine, Some(SetupEngine::Inno));
    let destination = fixture.0.join("Installed Test Game");
    let job = manager
        .start(
            "one",
            &plan.token,
            &plan.entries[0].id,
            Some(&source(&destination)),
        )
        .unwrap();
    assert_eq!(job.status, SetupStatus::Running);
    assert_eq!(
        job.destination.as_deref(),
        Some(source(&destination).as_str())
    );
    drop(manager);
    let deadline = Instant::now() + Duration::from_secs(20);
    let completed = loop {
        if let Some(completed) = events
            .lock()
            .unwrap()
            .iter()
            .find(|event| event.id == job.id && event.status == SetupStatus::Finished)
            .cloned()
        {
            break completed;
        }
        assert!(
            Instant::now() < deadline,
            "controlled managed process did not complete: {:?}",
            events.lock().unwrap()
        );
        std::thread::sleep(Duration::from_millis(25));
    };
    assert_eq!(completed.exit_code, Some(0));
    assert_eq!(completed.error, None);
    let activity = completed.activity.as_ref().unwrap();
    assert_eq!(activity.files, 6);
    assert!(activity.bytes >= 5 * 64 * 1024);
    assert!(!activity.truncated);
    assert!(!completed.scan_truncated);
    assert_eq!(completed.game_candidates.len(), 1);
    assert!(completed.game_candidates[0].ends_with("Game.exe"));
    assert!(events.lock().unwrap().iter().any(|event| event.id == job.id
        && event.status == SetupStatus::Running
        && event
            .activity
            .as_ref()
            .is_some_and(|activity| activity.bytes > 0)));
    let manager = fixture.manager();
    let persisted = &manager.list("one").unwrap()[0];
    assert_eq!(persisted.game_candidates, completed.game_candidates);
    assert_eq!(persisted.activity, completed.activity);
    assert_eq!(persisted.destination, completed.destination);
    // A failed installer cannot offer even a plausible executable as ready.
    fs::write(installer.parent().unwrap().join("fail-next.txt"), b"fail").unwrap();
    let plan = manager.inspect("one", &source(&installer)).unwrap();
    let failed = manager
        .start(
            "one",
            &plan.token,
            &plan.entries[0].id,
            Some(&source(&fixture.0.join("Failed Test Game"))),
        )
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(15);
    loop {
        let current = manager
            .list("one")
            .unwrap()
            .into_iter()
            .find(|event| event.id == failed.id)
            .unwrap();
        if current.status != SetupStatus::Running {
            assert_eq!(current.status, SetupStatus::Failed);
            assert_eq!(current.exit_code, Some(7));
            assert!(current.game_candidates.is_empty());
            break;
        }
        assert!(Instant::now() < deadline);
        std::thread::sleep(Duration::from_millis(25));
    }
}
