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
            // === File Menu Items ===
            let new_connection = MenuItemBuilder::new("New Connection")
                .id("new_connection")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;

            let save_query = MenuItemBuilder::new("Save Query")
                .id("save_query")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;

            let open_project = MenuItemBuilder::new("Open Project Directory...")
                .id("open_project")
                .accelerator("CmdOrCtrl+Shift+O")
                .build(app)?;

            // === View Menu Items ===
            let command_palette = MenuItemBuilder::new("Command Palette")
                .id("command_palette")
                .accelerator("CmdOrCtrl+K")
                .build(app)?;

            let toggle_sidebar = MenuItemBuilder::new("Toggle Sidebar")
                .id("toggle_sidebar")
                .accelerator("CmdOrCtrl+B")
                .build(app)?;

            let toggle_fullscreen = MenuItemBuilder::new("Toggle Full-screen Results")
                .id("toggle_fullscreen")
                .accelerator("CmdOrCtrl+Shift+F")
                .build(app)?;

            let settings = MenuItemBuilder::new("Settings...")
                .id("settings")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            // === Query Menu Items ===
            let run_query = MenuItemBuilder::new("Run Query")
                .id("run_query")
                .accelerator("CmdOrCtrl+Enter")
                .build(app)?;

            let connection_picker = MenuItemBuilder::new("Switch Connection")
                .id("connection_picker")
                .accelerator("CmdOrCtrl+Shift+C")
                .build(app)?;

            // === Window Menu Items ===
            let close_modal = MenuItemBuilder::new("Close Panel")
                .id("close_modal")
                .accelerator("CmdOrCtrl+W")
                .build(app)?;

            // === Build Submenus ===
            let file_submenu = SubmenuBuilder::new(app, "File")
                .item(&new_connection)
                .item(&save_query)
                .separator()
                .item(&open_project)
                .separator()
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            let view_submenu = SubmenuBuilder::new(app, "View")
                .item(&command_palette)
                .separator()
                .item(&toggle_sidebar)
                .item(&toggle_fullscreen)
                .separator()
                .item(&settings)
                .build()?;

            let query_submenu = SubmenuBuilder::new(app, "Query")
                .item(&run_query)
                .separator()
                .item(&connection_picker)
                .build()?;

            let window_submenu = SubmenuBuilder::new(app, "Window")
                .item(&close_modal)
                .separator()
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::hide(app, None)?)
                .build()?;

            // Build complete menu
            let menu = MenuBuilder::new(app)
                .item(&file_submenu)
                .item(&edit_submenu)
                .item(&view_submenu)
                .item(&query_submenu)
                .item(&window_submenu)
                .build()?;

            app.set_menu(menu)?;

            // Handle menu item clicks - emit events to frontend
            app.on_menu_event(move |app, event| {
                let event_name = match event.id().0.as_str() {
                    "open_project" => Some("reveal-project-directory"),
                    "new_connection" => Some("menu-new-connection"),
                    "save_query" => Some("menu-save-query"),
                    "command_palette" => Some("menu-command-palette"),
                    "toggle_sidebar" => Some("menu-toggle-sidebar"),
                    "toggle_fullscreen" => Some("menu-toggle-fullscreen"),
                    "settings" => Some("menu-settings"),
                    "run_query" => Some("menu-run-query"),
                    "connection_picker" => Some("menu-connection-picker"),
                    "close_modal" => Some("menu-close-modal"),
                    _ => None,
                };

                if let Some(name) = event_name {
                    let _ = app.emit(name, ());
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
            list_collections,
            create_collection,
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
            get_git_diff,
            git_init,
            git_commit,
            git_push,
            git_pull,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
