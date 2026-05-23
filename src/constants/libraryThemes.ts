import type * as Monaco from "monaco-editor";

export const QUERY_LIBRARY_COLORS = {
  background: "#080808",
  card: "#0f0f0f",
  popover: "#141414",
  primary: "#f5f5f5",
  primaryHover: "#ffffff",
  foreground: "#f5f5f5",
  secondaryForeground: "#e5e5e5",
  muted: "#1a1a1a",
  mutedForeground: "#9e9e9e",
  accent: "#292929",
  border: "#383838",
  input: "#212121",
  success: "#74bd91",
  error: "#d96d72",
  warning: "#d1a64e",
  info: "#78a8d1",
} as const;

export const QUERY_MONACO_THEME_NAME = "query-dark";

export function defineQueryMonacoTheme(monaco: typeof Monaco) {
  const colors = QUERY_LIBRARY_COLORS;

  monaco.editor.defineTheme(QUERY_MONACO_THEME_NAME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword.sql", foreground: colors.primary.slice(1), fontStyle: "bold" },
      { token: "string.sql", foreground: colors.success.slice(1) },
      { token: "number", foreground: colors.warning.slice(1) },
      { token: "comment", foreground: colors.mutedForeground.slice(1), fontStyle: "italic" },
      { token: "operator.sql", foreground: colors.info.slice(1) },
    ],
    colors: {
      "editor.background": colors.card,
      "editor.foreground": colors.foreground,
      "editor.lineHighlightBackground": colors.background,
      "editor.selectionBackground": `${colors.primary}66`,
      "editor.inactiveSelectionBackground": `${colors.primary}33`,
      "editor.selectionHighlightBackground": `${colors.primary}2e`,
      "editorLineNumber.foreground": colors.mutedForeground,
      "editorLineNumber.activeForeground": colors.primaryHover,
      "editorCursor.foreground": colors.primaryHover,
      "editorWhitespace.foreground": colors.border,
      "editorIndentGuide.background": colors.border,
      "editorIndentGuide.activeBackground": colors.mutedForeground,
      "editorSuggestWidget.background": colors.popover,
      "editorSuggestWidget.border": colors.border,
      "editorSuggestWidget.foreground": colors.foreground,
      "editorSuggestWidget.selectedBackground": `${colors.primary}4d`,
      "editorWidget.background": colors.popover,
      "editorWidget.border": colors.border,
      "input.background": colors.input,
      "input.border": colors.border,
    },
  });
}

export const QUERY_PIERRE_DIFF_THEME_OPTIONS = {
  theme: "pierre-dark",
  themeType: "dark",
  unsafeCSS: `
    :host {
      color-scheme: dark;
      --diffs-dark-bg: ${QUERY_LIBRARY_COLORS.card};
      --diffs-dark: ${QUERY_LIBRARY_COLORS.foreground};
      --diffs-bg-buffer-override: ${QUERY_LIBRARY_COLORS.card};
      --diffs-bg-context-override: ${QUERY_LIBRARY_COLORS.background};
      --diffs-bg-context-gutter-override: ${QUERY_LIBRARY_COLORS.card};
      --diffs-bg-separator-override: ${QUERY_LIBRARY_COLORS.muted};
      --diffs-fg-number-override: ${QUERY_LIBRARY_COLORS.mutedForeground};
      --diffs-bg-hover-override: ${QUERY_LIBRARY_COLORS.foreground};
      --diffs-bg-selection-override: ${QUERY_LIBRARY_COLORS.primary};
      --diffs-added-dark: ${QUERY_LIBRARY_COLORS.success};
      --diffs-deleted-dark: ${QUERY_LIBRARY_COLORS.error};
      --diffs-modified-dark: ${QUERY_LIBRARY_COLORS.primaryHover};
      --diffs-bg-addition-override: rgb(116 189 145 / 0.12);
      --diffs-bg-addition-emphasis-override: rgb(116 189 145 / 0.22);
      --diffs-bg-deletion-override: rgb(217 109 114 / 0.12);
      --diffs-bg-deletion-emphasis-override: rgb(217 109 114 / 0.22);
      --diffs-fg-number-addition-override: ${QUERY_LIBRARY_COLORS.success};
      --diffs-fg-number-deletion-override: ${QUERY_LIBRARY_COLORS.error};
      --diffs-font-family: var(--font-family-editor), "JetBrains Mono", "SF Mono", Monaco, Consolas, monospace;
      --diffs-header-font-family: var(--font-family-interface), Inter UI, system-ui, sans-serif;
      --diffs-font-size: var(--editor-font-size, 13px);
    }

    [data-diffs-header="default"] {
      border-bottom: 1px solid ${QUERY_LIBRARY_COLORS.border};
    }

    [data-column-number] {
      background-color: ${QUERY_LIBRARY_COLORS.card};
    }
  `,
} as const;
