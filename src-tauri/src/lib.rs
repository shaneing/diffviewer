use serde::Serialize;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

const MAX_SCAN_FILES: usize = 5_000;
const MAX_CONFLICT_SCAN_BYTES: u64 = 1_000_000;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ChangedFile {
    path: String,
    old_path: Option<String>,
    status: FileStatus,
    git_status: String,
    has_conflict_markers: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum FileStatus {
    Modified,
    Added,
    Deleted,
    Renamed,
    Conflicted,
    Untracked,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectInspection {
    selected_path: String,
    repo_root: Option<String>,
    is_git_repo: bool,
    files: Vec<ChangedFile>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileDiff {
    path: String,
    status: FileStatus,
    baseline: String,
    working: String,
    conflicts: Vec<ConflictBlock>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConflictBlock {
    label: Option<String>,
    ours: String,
    theirs: String,
}

#[tauri::command]
async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    Ok(app
        .dialog()
        .file()
        .blocking_pick_folder()
        .map(|path| path.to_string()))
}

#[tauri::command]
fn inspect_project(folder: String) -> Result<ProjectInspection, String> {
    let selected = PathBuf::from(&folder);
    if !selected.is_dir() {
        return Err("Selected path is not a folder".into());
    }

    let repo_root = match git_output(&selected, ["rev-parse", "--show-toplevel"]) {
        Ok(root) => PathBuf::from(root.trim()),
        Err(error) => {
            return Ok(ProjectInspection {
                selected_path: folder,
                repo_root: None,
                is_git_repo: false,
                files: Vec::new(),
                error: Some(error),
            });
        }
    };

    let mut files = parse_git_status(&repo_root)?;
    merge_marker_scan(&repo_root, &mut files);

    let mut sorted: Vec<_> = files.into_values().collect();
    sorted.sort_by(|a, b| a.path.cmp(&b.path));

    Ok(ProjectInspection {
        selected_path: folder,
        repo_root: Some(repo_root.to_string_lossy().to_string()),
        is_git_repo: true,
        files: sorted,
        error: None,
    })
}

#[tauri::command]
fn read_file_diff(folder: String, path: String) -> Result<FileDiff, String> {
    let selected = PathBuf::from(folder);
    let repo_root = PathBuf::from(git_output(&selected, ["rev-parse", "--show-toplevel"])?.trim());
    let relative = normalize_relative_path(&path)?;
    let work_path = repo_root.join(&relative);
    if work_path.is_dir() {
        return Err("Selected path is a directory, not a file".into());
    }
    let status_entry = parse_git_status(&repo_root)?
        .remove(&relative)
        .unwrap_or_else(|| ChangedFile {
            path: relative.clone(),
            old_path: None,
            status: FileStatus::Modified,
            git_status: String::new(),
            has_conflict_markers: false,
        });

    let baseline = match status_entry.status {
        FileStatus::Added => String::new(),
        FileStatus::Conflicted => git_blob(&repo_root, &format!(":1:{relative}"))
            .or_else(|_| git_blob(&repo_root, &format!("HEAD:{relative}")))
            .unwrap_or_default(),
        _ => git_blob(&repo_root, &format!("HEAD:{relative}")).unwrap_or_default(),
    };

    let working = match status_entry.status {
        FileStatus::Deleted => String::new(),
        _ => fs::read_to_string(&work_path)
            .map_err(|error| format!("Failed to read working copy file (check folder permissions): {error}"))?,
    };

    let conflicts = parse_conflicts(&working);

    Ok(FileDiff {
        path: relative,
        status: if conflicts.is_empty() {
            status_entry.status
        } else {
            FileStatus::Conflicted
        },
        baseline,
        working,
        conflicts,
    })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            pick_folder,
            inspect_project,
            read_file_diff
        ])
        .run(tauri::generate_context!())
        .expect("error while running desktop diff viewer");
}

fn git_output<const N: usize>(repo: &Path, args: [&str; N]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .output()
        .map_err(|error| format!("Failed to run git: {error}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if message.is_empty() {
            "Git command failed".into()
        } else {
            message
        })
    }
}

fn git_blob(repo_root: &Path, spec: &str) -> Result<String, String> {
    git_output(repo_root, ["show", spec])
}

fn parse_git_status(repo_root: &Path) -> Result<BTreeMap<String, ChangedFile>, String> {
    let output = git_output(repo_root, ["status", "--porcelain=v1", "-z", "-uall"])?;
    let parts: Vec<&str> = output.split('\0').filter(|part| !part.is_empty()).collect();
    let mut files = BTreeMap::new();
    let mut index = 0;

    while index < parts.len() {
        let entry = parts[index];
        index += 1;

        if entry.len() < 4 {
            continue;
        }

        let status_code = entry[0..2].to_string();
        let path = entry[3..].to_string();
        let mut old_path = None;

        if matches!(status_code.chars().next(), Some('R' | 'C')) && index < parts.len() {
            old_path = Some(parts[index].to_string());
            index += 1;
        }

        let work_path = repo_root.join(&path);
        if work_path.is_dir() {
            continue;
        }

        let status = classify_status(&status_code);
        files.insert(
            path.clone(),
            ChangedFile {
                path,
                old_path,
                status,
                git_status: status_code,
                has_conflict_markers: false,
            },
        );
    }

    Ok(files)
}

fn classify_status(code: &str) -> FileStatus {
    let chars: Vec<char> = code.chars().collect();
    let x = chars.get(0).copied().unwrap_or(' ');
    let y = chars.get(1).copied().unwrap_or(' ');

    if x == 'U'
        || y == 'U'
        || matches!((x, y), ('A', 'A') | ('D', 'D') | ('A', 'U') | ('U', 'A') | ('D', 'U') | ('U', 'D'))
    {
        FileStatus::Conflicted
    } else if x == 'R' || y == 'R' {
        FileStatus::Renamed
    } else if x == 'D' || y == 'D' {
        FileStatus::Deleted
    } else if code == "??" {
        FileStatus::Untracked
    } else if x == 'A' || y == 'A' {
        FileStatus::Added
    } else {
        FileStatus::Modified
    }
}

fn merge_marker_scan(repo_root: &Path, files: &mut BTreeMap<String, ChangedFile>) {
    let mut seen = BTreeSet::new();
    let mut scanned = 0;
    scan_for_conflicts(repo_root, repo_root, files, &mut seen, &mut scanned);
}

fn scan_for_conflicts(
    repo_root: &Path,
    current: &Path,
    files: &mut BTreeMap<String, ChangedFile>,
    seen: &mut BTreeSet<PathBuf>,
    scanned: &mut usize,
) {
    if *scanned >= MAX_SCAN_FILES {
        return;
    }

    let entries = match fs::read_dir(current) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        if *scanned >= MAX_SCAN_FILES {
            break;
        }

        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();

        if should_skip_path(&name) {
            continue;
        }

        if path.is_dir() {
            scan_for_conflicts(repo_root, &path, files, seen, scanned);
            continue;
        }

        *scanned += 1;
        if !seen.insert(path.clone()) || !has_conflict_markers(&path) {
            continue;
        }

        if let Ok(relative) = path.strip_prefix(repo_root) {
            let relative = relative.to_string_lossy().replace('\\', "/");
            files
                .entry(relative.clone())
                .and_modify(|file| {
                    file.has_conflict_markers = true;
                    file.status = FileStatus::Conflicted;
                })
                .or_insert(ChangedFile {
                    path: relative,
                    old_path: None,
                    status: FileStatus::Conflicted,
                    git_status: "markers".into(),
                    has_conflict_markers: true,
                });
        }
    }
}

fn should_skip_path(name: &str) -> bool {
    matches!(
        name,
        ".git" | "node_modules" | "dist" | "target" | ".DS_Store" | ".idea" | ".vscode"
    )
}

fn has_conflict_markers(path: &Path) -> bool {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => return false,
    };

    if metadata.len() > MAX_CONFLICT_SCAN_BYTES {
        return false;
    }

    let Ok(contents) = fs::read_to_string(path) else {
        return false;
    };

    contents.contains("<<<<<<<") && contents.contains("=======") && contents.contains(">>>>>>>")
}

fn parse_conflicts(contents: &str) -> Vec<ConflictBlock> {
    let mut blocks = Vec::new();
    let mut lines = contents.lines();

    while let Some(line) = lines.next() {
        if !line.starts_with("<<<<<<<") {
            continue;
        }

        let label = line.trim_start_matches("<<<<<<<").trim();
        let mut ours = Vec::new();
        let mut theirs = Vec::new();
        let mut in_theirs = false;

        for conflict_line in lines.by_ref() {
            if conflict_line.starts_with("=======") {
                in_theirs = true;
                continue;
            }

            if conflict_line.starts_with(">>>>>>>") {
                break;
            }

            if in_theirs {
                theirs.push(conflict_line);
            } else {
                ours.push(conflict_line);
            }
        }

        blocks.push(ConflictBlock {
            label: if label.is_empty() {
                None
            } else {
                Some(label.to_string())
            },
            ours: ours.join("\n"),
            theirs: theirs.join("\n"),
        });
    }

    blocks
}

fn normalize_relative_path(path: &str) -> Result<String, String> {
    let relative = Path::new(path);
    if relative.is_absolute() || path.contains("..") {
        return Err("File path must be relative to the repository root".into());
    }

    Ok(path.replace('\\', "/"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        env,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn inspect_project_lists_modified_files() {
        let repo = TestRepo::new("modified");
        repo.write("sample.txt", "before\n");
        repo.git(["add", "."]);
        repo.git(["commit", "-m", "initial"]);
        repo.write("sample.txt", "before\nafter\n");

        let inspection = inspect_project(repo.path_string()).expect("inspection should succeed");

        assert!(inspection.is_git_repo);
        assert!(inspection.files.iter().any(|file| {
            file.path == "sample.txt" && file.status == FileStatus::Modified
        }));

        let diff = read_file_diff(repo.path_string(), "sample.txt".into()).expect("diff should load");
        assert_eq!(diff.baseline, "before\n");
        assert_eq!(diff.working, "before\nafter\n");
        assert!(diff.conflicts.is_empty());
    }

    #[test]
    fn inspect_project_detects_conflict_markers() {
        let repo = TestRepo::new("conflict");
        repo.write("conflict.txt", "clean\n");
        repo.git(["add", "."]);
        repo.git(["commit", "-m", "initial"]);
        repo.write(
            "conflict.txt",
            "<<<<<<< ours\nlocal\n=======\nremote\n>>>>>>> theirs\n",
        );

        let inspection = inspect_project(repo.path_string()).expect("inspection should succeed");
        let file = inspection
            .files
            .iter()
            .find(|file| file.path == "conflict.txt")
            .expect("conflict file should be listed");
        assert_eq!(file.status, FileStatus::Conflicted);
        assert!(file.has_conflict_markers);

        let diff = read_file_diff(repo.path_string(), "conflict.txt".into()).expect("diff should load");
        assert_eq!(diff.status, FileStatus::Conflicted);
        assert_eq!(diff.conflicts.len(), 1);
        assert_eq!(diff.conflicts[0].ours, "local");
        assert_eq!(diff.conflicts[0].theirs, "remote");
    }

    struct TestRepo {
        root: PathBuf,
    }

    impl TestRepo {
        fn new(label: &str) -> Self {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock should work")
                .as_nanos();
            let root = env::temp_dir().join(format!("codereviwer-{label}-{now}"));
            fs::create_dir_all(&root).expect("temp repo should be created");

            let repo = Self { root };
            repo.git(["init"]);
            repo.git(["config", "user.email", "test@example.com"]);
            repo.git(["config", "user.name", "Test User"]);
            repo
        }

        fn path_string(&self) -> String {
            self.root.to_string_lossy().to_string()
        }

        fn write(&self, relative: &str, contents: &str) {
            let path = self.root.join(relative);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).expect("parent directory should be created");
            }
            fs::write(path, contents).expect("file should be written");
        }

        fn git<const N: usize>(&self, args: [&str; N]) {
            let output = Command::new("git")
                .arg("-C")
                .arg(&self.root)
                .args(args)
                .output()
                .expect("git should run");
            assert!(
                output.status.success(),
                "git failed: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }
    }

    impl Drop for TestRepo {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }
}
