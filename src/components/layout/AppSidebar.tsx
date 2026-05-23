import { memo, useState, useEffect, useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarGroup,
  SidebarGroupContent,
  SidebarRail,
} from "../ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import {
  GitBranch,
  GitCommit,
  Upload,
  Download,
  Plus,
  Minus,
  ChevronRight,
  Database,
  History as HistoryIcon,
  BookmarkIcon,
  Pin,
  Folder,
  FilePlus,
  FolderPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Kbd } from "../ui/kbd";
import type { DatabaseSchema, QueryHistoryEntry, SavedQuery, GitStatus } from "../../types";
import { getGitStatus, gitInit } from "../../utils/tauri";
import { getRequestCollection } from "../../utils/queryRequest";
import { GitCommitModal } from "../modals/GitCommitModal";
import {
  SIDEBAR_FOOTER_HEIGHT,
  GIT_STATUS_POLL_INTERVAL,
  MESSAGE_AUTO_CLEAR_DELAY,
} from "../../constants";

interface AppSidebarProps {
  schema: DatabaseSchema | null;
  availableSchemas: string[];
  selectedSchema: string;
  onSchemaChange: (schema: string) => void;
  history: QueryHistoryEntry[];
  savedQueries: SavedQuery[];
  collections: string[];
  onTableClick: (tableName: string) => void;
  onColumnClick: (tableName: string, columnName: string) => void;
  onSelectQuery: (query: string) => void;
  onSelectSavedQuery: (query: SavedQuery) => void;
  onDeleteQuery: (id: number) => void;
  onTogglePin: (id: number) => void;
  onClearHistory: () => void;
  onNewQuery: (collection?: string) => void;
  onNewCollection: () => void;
  onTableInsert?: (tableName: string) => void;
  onTableUpdate?: (tableName: string) => void;
  onTableDelete?: (tableName: string) => void;
}

// Query type badge styles using semantic tokens
const queryBadgeStyles = {
  SELECT: "bg-query-select/20 text-query-select border-query-select/30 hover:bg-query-select/30",
  INSERT: "bg-query-insert/20 text-query-insert border-query-insert/30 hover:bg-query-insert/30",
  UPDATE: "bg-query-update/20 text-query-update border-query-update/30 hover:bg-query-update/30",
  DELETE: "bg-query-delete/20 text-query-delete border-query-delete/30 hover:bg-query-delete/30",
  DEFAULT: "bg-muted text-muted-foreground border-border hover:bg-muted/80",
} as const;

// Helper to get query type tag
function getQueryTag(query: string): { label: string; className: string } {
  const normalizedQuery = query.trim().toUpperCase();
  if (normalizedQuery.startsWith("SELECT")) {
    return { label: "SEL", className: queryBadgeStyles.SELECT };
  } else if (normalizedQuery.startsWith("INSERT")) {
    return { label: "INS", className: queryBadgeStyles.INSERT };
  } else if (normalizedQuery.startsWith("UPDATE")) {
    return { label: "UPD", className: queryBadgeStyles.UPDATE };
  } else if (normalizedQuery.startsWith("DELETE")) {
    return { label: "DEL", className: queryBadgeStyles.DELETE };
  }
  return { label: "SQL", className: queryBadgeStyles.DEFAULT };
}

export const AppSidebar = memo(function AppSidebar({
  schema,
  availableSchemas,
  selectedSchema,
  onSchemaChange,
  history,
  savedQueries,
  collections,
  onTableClick,
  onColumnClick,
  onSelectQuery,
  onSelectSavedQuery,
  onDeleteQuery,
  onTogglePin,
  onClearHistory,
  onNewQuery,
  onNewCollection,
  onTableInsert,
  onTableUpdate,
  onTableDelete,
}: AppSidebarProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  const [gitSuccess, setGitSuccess] = useState<string | null>(null);

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  // Fetch git status on mount and poll every 10 seconds
  useEffect(() => {
    const fetchGitStatus = async () => {
      try {
        const status = await getGitStatus();
        setGitStatus(status);
      } catch (error) {
        console.error("Failed to fetch git status:", error);
      }
    };

    fetchGitStatus();
    const interval = setInterval(fetchGitStatus, GIT_STATUS_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Auto-clear git messages
  useEffect(() => {
    if (gitError || gitSuccess) {
      const timer = setTimeout(() => {
        setGitError(null);
        setGitSuccess(null);
      }, MESSAGE_AUTO_CLEAR_DELAY);
      return () => clearTimeout(timer);
    }
  }, [gitError, gitSuccess]);

  const savedQueryGroups = useMemo(() => {
    const groups = new Map<string, SavedQuery[]>();

    savedQueries.forEach((savedQuery) => {
      const collection = getRequestCollection(savedQuery);
      const entries = groups.get(collection) ?? [];
      entries.push(savedQuery);
      groups.set(collection, entries);
    });

    // Surface empty collections (created via "New Collection" but no queries
    // saved yet) so users see them in the tree immediately.
    collections.forEach((collection) => {
      if (!groups.has(collection)) {
        groups.set(collection, []);
      }
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([collection, queries]) => ({
        collection,
        queries: queries.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
      }));
  }, [savedQueries, collections]);

  return (
    <Sidebar>
      <SidebarContent>
        <ScrollArea className={`h-[calc(100vh-${SIDEBAR_FOOTER_HEIGHT}px)]`}>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Schema Selector */}
                {availableSchemas.length > 0 && (
                  <SidebarMenuItem className="mb-2">
                    <Select value={selectedSchema} onValueChange={onSchemaChange}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select schema" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSchemas.map((schema) => (
                          <SelectItem key={schema} value={schema} className="text-xs">
                            {schema}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SidebarMenuItem>
                )}

                {/* Tables Section */}
                <Collapsible defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <Database className="h-4 w-4" />
                        <span>Tables</span>
                        <span className="text-muted-foreground ml-auto text-xs">
                          {schema?.tables.length || 0}
                        </span>
                        <Plus className="ml-2 h-4 w-4 group-data-[state=open]/collapsible:hidden" />
                        <Minus className="ml-2 h-4 w-4 group-data-[state=closed]/collapsible:hidden" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {schema && schema.tables.length > 0 ? (
                          schema.tables.map((table) => (
                            <Collapsible
                              key={table.table_name}
                              open={expandedTables.has(table.table_name)}
                              onOpenChange={() => toggleTable(table.table_name)}
                              className="group/table"
                            >
                              <SidebarMenuSubItem>
                                <CollapsibleTrigger asChild>
                                  <SidebarMenuSubButton>
                                    <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]/table:rotate-90" />
                                    <span className="font-mono text-xs">{table.table_name}</span>
                                    <span className="text-muted-foreground ml-auto text-xs">
                                      {table.columns.length}
                                    </span>
                                  </SidebarMenuSubButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="mt-1 ml-6 space-y-1">
                                    {/* Quick Actions */}
                                    <div className="flex gap-1.5 px-2 py-1">
                                      <Kbd
                                        className={`pointer-events-auto h-5 cursor-pointer border px-1.5 py-0 text-[10px] transition-colors ${queryBadgeStyles.SELECT}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onTableClick(table.table_name);
                                        }}
                                      >
                                        SEL
                                      </Kbd>
                                      <Kbd
                                        className={`pointer-events-auto h-5 cursor-pointer border px-1.5 py-0 text-[10px] transition-colors ${queryBadgeStyles.INSERT}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onTableInsert?.(table.table_name);
                                        }}
                                      >
                                        INS
                                      </Kbd>
                                      <Kbd
                                        className={`pointer-events-auto h-5 cursor-pointer border px-1.5 py-0 text-[10px] transition-colors ${queryBadgeStyles.UPDATE}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onTableUpdate?.(table.table_name);
                                        }}
                                      >
                                        UPD
                                      </Kbd>
                                      <Kbd
                                        className={`pointer-events-auto h-5 cursor-pointer border px-1.5 py-0 text-[10px] transition-colors ${queryBadgeStyles.DELETE}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onTableDelete?.(table.table_name);
                                        }}
                                      >
                                        DEL
                                      </Kbd>
                                    </div>
                                    {/* Columns */}
                                    {table.columns.map((col) => (
                                      <div
                                        key={col.column_name}
                                        className="hover:bg-muted flex cursor-pointer items-center justify-between rounded px-2 py-1 text-xs"
                                        onClick={() =>
                                          onColumnClick(table.table_name, col.column_name)
                                        }
                                      >
                                        <span className="text-muted-foreground font-mono">
                                          {col.column_name}
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                          {col.data_type}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </SidebarMenuSubItem>
                            </Collapsible>
                          ))
                        ) : (
                          <div className="flex flex-col items-center gap-1 px-4 py-4 text-center">
                            <Database className="text-muted-foreground/40 h-4 w-4" />
                            <span className="text-muted-foreground text-[11px]">
                              Connect a database to browse tables
                            </span>
                          </div>
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>

                {/* Collections Section */}
                <Collapsible className="group/collapsible" defaultOpen>
                  <SidebarMenuItem>
                    <div className="flex items-center">
                      <CollapsibleTrigger asChild className="flex-1">
                        <SidebarMenuButton>
                          <BookmarkIcon className="h-4 w-4" />
                          <span>Collections</span>
                          <span className="text-muted-foreground ml-auto text-xs">
                            {savedQueries.length}
                          </span>
                          <ChevronRight className="ml-2 h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:bg-accent hover:text-foreground mr-1 flex h-6 w-6 items-center justify-center rounded"
                            title="Add"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onSelect={() => onNewQuery()}>
                            <FilePlus className="h-3.5 w-3.5" />
                            New query
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onNewCollection()}>
                            <FolderPlus className="h-3.5 w-3.5" />
                            New collection
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {savedQueryGroups.length === 0 ? (
                          <div className="flex flex-col items-center gap-1 px-4 py-4 text-center">
                            <BookmarkIcon className="text-muted-foreground/40 h-4 w-4" />
                            <span className="text-muted-foreground text-[11px]">
                              No collections yet
                            </span>
                            <span className="text-muted-foreground/70 text-[10px]">
                              Click <Plus className="inline h-2.5 w-2.5 align-text-bottom" /> above
                              to add one
                            </span>
                          </div>
                        ) : (
                          savedQueryGroups.map(({ collection, queries }) => (
                            <Collapsible
                              key={collection}
                              defaultOpen={collection === "General" || queries.length === 0}
                              className="group/collection"
                            >
                              <SidebarMenuSubItem>
                                <div className="group/collection-row flex items-center">
                                  <CollapsibleTrigger asChild className="flex-1">
                                    <SidebarMenuSubButton>
                                      <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]/collection:rotate-90" />
                                      <Folder className="text-muted-foreground h-3.5 w-3.5" />
                                      <span className="flex-1 truncate text-xs">{collection}</span>
                                      <span className="text-muted-foreground text-xs">
                                        {queries.length}
                                      </span>
                                    </SidebarMenuSubButton>
                                  </CollapsibleTrigger>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNewQuery(collection);
                                    }}
                                    className="text-muted-foreground hover:bg-accent hover:text-foreground mr-1 flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity group-hover/collection-row:opacity-100"
                                    title={`New query in ${collection}`}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                                <CollapsibleContent>
                                  <div className="mt-1 ml-4 space-y-1">
                                    {queries.length === 0 && (
                                      <div className="text-muted-foreground px-2 py-1 text-[10px]">
                                        Empty collection
                                      </div>
                                    )}
                                    {queries.map((savedQuery) => {
                                      const tag = getQueryTag(savedQuery.query);
                                      return (
                                        <SidebarMenuSubButton
                                          key={savedQuery.id}
                                          onClick={() => onSelectSavedQuery(savedQuery)}
                                          className="group/query flex gap-2"
                                        >
                                          <Kbd
                                            className={`h-4 px-1.5 py-0 text-[10px] ${tag.className} border`}
                                          >
                                            {tag.label}
                                          </Kbd>
                                          {savedQuery.is_pinned && (
                                            <Pin className="text-status-warning h-3 w-3 shrink-0" />
                                          )}
                                          <span className="min-w-0 flex-1 truncate text-xs">
                                            {savedQuery.name}
                                          </span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onTogglePin(savedQuery.id);
                                            }}
                                            className="opacity-0 transition-opacity group-hover/query:opacity-100"
                                            title={
                                              savedQuery.is_pinned ? "Unpin request" : "Pin request"
                                            }
                                          >
                                            <Pin className="h-3 w-3" />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onDeleteQuery(savedQuery.id);
                                            }}
                                            className="hover:text-status-error text-xs opacity-0 transition-opacity group-hover/query:opacity-100"
                                            title="Delete request"
                                          >
                                            ×
                                          </button>
                                        </SidebarMenuSubButton>
                                      );
                                    })}
                                  </div>
                                </CollapsibleContent>
                              </SidebarMenuSubItem>
                            </Collapsible>
                          ))
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>

                {/* History Section */}
                <Collapsible className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <HistoryIcon className="h-4 w-4" />
                        <span>History</span>
                        <span className="text-muted-foreground ml-auto text-xs">
                          {history.length}
                        </span>
                        <Plus className="ml-2 h-4 w-4 group-data-[state=open]/collapsible:hidden" />
                        <Minus className="ml-2 h-4 w-4 group-data-[state=closed]/collapsible:hidden" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {history.length === 0 ? (
                          <div className="flex flex-col items-center gap-1 px-4 py-4 text-center">
                            <HistoryIcon className="text-muted-foreground/40 h-4 w-4" />
                            <span className="text-muted-foreground text-[11px]">
                              No queries yet
                            </span>
                            <span className="text-muted-foreground/70 text-[10px]">
                              Run something and it'll show up here
                            </span>
                          </div>
                        ) : (
                          <>
                            {history.map((entry) => (
                              <SidebarMenuSubItem key={entry.id}>
                                <SidebarMenuSubButton
                                  onClick={() => onSelectQuery(entry.query)}
                                  className="flex gap-2"
                                >
                                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                                    {entry.query}
                                  </span>
                                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                                    {entry.execution_time_ms}ms
                                  </span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                onClick={onClearHistory}
                                className="text-status-error hover:text-status-error/80 text-xs"
                              >
                                Clear History
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          </>
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="border-t">
        {gitStatus && gitStatus.is_repo ? (
          <div className="space-y-2 px-3 py-3">
            <div className="flex items-center gap-2 text-sm">
              <GitBranch className="text-muted-foreground h-4 w-4" />
              <div className="flex-1">
                <div className="text-sm font-medium">{gitStatus.branch}</div>
                <div className="text-muted-foreground text-xs">
                  {gitStatus.staged + gitStatus.unstaged + gitStatus.untracked === 0
                    ? "No changes"
                    : `${gitStatus.staged + gitStatus.unstaged + gitStatus.untracked} changes`}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setGitError(null);
                  setGitSuccess(null);
                  setShowCommitModal(true);
                }}
                disabled={gitStatus.staged + gitStatus.unstaged + gitStatus.untracked === 0}
                className="h-7 flex-1 gap-1 text-xs"
                title="Commit changes"
              >
                <GitCommit className="h-3 w-3" />
                Commit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setGitError(null);
                  setGitSuccess(null);
                  try {
                    const message = await import("../../utils/tauri").then(({ gitPush }) =>
                      gitPush()
                    );
                    setGitSuccess(message);
                    const status = await getGitStatus();
                    setGitStatus(status);
                  } catch (error) {
                    setGitError(error instanceof Error ? error.message : String(error));
                  }
                }}
                className="h-7 flex-1 gap-1 text-xs"
                title="Push to remote"
              >
                <Upload className="h-3 w-3" />
                Push
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setGitError(null);
                  setGitSuccess(null);
                  try {
                    const message = await import("../../utils/tauri").then(({ gitPull }) =>
                      gitPull()
                    );
                    setGitSuccess(message);
                    const status = await getGitStatus();
                    setGitStatus(status);
                  } catch (error) {
                    setGitError(error instanceof Error ? error.message : String(error));
                  }
                }}
                className="h-7 flex-1 gap-1 text-xs"
                title="Pull from remote"
              >
                <Download className="h-3 w-3" />
                Pull
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 px-3 py-3">
            <div className="text-muted-foreground text-center text-xs">Not a git repository</div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setInitializing(true);
                setGitError(null);
                setGitSuccess(null);
                try {
                  const message = await gitInit();
                  setGitSuccess(message);
                  // Refresh git status after init
                  const status = await getGitStatus();
                  setGitStatus(status);
                } catch (error) {
                  setGitError(error instanceof Error ? error.message : String(error));
                } finally {
                  setInitializing(false);
                }
              }}
              disabled={initializing}
              className="h-8 w-full gap-2 text-xs"
              title="Initialize git repository"
            >
              <GitBranch className="h-3 w-3" />
              {initializing ? "Initializing..." : "Initialize Repository"}
            </Button>
          </div>
        )}
        {/* Git messages (error/success) */}
        {(gitError || gitSuccess) && (
          <div className="px-3 pb-3">
            {gitError && (
              <div className="bg-status-error/10 border-status-error/30 text-status-error rounded-md border p-2 text-xs">
                {gitError}
              </div>
            )}
            {gitSuccess && (
              <div className="bg-status-success/10 border-status-success/30 text-status-success rounded-md border p-2 text-xs">
                {gitSuccess}
              </div>
            )}
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />

      {/* Git Commit Modal */}
      <GitCommitModal
        isOpen={showCommitModal}
        onClose={() => setShowCommitModal(false)}
        gitStatus={gitStatus}
        onCommitSuccess={(newStatus, message) => {
          setGitStatus(newStatus);
          setGitSuccess(message);
          setShowCommitModal(false);
        }}
      />
    </Sidebar>
  );
});
