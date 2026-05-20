use crate::models::SavedQuery;
use crate::storage::saved_queries_fs;
use crate::utils::get_app_dir;

#[tauri::command]
pub async fn save_query(
    name: String,
    query: String,
    description: Option<String>,
) -> Result<SavedQuery, String> {
    let app_dir = get_app_dir()?;
    let now = chrono::Utc::now().to_rfc3339();
    // Tentative id — overwritten by upsert() if a matching file exists.
    let id = chrono::Utc::now().timestamp_micros();

    let saved = SavedQuery {
        id,
        name,
        query,
        description,
        is_pinned: false,
        created_at: now.clone(),
        updated_at: now,
    };

    saved_queries_fs::upsert(&app_dir, &saved)
}

#[tauri::command]
pub async fn get_saved_queries() -> Result<Vec<SavedQuery>, String> {
    let app_dir = get_app_dir()?;
    saved_queries_fs::remove_legacy_db(&app_dir);
    saved_queries_fs::read_all(&app_dir)
}

#[tauri::command]
pub async fn delete_saved_query(id: i64) -> Result<(), String> {
    let app_dir = get_app_dir()?;
    saved_queries_fs::delete(&app_dir, id)
}

#[tauri::command]
pub async fn toggle_pin_query(id: i64) -> Result<bool, String> {
    let app_dir = get_app_dir()?;
    saved_queries_fs::toggle_pin(&app_dir, id)
}

#[tauri::command]
pub async fn list_collections() -> Result<Vec<String>, String> {
    let app_dir = get_app_dir()?;
    saved_queries_fs::list_collections(&app_dir)
}

#[tauri::command]
pub async fn create_collection(name: String) -> Result<String, String> {
    let app_dir = get_app_dir()?;
    saved_queries_fs::create_collection(&app_dir, &name)
}
