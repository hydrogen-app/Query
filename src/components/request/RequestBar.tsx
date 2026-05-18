import { memo } from "react";
import {
  Play,
  Save,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type { RequestEnvironment } from "../../hooks";
import type { QuerySafetyMode } from "../../utils/queryRequest";

interface RequestBarProps {
  requestName: string;
  collection: string;
  collections: string[];
  queryKind: string;
  isWriteQuery: boolean;
  environments: RequestEnvironment[];
  activeEnvironmentId: string;
  safetyMode: QuerySafetyMode;
  maxRows: number;
  vimMode: boolean;
  isRunning: boolean;
  isConnectionLoading: boolean;
  onRequestNameChange: (name: string) => void;
  onCollectionChange: (collection: string) => void;
  onEnvironmentChange: (id: string) => void;
  onSafetyModeChange: (mode: QuerySafetyMode) => void;
  onMaxRowsChange: (maxRows: number) => void;
  onVimModeChange: (enabled: boolean) => void;
  onSave: () => void;
  onRun: () => void;
}

const SAFETY_LABELS: Record<QuerySafetyMode, string> = {
  read_only: "Read only",
  confirm_writes: "Confirm writes",
  allow_writes: "Allow writes",
};

export const RequestBar = memo(function RequestBar({
  requestName,
  collection,
  collections,
  queryKind,
  isWriteQuery,
  environments,
  activeEnvironmentId,
  safetyMode,
  maxRows,
  vimMode,
  isRunning,
  isConnectionLoading,
  onRequestNameChange,
  onCollectionChange,
  onEnvironmentChange,
  onSafetyModeChange,
  onMaxRowsChange,
  onVimModeChange,
  onSave,
  onRun,
}: RequestBarProps) {
  return (
    <div className="border-b border-border/50 bg-background">
      <div className="flex min-h-12 flex-wrap items-center gap-2 px-3 py-2">
        <Input
          value={requestName}
          onChange={(event) => onRequestNameChange(event.target.value)}
          className="h-8 w-[220px] min-w-[180px] flex-1 text-sm font-medium"
          placeholder="Request name"
        />

        <div className="flex items-center gap-1">
          <Label className="sr-only" htmlFor="request-collection">
            Collection
          </Label>
          <Input
            id="request-collection"
            value={collection}
            list="request-collections"
            onChange={(event) => onCollectionChange(event.target.value)}
            className="h-8 w-[150px] text-xs"
            placeholder="Collection"
          />
          <datalist id="request-collections">
            {collections.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>

        <Badge
          variant={isWriteQuery ? "destructive" : "outline"}
          className="h-7 rounded-md px-2 font-mono"
        >
          {queryKind}
        </Badge>

        <Select value={activeEnvironmentId} onValueChange={onEnvironmentChange}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Environment" />
          </SelectTrigger>
          <SelectContent>
            {environments.map((environment) => (
              <SelectItem key={environment.id} value={environment.id}>
                {environment.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={safetyMode}
          onValueChange={(value) => onSafetyModeChange(value as QuerySafetyMode)}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="read_only">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                {SAFETY_LABELS.read_only}
              </span>
            </SelectItem>
            <SelectItem value="confirm_writes">
              <span className="flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5" />
                {SAFETY_LABELS.confirm_writes}
              </span>
            </SelectItem>
            <SelectItem value="allow_writes">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {SAFETY_LABELS.allow_writes}
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Label htmlFor="request-max-rows" className="text-xs text-muted-foreground">
            Rows
          </Label>
          <Input
            id="request-max-rows"
            type="number"
            min={0}
            value={maxRows}
            onChange={(event) => onMaxRowsChange(Number(event.target.value))}
            className="h-8 w-[84px] text-xs"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={vimMode ? "default" : "outline"}
            size="sm"
            className="h-8 px-2"
            title="Toggle Vim mode"
            onClick={() => onVimModeChange(!vimMode)}
          >
            <span className="font-mono text-xs">VIM</span>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onSave}>
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5"
            disabled={isRunning || isConnectionLoading}
            onClick={onRun}
          >
            <Play className="h-3.5 w-3.5" />
            Run
          </Button>
        </div>
      </div>
    </div>
  );
});
