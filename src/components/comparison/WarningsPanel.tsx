import type { ComparisonWarning } from "../../types";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "../../lib/utils";
import { WARNING_SEVERITY } from "../../constants";

interface WarningsPanelProps {
  warnings: ComparisonWarning[];
}

export function WarningsPanel({ warnings }: WarningsPanelProps) {
  const highRiskWarnings = warnings.filter((w) => w.severity === WARNING_SEVERITY.HIGH);
  const mediumRiskWarnings = warnings.filter((w) => w.severity === WARNING_SEVERITY.MEDIUM);
  const lowRiskWarnings = warnings.filter((w) => w.severity === WARNING_SEVERITY.LOW);

  if (warnings.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
        <Info className="text-status-success mb-4 h-12 w-12" />
        <p className="text-lg font-medium">No Warnings Detected</p>
        <p className="text-sm">All changes appear safe to apply</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex flex-shrink-0 items-center gap-3">
        <h2 className="text-lg font-semibold">Schema Change Warnings</h2>
        <div className="flex gap-2 text-sm">
          {highRiskWarnings.length > 0 && (
            <span className="bg-status-error/15 text-status-error rounded px-2 py-1">
              {highRiskWarnings.length} High Risk
            </span>
          )}
          {mediumRiskWarnings.length > 0 && (
            <span className="bg-status-warning/15 text-status-warning rounded px-2 py-1">
              {mediumRiskWarnings.length} Medium Risk
            </span>
          )}
          {lowRiskWarnings.length > 0 && (
            <span className="bg-query-select/15 text-query-select rounded px-2 py-1">
              {lowRiskWarnings.length} Low Risk
            </span>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="min-h-0 flex-1 space-y-6 overflow-auto">
        {/* High Risk Warnings */}
        {highRiskWarnings.length > 0 && (
          <div className="space-y-3">
            <div className="text-status-error flex items-center gap-2 font-medium">
              <AlertTriangle className="h-5 w-5" />
              <h3>HIGH RISK</h3>
            </div>
            <div className="space-y-2 pl-7">
              {highRiskWarnings.map((warning, idx) => (
                <WarningCard key={idx} warning={warning} severity={WARNING_SEVERITY.HIGH} />
              ))}
            </div>
          </div>
        )}

        {/* Medium Risk Warnings */}
        {mediumRiskWarnings.length > 0 && (
          <div className="space-y-3">
            <div className="text-status-warning flex items-center gap-2 font-medium">
              <AlertCircle className="h-5 w-5" />
              <h3>MEDIUM RISK</h3>
            </div>
            <div className="space-y-2 pl-7">
              {mediumRiskWarnings.map((warning, idx) => (
                <WarningCard key={idx} warning={warning} severity={WARNING_SEVERITY.MEDIUM} />
              ))}
            </div>
          </div>
        )}

        {/* Low Risk Warnings */}
        {lowRiskWarnings.length > 0 && (
          <div className="space-y-3">
            <div className="text-query-select flex items-center gap-2 font-medium">
              <Info className="h-5 w-5" />
              <h3>LOW RISK</h3>
            </div>
            <div className="space-y-2 pl-7">
              {lowRiskWarnings.map((warning, idx) => (
                <WarningCard key={idx} warning={warning} severity={WARNING_SEVERITY.LOW} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WarningCard({
  warning,
  severity,
}: {
  warning: ComparisonWarning;
  severity: "high" | "medium" | "low";
}) {
  const borderColors = {
    high: "border-status-error/40 bg-status-error/10",
    medium: "border-status-warning/40 bg-status-warning/10",
    low: "border-query-select/40 bg-query-select/10",
  };

  const badgeColors = {
    high: "bg-status-error/15 text-status-error",
    medium: "bg-status-warning/15 text-status-warning",
    low: "bg-query-select/15 text-query-select",
  };

  // Capitalize for display
  const displaySeverity = severity.charAt(0).toUpperCase() + severity.slice(1);

  return (
    <div className={cn("space-y-2 rounded-lg border p-4", borderColors[severity])}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium">{warning.message}</p>
          {warning.details && (
            <p className="text-muted-foreground mt-1 text-sm">{warning.details}</p>
          )}
        </div>
        <span
          className={cn("rounded px-2 py-0.5 text-xs whitespace-nowrap", badgeColors[severity])}
        >
          {displaySeverity}
        </span>
      </div>

      {warning.affected_object && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Affected object:</span>
          <code className="bg-muted rounded px-1.5 py-0.5 font-mono">
            {warning.affected_object}
          </code>
        </div>
      )}

      {/* Additional context based on warning type */}
      {severity === WARNING_SEVERITY.HIGH && (
        <div className="border-status-error/30 mt-3 flex items-start gap-2 border-t pt-3 text-xs">
          <AlertTriangle className="text-status-error mt-0.5 h-3.5 w-3.5" />
          <div className="text-muted-foreground">
            <strong className="text-foreground">Recommended actions:</strong>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>Create a backup before proceeding</li>
              <li>Review the affected data carefully</li>
              <li>Consider running in a test environment first</li>
            </ul>
          </div>
        </div>
      )}

      {severity === WARNING_SEVERITY.MEDIUM && (
        <div className="border-status-warning/30 mt-3 flex items-start gap-2 border-t pt-3 text-xs">
          <AlertCircle className="text-status-warning mt-0.5 h-3.5 w-3.5" />
          <div className="text-muted-foreground">
            <strong className="text-foreground">Note:</strong> This operation may cause temporary
            table locks or performance impact during execution.
          </div>
        </div>
      )}
    </div>
  );
}
