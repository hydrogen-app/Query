import { memo, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ColumnInfo } from "../../types";

interface TableNodeProps {
  data: {
    label: string;
    columns: ColumnInfo[];
    expanded?: boolean;
    onToggleExpand?: (tableName: string) => void;
  };
}

export const TableNode = memo(({ data }: TableNodeProps) => {
  const { label, columns, expanded = false, onToggleExpand } = data;
  const [isExpanded, setIsExpanded] = useState(expanded);

  // Sync internal state with prop when it changes
  useEffect(() => {
    setIsExpanded(expanded);
  }, [expanded]);

  const handleToggle = () => {
    if (onToggleExpand) {
      onToggleExpand(label);
    }
  };

  const visibleColumns = isExpanded ? columns : columns.slice(0, 10);
  const hasMore = columns.length > 10;

  return (
    <div className="border-border bg-card min-w-[250px] overflow-hidden rounded-lg border">
      {/* Table Header */}
      <div className="border-border bg-primary/15 border-b px-3 py-2">
        <div className="text-foreground text-sm font-semibold">{label}</div>
      </div>

      {/* Columns List */}
      <div className="max-h-[400px] overflow-y-auto py-1">
        {visibleColumns.map((col) => (
          <div
            key={col.column_name}
            className="hover:bg-muted/10 flex items-center gap-2 px-3 py-1 text-xs transition-colors"
          >
            <span className="text-foreground font-medium">{col.column_name}</span>
            <span className="text-muted-foreground text-[10px]">{col.data_type}</span>
          </div>
        ))}
        {hasMore && (
          <button
            onClick={handleToggle}
            className="border-border text-primary hover:bg-primary/10 flex w-full items-center gap-1.5 border-t px-3 py-1.5 text-xs transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronDown className="h-3 w-3" />
                <span>Show less</span>
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3" />
                <span>Show {columns.length - 10} more columns</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary !border-background !h-2 !w-2 !border-2"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary !border-background !h-2 !w-2 !border-2"
      />
    </div>
  );
});

TableNode.displayName = "TableNode";
