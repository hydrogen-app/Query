import { lazy, Suspense, useMemo, useState } from "react";
import type {
  EnhancedColumnInfo,
  SchemaComparison,
  TableDifference,
} from "../../types";
import { DIFF_STATUS, WARNING_SEVERITY } from "../../constants";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
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
          (w) =>
            w.severity === WARNING_SEVERITY.HIGH &&
            w.affected_object === table.table_name
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

  const allOpen = filteredTables.length > 0 &&
    filteredTables.every((t) => openTables.has(t.table_name));

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mb-3 flex flex-shrink-0 items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
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
      <div className="space-y-2 flex-1 overflow-auto min-h-0">
        {filteredTables.length === 0 && (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
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
        <div className="flex items-center gap-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-mono font-medium">{table.table_name}</span>
          <StatusBadge status={table.status} />
          {meaningfulColumnChanges.length > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {meaningfulColumnChanges.length} column changes
            </span>
          )}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 border rounded-lg overflow-hidden">
          {ddl && (
            <Suspense
              fallback={
                <div className="px-3 py-4 text-xs text-muted-foreground">
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
                  theme: "pierre-dark",
                  diffStyle: "split",
                  diffIndicators: "bars",
                  lineDiffType: "word",
                }}
              />
            </Suspense>
          )}

          {meaningfulColumnChanges.length > 0 && (
            <div className="border-t p-4 bg-muted/10">
              <div className="text-sm font-medium mb-2">Changes Detected:</div>
              <ul className="text-sm space-y-1 text-muted-foreground">
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
            <div className="border-t p-4 bg-muted/10">
              <div className="text-sm font-medium mb-2">Index Changes:</div>
              <ul className="text-sm space-y-1 text-muted-foreground">
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
function buildTableDDL(
  table: TableDifference,
  side: "source" | "target"
): string {
  // ADDED tables exist only on target; REMOVED only on source.
  if (side === "source" && table.status === DIFF_STATUS.ADDED) return "";
  if (side === "target" && table.status === DIFF_STATUS.REMOVED) return "";

  const lines: string[] = [];
  lines.push(`CREATE TABLE ${table.table_name} (`);

  const columnLines: string[] = [];
  for (const change of table.column_changes) {
    const def =
      side === "source" ? change.source_definition : change.target_definition;
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
    added: "bg-green-500/20 text-green-400 border-green-500/50",
    removed: "bg-red-500/20 text-red-400 border-red-500/50",
    modified: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
    identical: "bg-gray-500/20 text-gray-400 border-gray-500/50",
  };
  const displayText = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded text-xs border",
        colors[status as keyof typeof colors]
      )}
    >
      {displayText}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === DIFF_STATUS.ADDED) {
    return <span className="text-green-400">+</span>;
  }
  if (status === DIFF_STATUS.REMOVED) {
    return <span className="text-red-400">-</span>;
  }
  if (status === DIFF_STATUS.MODIFIED) {
    return <span className="text-yellow-400">~</span>;
  }
  return <span className="text-gray-400">•</span>;
}
