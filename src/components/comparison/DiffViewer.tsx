import { lazy, Suspense, useMemo, useState } from "react";
import type { EnhancedColumnInfo, SchemaComparison, TableDifference } from "../../types";
import { DIFF_STATUS, QUERY_PIERRE_DIFF_THEME_OPTIONS, WARNING_SEVERITY } from "../../constants";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Button } from "../ui/button";
import { ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/utils";

// Lazy so Shiki + Pierre stay out of the initial bundle. They only load
// when the user opens the schema-compare page and expands a table.
const MultiFileDiff = lazy(() =>
  import("@pierre/diffs/react").then((mod) => ({ default: mod.MultiFileDiff }))
);

interface DiffViewerProps {
  comparison: SchemaComparison;
  filterMode: "all" | "differences" | "conflicts";
  tableQuery?: string;
}

export function DiffViewer({ comparison, filterMode, tableQuery = "" }: DiffViewerProps) {
  const [openTables, setOpenTables] = useState<Set<string>>(new Set());

  const toggleTable = (tableName: string) => {
    const newOpen = new Set(openTables);
    if (newOpen.has(tableName)) {
      newOpen.delete(tableName);
    } else {
      newOpen.add(tableName);
    }
    setOpenTables(newOpen);
  };

  const filteredTables = useMemo(() => {
    const term = tableQuery.trim().toLowerCase();
    return comparison.table_differences.filter((table) => {
      if (filterMode === "differences" && table.status === DIFF_STATUS.IDENTICAL) {
        return false;
      }
      if (filterMode === "conflicts") {
        const hasHighRiskWarning = (comparison.warnings || []).some(
          (w) => w.severity === WARNING_SEVERITY.HIGH && w.affected_object === table.table_name
        );
        if (!hasHighRiskWarning) return false;
      }
      if (term && !table.table_name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [comparison.table_differences, comparison.warnings, filterMode, tableQuery]);

  const expandAll = () => {
    setOpenTables(new Set(filteredTables.map((t) => t.table_name)));
  };

  const collapseAll = () => {
    setOpenTables(new Set());
  };

  const allOpen =
    filteredTables.length > 0 && filteredTables.every((t) => openTables.has(t.table_name));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex flex-shrink-0 items-center justify-between gap-2">
        <div className="text-muted-foreground text-xs">
          Showing <span className="text-foreground">{filteredTables.length}</span> of{" "}
          {comparison.table_differences.length} tables
        </div>
        {filteredTables.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={allOpen ? collapseAll : expandAll}
            className="h-7 gap-1.5 text-xs"
          >
            {allOpen ? (
              <>
                <ChevronsDownUp className="h-3 w-3" />
                Collapse all
              </>
            ) : (
              <>
                <ChevronsUpDown className="h-3 w-3" />
                Expand all
              </>
            )}
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto">
        {filteredTables.length === 0 && (
          <div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm">No tables match the current filter</p>
            <p className="mt-1 text-xs">
              {tableQuery
                ? `Try clearing the search "${tableQuery}"`
                : `Total tables in comparison: ${comparison.table_differences.length}`}
            </p>
          </div>
        )}

        {filteredTables.map((table) => (
          <TableDiffRow
            key={table.table_name}
            table={table}
            sourceConnection={comparison.source_connection}
            targetConnection={comparison.target_connection}
            isOpen={openTables.has(table.table_name)}
            onToggle={() => toggleTable(table.table_name)}
          />
        ))}
      </div>
    </div>
  );
}

interface TableDiffRowProps {
  table: TableDifference;
  sourceConnection: string;
  targetConnection: string;
  isOpen: boolean;
  onToggle: () => void;
}

function TableDiffRow({
  table,
  sourceConnection,
  targetConnection,
  isOpen,
  onToggle,
}: TableDiffRowProps) {
  // Recompute the DDL strings only when this table's data changes — and
  // only when expanded, so an unopened row stays cheap.
  const ddl = useMemo(() => {
    if (!isOpen) return null;
    return {
      source: buildTableDDL(table, "source"),
      target: buildTableDDL(table, "target"),
    };
  }, [isOpen, table]);

  const meaningfulColumnChanges = table.column_changes.filter(
    (c) => c.status !== DIFF_STATUS.IDENTICAL
  );

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full">
        <div className="hover:bg-accent/50 flex items-center gap-2 rounded-lg border p-3 transition-colors">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-mono font-medium">{table.table_name}</span>
          <StatusBadge status={table.status} />
          {meaningfulColumnChanges.length > 0 && (
            <span className="text-muted-foreground ml-auto text-xs">
              {meaningfulColumnChanges.length} column changes
            </span>
          )}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 overflow-hidden rounded-lg border">
          {ddl && (
            <Suspense
              fallback={
                <div className="text-muted-foreground px-3 py-4 text-xs">
                  Loading diff renderer…
                </div>
              }
            >
              <MultiFileDiff
                oldFile={{
                  name: `${sourceConnection}/${table.table_name}.sql`,
                  contents: ddl.source,
                  lang: "sql",
                }}
                newFile={{
                  name: `${targetConnection}/${table.table_name}.sql`,
                  contents: ddl.target,
                  lang: "sql",
                }}
                options={{
                  ...QUERY_PIERRE_DIFF_THEME_OPTIONS,
                  diffStyle: "split",
                  diffIndicators: "bars",
                  lineDiffType: "word",
                }}
              />
            </Suspense>
          )}

          {meaningfulColumnChanges.length > 0 && (
            <div className="bg-muted/10 border-t p-4">
              <div className="mb-2 text-sm font-medium">Changes Detected:</div>
              <ul className="text-muted-foreground space-y-1 text-sm">
                {meaningfulColumnChanges.map((change, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <StatusIcon status={change.status} />
                    <span>
                      <strong className="text-foreground">{change.column_name}</strong>:{" "}
                      {change.changes && change.changes.length > 0
                        ? change.changes.join(", ")
                        : `Status: ${change.status}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {table.index_changes && table.index_changes.length > 0 && (
            <div className="bg-muted/10 border-t p-4">
              <div className="mb-2 text-sm font-medium">Index Changes:</div>
              <ul className="text-muted-foreground space-y-1 text-sm">
                {table.index_changes.map((idx, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <StatusIcon status={idx.status} />
                    <span>
                      <strong className="text-foreground">{idx.index_name}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Build a full `CREATE TABLE` DDL string for the given side. Columns that
 * exist only on the other side are omitted — Pierre will show that as the
 * line missing in this file, which is exactly the diff signal we want.
 */
function buildTableDDL(table: TableDifference, side: "source" | "target"): string {
  // ADDED tables exist only on target; REMOVED only on source.
  if (side === "source" && table.status === DIFF_STATUS.ADDED) return "";
  if (side === "target" && table.status === DIFF_STATUS.REMOVED) return "";

  const lines: string[] = [];
  lines.push(`CREATE TABLE ${table.table_name} (`);

  const columnLines: string[] = [];
  for (const change of table.column_changes) {
    const def = side === "source" ? change.source_definition : change.target_definition;
    if (!def) continue;
    columnLines.push(`  ${formatColumnDefinition(def)}`);
  }

  // Comma-terminate every column line except the last; trailing comma would
  // make the file not real SQL even though it's just for display.
  for (let i = 0; i < columnLines.length; i++) {
    const trailing = i < columnLines.length - 1 ? "," : "";
    lines.push(`${columnLines[i]}${trailing}`);
  }

  lines.push(");");
  return lines.join("\n") + "\n";
}

function formatColumnDefinition(col: EnhancedColumnInfo): string {
  let def = `${col.column_name} ${col.data_type}`;

  if (col.character_maximum_length) {
    def += `(${col.character_maximum_length})`;
  } else if (col.numeric_precision && col.numeric_scale) {
    def += `(${col.numeric_precision},${col.numeric_scale})`;
  }

  if (col.is_nullable === "NO") {
    def += " NOT NULL";
  }

  if (col.column_default) {
    def += ` DEFAULT ${col.column_default}`;
  }

  return def;
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    added: "border-status-success/40 bg-status-success/15 text-status-success",
    removed: "border-status-error/40 bg-status-error/15 text-status-error",
    modified: "border-status-warning/40 bg-status-warning/15 text-status-warning",
    identical: "border-border bg-muted/60 text-muted-foreground",
  };
  const displayText = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={cn("rounded border px-2 py-0.5 text-xs", colors[status as keyof typeof colors])}
    >
      {displayText}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === DIFF_STATUS.ADDED) {
    return <span className="text-status-success">+</span>;
  }
  if (status === DIFF_STATUS.REMOVED) {
    return <span className="text-status-error">-</span>;
  }
  if (status === DIFF_STATUS.MODIFIED) {
    return <span className="text-status-warning">~</span>;
  }
  return <span className="text-muted-foreground">•</span>;
}
