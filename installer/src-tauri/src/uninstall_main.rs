#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod install;
mod shell;

fn main() {
    shell::builder()
        .invoke_handler(tauri::generate_handler![
            install::default_install_dir,
            install::open_external,
            install::is_uninstall_mode,
            install::uninstall_facts,
            install::run_uninstall,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start Harbor Uninstall");
}
