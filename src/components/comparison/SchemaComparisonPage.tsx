import { useMemo, useState } from "react";
import { WARNING_SEVERITY, MACOS_TITLEBAR_TOP_PADDING } from "../../constants";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  ArrowLeft,
  ArrowLeftRight,
  Database,
  Lock,
  PlayCircle,
  Plus,
  Minus,
  Pencil,
  AlertTriangle,
  CheckCircle2,
  Search,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ConnectionConfig,
  SchemaComparison,
} from "../../types";
import { compareSchemas, generateMigrationSql, getConnectionPassword } from "../../utils/tauri";
import { DiffViewer } from "./DiffViewer";
import { ObjectSelectionTree } from "./ObjectSelectionTree";
import { WarningsPanel } from "./WarningsPanel";
import { MigrationScriptEditor } from "./MigrationScriptEditor";
import { cn } from "../../lib/utils";

interface SchemaComparisonPageProps {
  connections: ConnectionConfig[];
  onClose: () => void;
}

type FilterMode = "all" | "differences" | "conflicts";

export function SchemaComparisonPage({
  connections,
  onClose,
}: SchemaComparisonPageProps) {
  const [sourceConnection, setSourceConnection] =
    useState<ConnectionConfig | null>(null);
  const [targetConnection, setTargetConnection] =
    useState<ConnectionConfig | null>(null);
  const [comparison, setComparison] = useState<SchemaComparison | null>(null);
  const [migrationScript, setMigrationScript] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("differences");
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
  const [tableQuery, setTableQuery] = useState("");

  const runComparison = async () => {
    if (!sourceConnection || !targetConnection) {
      toast.error("Please select both source and target connections");
      return;
    }
    const sourcePassword = await getConnectionPassword(sourceConnection.name);
    const targetPassword = await getConnectionPassword(targetConnection.name);

    setLoading(true);
    try {
      const result = await compareSchemas(
        { ...sourceConnection, password: sourcePassword || "" },
        { ...targetConnection, password: targetPassword || "" }
      );
      setComparison(result);

      const script = await generateMigrationSql(result);
      setMigrationScript(script);

      const allChanges = new Set<string>();
      result.table_differences.forEach((table) => {
        if (table.status !== "identical") {
          allChanges.add(`table:${table.table_name}`);
        }
      });
      setSelectedChanges(allChanges);

      toast.success("Schema comparison completed");
    } catch (error) {
      console.error("Failed to compare schemas:", error);
      toast.error(`Comparison failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    setSourceConnection(targetConnection);
    setTargetConnection(sourceConnection);
  };

  const handleNewComparison = () => {
    setComparison(null);
    setMigrationScript("");
    setSelectedChanges(new Set());
    setTableQuery("");
  };

  const summary = comparison?.summary;
  const differenceCount = useMemo(() => {
    if (!comparison) return 0;
    return (
      comparison.table_differences.filter((t) => t.status !== "identical").length +
      comparison.view_differences.filter((v) => v.status !== "identical").length +
      comparison.routine_differences.filter((r) => r.status !== "identical").length
    );
  }, [comparison]);
  const conflictCount =
    comparison?.warnings.filter((w) => w.severity === WARNING_SEVERITY.HIGH).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header
        className="flex items-center justify-between gap-4 px-6 py-3 border-b"
        style={{ paddingTop: `${MACOS_TITLEBAR_TOP_PADDING}px` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 shrink-0"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight">Schema Comparison</h1>
            {comparison && (
              <p className="truncate text-xs text-muted-foreground">
                <span className="font-mono">{sourceConnection?.name}</span>
                <span className="mx-1">→</span>
                <span className="font-mono">{targetConnection?.name}</span>
              </p>
            )}
          </div>
        </div>

        {comparison && (
          <div className="flex items-center gap-2">
            <StatChip
              icon={<Plus className="h-3 w-3" />}
              tone="emerald"
              count={summary?.tables_added ?? 0}
              label="Added"
              active={filterMode === "differences"}
              onClick={() => setFilterMode("differences")}
            />
            <StatChip
              icon={<Minus className="h-3 w-3" />}
              tone="rose"
              count={summary?.tables_removed ?? 0}
              label="Removed"
              active={filterMode === "differences"}
              onClick={() => setFilterMode("differences")}
            />
            <StatChip
              icon={<Pencil className="h-3 w-3" />}
              tone="amber"
              count={summary?.tables_modified ?? 0}
              label="Modified"
              active={filterMode === "differences"}
              onClick={() => setFilterMode("differences")}
            />
            <StatChip
              icon={<AlertTriangle className="h-3 w-3" />}
              tone="orange"
              count={conflictCount}
              label="Conflicts"
              active={filterMode === "conflicts"}
              onClick={() => setFilterMode("conflicts")}
            />
            <div className="mx-1 h-6 w-px bg-border" />
            <Button
              variant={filterMode === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("all")}
              className="h-7 text-xs"
            >
              Show all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewComparison}
              className="h-7 gap-1.5 text-xs"
              title="Start a new comparison"
            >
              <RotateCcw className="h-3 w-3" />
              New
            </Button>
          </div>
        )}
      </header>

      {/* Picker */}
      {!comparison && (
        <ConnectionPicker
          connections={connections}
          source={sourceConnection}
          target={targetConnection}
          onSourceChange={setSourceConnection}
          onTargetChange={setTargetConnection}
          onSwap={handleSwap}
          onCompare={runComparison}
          loading={loading}
        />
      )}

      {/* Results */}
      {comparison && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Tabs defaultValue="diff" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-3 flex-shrink-0 w-fit">
              <TabsTrigger value="diff">Diff</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="warnings">
                Warnings
                {comparison.warnings && comparison.warnings.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                    {comparison.warnings.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="script">Migration</TabsTrigger>
              <TabsTrigger value="objects">Objects</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden px-6 py-4 min-h-0">
              <TabsContent value="diff" className="mt-0 h-full overflow-hidden">
                <div className="flex h-full flex-col gap-3 min-h-0">
                  <div className="relative w-full sm:w-72 flex-shrink-0">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={tableQuery}
                      onChange={(e) => setTableQuery(e.target.value)}
                      placeholder="Filter tables…"
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <div className="flex-1 min-h-0">
                    <DiffViewer
                      comparison={comparison}
                      filterMode={filterMode}
                      tableQuery={tableQuery}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="summary" className="mt-0 h-full overflow-auto">
                <SummaryPanel
                  comparison={comparison}
                  source={sourceConnection}
                  target={targetConnection}
                  differenceCount={differenceCount}
                  conflictCount={conflictCount}
                />
              </TabsContent>

              <TabsContent value="warnings" className="mt-0 h-full overflow-hidden">
                <WarningsPanel warnings={comparison.warnings || []} />
              </TabsContent>

              <TabsContent value="script" className="mt-0 h-full overflow-hidden">
                <MigrationScriptEditor migrationScript={migrationScript} readOnly={false} />
              </TabsContent>

              <TabsContent value="objects" className="mt-0 h-full overflow-hidden">
                <ObjectSelectionTree
                  comparison={comparison}
                  selectedChanges={selectedChanges}
                  onSelectionChange={setSelectedChanges}
                  filterMode={filterMode}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}
    </div>
  );
}

// ─── Connection picker ────────────────────────────────────────────────────

interface ConnectionPickerProps {
  connections: ConnectionConfig[];
  source: ConnectionConfig | null;
  target: ConnectionConfig | null;
  onSourceChange: (conn: ConnectionConfig | null) => void;
  onTargetChange: (conn: ConnectionConfig | null) => void;
  onSwap: () => void;
  onCompare: () => void;
  loading: boolean;
}

function ConnectionPicker({
  connections,
  source,
  target,
  onSourceChange,
  onTargetChange,
  onSwap,
  onCompare,
  loading,
}: ConnectionPickerProps) {
  const canCompare = !!source && !!target && source.name !== target.name;
  const sameSelected = source && target && source.name === target.name;

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-semibold">Compare two databases</h2>
          <p className="text-sm text-muted-foreground">
            Pick a source and a target — we'll diff tables, columns, indexes, and routines.
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
          <ConnectionCard
            label="Source"
            connection={source}
            connections={connections}
            onChange={onSourceChange}
            placeholder="Pick source…"
          />

          <div className="flex items-center justify-center">
            <Button
              variant="outline"
              size="icon"
              onClick={onSwap}
              disabled={!source && !target}
              className="h-10 w-10 rounded-full"
              title="Swap source and target"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
          </div>

          <ConnectionCard
            label="Target"
            connection={target}
            connections={connections}
            onChange={onTargetChange}
            placeholder="Pick target…"
          />
        </div>

        {sameSelected && (
          <div className="flex items-center justify-center gap-2 text-xs text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            Source and target are the same connection.
          </div>
        )}

        <div className="flex justify-center">
          <Button
            onClick={onCompare}
            disabled={loading || !canCompare}
            size="lg"
            className="gap-2"
          >
            <PlayCircle className="h-4 w-4" />
            {loading ? "Comparing…" : "Compare Schemas"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ConnectionCardProps {
  label: string;
  connection: ConnectionConfig | null;
  connections: ConnectionConfig[];
  onChange: (conn: ConnectionConfig | null) => void;
  placeholder: string;
}

function ConnectionCard({
  label,
  connection,
  connections,
  onChange,
  placeholder,
}: ConnectionCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </Label>
        {connection?.readOnly && (
          <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px]">
            <Lock className="h-2.5 w-2.5" />
            Read-only
          </Badge>
        )}
      </div>
      <Select
        value={connection?.name || ""}
        onValueChange={(value) => {
          const conn = connections.find((c) => c.name === value);
          onChange(conn || null);
        }}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {connections.map((conn) => (
            <SelectItem key={conn.name} value={conn.name}>
              {conn.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Database className="h-3 w-3 shrink-0" />
        {connection ? (
          <span className="truncate font-mono">
            {connection.database}@{connection.host}:{connection.port}
          </span>
        ) : (
          <span className="italic">No connection selected</span>
        )}
      </div>
    </div>
  );
}

// ─── Stat chip used in header ────────────────────────────────────────────

interface StatChipProps {
  icon: React.ReactNode;
  tone: "emerald" | "rose" | "amber" | "orange";
  count: number;
  label: string;
  active: boolean;
  onClick: () => void;
}

const TONE_STYLES: Record<StatChipProps["tone"], string> = {
  emerald: "text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30",
  rose: "text-rose-400 hover:bg-rose-500/10 border-rose-500/30",
  amber: "text-amber-400 hover:bg-amber-500/10 border-amber-500/30",
  orange: "text-orange-400 hover:bg-orange-500/10 border-orange-500/30",
};

function StatChip({ icon, tone, count, label, active, onClick }: StatChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors",
        TONE_STYLES[tone],
        active ? "bg-accent/40" : "bg-transparent"
      )}
      title={`${count} ${label.toLowerCase()}`}
    >
      {icon}
      <span className="font-semibold">{count}</span>
      <span className="text-muted-foreground">{label}</span>
    </button>
  );
}

// ─── Summary panel ───────────────────────────────────────────────────────

interface SummaryPanelProps {
  comparison: SchemaComparison;
  source: ConnectionConfig | null;
  target: ConnectionConfig | null;
  differenceCount: number;
  conflictCount: number;
}

function SummaryPanel({
  comparison,
  source,
  target,
  differenceCount,
  conflictCount,
}: SummaryPanelProps) {
  const stats = [
    {
      label: "Tables Added",
      value: comparison.summary.tables_added,
      tone: "emerald" as const,
      icon: <Plus className="h-4 w-4" />,
    },
    {
      label: "Tables Removed",
      value: comparison.summary.tables_removed,
      tone: "rose" as const,
      icon: <Minus className="h-4 w-4" />,
    },
    {
      label: "Tables Modified",
      value: comparison.summary.tables_modified,
      tone: "amber" as const,
      icon: <Pencil className="h-4 w-4" />,
    },
    {
      label: "Indexes Missing",
      value: comparison.summary.indexes_missing,
      tone: "blue" as const,
      icon: <Database className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <ConnectionSummaryCard label="Source" connection={source} />
        <ConnectionSummaryCard label="Target" connection={target} />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "rounded-lg border p-4",
              stat.tone === "emerald" && "border-emerald-500/20 bg-emerald-500/5",
              stat.tone === "rose" && "border-rose-500/20 bg-rose-500/5",
              stat.tone === "amber" && "border-amber-500/20 bg-amber-500/5",
              stat.tone === "blue" && "border-blue-500/20 bg-blue-500/5"
            )}
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs uppercase tracking-wide">{stat.label}</span>
              <span
                className={cn(
                  stat.tone === "emerald" && "text-emerald-400",
                  stat.tone === "rose" && "text-rose-400",
                  stat.tone === "amber" && "text-amber-400",
                  stat.tone === "blue" && "text-blue-400"
                )}
              >
                {stat.icon}
              </span>
            </div>
            <div className="mt-2 text-3xl font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-medium">Overall</h3>
        <div className="flex items-center gap-4 text-sm">
          {differenceCount === 0 ? (
            <span className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Schemas are identical
            </span>
          ) : (
            <span>
              <strong className="text-foreground">{differenceCount}</strong>{" "}
              <span className="text-muted-foreground">object{differenceCount === 1 ? "" : "s"} differ</span>
            </span>
          )}
          {conflictCount > 0 && (
            <span className="flex items-center gap-1 text-orange-400">
              <AlertTriangle className="h-4 w-4" />
              {conflictCount} high-risk warning{conflictCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectionSummaryCard({
  label,
  connection,
}: {
  label: string;
  connection: ConnectionConfig | null;
}) {
  if (!connection) return null;
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </Label>
        {connection.readOnly && (
          <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px]">
            <Lock className="h-2.5 w-2.5" />
            Read-only
          </Badge>
        )}
      </div>
      <div className="font-medium">{connection.name}</div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Database className="h-3 w-3 shrink-0" />
        <span className="truncate font-mono">
          {connection.database}@{connection.host}:{connection.port}
        </span>
      </div>
    </div>
  );
}
