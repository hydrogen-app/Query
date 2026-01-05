// Module declarations
mod commands;
mod constants;
mod models;
mod storage;
mod utils;

// Re-export commands for Tauri
use commands::*;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    Emitter,
};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Create "Open Project Directory..." menu item
            let open_project = MenuItemBuilder::new("Open Project Directory...")
                .id("open_project")
                .accelerator("CmdOrCtrl+Shift+O")
                .build(app)?;

            // Create File submenu
            let file_submenu = SubmenuBuilder::new(app, "File")
                .item(&open_project)
                .separator()
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            // Create Edit submenu with standard shortcuts (required for clipboard on macOS)
            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            // Build complete menu
            let menu = MenuBuilder::new(app)
                .item(&file_submenu)
                .item(&edit_submenu)
                .build()?;

            app.set_menu(menu)?;

            // Handle menu item clicks
            app.on_menu_event(move |app, event| {
                if event.id() == "open_project" {
                    // Emit event to frontend to reveal project directory
                    let _ = app.emit("reveal-project-directory", ());
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            // Connection commands
            test_postgres_connection,
            execute_query,
            get_database_schema,
            get_database_schemas,
            get_enhanced_database_schema,
            // Comparison commands
            compare_schemas,
            generate_migration_sql,
            // History commands
            save_query_to_history,
            get_query_history,
            clear_query_history,
            // Saved queries commands
            save_query,
            get_saved_queries,
            delete_saved_query,
            toggle_pin_query,
            // Settings commands
            set_project_path,
            get_current_project_path,
            load_project_settings,
            get_app_dir,
            set_last_connection,
            get_last_connection,
            set_auto_connect_enabled,
            get_auto_connect_enabled,
            set_vim_mode_enabled,
            get_vim_mode_enabled,
            get_recent_projects,
            remove_recent_project,
            verify_project_access,
            // Connection storage commands
            save_connections,
            load_connections,
            save_connection_password,
            get_connection_password,
            delete_connection_password,
            // Git commands
            check_git_repo,
            get_git_status,
            get_git_log,
            git_init,
            git_commit,
            git_push,
            git_pull,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
