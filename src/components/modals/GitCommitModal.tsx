import { useState, memo, useEffect, useMemo, lazy, Suspense } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  Database as DatabaseIcon,
  FileJson,
  FileCode,
  GitBranch,
} from "lucide-react";
import type { GitStatus, GitStatusFile } from "../../types";
import { gitCommit, getGitStatus } from "../../utils/tauri";
import { cn } from "@/lib/utils";

// Lazy-loaded so Shiki/highlighter weight stays out of the initial bundle.
const GitDiffViewer = lazy(() =>
  import("../git/GitDiffViewer").then((mod) => ({ default: mod.GitDiffViewer }))
);

interface GitCommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  gitStatus: GitStatus | null;
  onCommitSuccess: (newStatus: GitStatus, message: string) => void;
}

// Map porcelain code → short label + color. The two characters track staged
// (XY) vs unstaged (XY) state — we collapse them into one badge for display.
function statusLabel(code: string): { label: string; tone: string } {
  switch (code) {
    case "??":
      return { label: "Untracked", tone: "bg-blue-500/15 text-blue-400" };
    case "A ":
    case " A":
      return { label: "Added", tone: "bg-emerald-500/15 text-emerald-400" };
    case "M ":
    case " M":
    case "MM":
      return { label: "Modified", tone: "bg-amber-500/15 text-amber-400" };
    case "D ":
    case " D":
      return { label: "Deleted", tone: "bg-rose-500/15 text-rose-400" };
    case "R ":
    case " R":
      return { label: "Renamed", tone: "bg-violet-500/15 text-violet-400" };
    default:
      return { label: code.trim() || "—", tone: "bg-muted text-muted-foreground" };
  }
}

function fileIcon(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".sql")) return <FileCode className="h-3.5 w-3.5 text-emerald-400" />;
  if (lower.endsWith(".db") || lower.endsWith(".sqlite"))
    return <DatabaseIcon className="h-3.5 w-3.5 text-blue-400" />;
  if (lower.endsWith(".json")) return <FileJson className="h-3.5 w-3.5 text-amber-400" />;
  return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
}

function isBinaryByName(path: string): boolean {
  return /\.(db|sqlite|sqlite3|wal|shm)$/i.test(path);
}

export const GitCommitModal = memo(function GitCommitModal({
  isOpen,
  onClose,
  gitStatus,
  onCommitSuccess,
}: GitCommitModalProps) {
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCommitMessage("");
      setError(null);
      setExpandedFile(null);
    }
  }, [isOpen]);

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError("Commit message is required");
      return;
    }
    setCommitting(true);
    setError(null);
    try {
      const successMessage = await gitCommit(commitMessage);
      const newStatus = await getGitStatus();
      onCommitSuccess(newStatus, successMessage);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCommit();
    }
  };

  // Prefer the new `entries` field; fall back to plain `files` for older
  // responses (defensive — the type now guarantees `entries`).
  const entries = useMemo<GitStatusFile[]>(() => {
    if (!gitStatus) return [];
    if (gitStatus.entries?.length) return gitStatus.entries;
    return gitStatus.files.map((path) => ({ path, status: "" }));
  }, [gitStatus]);

  const hasBinaryEntries = useMemo(
    () => entries.some((entry) => isBinaryByName(entry.path)),
    [entries]
  );

  const totalChanges = entries.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[760px]">
        <DialogHeader className="border-b px-5 pb-4 pt-5">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <DialogTitle className="text-base">Commit Changes</DialogTitle>
            {gitStatus?.branch && (
              <Badge variant="outline" className="font-mono text-[10px]">
                {gitStatus.branch}
              </Badge>
            )}
          </div>
          <DialogDescription className="mt-1 text-xs">
            {totalChanges === 0
              ? "No changes to commit"
              : `${totalChanges} changed file${totalChanges !== 1 ? "s" : ""} in this project`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden px-5 py-4">
          {/* Commit Message */}
          <div className="space-y-2">
            <Label htmlFor="commit-message" className="text-xs uppercase tracking-wide text-muted-foreground">
              Commit Message
            </Label>
            <Input
              id="commit-message"
              placeholder="Update saved queries…"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">
              <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">⌘↵</kbd> to commit
            </p>
          </div>

          {/* Binary-file warning */}
          {hasBinaryEntries && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">
                  Some changes are inside SQLite databases
                </span>
                <span className="text-muted-foreground">
                  Saved queries and history live in <code className="font-mono">.db</code> files,
                  so git can't show row-level diffs. Migrate to <code className="font-mono">.sql</code>
                  {" "}files on disk to get real per-query history.
                </span>
              </div>
            </div>
          )}

          {/* File list */}
          {entries.length > 0 && (
            <div className="flex min-h-0 flex-1 flex-col gap-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Changed Files
              </Label>
              <ScrollArea className="flex-1 rounded-md border bg-card">
                <div className="divide-y">
                  {entries.map((entry) => {
                    const isExpanded = expandedFile === entry.path;
                    const badge = statusLabel(entry.status);
                    const binary = isBinaryByName(entry.path);
                    return (
                      <div key={entry.path}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedFile((current) =>
                              current === entry.path ? null : entry.path
                            )
                          }
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40",
                            isExpanded && "bg-muted/30"
                          )}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                          {fileIcon(entry.path)}
                          <span className="flex-1 truncate font-mono text-xs">
                            {entry.path}
                          </span>
                          {binary && (
                            <Badge
                              variant="outline"
                              className="h-5 border-amber-500/30 px-1.5 text-[10px] text-amber-400"
                            >
                              binary
                            </Badge>
                          )}
                          <Badge
                            className={cn("h-5 border-none px-1.5 text-[10px]", badge.tone)}
                          >
                            {badge.label}
                          </Badge>
                        </button>
                        {isExpanded && (
                          <div className="border-t bg-background/40 p-2">
                            <Suspense
                              fallback={
                                <div className="px-3 py-2 text-xs text-muted-foreground">
                                  Loading diff renderer…
                                </div>
                              }
                            >
                              <GitDiffViewer filePath={entry.path} />
                            </Suspense>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="border-t bg-muted/20 px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={committing}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCommit} disabled={committing || !commitMessage.trim()}>
            {committing ? "Committing…" : "Commit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
