//! Filesystem-backed storage for saved queries.
//!
//! Each saved query lives in `{project_path}/queries/{collection}/{slug}.sql`.
//! The file is a real, executable `.sql` script — metadata (id, pin state,
//! the request-workspace JSON blob) is stored in header comments that any
//! SQL client will ignore:
//!
//! ```sql
//! -- @id: 1734123456789012
//! -- @name: Active users
//! -- @pinned: false
//! -- @created: 2025-05-18T12:34:56Z
//! -- @updated: 2025-05-18T12:34:56Z
//! -- @meta: {"kind":"query-request",...}
//!
//! SELECT * FROM users WHERE active = true;
//! ```
//!
//! This makes saved queries clean to diff, merge, and review in any git tool.

use crate::models::SavedQuery;
use std::fs;
use std::path::{Path, PathBuf};

const QUERIES_DIR: &str = "queries";
const DEFAULT_COLLECTION: &str = "general";

/// Slugify a name for use as a filesystem path segment.
fn slugify(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut last_dash = true;
    for c in input.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "query".to_string()
    } else {
        trimmed
    }
}

/// Extract the `collection` field from the request-workspace JSON blob the
/// frontend ships in `description`. Falls back to "general" for plain or
/// missing descriptions.
fn collection_from_description(description: Option<&str>) -> String {
    let raw = match description {
        Some(s) => s,
        None => return DEFAULT_COLLECTION.to_string(),
    };
    serde_json::from_str::<serde_json::Value>(raw)
        .ok()
        .and_then(|v| {
            v.get("collection")
                .and_then(|c| c.as_str())
                .map(|s| s.to_string())
        })
        .filter(|s| !s.is_empty())
        .map(|s| slugify(&s))
        .unwrap_or_else(|| DEFAULT_COLLECTION.to_string())
}

fn queries_root(app_dir: &Path) -> PathBuf {
    app_dir.join(QUERIES_DIR)
}

fn serialize(query: &SavedQuery) -> String {
    let mut out = String::new();
    out.push_str(&format!("-- @id: {}\n", query.id));
    out.push_str(&format!("-- @name: {}\n", query.name.replace('\n', " ")));
    out.push_str(&format!("-- @pinned: {}\n", query.is_pinned));
    out.push_str(&format!("-- @created: {}\n", query.created_at));
    out.push_str(&format!("-- @updated: {}\n", query.updated_at));
    if let Some(meta) = &query.description {
        // Collapse newlines so the header stays a single line per key.
        let escaped = meta.replace('\n', "\\n");
        out.push_str(&format!("-- @meta: {}\n", escaped));
    }
    out.push('\n');
    out.push_str(&query.query);
    if !query.query.ends_with('\n') {
        out.push('\n');
    }
    out
}

/// Parse a single `.sql` file. Returns None if the file isn't one of ours
/// (missing required headers).
fn parse(path: &Path) -> Option<SavedQuery> {
    let contents = fs::read_to_string(path).ok()?;
    let mut id: Option<i64> = None;
    let mut name: Option<String> = None;
    let mut pinned = false;
    let mut created: Option<String> = None;
    let mut updated: Option<String> = None;
    let mut meta: Option<String> = None;
    let mut body_start: usize = 0;

    for (idx, line) in contents.lines().enumerate() {
        if let Some(rest) = line.strip_prefix("-- @") {
            if let Some((key, value)) = rest.split_once(':') {
                let value = value.trim();
                match key.trim() {
                    "id" => id = value.parse().ok(),
                    "name" => name = Some(value.to_string()),
                    "pinned" => pinned = value == "true",
                    "created" => created = Some(value.to_string()),
                    "updated" => updated = Some(value.to_string()),
                    "meta" => meta = Some(value.replace("\\n", "\n")),
                    _ => {}
                }
            }
            continue;
        }
        // First non-header, non-blank line marks the start of the SQL body.
        if !line.trim().is_empty() {
            body_start = idx;
            break;
        }
        body_start = idx + 1;
    }

    let mut body_lines: Vec<&str> = contents.lines().collect();
    let body = if body_start >= body_lines.len() {
        String::new()
    } else {
        body_lines.drain(0..body_start);
        body_lines.join("\n")
    };

    Some(SavedQuery {
        id: id?,
        name: name?,
        query: body.trim_end().to_string(),
        description: meta,
        is_pinned: pinned,
        created_at: created.unwrap_or_default(),
        updated_at: updated.unwrap_or_default(),
    })
}

/// Walk every collection directory and read all saved queries.
pub fn read_all(app_dir: &Path) -> Result<Vec<SavedQuery>, String> {
    let root = queries_root(app_dir);
    if !root.exists() {
        return Ok(vec![]);
    }

    let mut results = Vec::new();
    let collections = fs::read_dir(&root).map_err(|e| format!("Failed to read queries dir: {}", e))?;
    for entry in collections.flatten() {
        let collection_path = entry.path();
        if !collection_path.is_dir() {
            continue;
        }
        let files = match fs::read_dir(&collection_path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        for file_entry in files.flatten() {
            let file_path = file_entry.path();
            if file_path.extension().and_then(|s| s.to_str()) != Some("sql") {
                continue;
            }
            if let Some(query) = parse(&file_path) {
                results.push(query);
            }
        }
    }

    // Pinned first, then alphabetical by name (matches the previous DB order).
    results.sort_by(|a, b| match (a.is_pinned, b.is_pinned) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(results)
}

/// Find the file backing a given id by scanning the tree. Returns None if
/// the id isn't present.
pub fn find_path_by_id(app_dir: &Path, id: i64) -> Option<PathBuf> {
    let root = queries_root(app_dir);
    let collections = fs::read_dir(&root).ok()?;
    for entry in collections.flatten() {
        let collection_path = entry.path();
        if !collection_path.is_dir() {
            continue;
        }
        let files = match fs::read_dir(&collection_path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        for file_entry in files.flatten() {
            let file_path = file_entry.path();
            if file_path.extension().and_then(|s| s.to_str()) != Some("sql") {
                continue;
            }
            if let Some(parsed) = parse(&file_path) {
                if parsed.id == id {
                    return Some(file_path);
                }
            }
        }
    }
    None
}

/// Upsert behavior: if a file already exists at the canonical path for
/// `(collection, name)`, preserve its id + created_at and overwrite the
/// rest. Otherwise create a fresh file with the provided id.
pub fn upsert(app_dir: &Path, query: &SavedQuery) -> Result<SavedQuery, String> {
    let collection = collection_from_description(query.description.as_deref());
    let collection_dir = queries_root(app_dir).join(&collection);
    fs::create_dir_all(&collection_dir)
        .map_err(|e| format!("Failed to create queries directory: {}", e))?;

    let slug = slugify(&query.name);
    let canonical = collection_dir.join(format!("{}.sql", slug));

    // If an id was provided that exists elsewhere (e.g. user renamed an
    // existing saved query), prefer that file so renames don't fork into
    // a duplicate. Otherwise fall through to canonical path lookup.
    let existing_path = find_path_by_id(app_dir, query.id).filter(|p| p.exists());

    let mut result = query.clone();
    if let Some(path) = existing_path {
        // Rename case: remove the stale file, rewrite at canonical.
        if path != canonical {
            let _ = fs::remove_file(&path);
        }
        fs::write(&canonical, serialize(&result))
            .map_err(|e| format!("Failed to write query file: {}", e))?;
        return Ok(result);
    }

    if canonical.exists() {
        if let Some(existing) = parse(&canonical) {
            // Preserve the original id + creation time so git diffs show
            // content changes, not header churn.
            result.id = existing.id;
            result.created_at = existing.created_at;
        }
    }

    fs::write(&canonical, serialize(&result))
        .map_err(|e| format!("Failed to write query file: {}", e))?;
    Ok(result)
}

/// List every collection that has a directory under `queries/`, including
/// empty ones. Used by the sidebar so newly-created empty collections show
/// up even before any queries land in them.
pub fn list_collections(app_dir: &Path) -> Result<Vec<String>, String> {
    let root = queries_root(app_dir);
    if !root.exists() {
        return Ok(vec![]);
    }
    let mut collections = Vec::new();
    let entries = fs::read_dir(&root)
        .map_err(|e| format!("Failed to read queries dir: {}", e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                collections.push(name.to_string());
            }
        }
    }
    collections.sort();
    Ok(collections)
}

/// Create an empty collection directory. Idempotent — `create_dir_all`
/// won't error if the directory already exists.
pub fn create_collection(app_dir: &Path, name: &str) -> Result<String, String> {
    let slug = slugify(name);
    if slug.is_empty() {
        return Err("Collection name cannot be empty".to_string());
    }
    let dir = queries_root(app_dir).join(&slug);
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create collection: {}", e))?;
    Ok(slug)
}

pub fn delete(app_dir: &Path, id: i64) -> Result<(), String> {
    if let Some(path) = find_path_by_id(app_dir, id) {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete query file: {}", e))?;
    }
    Ok(())
}

pub fn toggle_pin(app_dir: &Path, id: i64) -> Result<bool, String> {
    let path = find_path_by_id(app_dir, id)
        .ok_or_else(|| format!("Saved query {} not found", id))?;
    let mut query = parse(&path).ok_or_else(|| "Failed to parse query file".to_string())?;
    query.is_pinned = !query.is_pinned;
    query.updated_at = chrono::Utc::now().to_rfc3339();
    fs::write(&path, serialize(&query))
        .map_err(|e| format!("Failed to update pin: {}", e))?;
    Ok(query.is_pinned)
}

/// One-time hygiene: remove the old SQLite saved-queries database if it's
/// still lying around from before the migration. Idempotent — safe to call
/// on every startup.
pub fn remove_legacy_db(app_dir: &Path) {
    let legacy = app_dir.join("saved_queries.db");
    if legacy.exists() {
        let _ = fs::remove_file(legacy);
    }
}
