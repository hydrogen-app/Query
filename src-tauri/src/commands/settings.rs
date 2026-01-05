use crate::models::ConnectionConfig;
use crate::storage::{
    delete_password_from_keychain, get_password_from_keychain, save_password_to_keychain,
};
use crate::utils::{
    get_auto_connect_enabled_internal, get_current_project_path_internal, get_last_connection_internal,
    load_project_settings_internal, set_auto_connect_enabled_internal, set_last_connection_internal,
    set_project_path_internal, get_recent_projects_internal, remove_recent_project_internal, RecentProject,
    get_vim_mode_enabled_internal, set_vim_mode_enabled_internal,
};

#[tauri::command]
pub fn get_app_dir() -> Result<std::path::PathBuf, String> {
    crate::utils::get_app_dir()
}

#[tauri::command]
pub fn set_project_path(path: String) -> Result<(), String> {
    set_project_path_internal(path)
}

#[tauri::command]
pub fn get_current_project_path() -> Result<Option<String>, String> {
    get_current_project_path_internal()
}

#[tauri::command]
pub fn load_project_settings() -> Result<(), String> {
    load_project_settings_internal()
}

#[tauri::command]
pub fn save_connections(connections: Vec<ConnectionConfig>) -> Result<(), String> {
    let app_dir = crate::utils::get_app_dir()?;
    crate::storage::save_connections(connections, app_dir)
}

#[tauri::command]
pub fn save_connection_password(name: String, password: String) -> Result<(), String> {
    save_password_to_keychain(&name, &password)
}

#[tauri::command]
pub fn get_connection_password(name: String) -> Result<Option<String>, String> {
    get_password_from_keychain(&name)
}

#[tauri::command]
pub fn delete_connection_password(name: String) -> Result<(), String> {
    delete_password_from_keychain(&name)
}

#[tauri::command]
pub fn load_connections() -> Result<Vec<ConnectionConfig>, String> {
    let app_dir = crate::utils::get_app_dir()?;
    crate::storage::load_connections(app_dir)
}

#[tauri::command]
pub fn set_last_connection(connection_name: String) -> Result<(), String> {
    set_last_connection_internal(connection_name)
}

#[tauri::command]
pub fn get_last_connection() -> Result<Option<String>, String> {
    get_last_connection_internal()
}

#[tauri::command]
pub fn set_auto_connect_enabled(enabled: bool) -> Result<(), String> {
    set_auto_connect_enabled_internal(enabled)
}

#[tauri::command]
pub fn get_auto_connect_enabled() -> Result<bool, String> {
    get_auto_connect_enabled_internal()
}

#[tauri::command]
pub fn get_recent_projects() -> Result<Vec<RecentProject>, String> {
    get_recent_projects_internal()
}

#[tauri::command]
pub fn remove_recent_project(path: String) -> Result<(), String> {
    remove_recent_project_internal(path)
}

#[tauri::command]
pub fn set_vim_mode_enabled(enabled: bool) -> Result<(), String> {
    set_vim_mode_enabled_internal(enabled)
}

#[tauri::command]
pub fn get_vim_mode_enabled() -> Result<bool, String> {
    get_vim_mode_enabled_internal()
}

/// Verify we have access to the current project directory
/// Returns true if accessible, false if not (e.g., sandbox permission lost)
#[tauri::command]
pub fn verify_project_access() -> Result<bool, String> {
    let app_dir = crate::utils::get_app_dir()?;

    // Try to read the directory to verify access
    match std::fs::read_dir(&app_dir) {
        Ok(_) => Ok(true),
        Err(e) => {
            // Permission denied or other access error
            eprintln!("Cannot access project directory {:?}: {}", app_dir, e);
            Ok(false)
        }
    }
}
