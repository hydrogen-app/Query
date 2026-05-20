export interface GitStatusFile {
  path: string;
  /** Two-character porcelain code, e.g. " M", "M ", "??", "A ", " D". */
  status: string;
}

export interface GitStatus {
  is_repo: boolean;
  branch: string;
  staged: number;
  unstaged: number;
  untracked: number;
  files: string[];
  entries: GitStatusFile[];
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
}
