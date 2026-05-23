import { useState, memo } from "react";
import { WARNING_SEVERITY } from "../../constants";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import type { ConnectionConfig, SchemaComparison } from "../../types";
import { compareSchemas, generateMigrationSql, getConnectionPassword } from "../../utils/tauri";
import { Loader2, AlertTriangle, CheckCircle2, XCircle, MinusCircle } from "lucide-react";

interface SchemaComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  connections: ConnectionConfig[];
}

export const SchemaComparisonModal = memo(function SchemaComparisonModal({
  isOpen,
  onClose,
  connections,
}: SchemaComparisonModalProps) {
  const [sourceConnectionName, setSourceConnectionName] = useState<string>("");
  const [targetConnectionName, setTargetConnectionName] = useState<string>("");
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<SchemaComparison | null>(null);
  const [migrationScript, setMigrationScript] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleCompare = async () => {
    if (!sourceConnectionName || !targetConnectionName) {
      setError("Please select both source and target connections");
      return;
    }

    const sourceConfig = connections.find((c) => c.name === sourceConnectionName);
    const targetConfig = connections.find((c) => c.name === targetConnectionName);

    if (!sourceConfig || !targetConfig) {
      setError("Selected connections not found");
      return;
    }

    setComparing(true);
    setError("");
    setComparison(null);
    setMigrationScript("");

    try {
      // Fetch passwords from keychain for both connections
      const sourcePassword = await getConnectionPassword(sourceConfig.name);
      const targetPassword = await getConnectionPassword(targetConfig.name);

      // Create connection configs with passwords
      const sourceConfigWithPassword = {
        ...sourceConfig,
        password: sourcePassword || "",
      };
      const targetConfigWithPassword = {
        ...targetConfig,
        password: targetPassword || "",
      };

      const result = await compareSchemas(sourceConfigWithPassword, targetConfigWithPassword);
      setComparison(result);

      // Generate migration script
      const script = await generateMigrationSql(result);
      setMigrationScript(script);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setComparing(false);
    }
  };

  const handleSaveScript = () => {
    if (!migrationScript) return;

    const blob = new Blob([migrationScript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migration_${sourceConnectionName}_to_${targetConnectionName}_${Date.now()}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Added":
        return <CheckCircle2 className="text-status-success h-4 w-4" />;
      case "Removed":
        return <XCircle className="text-status-error h-4 w-4" />;
      case "Modified":
        return <MinusCircle className="text-status-warning h-4 w-4" />;
      default:
        return <CheckCircle2 className="text-muted-foreground h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "High":
        return "bg-status-error";
      case "Medium":
        return "bg-status-warning";
      case "Low":
        return "bg-query-select";
      default:
        return "bg-muted";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schema Comparison</DialogTitle>
          <DialogDescription>Compare database schemas between two connections</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Connection Selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Source (From)</Label>
              <Select value={sourceConnectionName} onValueChange={setSourceConnectionName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source connection" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((conn) => (
                    <SelectItem key={conn.name} value={conn.name}>
                      {conn.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target (To)</Label>
              <Select value={targetConnectionName} onValueChange={setTargetConnectionName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target connection" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((conn) => (
                    <SelectItem key={conn.name} value={conn.name}>
                      {conn.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Compare Button */}
          <div className="flex gap-3">
            <Button
              onClick={handleCompare}
              disabled={comparing || !sourceConnectionName || !targetConnectionName}
              className="flex-1"
            >
              {comparing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Compare Schemas
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-status-error/10 border-status-error/40 text-status-error rounded-lg border p-4 text-sm">
              {error}
            </div>
          )}

          {/* Comparison Results */}
          {comparison && (
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="tables">Tables</TabsTrigger>
                <TabsTrigger value="warnings">
                  Warnings
                  {comparison.warnings.length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {comparison.warnings.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="script">Migration Script</TabsTrigger>
              </TabsList>

              {/* Summary Tab */}
              <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-card border-border rounded-lg border p-4">
                    <div className="text-muted-foreground mb-1 text-sm">Tables</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="text-status-success h-4 w-4" />
                        <span className="text-sm">{comparison.summary.tables_added} added</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="text-status-error h-4 w-4" />
                        <span className="text-sm">{comparison.summary.tables_removed} removed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MinusCircle className="text-status-warning h-4 w-4" />
                        <span className="text-sm">
                          {comparison.summary.tables_modified} modified
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border-border rounded-lg border p-4">
                    <div className="text-muted-foreground mb-1 text-sm">Indexes</div>
                    <div className="text-2xl font-semibold">
                      {comparison.summary.indexes_missing}
                    </div>
                    <div className="text-muted-foreground text-xs">changes detected</div>
                  </div>

                  <div className="bg-card border-border rounded-lg border p-4">
                    <div className="text-muted-foreground mb-1 text-sm">Views</div>
                    <div className="text-2xl font-semibold">{comparison.summary.views_changed}</div>
                    <div className="text-muted-foreground text-xs">changed</div>
                  </div>
                </div>
              </TabsContent>

              {/* Tables Tab */}
              <TabsContent value="tables" className="space-y-4">
                <div className="space-y-3">
                  {comparison.table_differences.map((tableDiff) => (
                    <div
                      key={tableDiff.table_name}
                      className="bg-card border-border rounded-lg border p-4"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        {getStatusIcon(tableDiff.status)}
                        <span className="font-semibold">{tableDiff.table_name}</span>
                        <Badge variant="outline" className="ml-auto">
                          {tableDiff.status}
                        </Badge>
                      </div>

                      {tableDiff.column_changes.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-muted-foreground text-xs">Column Changes:</div>
                          {tableDiff.column_changes.map((colChange) => (
                            <div
                              key={colChange.column_name}
                              className="flex items-center gap-2 pl-4 text-sm"
                            >
                              {getStatusIcon(colChange.status)}
                              <span>{colChange.column_name}</span>
                              {colChange.changes.length > 0 && (
                                <span className="text-muted-foreground text-xs">
                                  ({colChange.changes.join(", ")})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {tableDiff.index_changes.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-muted-foreground text-xs">Index Changes:</div>
                          {tableDiff.index_changes.map((idxChange) => (
                            <div
                              key={idxChange.index_name}
                              className="flex items-center gap-2 pl-4 text-sm"
                            >
                              {getStatusIcon(idxChange.status)}
                              <span>{idxChange.index_name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Warnings Tab */}
              <TabsContent value="warnings" className="space-y-3">
                {comparison.warnings.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center">No warnings detected</div>
                ) : (
                  comparison.warnings.map((warning, idx) => (
                    <div key={idx} className="bg-card border-border rounded-lg border p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle
                          className={`mt-0.5 h-5 w-5 ${
                            warning.severity === WARNING_SEVERITY.HIGH
                              ? "text-status-error"
                              : warning.severity === WARNING_SEVERITY.MEDIUM
                                ? "text-status-warning"
                                : "text-query-select"
                          }`}
                        />
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-semibold">{warning.message}</span>
                            <Badge
                              variant="outline"
                              className={`${getSeverityColor(warning.severity)} border-0 text-white`}
                            >
                              {warning.severity}
                            </Badge>
                          </div>
                          {warning.details && (
                            <div className="text-muted-foreground text-sm">{warning.details}</div>
                          )}
                          <div className="text-muted-foreground mt-1 text-xs">
                            Affects: {warning.affected_object}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Migration Script Tab */}
              <TabsContent value="script" className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={handleSaveScript} variant="outline">
                    Save Script
                  </Button>
                </div>
                <pre className="bg-background border-border max-h-96 overflow-x-auto overflow-y-auto rounded-lg border p-4 font-mono text-sm">
                  {migrationScript}
                </pre>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
