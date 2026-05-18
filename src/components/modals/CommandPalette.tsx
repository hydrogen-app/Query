import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../ui/command";
import {
  ArrowLeft,
  BookmarkIcon,
  Check,
  ClipboardPaste,
  Database,
  Hash,
  History as HistoryIcon,
  Pin,
  Search,
  Table as TableIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ColumnInfo,
  DatabaseSchema,
  QueryHistoryEntry,
  SavedQuery,
  TableInfo,
} from "../../types";
import { DEFAULTS, UI_LAYOUT } from "../../constants";
import { getRequestCollection, getRequestDescription } from "../../utils/queryRequest";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  schema: DatabaseSchema | null;
  history: QueryHistoryEntry[];
  savedQueries: SavedQuery[];
  onInsertQuery: (query: string) => void;
  onInsertSavedQuery?: (savedQuery: SavedQuery) => void;
}

type Action = "SELECT" | "COUNT" | "DESCRIBE" | "INSERT" | "UPDATE" | "DELETE";

const ACTIONS: { id: Action; label: string; description: string; needsColumns: boolean }[] = [
  { id: "SELECT", label: "SELECT", description: "Query rows from the table", needsColumns: true },
  { id: "COUNT", label: "COUNT", description: "Count rows in the table", needsColumns: false },
  { id: "DESCRIBE", label: "DESCRIBE", description: "Show column structure", needsColumns: false },
  { id: "INSERT", label: "INSERT", description: "Insert a new row", needsColumns: false },
  { id: "UPDATE", label: "UPDATE", description: "Update rows in the table", needsColumns: false },
  { id: "DELETE", label: "DELETE", description: "Delete rows from the table", needsColumns: false },
];

const ALL_COLUMNS = "*";

// shadcn CommandDialog applies these globals via descendant selectors; we
// re-apply them on a sibling Command since we no longer use CommandDialog.
const COMMAND_GLOBALS =
  "[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input-wrapper]]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5";

function buildQuery(table: string, action: Action, columns: string[]): string {
  switch (action) {
    case "SELECT": {
      const cols =
        columns.includes(ALL_COLUMNS) || columns.length === 0 ? "*" : columns.join(", ");
      return `SELECT ${cols} FROM ${table} LIMIT ${DEFAULTS.QUERY_LIMIT};`;
    }
    case "COUNT":
      return `SELECT COUNT(*) FROM ${table};`;
    case "DESCRIBE":
      return `SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = '${table}'
ORDER BY ordinal_position;`;
    case "INSERT":
      return `INSERT INTO ${table} (column1, column2) VALUES ('value1', 'value2');`;
    case "UPDATE":
      return `UPDATE ${table} SET column = 'value' WHERE condition;`;
    case "DELETE":
      return `DELETE FROM ${table} WHERE condition;`;
  }
}

export const CommandPalette = memo(function CommandPalette({
  isOpen,
  onClose,
  schema,
  history,
  savedQueries,
  onInsertQuery,
  onInsertSavedQuery,
}: CommandPaletteProps) {
  const [step, setStep] = useState<"root" | "action" | "columns">("root");
  const [table, setTable] = useState<TableInfo | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set([ALL_COLUMNS]));
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setStep("root");
      setTable(null);
      setAction(null);
      setSelectedColumns(new Set([ALL_COLUMNS]));
      setSearch("");
    }
  }, [isOpen]);

  useEffect(() => {
    setSearch("");
  }, [step]);

  const tableCommands = useMemo(() => schema?.tables ?? [], [schema]);

  const sortedSavedQueries = useMemo(
    () =>
      [...savedQueries].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [savedQueries]
  );

  const recentHistory = useMemo(
    () => history.slice(0, DEFAULTS.RECENT_HISTORY_LIMIT),
    [history]
  );

  const handleSelectTable = (info: TableInfo) => {
    setTable(info);
    setStep("action");
  };

  const handleSelectAction = (next: Action) => {
    setAction(next);
    const meta = ACTIONS.find((entry) => entry.id === next)!;
    if (meta.needsColumns && table) {
      setSelectedColumns(new Set([ALL_COLUMNS]));
      setStep("columns");
    } else if (table) {
      onInsertQuery(buildQuery(table.table_name, next, []));
      onClose();
    }
  };

  const toggleColumn = (column: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (column === ALL_COLUMNS) {
        return new Set([ALL_COLUMNS]);
      }
      next.delete(ALL_COLUMNS);
      if (next.has(column)) {
        next.delete(column);
      } else {
        next.add(column);
      }
      if (next.size === 0) next.add(ALL_COLUMNS);
      return next;
    });
  };

  const handleInsertColumns = () => {
    if (!table || !action) return;
    onInsertQuery(buildQuery(table.table_name, action, Array.from(selectedColumns)));
    onClose();
  };

  const handleBack = () => {
    if (step === "columns") {
      setStep("action");
    } else if (step === "action") {
      setStep("root");
      setTable(null);
    } else {
      onClose();
    }
  };

  const handleSelectSaved = (saved: SavedQuery) => {
    if (onInsertSavedQuery) {
      onInsertSavedQuery(saved);
    } else {
      onInsertQuery(saved.query);
    }
    onClose();
  };

  const handleSelectHistory = (entry: QueryHistoryEntry) => {
    onInsertQuery(entry.query);
    onClose();
  };

  const breadcrumbs = useMemo(() => {
    if (step === "root") return null;
    const segments: string[] = [];
    if (table) segments.push(table.table_name);
    if (action && step === "columns") segments.push(action);
    return segments.join(" › ");
  }, [step, table, action]);

  const placeholder =
    step === "root"
      ? "Search tables, saved queries, or history..."
      : step === "action"
      ? `Pick an action for ${table?.table_name ?? "the table"}...`
      : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="overflow-hidden p-0"
        onEscapeKeyDown={(event) => {
          // Intercept Escape so non-root steps walk back instead of closing.
          if (step !== "root") {
            event.preventDefault();
            handleBack();
          }
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>Pick a table, then an action</DialogDescription>
        </DialogHeader>

        {breadcrumbs && (
          <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent hover:text-accent-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
            <span className="font-mono">{breadcrumbs}</span>
          </div>
        )}

        {step === "columns" && table && action ? (
          <ColumnsStep
            table={table}
            action={action}
            selectedColumns={selectedColumns}
            onToggle={toggleColumn}
            onInsert={handleInsertColumns}
            onBack={handleBack}
          />
        ) : (
          <Command className={cn("flex h-full w-full flex-col overflow-hidden", COMMAND_GLOBALS)}>
            <CommandInput
              placeholder={placeholder}
              value={search}
              onValueChange={setSearch}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && search.length === 0 && step !== "root") {
                  e.preventDefault();
                  handleBack();
                }
              }}
            />
            <CommandList>
              <CommandEmpty>
                {tableCommands.length === 0 && step === "root" ? (
                  <div className="flex flex-col items-center gap-1 py-4">
                    <p className="text-sm">No tables available</p>
                    <p className="text-xs text-muted-foreground">Connect to a database first</p>
                  </div>
                ) : (
                  <p className="text-sm">No matches</p>
                )}
              </CommandEmpty>

              {step === "root" && (
                <>
                  {tableCommands.length > 0 && (
                    <CommandGroup heading="Tables">
                      {tableCommands.map((info) => (
                        <CommandItem
                          key={`table-${info.table_name}`}
                          value={`table ${info.table_name}`}
                          onSelect={() => handleSelectTable(info)}
                        >
                          <TableIcon className="h-4 w-4" />
                          <div className="flex flex-col">
                            <span className="font-medium">{info.table_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {info.columns.length} columns
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {sortedSavedQueries.length > 0 && (
                    <>
                      <CommandSeparator />
                      <CommandGroup heading="Saved Queries">
                        {sortedSavedQueries.map((saved) => {
                          const description =
                            getRequestDescription(saved) ||
                            saved.query.substring(0, 60) +
                              (saved.query.length > 60 ? "..." : "");
                          const collection = getRequestCollection(saved);
                          return (
                            <CommandItem
                              key={`saved-${saved.id}`}
                              value={`saved ${collection} ${saved.name} ${description}`}
                              onSelect={() => handleSelectSaved(saved)}
                            >
                              <BookmarkIcon className="h-4 w-4" />
                              {saved.is_pinned && <Pin className="h-3 w-3 text-yellow-500" />}
                              <div className="flex flex-col">
                                <span className="font-medium">{saved.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {collection} / {description}
                                </span>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </>
                  )}

                  {recentHistory.length > 0 && (
                    <>
                      <CommandSeparator />
                      <CommandGroup heading="Recent Queries">
                        {recentHistory.map((entry) => {
                          const label =
                            entry.query.substring(0, UI_LAYOUT.QUERY_PREVIEW_LENGTH) +
                            (entry.query.length > UI_LAYOUT.QUERY_PREVIEW_LENGTH ? "..." : "");
                          return (
                            <CommandItem
                              key={`history-${entry.id}`}
                              value={`history ${entry.query}`}
                              onSelect={() => handleSelectHistory(entry)}
                            >
                              <HistoryIcon className="h-4 w-4" />
                              <div className="flex flex-col">
                                <span className="font-mono text-xs">{label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {entry.row_count} rows in {entry.execution_time_ms}ms
                                </span>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </>
                  )}
                </>
              )}

              {step === "action" && (
                <CommandGroup heading="Actions">
                  {ACTIONS.map((entry) => (
                    <CommandItem
                      key={`action-${entry.id}`}
                      value={`action ${entry.id} ${entry.label} ${entry.description}`}
                      onSelect={() => handleSelectAction(entry.id)}
                    >
                      {entry.id === "SELECT" ? (
                        <Search className="h-4 w-4" />
                      ) : entry.id === "COUNT" ? (
                        <Hash className="h-4 w-4" />
                      ) : (
                        <Database className="h-4 w-4" />
                      )}
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-medium">{entry.label}</span>
                        <span className="text-xs text-muted-foreground">{entry.description}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        )}
      </DialogContent>
    </Dialog>
  );
});

interface ColumnsStepProps {
  table: TableInfo;
  action: Action;
  selectedColumns: Set<string>;
  onToggle: (column: string) => void;
  onInsert: () => void;
  onBack: () => void;
}

interface ColumnRow {
  name: string;
  description: string;
}

function ColumnsStep({
  table,
  action,
  selectedColumns,
  onToggle,
  onInsert,
  onBack,
}: ColumnsStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  const rows = useMemo<ColumnRow[]>(() => {
    const base: ColumnRow[] = [{ name: ALL_COLUMNS, description: "All columns" }];
    const cols: ColumnRow[] = table.columns.map((col: ColumnInfo) => ({
      name: col.column_name,
      description: col.data_type,
    }));
    return [...base, ...cols];
  }, [table]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.description.toLowerCase().includes(term)
    );
  }, [rows, search]);

  // Reset highlight whenever the filtered set shrinks under it.
  useEffect(() => {
    setHighlighted((current) => Math.min(current, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  // Focus the input on mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the highlighted row in view while navigating with the keyboard.
  useEffect(() => {
    if (!listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(
      `[data-row-index="${highlighted}"]`
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  const focusList = () => {
    inputRef.current?.blur();
    listRef.current?.focus();
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const inListMode = () =>
    typeof document !== "undefined" && document.activeElement !== inputRef.current;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      if (inListMode()) focusInput();
      else focusList();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      onInsert();
      return;
    }

    if (e.key === "Escape") {
      // DialogContent.onEscapeKeyDown already handles this, but we
      // intercept here too so the dialog never sees it as a close request.
      e.preventDefault();
      onBack();
      return;
    }

    if (inListMode()) {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        const row = filtered[highlighted];
        if (row) onToggle(row.name);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((i) => Math.min(filtered.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((i) => Math.max(0, i - 1));
        return;
      }
    } else {
      // Input is focused — let Backspace on empty walk back, and ArrowDown
      // dip into the list for navigation.
      if (e.key === "Backspace" && search.length === 0) {
        e.preventDefault();
        onBack();
        return;
      }
      if (e.key === "ArrowDown" && filtered.length > 0) {
        e.preventDefault();
        focusList();
        return;
      }
    }
  };

  const previewColumns =
    selectedColumns.has(ALL_COLUMNS) || selectedColumns.size === 0
      ? "*"
      : Array.from(selectedColumns).join(", ");

  return (
    <div onKeyDown={handleKeyDown}>
      <div className="flex h-9 items-center gap-2 border-b px-3">
        <Search className="size-4 shrink-0 opacity-50" />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter columns..."
          className="placeholder:text-muted-foreground flex h-10 w-full bg-transparent py-3 text-sm outline-none"
        />
      </div>

      <div
        ref={listRef}
        tabIndex={-1}
        className="max-h-[300px] overflow-y-auto p-1 outline-none focus:bg-muted/10"
      >
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No matches</div>
        ) : (
          filtered.map((row, idx) => {
            const checked = selectedColumns.has(row.name);
            const isHighlighted = idx === highlighted;
            return (
              <div
                key={row.name}
                data-row-index={idx}
                onMouseEnter={() => setHighlighted(idx)}
                onClick={() => {
                  setHighlighted(idx);
                  onToggle(row.name);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                  isHighlighted && "bg-accent text-accent-foreground"
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-sm border bg-background">
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <div className="flex flex-col">
                  <span className="font-mono text-sm">{row.name}</span>
                  <span className="text-xs text-muted-foreground">{row.description}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="truncate font-mono">
          {action} {previewColumns} FROM {table.table_name}
        </span>
        <div className="flex items-center gap-3">
          <span>
            <kbd className="rounded border bg-background px-1">Tab</kbd> focus ·{" "}
            <kbd className="rounded border bg-background px-1">Space</kbd> check ·{" "}
            <kbd className="rounded border bg-background px-1">Enter</kbd> paste ·{" "}
            <kbd className="rounded border bg-background px-1">Esc</kbd> back
          </span>
          <button
            type="button"
            onClick={onInsert}
            className="flex items-center gap-1 rounded border bg-background px-2 py-1 font-medium text-foreground hover:bg-accent"
          >
            <ClipboardPaste className="h-3 w-3" />
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}
