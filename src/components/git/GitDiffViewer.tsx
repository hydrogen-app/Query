import { memo, useEffect, useState } from "react";
import { PatchDiff } from "@pierre/diffs/react";
import { FileQuestion } from "lucide-react";
import { getGitDiff } from "../../utils/tauri";
import { QUERY_PIERRE_DIFF_THEME_OPTIONS } from "../../constants";

interface GitDiffViewerProps {
  filePath: string;
}

// Heuristics for "git can't meaningfully diff this" cases.
function classifyPatch(patch: string): "empty" | "binary" | "patch" {
  const trimmed = patch.trim();
  if (trimmed.length === 0) return "empty";
  // git emits a "Binary files ... differ" line and no hunks for binary blobs,
  // or "GIT binary patch" with --binary. Pierre's PatchDiff renders nothing
  // in either case, so we surface a friendlier message ourselves.
  if (/^Binary files .* differ$/m.test(patch) || /GIT binary patch/.test(patch)) {
    return "binary";
  }
  // A real patch always contains at least one hunk header.
  if (!/^@@ /m.test(patch)) return "empty";
  return "patch";
}

export const GitDiffViewer = memo(function GitDiffViewer({ filePath }: GitDiffViewerProps) {
  const [patch, setPatch] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPatch(null);

    getGitDiff(filePath)
      .then((result) => {
        if (cancelled) return;
        setPatch(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  if (loading) {
    return <div className="text-muted-foreground px-3 py-3 text-xs">Loading diff…</div>;
  }

  if (error) {
    return (
      <div className="border-destructive/40 bg-destructive/10 text-destructive rounded border px-3 py-2 text-xs">
        {error}
      </div>
    );
  }

  const kind = classifyPatch(patch ?? "");

  if (kind === "binary") {
    return (
      <div className="border-status-warning/30 bg-status-warning/10 flex items-start gap-2 rounded border px-3 py-2 text-xs">
        <FileQuestion className="text-status-warning mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="text-foreground font-medium">Binary file — diff not available</span>
          <span className="text-muted-foreground">
            Saved queries live inside <code className="font-mono">saved_queries.db</code> (SQLite),
            so git can only see the database as one binary blob. To get per-query diffs we'd need to
            store queries as <code className="font-mono">.sql</code> files on disk.
          </span>
        </div>
      </div>
    );
  }

  if (kind === "empty") {
    return <div className="text-muted-foreground px-3 py-2 text-xs">No textual changes.</div>;
  }

  return (
    <div className="bg-background overflow-hidden rounded border text-xs">
      <PatchDiff
        patch={patch!}
        options={{
          ...QUERY_PIERRE_DIFF_THEME_OPTIONS,
          diffStyle: "unified",
          diffIndicators: "bars",
        }}
      />
    </div>
  );
});
