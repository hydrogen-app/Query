use crate::constants::{APP_DIR_NAME, SETTINGS_FILENAME};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[cfg(target_os = "macos")]
use objc2_foundation::{
    NSData, NSError, NSURLBookmarkCreationOptions, NSURLBookmarkResolutionOptions, NSURL,
};

// Global state for current project path
pub static PROJECT_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

const PROJECT_BOOKMARKS_KEY: &str = "project_bookmarks";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RecentProject {
    pub path: String,
    pub last_accessed: String, // ISO 8601 timestamp
    pub name: Option<String>,
}

pub fn get_app_dir() -> Result<PathBuf, String> {
    // Check if custom project path is set
    let project_path = PROJECT_PATH
        .lock()
        .map_err(|e| format!("Failed to acquire project path lock: {}", e))?;

    let app_dir = if let Some(path) = project_path.as_ref() {
        path.clone()
    } else {
        dirs::home_dir()
            .ok_or("Could not find home directory")?
            .join(APP_DIR_NAME)
    };

    fs::create_dir_all(&app_dir).map_err(|e| format!("Could not create app directory: {}", e))?;

    Ok(app_dir)
}

/// Validates that a path is safe to use as a project directory
/// Prevents path traversal attacks and ensures the path is absolute
fn validate_project_path(path: &str) -> Result<PathBuf, String> {
    let project_path = PathBuf::from(path);

    // Reject paths containing parent directory references
    if path.contains("..") {
        return Err("Invalid path: parent directory references (..) are not allowed".to_string());
    }

    // Canonicalize to resolve any symlinks and get absolute path
    // If the path doesn't exist yet, we need to handle it differently
    let canonical_path = if project_path.exists() {
        project_path
            .canonicalize()
            .map_err(|e| format!("Could not resolve path: {}", e))?
    } else {
        // For non-existent paths, ensure they're absolute and clean
        if !project_path.is_absolute() {
            return Err("Project path must be an absolute path".to_string());
        }

        // Verify parent directory exists
        if let Some(parent) = project_path.parent() {
            if !parent.exists() {
                return Err(format!(
                    "Parent directory does not exist: {}",
                    parent.display()
                ));
            }
            // Canonicalize parent and join with the last component
            let canonical_parent = parent
                .canonicalize()
                .map_err(|e| format!("Could not resolve parent path: {}", e))?;
            if let Some(file_name) = project_path.file_name() {
                canonical_parent.join(file_name)
            } else {
                canonical_parent
            }
        } else {
            return Err("Invalid path: no parent directory".to_string());
        }
    };

    // Additional safety check: ensure the resolved path doesn't contain ..
    if canonical_path.to_string_lossy().contains("..") {
        return Err("Invalid path: resolved path contains parent directory references".to_string());
    }

    Ok(canonical_path)
}

#[cfg(target_os = "macos")]
fn ns_error_message(error: &NSError) -> String {
    error.localizedDescription().to_string()
}

#[cfg(target_os = "macos")]
fn create_security_scoped_bookmark(path: &Path) -> Result<Vec<u8>, String> {
    let url = NSURL::from_directory_path(path)
        .ok_or_else(|| format!("Could not create file URL for {}", path.display()))?;

    // Keep access open for the process so subsequent std::fs calls can use the selected folder.
    let _ = unsafe { url.startAccessingSecurityScopedResource() };

    let bookmark = url
        .bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
            NSURLBookmarkCreationOptions::WithSecurityScope,
            None,
            None,
        )
        .map_err(|error| {
            format!(
                "Could not create project folder bookmark: {}",
                ns_error_message(&error)
            )
        })?;

    Ok(bookmark.to_vec())
}

#[cfg(target_os = "macos")]
fn resolve_security_scoped_bookmark(bookmark: &[u8]) -> Result<PathBuf, String> {
    let bookmark_data = NSData::with_bytes(bookmark);
    let url = unsafe {
        NSURL::URLByResolvingBookmarkData_options_relativeToURL_bookmarkDataIsStale_error(
            &bookmark_data,
            NSURLBookmarkResolutionOptions::WithSecurityScope,
            None,
            std::ptr::null_mut(),
        )
    }
    .map_err(|error| {
        format!(
            "Could not restore project folder access: {}",
            ns_error_message(&error)
        )
    })?;

    let _ = unsafe { url.startAccessingSecurityScopedResource() };
    let path = url
        .to_file_path()
        .ok_or_else(|| "Could not resolve bookmarked project folder path".to_string())?;

    Ok(path)
}

fn bookmark_for_project(settings: &serde_json::Value, path: &str) -> Option<Vec<u8>> {
    settings
        .get(PROJECT_BOOKMARKS_KEY)
        .and_then(|bookmarks| bookmarks.get(path))
        .and_then(|bookmark| serde_json::from_value(bookmark.clone()).ok())
}

fn activate_project_bookmark(
    settings: &serde_json::Value,
    path: &str,
) -> Result<Option<PathBuf>, String> {
    let Some(bookmark) = bookmark_for_project(settings, path) else {
        return Ok(None);
    };

    #[cfg(target_os = "macos")]
    {
        resolve_security_scoped_bookmark(&bookmark).map(Some)
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(None)
    }
}

fn store_project_bookmark(settings: &mut serde_json::Value, path: &Path) {
    #[cfg(target_os = "macos")]
    {
        match create_security_scoped_bookmark(path) {
            Ok(bookmark) => {
                let key = path.to_string_lossy().to_string();
                if !settings
                    .get(PROJECT_BOOKMARKS_KEY)
                    .map(|value| value.is_object())
                    .unwrap_or(false)
                {
                    settings[PROJECT_BOOKMARKS_KEY] = serde_json::json!({});
                }
                settings[PROJECT_BOOKMARKS_KEY][key.as_str()] = serde_json::json!(bookmark);
            }
            Err(error) => {
                eprintln!("Failed to persist project folder access: {}", error);
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (settings, path);
    }
}

pub fn set_project_path_internal(path: String) -> Result<(), String> {
    let settings_file = get_settings_file()?;
    let mut settings = load_settings_json(&settings_file)?;

    if let Err(error) = activate_project_bookmark(&settings, &path) {
        eprintln!("Failed to activate stored project folder access: {}", error);
    }

    // Validate the path before using it
    let project_path = validate_project_path(&path)?;
    let project_path_string = project_path.to_string_lossy().to_string();

    // Verify directory exists or can be created
    fs::create_dir_all(&project_path)
        .map_err(|e| format!("Could not create project directory: {}", e))?;

    // Set the global project path
    let mut current_path = PROJECT_PATH
        .lock()
        .map_err(|e| format!("Failed to acquire project path lock: {}", e))?;
    *current_path = Some(project_path.clone());

    // Load existing settings and update project_path
    settings["project_path"] = serde_json::json!(project_path_string);
    store_project_bookmark(&mut settings, &project_path);

    let json_str = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(settings_file, json_str).map_err(|e| format!("Could not write settings: {}", e))?;

    // Add to recent projects
    add_recent_project_internal(project_path.to_string_lossy().to_string())?;

    Ok(())
}

pub fn get_current_project_path_internal() -> Result<Option<String>, String> {
    let project_path = PROJECT_PATH
        .lock()
        .map_err(|e| format!("Failed to acquire project path lock: {}", e))?;
    Ok(project_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string()))
}

pub fn load_project_settings_internal() -> Result<(), String> {
    let default_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(APP_DIR_NAME);

    let settings_file = default_dir.join(SETTINGS_FILENAME);

    if settings_file.exists() {
        let data = fs::read_to_string(&settings_file)
            .map_err(|e| format!("Failed to read settings: {}", e))?;

        let settings: serde_json::Value =
            serde_json::from_str(&data).map_err(|e| format!("Failed to parse settings: {}", e))?;

        if let Some(path_str) = settings.get("project_path").and_then(|v| v.as_str()) {
            let project_path = match activate_project_bookmark(&settings, path_str) {
                Ok(Some(path)) => path,
                Ok(None) => PathBuf::from(path_str),
                Err(error) => {
                    eprintln!("Failed to restore project folder access: {}", error);
                    PathBuf::from(path_str)
                }
            };

            let mut current_path = PROJECT_PATH
                .lock()
                .map_err(|e| format!("Failed to acquire project path lock: {}", e))?;
            *current_path = Some(project_path);
        }
    }

    Ok(())
}

// Helper function to load settings JSON
fn load_settings_json(settings_file: &PathBuf) -> Result<serde_json::Value, String> {
    if settings_file.exists() {
        let data = fs::read_to_string(settings_file)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse settings: {}", e))
    } else {
        Ok(serde_json::json!({}))
    }
}

// Helper function to get settings file path
fn get_settings_file() -> Result<PathBuf, String> {
    let default_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(APP_DIR_NAME);
    fs::create_dir_all(&default_dir)
        .map_err(|e| format!("Could not create default directory: {}", e))?;
    Ok(default_dir.join(SETTINGS_FILENAME))
}

pub fn set_last_connection_internal(connection_name: String) -> Result<(), String> {
    let settings_file = get_settings_file()?;
    let mut settings = load_settings_json(&settings_file)?;
    settings["last_connection"] = serde_json::json!(connection_name);

    let json_str = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(settings_file, json_str).map_err(|e| format!("Could not write settings: {}", e))?;

    Ok(())
}

pub fn get_last_connection_internal() -> Result<Option<String>, String> {
    let settings_file = get_settings_file()?;
    let settings = load_settings_json(&settings_file)?;
    Ok(settings
        .get("last_connection")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string()))
}

pub fn set_auto_connect_enabled_internal(enabled: bool) -> Result<(), String> {
    let settings_file = get_settings_file()?;
    let mut settings = load_settings_json(&settings_file)?;
    settings["auto_connect_enabled"] = serde_json::json!(enabled);

    let json_str = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(settings_file, json_str).map_err(|e| format!("Could not write settings: {}", e))?;

    Ok(())
}

pub fn get_auto_connect_enabled_internal() -> Result<bool, String> {
    let settings_file = get_settings_file()?;
    let settings = load_settings_json(&settings_file)?;
    Ok(settings
        .get("auto_connect_enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(true))
}

pub fn set_vim_mode_enabled_internal(enabled: bool) -> Result<(), String> {
    let settings_file = get_settings_file()?;
    let mut settings = load_settings_json(&settings_file)?;
    settings["vim_mode_enabled"] = serde_json::json!(enabled);

    let json_str = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(settings_file, json_str).map_err(|e| format!("Could not write settings: {}", e))?;

    Ok(())
}

pub fn get_vim_mode_enabled_internal() -> Result<bool, String> {
    let settings_file = get_settings_file()?;
    let settings = load_settings_json(&settings_file)?;
    Ok(settings
        .get("vim_mode_enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false))
}

// Recent projects management

const MAX_RECENT_PROJECTS: usize = 10;

pub fn add_recent_project_internal(path: String) -> Result<(), String> {
    let settings_file = get_settings_file()?;
    let mut settings = load_settings_json(&settings_file)?;

    // Get or create recent_projects array
    let mut recent_projects: Vec<RecentProject> = settings
        .get("recent_projects")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(Vec::new);

    // Check if project already exists and remove it (we'll re-add it with updated timestamp)
    recent_projects.retain(|p| p.path != path);

    // Get folder name for display
    let path_buf = PathBuf::from(&path);
    let name = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string());

    // Add the project at the beginning with current timestamp
    let now: DateTime<Utc> = Utc::now();
    recent_projects.insert(
        0,
        RecentProject {
            path: path.clone(),
            last_accessed: now.to_rfc3339(),
            name,
        },
    );

    // Limit to MAX_RECENT_PROJECTS
    recent_projects.truncate(MAX_RECENT_PROJECTS);

    // Save back to settings
    settings["recent_projects"] = serde_json::to_value(&recent_projects)
        .map_err(|e| format!("Failed to serialize recent projects: {}", e))?;

    let json_str = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(settings_file, json_str).map_err(|e| format!("Could not write settings: {}", e))?;

    Ok(())
}

pub fn get_recent_projects_internal() -> Result<Vec<RecentProject>, String> {
    let settings_file = get_settings_file()?;
    let settings = load_settings_json(&settings_file)?;

    let mut recent_projects: Vec<RecentProject> = settings
        .get("recent_projects")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(Vec::new);

    // Filter out projects that no longer exist
    recent_projects.retain(|p| {
        if let Err(error) = activate_project_bookmark(&settings, &p.path) {
            eprintln!("Failed to restore recent project access: {}", error);
        }

        let path = PathBuf::from(&p.path);
        path.exists()
    });

    // Save the cleaned list if we removed any
    let original_len = settings
        .get("recent_projects")
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(0);

    if recent_projects.len() != original_len {
        let mut updated_settings = settings.clone();
        updated_settings["recent_projects"] = serde_json::to_value(&recent_projects)
            .map_err(|e| format!("Failed to serialize recent projects: {}", e))?;

        if let Ok(json_str) = serde_json::to_string_pretty(&updated_settings) {
            let _ = fs::write(settings_file, json_str);
        }
    }

    Ok(recent_projects)
}

pub fn remove_recent_project_internal(path: String) -> Result<(), String> {
    let settings_file = get_settings_file()?;
    let mut settings = load_settings_json(&settings_file)?;

    let mut recent_projects: Vec<RecentProject> = settings
        .get("recent_projects")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(Vec::new);

    // Remove the project
    recent_projects.retain(|p| p.path != path);
    if let Some(bookmarks) = settings
        .get_mut(PROJECT_BOOKMARKS_KEY)
        .and_then(|value| value.as_object_mut())
    {
        bookmarks.remove(&path);
    }

    // Save back to settings
    settings["recent_projects"] = serde_json::to_value(&recent_projects)
        .map_err(|e| format!("Failed to serialize recent projects: {}", e))?;

    let json_str = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(settings_file, json_str).map_err(|e| format!("Could not write settings: {}", e))?;

    Ok(())
}
