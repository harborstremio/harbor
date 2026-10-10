#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod install;
mod shell;
mod update;

fn main() {
    if let Some(code) = update::maybe_run() {
        std::process::exit(code);
    }
    shell::builder()
        .invoke_handler(tauri::generate_handler![
            install::default_install_dir,
            install::payload_size,
            install::run_install,
            install::run_repair,
            install::launch_harbor,
            install::run_uninstall,
            install::payload_entries,
            install::install_facts,
            install::open_external,
            install::fetch_changelog,
            install::free_space_at,
            install::existing_install,
            install::print_terms,
            install::save_license,
            install::harbor_version,
            install::is_uninstall_mode,
            install::uninstall_facts,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start Harbor Setup");
}
