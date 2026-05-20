use serde::{Deserialize, Serialize};
use std::process::Command;
use crate::utils::get_app_dir;

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatusFile {
    pub path: String,
    /// Two-character porcelain code, e.g. " M", "M ", "??", "A ", " D".
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: String,
    pub staged: usize,
    pub unstaged: usize,
    pub untracked: usize,
    /// Backwards-compatible flat list of paths.
    pub files: Vec<String>,
    /// Same files but with their porcelain status codes attached so the UI
    /// can render badges (M / A / ?? / D / etc).
    pub entries: Vec<GitStatusFile>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommit {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: String,
}

#[tauri::command]
pub fn git_init() -> Result<String, String> {
    let project_path = get_app_dir().map_err(|e| e.to_string())?;

    let output = Command::new("git")
        .arg("init")
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to initialize git repository: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git init failed: {}", stderr));
    }

    Ok("Initialized git repository successfully".to_string())
}

#[tauri::command]
pub fn check_git_repo() -> Result<bool, String> {
    let project_path = get_app_dir().map_err(|e| e.to_string())?;

    let output = Command::new("git")
        .arg("rev-parse")
        .arg("--is-inside-work-tree")
        .current_dir(&project_path)
        .output();

    match output {
        Ok(result) => Ok(result.status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub fn get_git_status() -> Result<GitStatus, String> {
    let project_path = get_app_dir().map_err(|e| e.to_string())?;

    // Check if it's a git repo first
    let is_repo = check_git_repo()?;
    if !is_repo {
        return Ok(GitStatus {
            is_repo: false,
            branch: String::new(),
            staged: 0,
            unstaged: 0,
            untracked: 0,
            files: vec![],
            entries: vec![],
        });
    }

    // Get current branch
    let branch_output = Command::new("git")
        .arg("rev-parse")
        .arg("--abbrev-ref")
        .arg("HEAD")
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to get branch: {}", e))?;

    let branch = String::from_utf8_lossy(&branch_output.stdout)
        .trim()
        .to_string();

    // Get status with porcelain format
    let status_output = Command::new("git")
        .arg("status")
        .arg("--porcelain")
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let status_lines = String::from_utf8_lossy(&status_output.stdout);
    let mut staged = 0;
    let mut unstaged = 0;
    let mut untracked = 0;
    let mut files = Vec::new();
    let mut entries = Vec::new();

    for line in status_lines.lines() {
        if line.is_empty() || line.len() < 3 {
            continue;
        }

        let status_code = &line[0..2];
        let filename = line[3..].to_string();
        files.push(filename.clone());
        entries.push(GitStatusFile {
            path: filename,
            status: status_code.to_string(),
        });

        match status_code {
            "??" => untracked += 1,
            _ => {
                let mut chars = status_code.chars();
                if let Some(first_char) = chars.next() {
                    if first_char != ' ' {
                        staged += 1;
                    }
                }
                if let Some(second_char) = chars.next() {
                    if second_char != ' ' {
                        unstaged += 1;
                    }
                }
            }
        }
    }

    Ok(GitStatus {
        is_repo: true,
        branch,
        staged,
        unstaged,
        untracked,
        files,
        entries,
    })
}

#[tauri::command]
pub fn get_git_log(limit: u32) -> Result<Vec<GitCommit>, String> {
    let project_path = get_app_dir().map_err(|e| e.to_string())?;

    // Format: hash|message|author|timestamp
    let output = Command::new("git")
        .arg("log")
        .arg(format!("-n{}", limit))
        .arg("--pretty=format:%h|%s|%an|%ar")
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to get git log: {}", e))?;

    if !output.status.success() {
        return Err("Not a git repository or no commits yet".to_string());
    }

    let log_text = String::from_utf8_lossy(&output.stdout);
    let commits: Vec<GitCommit> = log_text
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() == 4 {
                Some(GitCommit {
                    hash: parts[0].to_string(),
                    message: parts[1].to_string(),
                    author: parts[2].to_string(),
                    timestamp: parts[3].to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(commits)
}

#[tauri::command]
pub fn git_commit(message: String) -> Result<String, String> {
    let project_path = get_app_dir().map_err(|e| e.to_string())?;

    // Stage all changes
    let add_output = Command::new("git")
        .arg("add")
        .arg("-A")
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to stage files: {}", e))?;

    if !add_output.status.success() {
        return Err(format!(
            "Failed to stage files: {}",
            String::from_utf8_lossy(&add_output.stderr)
        ));
    }

    // Commit with message
    let commit_output = Command::new("git")
        .arg("commit")
        .arg("-m")
        .arg(&message)
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to commit: {}", e))?;

    if !commit_output.status.success() {
        let stderr = String::from_utf8_lossy(&commit_output.stderr);
        if stderr.contains("nothing to commit") {
            return Err("Nothing to commit, working tree clean".to_string());
        }
        return Err(format!("Failed to commit: {}", stderr));
    }

    Ok("Changes committed successfully".to_string())
}

/// Returns the unified-diff patch for a single file in the project repo.
///
/// Tracked files use `git diff HEAD -- <path>`, which folds staged and
/// unstaged changes into one patch. Untracked files use
/// `git diff --no-index /dev/null <path>` so the renderer still receives a
/// real unified-diff header (it intentionally exits non-zero on a difference,
/// which is why we don't check `status.success()` for that branch).
#[tauri::command]
pub fn get_git_diff(file_path: String) -> Result<String, String> {
    let project_path = get_app_dir().map_err(|e| e.to_string())?;

    // Probe the porcelain status for this one path so we know whether it is
    // tracked or untracked.
    let status_output = Command::new("git")
        .arg("status")
        .arg("--porcelain")
        .arg("--")
        .arg(&file_path)
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to query status: {}", e))?;

    let status_line = String::from_utf8_lossy(&status_output.stdout);
    let is_untracked = status_line
        .lines()
        .next()
        .map(|line| line.starts_with("??"))
        .unwrap_or(false);

    if is_untracked {
        // --no-index treats both sides as plain files, so it works on
        // untracked content. It exits 1 when files differ, so we deliberately
        // do not gate on status.success().
        let output = Command::new("git")
            .arg("diff")
            .arg("--no-color")
            .arg("--no-index")
            .arg("--")
            .arg("/dev/null")
            .arg(&file_path)
            .current_dir(&project_path)
            .output()
            .map_err(|e| format!("Failed to diff untracked file: {}", e))?;
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    let output = Command::new("git")
        .arg("diff")
        .arg("--no-color")
        .arg("HEAD")
        .arg("--")
        .arg(&file_path)
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to diff file: {}", e))?;

    if !output.status.success() {
        // Likely an empty repo with no HEAD — fall back to working-tree
        // vs. index. Still no-color for cleaner downstream parsing.
        let fallback = Command::new("git")
            .arg("diff")
            .arg("--no-color")
            .arg("--")
            .arg(&file_path)
            .current_dir(&project_path)
            .output()
            .map_err(|e| format!("Failed to diff file (fallback): {}", e))?;
        return Ok(String::from_utf8_lossy(&fallback.stdout).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub fn git_push() -> Result<String, String> {
    let project_path = get_app_dir().map_err(|e| e.to_string())?;

    let output = Command::new("git")
        .arg("push")
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to push: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Push failed: {}", stderr));
    }

    Ok("Pushed to remote successfully".to_string())
}

#[tauri::command]
pub fn git_pull() -> Result<String, String> {
    let project_path = get_app_dir().map_err(|e| e.to_string())?;

    let output = Command::new("git")
        .arg("pull")
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to pull: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Pull failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.contains("Already up to date") {
        Ok("Already up to date".to_string())
    } else {
        Ok("Pulled from remote successfully".to_string())
    }
}
