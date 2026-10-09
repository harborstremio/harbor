mod pokemon_bank;
mod pokemon_save_discovery;
mod retro_save_path;
mod pokemon_workspace;
mod pokemon_files;
mod save_activity;
#[tauri::command]
pub async fn games_pokemon(app: tauri::AppHandle, profile: String, request: serde_json::Value) -> Result<serde_json::Value, String> { pokemon_bank::dispatch(app, profile, request).await }
mod emulation;
mod embedded;
#[tauri::command]
pub async fn games_retro_status(app: tauri::AppHandle, system: u32) -> Result<embedded::RuntimeStatus, String> { embedded::status(app, system).await }
#[tauri::command]
pub async fn games_retro_start(app: tauri::AppHandle, id: String, profile: String, game_path: String, root: String, system: u32) -> Result<embedded::Session, String> { embedded::start(app, id, profile, game_path, root, system).await }
#[tauri::command]
pub fn games_retro_close(id: String) { embedded::close(&id); }
mod custom_launch;
mod hydra_import;
pub use hydra_import::try_run_worker as try_run_hydra_import_worker;
#[tauri::command]
pub async fn games_hydra_import_review(app: tauri::AppHandle, args: hydra_import::Request) -> Result<hydra_import::Review, String> {
    use tauri::Manager;
    let scratch = app.path().app_cache_dir().map_err(|_| "hydra_space")?.join("games-hydra-review");
    hydra_import::review(scratch, args).await.map_err(String::from)
}
#[tauri::command]
pub fn games_hydra_import_cancel(profile: String, session: String) { hydra_import::cancel(&profile, &session); }
mod game_shortcuts;
#[tauri::command]
pub async fn games_game_shortcuts(id: String, name: String, config: custom_launch::LaunchConfig, target: Option<String>) -> Result<game_shortcuts::Shortcuts, String> {
    tauri::async_runtime::spawn_blocking(move || game_shortcuts::inspect_or_create(id, name, config, target)).await.map_err(|_| "shortcut_write")?.map_err(String::from)
}
mod native_package;
mod patch;
mod patch_workspace;
mod patch_download;
#[tauri::command]
pub async fn games_download_patch(app: tauri::AppHandle, url: String, id: String) -> Result<patch_download::DownloadReview, String> {
    use tauri::Manager;
    let root=app.path().app_cache_dir().map_err(|_| "patch_write_failed")?.join("games-patches");
    patch_download::download(&root,url,id).await.map_err(String::from)
}
#[tauri::command]
pub fn games_cancel_patch_download(id: String) { patch_download::cancel(&id); }
mod steam_paths;
mod steam_account;
mod steam_account_store;
mod minecraft_data;
mod minecraft_store;
mod minecraft_account;
mod minecraft_catalog;
mod minecraft_instances;
mod minecraft_loader;
mod minecraft_pack_state;
mod minecraft_pack_transaction;
mod minecraft_pack_update;
mod minecraft_lifecycle_files;
mod minecraft_recycle;
mod minecraft_instance_export;
mod minecraft_instance_storage;
#[tauri::command]
pub async fn games_minecraft_instance_export_review(app: tauri::AppHandle, profile: String, path: String, id: String, version: String, worlds: bool, settings: bool, operation_id: String) -> Result<minecraft_instance_export::Plan, String> { minecraft_instance_export::review(app, profile, path, id, version, worlds, settings, operation_id).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_instance_export_apply(app: tauri::AppHandle, profile: String, token: String, path: String, operation_id: String) -> Result<minecraft_instance_export::Exported, String> { minecraft_instance_export::apply(app, profile, token, path, operation_id).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_instance_storage(profile: String, path: String, id: String) -> Result<minecraft_instance_storage::State, String> { minecraft_instance_storage::state(profile, path, id).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_instance_remove_review(profile: String, path: String, id: String, backup: Option<String>, operation_id: String) -> Result<minecraft_instance_storage::Plan, String> { minecraft_instance_storage::review(profile, path, id, backup, operation_id).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_instance_remove_apply(profile: String, token: String, operation_id: String) -> Result<minecraft_instance_storage::Removed, String> { minecraft_instance_storage::apply(profile, token, operation_id).await.map_err(String::from) }
#[tauri::command]
pub fn games_minecraft_lifecycle_discard(profile: String, token: String) { minecraft_instance_export::discard(&profile, &token); minecraft_instance_storage::discard(&profile, &token); }
#[tauri::command]
pub async fn games_minecraft_pack_update_state(profile: String, path: String, id: String) -> Result<minecraft_pack_update::State, String> { minecraft_pack_update::state(profile, path, id).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_pack_update_review(app: tauri::AppHandle, profile: String, path: String, id: String, source: Option<String>, remote: bool, original: Option<String>, operation_id: String) -> Result<minecraft_pack_update::Plan, String> { minecraft_pack_update::review(app, profile, path, id, source, remote, original, operation_id).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_pack_update_select(profile: String, token: String, optional: Vec<String>, operation_id: String) -> Result<minecraft_pack_update::Plan, String> { minecraft_pack_update::select(profile, token, optional, operation_id).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_pack_update_apply(app: tauri::AppHandle, profile: String, token: String, operation_id: String) -> Result<minecraft_instances::Instance, String> { minecraft_pack_update::apply(app, profile, token, operation_id).await.map_err(String::from) }
#[tauri::command]
pub fn games_minecraft_pack_update_discard(profile: String, token: String) { minecraft_pack_update::discard(&profile, &token); }
#[tauri::command]
pub fn games_minecraft_pack_update_cancel(profile: String, operation_id: String) { minecraft_pack_update::cancel(&profile, &operation_id); }
#[tauri::command]
pub async fn games_minecraft_fabric_versions(game: String) -> Result<Vec<minecraft_loader::Release>, String> { minecraft_loader::versions(game).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_loader_versions(game: String, loader: String) -> Result<Vec<minecraft_loader::Release>, String> { minecraft_loader::versions_for(loader, game).await.map_err(String::from) }
mod minecraft_content;
#[tauri::command]
pub async fn games_minecraft_content(profile: String, path: String, id: String) -> Result<minecraft_content::Content, String> { minecraft_content::content(profile, path, id).await.map_err(String::from) }
mod minecraft_pack;
mod minecraft_pack_install;
mod minecraft_runtime_data;
mod minecraft_runtime;
mod minecraft_forge;
mod minecraft_forge_data;
mod minecraft_forge_process;
mod minecraft_forge_profile;
#[cfg(test)]
mod minecraft_forge_failure_tests;
mod minecraft_java_data;
mod minecraft_java_archive;
mod minecraft_java;
mod minecraft_launch_data;
mod minecraft_launch_process;
mod minecraft_launch;
#[cfg(test)]
mod minecraft_launch_tests;
#[tauri::command]
pub async fn games_minecraft_launch_state(profile: String, path: String, id: String, logs: bool) -> Result<minecraft_launch_process::State, String> {
    tauri::async_runtime::spawn_blocking(move || minecraft_launch::state(&profile, &path, &id, logs)).await.map_err(|_| "launch_state")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_minecraft_launch(app: tauri::AppHandle, profile: String, path: String, id: String, operation_id: String) -> Result<minecraft_launch_process::State, String> {
    use tauri::Emitter; let accounts = minecraft_root(&app)?;
    minecraft_launch::launch(accounts, profile, path, id, operation_id, move |progress| { let _ = app.emit("games:minecraft-launch-progress", progress); }).await.map_err(String::from)
}
#[cfg(test)]
mod minecraft_runtime_tests;
#[tauri::command]
pub async fn games_minecraft_runtime_state(profile: String, path: String, id: String) -> Result<minecraft_runtime::State, String> {
    tauri::async_runtime::spawn_blocking(move || minecraft_runtime::state(&profile, &path, &id)).await.map_err(|_| "instance_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_minecraft_runtime_review(profile: String, path: String, id: String, operation_id: String) -> Result<minecraft_runtime::Plan, String> { minecraft_runtime::review(profile, path, id, operation_id).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_runtime_install(app: tauri::AppHandle, profile: String, token: String, operation_id: String) -> Result<minecraft_runtime::State, String> { use tauri::Emitter; minecraft_runtime::install(profile, token, operation_id, move |progress| { let _ = app.emit("games:minecraft-runtime-progress", progress); }).await.map_err(String::from) }
#[tauri::command]
pub fn games_minecraft_runtime_cancel(profile: String, operation_id: String) { minecraft_runtime::cancel(&profile, &operation_id); }
#[tauri::command]
pub fn games_minecraft_runtime_discard(profile: String, token: String) { minecraft_runtime::discard(&profile, &token); }

#[tauri::command]
pub async fn games_minecraft_java_state(profile: String, path: String, id: String) -> Result<minecraft_java::State, String> {
    tauri::async_runtime::spawn_blocking(move || minecraft_java::state(&profile, &path, &id)).await.map_err(|_| "instance_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_minecraft_java_review(profile: String, path: String, id: String, operation_id: String) -> Result<minecraft_java::Plan, String> { minecraft_java::review(profile, path, id, operation_id).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_java_select(profile: String, path: String, id: String, executable: String, memory: u32, operation_id: String) -> Result<minecraft_java::State, String> { minecraft_java::select(profile, path, id, executable, memory, operation_id).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_java_memory(profile: String, path: String, id: String, memory: u32) -> Result<minecraft_java::State, String> {
    tauri::async_runtime::spawn_blocking(move || minecraft_java::memory(&profile, &path, &id, memory)).await.map_err(|_| "instance_write")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_minecraft_java_install(app: tauri::AppHandle, profile: String, token: String, memory: u32, operation_id: String) -> Result<minecraft_java::State, String> { use tauri::Emitter; minecraft_java::install(profile, token, memory, operation_id, move |progress| { let _ = app.emit("games:minecraft-java-progress", progress); }).await.map_err(String::from) }
#[tauri::command]
pub fn games_minecraft_java_discard(profile: String, token: String) { minecraft_java::discard(&profile, &token); }
#[cfg(test)]
mod minecraft_instance_tests;
#[tauri::command]
pub async fn games_minecraft_instances(profile: String, path: String) -> Result<minecraft_instances::Library, String> {
    tauri::async_runtime::spawn_blocking(move || minecraft_instances::list(&profile, &path)).await.map_err(|_| "instance_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_minecraft_instance_create(profile: String, path: String, name: String, game: String, loader: Option<String>, loader_version: Option<String>, operation_id: Option<String>) -> Result<minecraft_instances::Instance, String> {
    minecraft_loader::create(profile, path, name, game, loader.unwrap_or_else(|| "vanilla".into()), loader_version.unwrap_or_default(), operation_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string())).await.map_err(String::from)
}
#[tauri::command]
pub async fn games_minecraft_instance_rename(profile: String, path: String, id: String, name: String) -> Result<minecraft_instances::Instance, String> {
    tauri::async_runtime::spawn_blocking(move || minecraft_instances::rename(&profile, &path, &id, &name)).await.map_err(|_| "instance_write")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_minecraft_instance_folder(profile: String, path: String, id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || minecraft_instances::game_folder(&profile, &path, &id)).await.map_err(|_| "instance_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_minecraft_pack_review(app: tauri::AppHandle, profile: String, path: String, source: String, remote_version: bool, operation_id: String) -> Result<minecraft_pack_install::Plan, String> {
    minecraft_pack_install::review(app, profile, path, source, remote_version, operation_id).await.map_err(String::from)
}
#[tauri::command]
pub async fn games_minecraft_pack_install(app: tauri::AppHandle, profile: String, token: String, name: String, optional: Vec<String>, operation_id: String) -> Result<minecraft_instances::Instance, String> {
    minecraft_pack_install::install(app, profile, token, name, optional, operation_id).await.map_err(String::from)
}
#[tauri::command]
pub fn games_minecraft_pack_cancel(profile: String, operation_id: String) { minecraft_pack_install::cancel(&profile, &operation_id); }
#[tauri::command]
pub fn games_minecraft_pack_discard(profile: String, token: String) { minecraft_pack_install::discard(&profile, &token); }
#[tauri::command]
pub async fn games_minecraft_catalog(args: minecraft_catalog::Request) -> Result<serde_json::Value, String> { minecraft_catalog::request(args).await.map_err(String::from) }

fn minecraft_root(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    Ok(app.path().app_data_dir().map_err(|_| "minecraft_store")?.join("game-accounts").join("minecraft"))
}
#[tauri::command]
pub async fn games_minecraft_status(app: tauri::AppHandle, profile: String) -> Result<minecraft_data::Status, String> {
    let root = minecraft_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || minecraft_account::status(&root, &profile)).await.map_err(|_| "minecraft_store")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_minecraft_begin(profile: String) -> Result<minecraft_account::Challenge, String> { minecraft_account::begin(profile).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_poll(app: tauri::AppHandle, profile: String, flow: String) -> Result<minecraft_account::Poll, String> { minecraft_account::poll(&minecraft_root(&app)?, &profile, &flow).await.map_err(String::from) }
#[tauri::command]
pub fn games_minecraft_cancel(profile: String, flow: Option<String>) { if let Some(id) = flow { minecraft_account::cancel(&profile, &id); } else { minecraft_account::cancel_profile(&profile); } }
#[tauri::command]
pub async fn games_minecraft_refresh(app: tauri::AppHandle, profile: String) -> Result<minecraft_data::Status, String> { minecraft_account::refresh(&minecraft_root(&app)?, &profile).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_disconnect(app: tauri::AppHandle, profile: String) -> Result<(), String> { minecraft_account::disconnect(&minecraft_root(&app)?, &profile).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_apply_skin(app: tauri::AppHandle, profile: String, png: String, variant: String) -> Result<minecraft_data::Status, String> { minecraft_account::apply_skin(&minecraft_root(&app)?, &profile, png, variant).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_apply_cape(app: tauri::AppHandle, profile: String, cape_id: Option<String>) -> Result<minecraft_data::Status, String> { minecraft_account::apply_cape(&minecraft_root(&app)?, &profile, cape_id).await.map_err(String::from) }
#[tauri::command]
pub async fn games_minecraft_texture(app: tauri::AppHandle, profile: String, kind: String, id: String) -> Result<String, String> { minecraft_account::texture(&minecraft_root(&app)?, &profile, &kind, &id).await.map_err(String::from) }
mod achievement_protocol;
#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
mod achievement_schema;
#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
mod steam_achievement_client;
mod steam_achievements;
pub use steam_achievements::try_run_worker as try_run_achievement_worker;
mod steam_scan;
mod steam_shortcuts;
mod steam_shortcut_art;
mod steam_shortcut_icons;
mod steam_shortcut_launch;
pub mod steam_shortcut_commands;
mod launcher_scan;
pub mod library_management;
mod wow_addons;
mod sims_package;
mod sims_manifest;
mod sims_files;
mod sims_packs;
mod sims_launch_settings;
mod sims_duplicates;
mod sims_fingerprints;
mod sims_dependencies;
mod sims_cc;
mod sims_store;
mod sims_catalog;
mod sims_lot51;
mod sims_mts;
mod sims_mts_browse;
mod stardew;
pub mod stardew_commands;
mod stardew_manifest;
mod stardew_guard;
mod stardew_install_files;
mod stardew_package;
mod stardew_store;
mod stardew_reviews;
mod stardew_progress;
mod stardew_updates;
mod stardew_remote;
mod stardew_catalog;
mod stardew_creator;
mod sims_reviews;
mod sims_saves;
mod save_restore;
mod wow_addon_package;
mod wow_addon_store;
mod wow_addon_guard;
mod wow_addon_reviews;
pub(crate) mod transfer_files;
mod transfer_protocol;
mod transfer_retry;
mod transfer_storage;
mod download_queue;
mod download_locations;
#[tauri::command]
pub async fn games_download_locations(parent: Option<String>) -> Result<download_locations::Locations, String> {
    tauri::async_runtime::spawn_blocking(move || download_locations::inspect(parent)).await.map_err(|_| "download_storage_unavailable".to_owned())
}
mod transfer_bandwidth;
mod download_metadata;
mod write_metrics;
mod p2p_storage;
mod p2p_space;
mod transfers;
mod save_files;
mod saves;
mod archives;
pub use archives::try_run_worker as try_run_archive_worker;
mod archive_jobs;
mod archive_cleanup;
mod archive_cleanup_io;
mod archive_cleanup_plans;
mod archive_cleanup_store;
mod game_file_use;
mod download_preparation;
mod preparation_runtime;
mod preparation_intake;
pub fn initialize_download_preparation(app:&tauri::AppHandle){preparation_runtime::initialize(app);}
mod setup;

#[tauri::command]
pub async fn games_inspect_setup(app: tauri::AppHandle, profile: String, source: String) -> Result<setup::SetupPlan, String> {
    tauri::async_runtime::spawn_blocking(move || setup::manager(&app)?.inspect(&profile, &source))
        .await.map_err(|_| "setup_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_start_setup(app: tauri::AppHandle, profile: String, token: String, candidate_id: String, destination: Option<String>) -> Result<setup::SetupJob, String> {
    tauri::async_runtime::spawn_blocking(move || setup::manager(&app)?.start(&profile, &token, &candidate_id, destination.as_deref()))
        .await.map_err(|_| "setup_start")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_setup_jobs(app: tauri::AppHandle, profile: String) -> Result<Vec<setup::SetupJob>, String> {
    tauri::async_runtime::spawn_blocking(move || setup::manager(&app)?.list(&profile))
        .await.map_err(|_| "setup_store")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_setup_icon(app: tauri::AppHandle, profile: String, token: String, candidate_id: String) -> Result<Option<String>, String> {
    static SLOTS: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(2);
    let permit = SLOTS.acquire().await.map_err(|_| "setup_busy")?;
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        setup::manager(&app)?.icon(&profile, &token, &candidate_id)
    }).await.map_err(|_| "setup_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_recover_setup(app: tauri::AppHandle, profile: String, id: String, destination: Option<String>) -> Result<setup::SetupJob, String> {
    tauri::async_runtime::spawn_blocking(move || setup::manager(&app)?.recover(&profile, &id, destination.as_deref()))
        .await.map_err(|_| "setup_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_reveal_setup(app: tauri::AppHandle, profile: String, id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || setup::manager(&app)?.reveal(&profile, &id))
        .await.map_err(|_| "setup_window")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_observe_setup(app: tauri::AppHandle, profile: String, id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || setup::manager(&app)?.observe(&profile, &id))
        .await.map_err(|_| "setup_window")?.map_err(String::from)
}
mod p2p;
mod p2p_files;
mod modrinth;
mod mod_files;
mod mods;
mod fabric_mods;
mod cloud_files;
mod source_public_files;
mod source_browser;
mod source_browser_policy;
mod source_browser_grants;
mod source_verification;
mod source_verification_policy;
mod source_http;
mod source_http_requests;
#[tauri::command]
pub async fn games_source_http_fetch(app: tauri::AppHandle, window: tauri::WebviewWindow, profile: Option<String>, session: String, url: String, max_bytes: usize) -> Result<crate::http_fetch::HarborFetchResponse, String> {
    if window.label() != "main" { return Err("source_network".into()); }
    source_http::fetch(app, profile, session, url, max_bytes).await
}
#[tauri::command]
pub fn games_source_http_cancel(window: tauri::WebviewWindow, profile: Option<String>, session: String) {
    if window.label() == "main" { source_http::cancel(profile.as_deref(), &session); }
}
#[tauri::command]
pub async fn games_source_verify(app: tauri::AppHandle, window: tauri::WebviewWindow, profile: String, session: String, url: String, user_agent: String) -> Result<(), String> {
    if window.label() != "main" { return Err("source_verify_failed".into()); }
    source_verification::verify(app, profile, session, url, user_agent).await.map_err(String::from)
}
#[tauri::command]
pub fn games_source_verify_cancel(app: tauri::AppHandle, window: tauri::WebviewWindow, profile: String, session: String) {
    if window.label() == "main" { source_verification::cancel(&app, &profile, &session); }
}
#[tauri::command]
pub async fn games_source_verified_fetch(window: tauri::WebviewWindow, profile: String, url: String, max_bytes: usize) -> Result<Option<crate::http_fetch::HarborFetchResponse>, String> {
    if window.label() != "main" { return Err("source_verify_failed".into()); }
    source_verification::fetch(profile, url, max_bytes).await.map_err(String::from)
}
#[tauri::command]
pub async fn games_source_browser_choose(app: tauri::AppHandle, window: tauri::WebviewWindow, profile: String, session: String, url: String) -> Result<source_browser::BrowserFile, String> {
    if window.label() != "main" { return Err("public_browser".into()); }
    source_browser::choose(app, profile, session, url).await.map_err(String::from)
}
#[tauri::command]
pub fn games_source_browser_close(app: tauri::AppHandle, window: tauri::WebviewWindow, profile: String, session: String) {
    if window.label() == "main" { source_browser::close(&app, &profile, &session); }
}
#[tauri::command]
pub async fn games_source_public_review(args:source_public_files::Request)->Result<source_public_files::PublicFiles,String>{source_public_files::review(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_source_public_prepare(args:source_public_files::Request)->Result<source_public_files::PublicDownload,String>{source_public_files::prepare(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_source_public_prepare_batch(args:source_public_files::batch::Request)->source_public_files::batch::BatchResult{source_public_files::batch::prepare(args).await}
#[tauri::command]
pub fn games_source_public_cancel_batch(profile:String,session:String){source_public_files::batch::cancel(&profile,&session)}

use serde::Serialize;

#[tauri::command]
pub async fn games_scan_launchers() -> Result<launcher_scan::Scan, String> {
    tauri::async_runtime::spawn_blocking(launcher_scan::scan).await.map_err(|_| "launcher_scan_failed".into())
}

#[tauri::command]
pub async fn games_sims_folders(app: tauri::AppHandle) -> Result<Vec<sims_files::Folder>, String> {
    use tauri::Manager;
    let documents=app.path().document_dir().map_err(|_|"sims_folder")?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut found=Vec::new();
        if let Ok(entries)=std::fs::read_dir(documents.join("Electronic Arts")){for entry in entries.take(30).flatten(){if let Ok(path)=entry.path().canonicalize(){if let Some(path)=path.to_str(){if let Ok(folder)=sims_files::inspect_folder(path){found.push(folder);}}}}}
        found
    }).await.map_err(|_|"sims_read".into())
}
#[tauri::command]
pub async fn games_sims_workspace(path:String)->Result<sims_reviews::Workspace,String>{tauri::async_runtime::spawn_blocking(move||sims_reviews::workspace(&path)).await.map_err(|_|"sims_read")?.map_err(String::from)}
#[tauri::command]
pub async fn games_sims_inspect(path:String,file:String)->Result<sims_package::PackageInfo,String>{tauri::async_runtime::spawn_blocking(move||sims_reviews::inspect(&path,&file)).await.map_err(|_|"sims_read")?.map_err(String::from)}
#[tauri::command]
pub async fn games_sims_metadata(app:tauri::AppHandle,profile:String,path:String,target:sims_store::metadata::Target,operation_id:String)->Result<sims_store::metadata::Report,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||sims_store::metadata::inspect(&profile,&path,target,&operation_id,|p|{let _=app.emit("games:sims-progress",p);})).await.map_err(|_|"sims_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_sims_packs(app:tauri::AppHandle,profile:String,path:String,operation_id:String,custom:Option<Vec<sims_launch_settings::CustomLaunch>>)->Result<sims_packs::Report,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||sims_packs::scan(&profile,&path,&operation_id,&custom.unwrap_or_default(),|p|{let _=app.emit("games:sims-progress",p);})).await.map_err(|_|"sims_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_sims_dependencies(app:tauri::AppHandle,profile:String,path:String,operation_id:String,installation:Option<sims_dependencies::PackSelection>)->Result<sims_dependencies::Report,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||sims_dependencies::scan(&profile,&path,&operation_id,installation.as_ref(),|p|{let _=app.emit("games:sims-progress",p);})).await.map_err(|_|"sims_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_sims_duplicates(app:tauri::AppHandle,profile:String,path:String,operation_id:String)->Result<sims_duplicates::Report,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||sims_duplicates::scan(&profile,&path,&operation_id,|p|{let _=app.emit("games:sims-progress",p);})).await.map_err(|_|"sims_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_sims_tray_preview(path:String,id:String)->Result<Option<String>,String>{tauri::async_runtime::spawn_blocking(move||sims_store::tray::images::preview(&path,&id)).await.map_err(|_|"sims_read")?.map_err(String::from)}

#[tauri::command]
pub async fn games_sims_tray_content(app:tauri::AppHandle,profile:String,path:String,id:String,operation_id:String,installation:Option<sims_dependencies::PackSelection>)->Result<sims_cc::Report,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||sims_cc::scan(&profile,&path,&id,&operation_id,installation.as_ref(),|p|{let _=app.emit("games:sims-progress",p);})).await.map_err(|_|"sims_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_sims_kept_folder(path:String,id:String)->Result<String,String>{tauri::async_runtime::spawn_blocking(move||sims_store::preparation::folder(&path,&id)).await.map_err(|_|"sims_read")?.map_err(String::from)}
#[tauri::command]
pub async fn games_sims_lot51_catalog(refresh:Option<bool>)->Result<sims_lot51::Catalog,String>{tauri::async_runtime::spawn_blocking(move||tauri::async_runtime::block_on(sims_lot51::catalog(refresh.unwrap_or(false)))).await.map_err(|_|"sims_creator_network")?.map_err(String::from)}
#[tauri::command]
pub async fn games_sims_mts_browse(app:tauri::AppHandle,profile:String,operation_id:String,query:sims_mts_browse::Query,refresh:bool)->Result<sims_mts_browse::Page,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||tauri::async_runtime::block_on(sims_mts_browse::browse(profile,operation_id,query,refresh,|progress|{let _=app.emit("games:sims-progress",progress);}))).await.map_err(|_|"sims_creator_network")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_sims_mts_detail(app:tauri::AppHandle,profile:String,page:String,operation_id:String)->Result<sims_mts::Detail,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||tauri::async_runtime::block_on(sims_mts::detail(profile,page,operation_id,|progress|{let _=app.emit("games:sims-progress",progress);}))).await.map_err(|_|"sims_creator_network")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_sims_mts_review(app:tauri::AppHandle,profile:String,path:String,request:sims_mts::Request,operation_id:String)->Result<sims_reviews::Review,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||tauri::async_runtime::block_on(sims_mts::review(profile,path,request,operation_id,|progress|{let _=app.emit("games:sims-progress",progress);}))).await.map_err(|_|"sims_creator_network")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_sims_lot51_detail(project:String)->Result<sims_lot51::Detail,String>{tauri::async_runtime::spawn_blocking(move||tauri::async_runtime::block_on(sims_lot51::detail(&project))).await.map_err(|_|"sims_creator_network")?.map_err(String::from)}
#[tauri::command]
pub async fn games_sims_lot51_review(app:tauri::AppHandle,profile:String,path:String,request:sims_lot51::Request,operation_id:String)->Result<sims_reviews::Review,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||tauri::async_runtime::block_on(sims_lot51::review(profile,path,request,operation_id,|progress|{let _=app.emit("games:sims-progress",progress);}))).await.map_err(|_|"sims_creator_network")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_sims_catalog(refresh:Option<bool>)->Result<sims_catalog::Catalog,String>{tauri::async_runtime::spawn_blocking(move||tauri::async_runtime::block_on(sims_catalog::catalog(refresh.unwrap_or(false)))).await.map_err(|_|"sims_creator_network")?.map_err(String::from)}
#[tauri::command]
pub async fn games_sims_creator_review(app:tauri::AppHandle,profile:String,path:String,request:sims_catalog::Request,operation_id:String)->Result<sims_reviews::Review,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||tauri::async_runtime::block_on(sims_catalog::review(profile,path,request,operation_id,|progress|{let _=app.emit("games:sims-progress",progress);}))).await.map_err(|_|"sims_creator_network")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_sims_review(app:tauri::AppHandle,profile:String,path:String,action:sims_store::Action,sources:Vec<String>,operation_id:Option<String>)->Result<sims_reviews::Review,String>{
    use tauri::Emitter;
    let operation_id=operation_id.unwrap_or_else(||uuid::Uuid::new_v4().to_string());
    tauri::async_runtime::spawn_blocking(move||sims_reviews::review_with_events(profile,path,action,sources,operation_id,|progress|{let _=app.emit("games:sims-progress",progress);})).await.map_err(|_|"sims_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_sims_apply(app:tauri::AppHandle,profile:String,token:String,operation_id:Option<String>)->Result<sims_reviews::Workspace,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||sims_reviews::apply_with_events(profile,token,operation_id.unwrap_or_else(||uuid::Uuid::new_v4().to_string()),|progress|{let _=app.emit("games:save-progress",progress);},|progress|{let _=app.emit("games:sims-progress",progress);})).await.map_err(|_|"sims_write")?.map_err(String::from)
}
#[tauri::command]
pub fn games_sims_cancel(profile:String,operation_id:String)->bool{sims_reviews::cancel(profile,operation_id)}
#[tauri::command]
pub async fn games_sims_sets(profile:String,path:String)->Result<Vec<sims_store::sets::ModSet>,String>{tauri::async_runtime::spawn_blocking(move||sims_store::sets::list(&profile,&path)).await.map_err(|_|"sims_read")?.map_err(String::from)}
#[tauri::command]
pub async fn games_sims_set_save(profile:String,path:String,edit:sims_store::sets::Edit)->Result<Vec<sims_store::sets::ModSet>,String>{tauri::async_runtime::spawn_blocking(move||sims_store::sets::save(&profile,&path,edit)).await.map_err(|_|"sims_write")?.map_err(String::from)}
#[tauri::command]
pub async fn games_sims_set_remove(profile:String,path:String,previous:sims_store::sets::ModSet)->Result<Vec<sims_store::sets::ModSet>,String>{tauri::async_runtime::spawn_blocking(move||sims_store::sets::remove(&profile,&path,previous)).await.map_err(|_|"sims_write")?.map_err(String::from)}
#[tauri::command]
pub fn games_sims_discard(profile:String,token:String){sims_reviews::discard(&profile,&token);}
#[tauri::command]
pub async fn games_sims_recover(path:String)->Result<sims_reviews::Workspace,String>{tauri::async_runtime::spawn_blocking(move||sims_reviews::recover(path)).await.map_err(|_|"sims_write")?.map_err(String::from)}

#[tauri::command]
pub async fn games_sims_save_context(path:String)->Result<sims_saves::Context,String>{tauri::async_runtime::spawn_blocking(move||sims_saves::context(&path)).await.map_err(|_|"save_read")?.map_err(String::from)}
#[tauri::command]
pub async fn games_sims_save_recover(app:tauri::AppHandle,path:String,profile:String,operation_id:String)->Result<saves::SaveRestoreReceipt,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||sims_saves::recover(path,profile,operation_id,|progress|{let _=app.emit("games:save-progress",progress);})).await.map_err(|_|"save_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_save_recovery_status(target:String)->Result<bool,String>{tauri::async_runtime::spawn_blocking(move||save_restore::pending(std::path::Path::new(&target))).await.map_err(|_|"save_read")?.map_err(String::from)}
#[tauri::command]
pub async fn games_recover_save_restore(app:tauri::AppHandle,target:String,game_id:String,profile:String,operation_id:String)->Result<saves::SaveRestoreReceipt,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||saves::recover_pending(profile,game_id,target,operation_id,std::sync::Arc::new(||Ok(())),|progress|{let _=app.emit("games:save-progress",progress);})).await.map_err(|_|"save_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_sims_save_list(path:String,profile:String,vault:String)->Result<Vec<saves::SaveSnapshotInfo>,String>{tauri::async_runtime::spawn_blocking(move||sims_saves::list(&path,profile,vault)).await.map_err(|_|"save_read")?.map_err(String::from)}
#[tauri::command]
pub async fn games_sims_save_snapshot(app:tauri::AppHandle,path:String,args:saves::SaveRequest)->Result<saves::SaveSnapshotInfo,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||sims_saves::snapshot(&path,args,|progress|{let _=app.emit("games:save-progress",progress);})).await.map_err(|_|"save_write")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_sims_save_review(app:tauri::AppHandle,path:String,profile:String,vault:String,snapshot_id:String,operation_id:String)->Result<saves::SaveRestorePlan,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||sims_saves::review(&path,profile,vault,snapshot_id,operation_id,|progress|{let _=app.emit("games:save-progress",progress);})).await.map_err(|_|"save_read")?.map_err(String::from)
}

#[tauri::command]
pub async fn games_wow_addons(id: String) -> Result<wow_addons::Inventory, String> {
    tauri::async_runtime::spawn_blocking(move || wow_addons::scan(&id))
        .await.map_err(|_| "wow_addons_failed")?.map_err(String::from)
}

#[tauri::command]
pub async fn games_wow_addon_package(id: String, addon_id: u32) -> Result<wow_addon_package::Review, String> {
    wow_addon_package::review(id, addon_id).await.map_err(String::from)
}

#[tauri::command]
pub async fn games_wow_addon_workspace(id: String) -> Result<wow_addon_reviews::Workspace, String> {
    wow_addon_reviews::workspace(id).await.map_err(String::from)
}
#[tauri::command]
pub async fn games_wow_addon_review(app: tauri::AppHandle, profile: String, id: String, request: wow_addon_reviews::Request, operation_id: String) -> Result<wow_addon_reviews::Review, String> {
    wow_addon_reviews::review(Some(app), profile, id, request, operation_id).await.map_err(String::from)
}
#[tauri::command]
pub async fn games_wow_addon_apply(app: tauri::AppHandle, profile: String, token: String, operation_id: String) -> Result<wow_addon_reviews::Workspace, String> {
    wow_addon_reviews::apply(Some(app), profile, token, operation_id).await.map_err(String::from)
}
#[tauri::command]
pub async fn games_wow_addon_discard(profile: String, token: String) -> Result<(), String> {
    wow_addon_reviews::discard(profile, token).await.map_err(String::from)
}
#[tauri::command]
pub fn games_wow_addon_cancel(profile: String, operation_id: String) {
    wow_addon_reviews::cancel(&profile, &operation_id)
}
#[tauri::command]
pub async fn games_wow_addon_recover(app: tauri::AppHandle, profile: String, id: String, operation_id: String) -> Result<wow_addon_reviews::Workspace, String> {
    wow_addon_reviews::recover(Some(app), profile, id, operation_id).await.map_err(String::from)
}

mod launcher_sessions;
#[tauri::command]
pub async fn games_launcher_sessions(app:tauri::AppHandle, profile:String) -> Result<launcher_sessions::Snapshot,String> {
    let root=account_root(&app)?.join("activity");
    tauri::async_runtime::spawn_blocking(move||launcher_sessions::snapshot(&root,&profile)).await.map_err(|_|"launcher_observation_failed")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_launch_launcher_game(app:tauri::AppHandle, profile:String, id: String) -> Result<bool, String> {
    // Re-read installation records at dispatch. The frontend supplies only the observed identity.
    let root=account_root(&app)?.join("activity");
    tauri::async_runtime::spawn_blocking(move || {
    let (plan,game) = launcher_scan::prepare_observed_launch(&id)?;
    launcher_sessions::launch(&root,&profile,&game,move||match plan {
        launcher_scan::LaunchPlan::Protocol(url) => tauri_plugin_opener::open_url(url, None::<&str>).map_err(|_| "launcher_launch_failed"),
        launcher_scan::LaunchPlan::Process { executable, args } => {
            let mut command = std::process::Command::new(&executable);
            command.args(args).current_dir(executable.parent().ok_or("launcher_client_missing")?);
            #[cfg(target_os = "windows")]
            { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
            command.spawn().map(|_| ()).map_err(|_| "launcher_launch_failed")
        }
    })
    }).await.map_err(|_| "launcher_scan_failed")?.map_err(String::from)
}

#[tauri::command]
pub async fn games_cloud_list(args:cloud_files::Request)->Result<cloud_files::CloudPage,String>{cloud_files::list(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_download(args:cloud_files::Request)->Result<cloud_files::CloudDownload,String>{cloud_files::resolve(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_resolve_link(args:cloud_files::LinkRequest)->Result<Vec<cloud_files::CloudDownload>,String>{cloud_files::resolve_link(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_host_check(args:cloud_files::LinkRequest)->Result<cloud_files::HostCheck,String>{cloud_files::host_check(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_ad_prepare(args:cloud_files::AdPrepare)->Result<cloud_files::AdLink,String>{cloud_files::ad_prepare(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_ad_status(args:cloud_files::AdRequest)->Result<cloud_files::AdStatus,String>{cloud_files::ad_status(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_web_create(args:cloud_files::LinkRequest)->Result<String,String>{cloud_files::web_create(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_web_list(args:cloud_files::Request)->Result<cloud_files::WebPage,String>{cloud_files::web_list(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_web_status(args:cloud_files::Request)->Result<cloud_files::WebJob,String>{cloud_files::web_status(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_web_download(args:cloud_files::Request)->Result<cloud_files::CloudDownload,String>{cloud_files::web_download(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_web_find(args:cloud_files::LinkRequest,page:u32)->Result<cloud_files::WebPage,String>{cloud_files::web_find(args,page).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_pm_create(args:cloud_files::LinkRequest)->Result<String,String>{cloud_files::pm_create(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_pm_list(args:cloud_files::Request)->Result<cloud_files::PmPage,String>{cloud_files::pm_list(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_pm_status(args:cloud_files::Request)->Result<cloud_files::PmJob,String>{cloud_files::pm_status(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_pm_download(args:cloud_files::Request)->Result<cloud_files::CloudDownload,String>{cloud_files::pm_download(args).await.map_err(String::from)}
#[tauri::command]
pub async fn games_cloud_pm_retry(args:cloud_files::Request)->Result<(),String>{cloud_files::pm_retry(args).await.map_err(String::from)}

#[tauri::command]
pub async fn games_modrinth(kind:String,query:String,loader:String,game:String,offset:u32,sort:String)->Result<serde_json::Value,String>{modrinth::json(&modrinth::client()?,modrinth::route(&kind,&query,&loader,&game,offset,&sort)?).await.map_err(String::from)}
#[tauri::command]
pub async fn games_mod_workspace(profile:String,path:String,loader:Option<String>,game:Option<String>)->Result<mod_files::Workspace,String>{mods::workspace(profile,path,loader,game).await.map_err(String::from)}
#[tauri::command]
pub async fn games_review_mods(profile:String,path:String,version:String,operation_id:String)->Result<mods::Plan,String>{mods::review(profile,path,version,operation_id).await.map_err(String::from)}
#[tauri::command]
pub async fn games_install_mods(app:tauri::AppHandle,profile:String,token:String,operation_id:String)->Result<mod_files::Workspace,String>{use tauri::Emitter;mods::install(profile,token,operation_id,|progress|{let _=app.emit("games:mod-progress",progress);}).await.map_err(String::from)}
#[tauri::command]
pub async fn games_mod_action(profile:String,path:String,project:String,action:String,revision:Option<String>)->Result<mod_files::Workspace,String>{mods::action(profile,path,project,action,revision).await.map_err(String::from)}
#[tauri::command]
pub fn games_cancel_mods(profile:String,operation_id:String){mods::cancel(&profile,&operation_id);}
#[tauri::command]
pub fn games_discard_mods(profile:String,token:String){mods::discard(&profile,&token);}

#[tauri::command]
pub async fn games_list_torrents(app:tauri::AppHandle,profile:String)->Result<Vec<p2p::TorrentRecord>,String>{p2p::manager(&app)?.list(&profile).map_err(String::from)}
#[tauri::command]
pub async fn games_inspect_torrent(app:tauri::AppHandle,profile:String,source:String,operation_id:String)->Result<p2p::TorrentPlan,String>{p2p::manager(&app)?.inspect(profile,source,operation_id).await.map_err(String::from)}
#[tauri::command]
pub fn games_cancel_torrent_inspection(app:tauri::AppHandle,profile:String,operation_id:String){if let Ok(manager)=p2p::manager(&app){manager.cancel_inspection(&profile,&operation_id);}}
#[tauri::command]
pub fn games_discard_torrent(app:tauri::AppHandle,profile:String,token:String){if let Ok(manager)=p2p::manager(&app){manager.discard(&profile,&token);}}
#[tauri::command]
pub async fn games_start_torrent(app:tauri::AppHandle,args:p2p::StartTorrent,preparation:Option<preparation_intake::Draft>)->Result<p2p::TorrentRecord,String>{
    let policies=if preparation.is_some(){
        let intake_app=app.clone();
        Some(tauri::async_runtime::spawn_blocking(move||preparation_runtime::manager(&intake_app)).await.map_err(|_|"archive_store")??)
    }else{None};
    let manager=p2p::manager(&app)?;
    let result=if preparation.is_some(){manager.start_prepared(args,preparation).await}else{manager.start(args).await};
    // Wake even when scheduler startup fails after durable acceptance. The
    // recorded intake still belongs to the accepted download and can recover.
    if let Some(policies)=policies{policies.notify();}
    result.map_err(String::from)
}
#[tauri::command]
pub async fn games_torrent_action(app:tauri::AppHandle,profile:String,id:String,action:String)->Result<(),String>{p2p::manager(&app)?.action(profile,id,action).await.map_err(String::from)}
#[tauri::command]
pub async fn games_seed_torrent(app:tauri::AppHandle,profile:String,id:String,policy:p2p::seeding::SeedPolicy)->Result<(),String>{p2p::manager(&app)?.seed(profile,id,policy).await.map_err(String::from)}

#[tauri::command]
pub async fn games_inspect_archive(app:tauri::AppHandle,profile:String,source:String,operation_id:String,password:Option<String>)->Result<archives::ArchivePlan,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||archives::inspect(profile,source,operation_id,password,|progress|{let _=app.emit("games:archive-progress",progress);})).await.map_err(|_|"archive_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_archive_space(profile:String,token:String,parent:String)->Result<archives::ArchiveSpace,String>{
    tauri::async_runtime::spawn_blocking(move||archives::space(profile,token,parent)).await.map_err(|_|"archive_destination")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_extract_archive(app:tauri::AppHandle,profile:String,token:String,parent:String,name:String,operation_id:String)->Result<archives::ArchiveReceipt,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||archives::extract(profile,token,parent,name,operation_id,|progress|{let _=app.emit("games:archive-progress",progress);})).await.map_err(|_|"archive_write")?.map_err(String::from)
}
#[tauri::command]
pub fn games_cancel_archive(profile:String,operation_id:String){archives::cancel(profile,operation_id);}
#[tauri::command]
pub fn games_discard_archive(profile:String,token:String){archives::discard(profile,token);}
#[tauri::command]
pub async fn games_archive_jobs(app:tauri::AppHandle,profile:String)->Result<Vec<archive_jobs::ArchiveJob>,String>{
    tauri::async_runtime::spawn_blocking(move||archive_jobs::manager(&app)?.list(&profile)).await.map_err(|_|"archive_store")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_start_archive(app:tauri::AppHandle,profile:String,token:String,parent:String,name:String,origin_source:Option<String>,game:Option<download_metadata::DownloadGame>)->Result<archive_jobs::ArchiveJob,String>{
    tauri::async_runtime::spawn_blocking(move||archive_jobs::manager(&app)?.start(profile,token,parent,name,origin_source,game)).await.map_err(|_|"archive_start")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_review_archive_cleanup(app:tauri::AppHandle,profile:String,id:String,operation_id:String)->Result<archive_cleanup::Review,String>{
    tauri::async_runtime::spawn_blocking(move||archive_cleanup::review(&app,&profile,&id,&operation_id)).await.map_err(|_|"archive_read")?.map_err(String::from)
}
#[tauri::command]
pub fn games_discard_archive_cleanup(profile:String,token:String){archive_cleanup_plans::discard(&profile,&token);}
#[tauri::command]
pub async fn games_recycle_archive_sources(app:tauri::AppHandle,profile:String,token:String,operation_id:String)->Result<archive_cleanup_store::Record,String>{
    tauri::async_runtime::spawn_blocking(move||archive_cleanup_store::run(&app,&profile,Some(&token),&operation_id,false)).await.map_err(|_|"archive_cleanup_recovery")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_archive_cleanup_records(app:tauri::AppHandle,profile:String)->Result<Vec<archive_cleanup_store::Record>,String>{
    tauri::async_runtime::spawn_blocking(move||archive_cleanup_store::list(archive_jobs::manager(&app)?.as_ref(),&profile)).await.map_err(|_|"archive_store")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_archive_cleanup_action(app:tauri::AppHandle,profile:String,id:String,action:String)->Result<archive_cleanup_store::Record,String>{
    if !matches!(action.as_str(),"resume"|"restore"|"dismiss"){return Err("archive_path".into());}
    tauri::async_runtime::spawn_blocking(move||if action=="dismiss" {archive_cleanup_store::dismiss(archive_jobs::manager(&app)?.as_ref(),&profile,&id)} else {archive_cleanup_store::run(&app,&profile,None,&id,action=="restore")}).await.map_err(|_|"archive_cleanup_recovery")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_prepare_archive(app:tauri::AppHandle,request:archive_jobs::PrepareArchive)->Result<archive_jobs::ArchiveJob,String>{
    tauri::async_runtime::spawn_blocking(move||archive_jobs::manager(&app)?.prepare(request)).await.map_err(|_|"archive_start")?.map_err(String::from)
}
#[tauri::command]
pub fn games_preparation_version() -> u8 { 1 }
#[tauri::command]
pub async fn games_preparation_choices(app:tauri::AppHandle,profile:String)->Result<Vec<download_preparation::Choice>,String>{
    tauri::async_runtime::spawn_blocking(move||preparation_runtime::choices(&app,&profile)).await.map_err(|_|"archive_store")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_preparation_candidates(app:tauri::AppHandle,target:download_preparation::Target)->Result<Vec<String>,String>{
    tauri::async_runtime::spawn_blocking(move||preparation_runtime::candidates(&app,&target)).await.map_err(|_|"archive_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_set_preparation(app:tauri::AppHandle,request:download_preparation::Configure)->Result<download_preparation::Choice,String>{
    tauri::async_runtime::spawn_blocking(move||preparation_runtime::configure(&app,request)).await.map_err(|_|"archive_store")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_disable_preparation(app:tauri::AppHandle,profile:String,id:String)->Result<(),String>{
    tauri::async_runtime::spawn_blocking(move||preparation_runtime::manager(&app)?.disable(&profile,&id)).await.map_err(|_|"archive_store")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_remove_archive_job(app:tauri::AppHandle,profile:String,id:String)->Result<(),String>{
    tauri::async_runtime::spawn_blocking(move||archive_jobs::manager(&app)?.remove(&profile,&id)).await.map_err(|_|"archive_store")?.map_err(String::from)
}

fn account_root(app:&tauri::AppHandle)->Result<std::path::PathBuf,String>{use tauri::Manager;Ok(app.path().app_data_dir().map_err(|_|"steam_account_store")?.join("game-accounts"))}
mod battlenet_account;
mod battlenet_account_policy;
mod battlenet_account_browser;
#[tauri::command]
pub async fn games_battlenet_account(app:tauri::AppHandle,profile:String)->Result<battlenet_account::Status,String>{let root=account_root(&app)?;tauri::async_runtime::spawn_blocking(move||battlenet_account::status(&root,&profile)).await.map_err(|_|"battlenet_account_store")?.map_err(String::from)}
#[tauri::command]
pub async fn games_battlenet_import(app:tauri::AppHandle,profile:String,request:String,fresh:bool)->Result<battlenet_account::Status,String>{let root=account_root(&app)?;battlenet_account_browser::import(app,root,profile,request,fresh).await.map_err(String::from)}
#[tauri::command]
pub fn games_battlenet_cancel(app:tauri::AppHandle,profile:String,request:String){if let Ok(root)=account_root(&app){battlenet_account_browser::cancel(&app,&root,&profile,&request);}}
#[tauri::command]
pub async fn games_battlenet_preferences(app:tauri::AppHandle,profile:String,installed:bool,uninstalled:bool)->Result<battlenet_account::Status,String>{let root=account_root(&app)?;tauri::async_runtime::spawn_blocking(move||battlenet_account::preferences(&root,&profile,installed,uninstalled)).await.map_err(|_|"battlenet_account_store")?.map_err(String::from)}
#[tauri::command]
pub async fn games_battlenet_disconnect(app:tauri::AppHandle,profile:String)->Result<battlenet_account::Status,String>{let root=account_root(&app)?;tauri::async_runtime::spawn_blocking(move||battlenet_account_browser::disconnect(&app,&root,&profile)).await.map_err(|_|"battlenet_account_store")?.map_err(String::from)}
#[tauri::command]
pub async fn games_read_local_achievements(profile: String, app_id: u32) -> Result<steam_achievements::Review, String> {
    tauri::async_runtime::spawn_blocking(move || steam_achievements::read(profile, app_id)).await.map_err(|_| "achievement_client_failed")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_apply_local_achievements(profile: String, token: String, changes: Vec<achievement_protocol::Change>) -> Result<achievement_protocol::Applied, String> {
    tauri::async_runtime::spawn_blocking(move || steam_achievements::apply(profile, token, changes)).await.map_err(|_| "achievement_apply_uncertain")?.map_err(String::from)
}
#[tauri::command]
pub fn games_discard_local_achievements(profile: String, token: String) { steam_achievements::discard(profile, token); }
#[tauri::command]
pub async fn games_steam_account_status(app:tauri::AppHandle,profile:String)->Result<steam_account::SteamAccountStatus,String>{let root=account_root(&app)?;tauri::async_runtime::spawn_blocking(move||steam_account::status(root,profile)).await.map_err(|_|"steam_account_store")?.map_err(String::from)}
#[tauri::command]
pub async fn games_connect_steam_account(app:tauri::AppHandle,profile:String,target:String,key:String,remember:bool)->Result<steam_account::SteamAccountStatus,String>{steam_account::connect(account_root(&app)?,profile,target,key,remember).await.map_err(String::from)}
#[tauri::command]
pub async fn games_refresh_steam_account(app:tauri::AppHandle,profile:String)->Result<steam_account::SteamAccountStatus,String>{steam_account::refresh(account_root(&app)?,profile).await.map_err(String::from)}
#[tauri::command]
pub async fn games_disconnect_steam_account(app:tauri::AppHandle,profile:String)->Result<(),String>{let root=account_root(&app)?;tauri::async_runtime::spawn_blocking(move||steam_account::disconnect(root,profile)).await.map_err(|_|"steam_account_store")?.map_err(String::from)}
#[tauri::command]
pub async fn games_steam_achievements(app:tauri::AppHandle,profile:String,app_id:u32)->Result<steam_account::SteamAchievements,String>{steam_account::achievements(account_root(&app)?,profile,app_id).await.map_err(String::from)}
#[tauri::command]
pub async fn games_install_steam(app:tauri::AppHandle,profile:String,app_id:u32)->Result<(),String>{
    let root=account_root(&app)?;let owned=tauri::async_runtime::spawn_blocking(move||steam_account::owns(root,profile,app_id)).await.map_err(|_|"steam_account_store")?.map_err(String::from)?;
    if !owned{return Err("steam_account_not_owned".into());}if steam_paths::find_root().is_none(){return Err("steam_account_no_client".into());}
    tauri_plugin_opener::open_url(format!("steam://install/{app_id}"),None::<&str>).map_err(|_|"steam_account_install".into())
}

#[tauri::command]
pub async fn games_allow_game_execution(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || native_package::allow_execution(path)).await.map_err(|_| "launch_failed".to_string())?.map_err(String::from)
}
#[tauri::command]
pub async fn games_validate_custom_launch(config:custom_launch::LaunchConfig)->Result<custom_launch::LaunchConfig,String>{
    tauri::async_runtime::spawn_blocking(move||custom_launch::validate(config)).await.map_err(|_|"launch_failed")?.map_err(String::from)
}
#[tauri::command]
pub fn games_custom_running(profile:String)->Vec<custom_launch::CustomProcess>{custom_launch::running(profile)}
#[tauri::command]
pub fn games_custom_history(profile:String)->Vec<custom_launch::CustomExit>{custom_launch::history(profile)}
#[tauri::command]
pub async fn games_validate_custom_artwork(path:String)->Result<String,String>{
    tauri::async_runtime::spawn_blocking(move||custom_launch::artwork(path)).await.map_err(|_|"launch_artwork")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_launch_custom(app:tauri::AppHandle,profile:String,id:String,config:custom_launch::LaunchConfig)->Result<custom_launch::CustomProcess,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||custom_launch::launch(profile,id,config,move|event|{let _=app.emit("games:custom-exit",event);})).await.map_err(|_|"launch_failed")?.map_err(String::from)
}

#[tauri::command]
pub async fn games_list_save_snapshots(vault:String,profile:String,game_id:String)->Result<Vec<saves::SaveSnapshotInfo>,String>{
    tauri::async_runtime::spawn_blocking(move||saves::list(vault,profile,game_id)).await.map_err(|_|"save_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_create_save_snapshot(app:tauri::AppHandle,args:saves::SaveRequest)->Result<saves::SaveSnapshotInfo,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||saves::snapshot(args,|progress|{let _=app.emit("games:save-progress",progress);})).await.map_err(|_|"save_write")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_prepare_save_restore(app:tauri::AppHandle,vault:String,profile:String,game_id:String,snapshot_id:String,target:String,operation_id:String)->Result<saves::SaveRestorePlan,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||saves::prepare_restore(vault,profile,game_id,snapshot_id,target,operation_id,|progress|{let _=app.emit("games:save-progress",progress);})).await.map_err(|_|"save_read")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_restore_save_snapshot(app:tauri::AppHandle,profile:String,token:String,operation_id:String)->Result<saves::SaveRestoreReceipt,String>{
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move||saves::restore(profile,token,operation_id,|progress|{let _=app.emit("games:save-progress",progress);})).await.map_err(|_|"save_write")?.map_err(String::from)
}
#[tauri::command]
pub fn games_cancel_save_operation(profile:String,operation_id:String){saves::cancel(profile,operation_id);}
#[tauri::command]
pub fn games_discard_save_restore(profile:String,token:String){saves::discard(profile,token);}

#[tauri::command]
pub async fn games_list_transfers(
    app: tauri::AppHandle,
    profile: String,
) -> Result<Vec<transfers::Transfer>, String> {
    tauri::async_runtime::spawn_blocking(move || transfers::manager(&app)?.list(&profile))
        .await
        .map_err(|_| "transfer_store")?
        .map_err(String::from)
}
#[tauri::command]
pub async fn games_transfer_settings(app: tauri::AppHandle, profile: String) -> Result<transfers::TransferSettings, String> {
    tauri::async_runtime::spawn_blocking(move || transfers::manager(&app)?.settings(&profile)).await.map_err(|_| "transfer_store")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_transfer_storage(app: tauri::AppHandle, profile: String) -> Result<Vec<transfer_storage::Forecast>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut items = transfers::manager(&app)?.storage_items(&profile)?;
        items.extend(p2p::manager(&app).map_err(|_| "transfer_store")?.storage_items(&profile).map_err(|_| "transfer_store")?);
        Ok::<_, &'static str>(transfer_storage::shared().forecast(&items))
    }).await.map_err(|_| "transfer_store")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_set_transfer_bandwidth(app: tauri::AppHandle, profile: String, bytes_per_second_limit: u64) -> Result<transfers::TransferSettings, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use tauri::Emitter;
        let settings = transfers::manager(&app)?.set_bandwidth(&profile, bytes_per_second_limit)?;
        let _ = app.emit("games:transfer-settings", &settings);
        Ok::<_, &'static str>(settings)
    }).await.map_err(|_| "transfer_store")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_add_transfer(
    app: tauri::AppHandle,
    args: transfers::NewTransfer,
    preparation: Option<preparation_intake::Draft>,
) -> Result<transfers::Transfer, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let policies = preparation.as_ref().map(|_| preparation_runtime::manager(&app)).transpose()?;
        let manager = transfers::manager(&app)?;
        let result = if preparation.is_some() { manager.add_prepared(args, preparation) } else { manager.add(args) };
        if let Some(policies) = policies { policies.notify(); }
        result
    })
        .await
        .map_err(|_| "transfer_store")?
        .map_err(String::from)
}
#[tauri::command]
pub async fn games_add_transfer_batch(
    app: tauri::AppHandle,
    args: transfers::NewBatch,
    preparation: Option<preparation_intake::Draft>,
) -> Result<Vec<transfers::Transfer>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let policies = preparation.as_ref().map(|_| preparation_runtime::manager(&app)).transpose()?;
        let manager = transfers::manager(&app)?;
        let result = if preparation.is_some() { manager.add_batch_prepared(args, preparation) } else { manager.add_batch(args) };
        if let Some(policies) = policies { policies.notify(); }
        result
    })
        .await
        .map_err(|_| "transfer_store")?
        .map_err(String::from)
}
#[tauri::command]
pub async fn games_relink_transfer(
    app: tauri::AppHandle,
    args: transfers::Relink,
) -> Result<transfers::Transfer, String> {
    tauri::async_runtime::spawn_blocking(move || transfers::manager(&app)?.relink(args))
        .await
        .map_err(|_| "transfer_store")?
        .map_err(String::from)
}
#[tauri::command]
pub async fn games_transfer_action(
    app: tauri::AppHandle,
    profile: String,
    id: String,
    action: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        transfers::manager(&app)?.action(&profile, &id, &action)
    })
    .await
    .map_err(|_| "transfer_store")?
    .map_err(String::from)
}

#[tauri::command]
pub async fn games_scan_roms(root: String, system: u32) -> Result<emulation::RomScan, String> {
    tauri::async_runtime::spawn_blocking(move || emulation::scan_roms(root, system))
        .await
        .map_err(|_| "emulation_scan_failed")?
        .map_err(String::from)
}
#[tauri::command]
pub async fn games_find_emulators() -> Result<Vec<emulation::Emulator>, String> {
    tauri::async_runtime::spawn_blocking(emulation::discover)
        .await
        .map_err(|_| "emulation_scan_failed".into())
}
#[tauri::command]
pub async fn games_validate_emulator(
    emulator: emulation::Emulator,
) -> Result<emulation::Emulator, String> {
    tauri::async_runtime::spawn_blocking(move || emulation::validate_emulator(emulator))
        .await
        .map_err(|_| "emulation_scan_failed")?
        .map_err(String::from)
}
#[tauri::command]
pub fn games_emulation_running() -> Vec<emulation::RunningGame> {
    emulation::running()
}
#[tauri::command]
pub async fn games_launch_emulated(
    app: tauri::AppHandle,
    emulator: emulation::Emulator,
    game_path: String,
    root: String,
    system: u32,
) -> Result<emulation::RunningGame, String> {
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move || {
        emulation::launch(emulator, game_path, root, system, move |result| {
            let _ = app.emit("games:emulator-exited", result);
        })
    })
    .await
    .map_err(|_| "emulation_launch_failed")?
    .map_err(String::from)
}

#[tauri::command]
pub async fn games_match_patch_sources(patch_path: String, paths: Vec<String>) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || patch_workspace::match_sources(patch_path,paths)).await.map_err(|_|"patch_failed")?.map_err(String::from)
}
#[tauri::command]
pub async fn games_prepare_patch(
    source_path: String,
    patch_path: String,
) -> Result<patch_workspace::PatchPlan, String> {
    tauri::async_runtime::spawn_blocking(move || {
        patch_workspace::prepare_patch(source_path, patch_path)
    })
    .await
    .map_err(|_| "patch_failed")?
    .map_err(String::from)
}
#[tauri::command]
pub async fn games_write_patch(
    token: String,
    output_path: String,
) -> Result<patch_workspace::PatchReceipt, String> {
    tauri::async_runtime::spawn_blocking(move || patch_workspace::write_patch(token, output_path))
        .await
        .map_err(|_| "patch_failed")?
        .map_err(String::from)
}
#[tauri::command]
pub async fn games_discard_patch(token: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || patch_workspace::discard_patch(token))
        .await
        .map_err(|_| "patch_failed")?
        .map_err(String::from)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamGame {
    app_id: u32,
    name: String,
    install_path: String,
    library_path: String,
    size_bytes: u64,
    last_played: u64,
    state: &'static str,
    update: &'static str,
    bytes_to_download: u64,
    bytes_downloaded: u64,
    artwork: SteamArtwork,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamArtwork {
    capsule: Option<String>,
    portrait: Option<String>,
    library_hero: Option<String>,
    logo: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamLibrary {
    path: String,
    available: bool,
    app_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamScan {
    steam_found: bool,
    libraries: Vec<SteamLibrary>,
    games: Vec<SteamGame>,
    warnings: Vec<&'static str>,
}

fn scan() -> steam_scan::Scan {
    steam_paths::find_root()
        .map(|root| steam_scan::scan(&root))
        .unwrap_or_default()
}

#[tauri::command]
pub async fn games_scan_steam() -> Result<SteamScan, String> {
    let result = tauri::async_runtime::spawn_blocking(scan)
        .await
        .map_err(|_| "scan_failed")?;
    Ok(SteamScan {
        steam_found: result.steam_root.is_some(),
        libraries: result
            .libraries
            .into_iter()
            .map(|library| SteamLibrary {
                path: library.path,
                available: library.available,
                app_count: library.app_count,
            })
            .collect(),
        games: result
            .apps
            .into_iter()
            .map(|game| SteamGame {
                app_id: game.app_id,
                name: game.name,
                install_path: game.install_path,
                library_path: game.library_path,
                size_bytes: game.size_bytes,
                last_played: game.last_played,
                state: game.state,
                update: game.update,
                bytes_to_download: game.bytes_to_download,
                bytes_downloaded: game.bytes_downloaded,
                artwork: SteamArtwork {
                    capsule: game.artwork.capsule,
                    portrait: game.artwork.portrait,
                    library_hero: game.artwork.library_hero,
                    logo: game.artwork.logo,
                },
            })
            .collect(),
        warnings: result.warnings,
    })
}

#[tauri::command]
pub async fn games_launch_steam(app_id: u32) -> Result<(), String> {
    // Reconcile immediately before launch, so moved/removed installs cannot use a stale UI record.
    // Only a numeric app ID crosses this boundary; no client-supplied executable or arguments.
    let installed = tauri::async_runtime::spawn_blocking(move || {
        scan()
            .apps
            .into_iter()
            .any(|game| game.app_id == app_id && game.state == "installed")
    })
    .await
    .map_err(|_| "scan_failed")?;
    if !installed {
        return Err("game_not_installed".into());
    }
    tauri_plugin_opener::open_url(format!("steam://rungameid/{app_id}"), None::<&str>)
        .map_err(|_| "steam_launch_failed".into())
}
