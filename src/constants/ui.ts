import type { DiffStatus, WarningSeverity } from "../types";

// Status badge styles
export const STATUS_BADGE_STYLES: Record<DiffStatus, { bg: string; text: string; border: string }> =
  {
    identical: {
      bg: "bg-muted/60",
      text: "text-muted-foreground",
      border: "border-border",
    },
    modified: {
      bg: "bg-query-select/15",
      text: "text-query-select",
      border: "border-query-select/35",
    },
    added: {
      bg: "bg-status-success/15",
      text: "text-status-success",
      border: "border-status-success/35",
    },
    removed: {
      bg: "bg-status-error/15",
      text: "text-status-error",
      border: "border-status-error/35",
    },
  };

// Warning severity badge styles
export const SEVERITY_BADGE_STYLES: Record<
  WarningSeverity,
  { bg: string; text: string; icon: string }
> = {
  high: {
    bg: "bg-status-error/15",
    text: "text-status-error",
    icon: "⚠️",
  },
  medium: {
    bg: "bg-status-warning/15",
    text: "text-status-warning",
    icon: "⚠️",
  },
  low: {
    bg: "bg-query-select/15",
    text: "text-query-select",
    icon: "ℹ️",
  },
};

// Status display labels
export const STATUS_LABELS: Record<DiffStatus, string> = {
  identical: "Identical",
  modified: "Modified",
  added: "Added",
  removed: "Removed",
};

// Warning severity display labels
export const SEVERITY_LABELS: Record<WarningSeverity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

// macOS UI dimensions
export const MACOS_TITLEBAR_TOP_PADDING = 28; // Height for traffic light buttons
export const MACOS_TITLEBAR_LEFT_PADDING = 72; // Left padding for traffic lights
export const SIDEBAR_FOOTER_HEIGHT = 240; // Height reserved for sidebar footer
export const GIT_STATUS_POLL_INTERVAL = 10000; // 10 seconds
export const MESSAGE_AUTO_CLEAR_DELAY = 5000; // 5 seconds
