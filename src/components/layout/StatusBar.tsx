import { memo, useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Circle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBarProps {
  status: string;
  onClear: () => void;
  connected: boolean;
  connectionName: string;
}

type Level = "success" | "error" | "info";

// Infer the severity of a status string from its prose. We tag explicit
// failure/success words; everything else is "info".
function levelFor(status: string): Level {
  const lower = status.toLowerCase();
  if (/^(failed|error|fail to|unable to|cannot)/.test(lower) || lower.includes("failed")) {
    return "error";
  }
  if (
    lower.includes("saved") ||
    lower.includes("success") ||
    lower.startsWith("connected") ||
    lower.startsWith("loaded") ||
    lower.startsWith("created") ||
    lower.startsWith("pushed") ||
    lower.startsWith("pulled") ||
    lower.startsWith("switched") ||
    lower.startsWith("history cleared")
  ) {
    return "success";
  }
  return "info";
}

const AUTO_CLEAR_MS = 6000;

export const StatusBar = memo(function StatusBar({
  status,
  onClear,
  connected,
  connectionName,
}: StatusBarProps) {
  // Track which status string the active timer was started for, so a fast
  // succession of status updates doesn't clear a fresh message early.
  const lastStatusRef = useRef<string>("");

  useEffect(() => {
    if (!status) return;
    lastStatusRef.current = status;
    const timer = setTimeout(() => {
      if (lastStatusRef.current === status) onClear();
    }, AUTO_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [status, onClear]);

  if (!status) {
    return (
      <div className="flex h-7 items-center gap-2 border-t border-border/50 bg-muted/20 px-4 text-[11px] text-muted-foreground">
        <Circle
          className={cn(
            "h-2 w-2 shrink-0",
            connected ? "fill-status-success text-status-success" : "fill-muted-foreground/50 text-muted-foreground/50"
          )}
        />
        <span className="truncate">
          {connected
            ? `Connected to ${connectionName}`
            : "Not connected"}
        </span>
      </div>
    );
  }

  const level = levelFor(status);
  const Icon = level === "error" ? AlertCircle : level === "success" ? CheckCircle2 : Info;
  const toneClass =
    level === "error"
      ? "text-rose-400"
      : level === "success"
      ? "text-emerald-400"
      : "text-blue-400";

  return (
    <div className="group flex h-7 items-center gap-2 border-t border-border/50 bg-muted/20 px-4 text-[11px]">
      <Icon className={cn("h-3 w-3 shrink-0", toneClass)} />
      <span className="truncate text-foreground/90">{status}</span>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
        title="Dismiss"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
});
