import { useState, memo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Kbd } from "../ui/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ShieldAlert, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { QuerySafetyMode } from "../../utils/queryRequest";

export interface SaveQueryInput {
  name: string;
  description: string;
  collection: string;
  safetyMode: QuerySafetyMode;
}

interface SaveQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: SaveQueryInput) => void;
  currentQuery: string;
  initialName: string;
  initialCollection: string;
  initialSafetyMode: QuerySafetyMode;
  collections: string[];
}

export const SaveQueryModal = memo(function SaveQueryModal({
  isOpen,
  onClose,
  onSave,
  currentQuery,
  initialName,
  initialCollection,
  initialSafetyMode,
  collections,
}: SaveQueryModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [collection, setCollection] = useState("General");
  const [safetyMode, setSafetyMode] = useState<QuerySafetyMode>("confirm_writes");

  useEffect(() => {
    if (isOpen) {
      setName(initialName === "Untitled request" ? "" : initialName);
      setDescription("");
      setCollection(initialCollection || "General");
      setSafetyMode(initialSafetyMode);
    }
  }, [initialCollection, initialName, initialSafetyMode, isOpen]);

  const handleSave = () => {
    if (name.trim()) {
      onSave({
        name: name.trim(),
        description: description.trim(),
        collection: collection.trim() || "General",
        safetyMode,
      });
      setName("");
      setDescription("");
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[560px]"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="border-b px-5 pb-3 pt-4">
          <DialogTitle className="text-base">Save Request</DialogTitle>
          <DialogDescription className="text-xs">
            Save this query for quick access. It'll appear in the sidebar and the command palette.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-auto px-5 py-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="query-name"
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="query-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Active users report"
              className="h-9"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="query-description"
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              Description <span className="text-muted-foreground/60">(optional)</span>
            </Label>
            <Input
              id="query-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this query do?"
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="query-collection"
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Collection
              </Label>
              <Input
                id="query-collection"
                value={collection}
                list="save-query-collections"
                onChange={(e) => setCollection(e.target.value)}
                placeholder="General"
                className="h-9"
              />
              <datalist id="save-query-collections">
                {collections.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Write Safety
              </Label>
              <Select
                value={safetyMode}
                onValueChange={(value) => setSafetyMode(value as QuerySafetyMode)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read_only">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Read only
                    </span>
                  </SelectItem>
                  <SelectItem value="confirm_writes">
                    <span className="flex items-center gap-2">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Confirm writes
                    </span>
                  </SelectItem>
                  <SelectItem value="allow_writes">
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Allow writes
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Query Preview
            </Label>
            <pre className="max-h-32 w-full overflow-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
              {currentQuery || <span className="italic">No query yet</span>}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-5 py-3">
          <div className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd>
            <span>to save</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
