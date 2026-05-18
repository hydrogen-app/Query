import { memo, useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import {
  Edit3,
  Trash2,
  Folder,
  FolderOpen,
  Plus,
} from "lucide-react";
import type { ConnectionConfig, RecentProject } from "../../types";
import type { RequestEnvironment } from "../../hooks";
import type { QueryParameter } from "../../utils/queryRequest";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  // General settings
  currentProjectPath: string | null;
  onProjectPathChange: () => Promise<void>;
  // Editor settings
  vimMode: boolean;
  onVimModeChange: (enabled: boolean) => void;
  // Display settings
  compactView: boolean;
  onCompactViewChange: (enabled: boolean) => void;
  layoutDirection: "vertical" | "horizontal";
  onLayoutDirectionChange: (direction: "vertical" | "horizontal") => void;
  // Connection settings
  connections: ConnectionConfig[];
  onDeleteConnection: (name: string) => Promise<void>;
  onEditConnection: (connection: ConnectionConfig) => void;
  onNewConnection: () => void;
  // Environment settings
  environments: RequestEnvironment[];
  activeEnvironmentId: string;
  activeVariables: Record<string, string>;
  params: QueryParameter[];
  onEnvironmentChange: (id: string) => void;
  onAddEnvironment: () => void;
  onVariableChange: (name: string, value: string) => void;
  onVariableRename: (oldName: string, newName: string) => void;
  onAddVariable: () => void;
  onParamValueChange: (name: string, value: string) => void;
  onParamEnabledChange: (name: string, enabled: boolean) => void;
}

export const Settings = memo(function Settings({
  isOpen,
  onClose,
  currentProjectPath,
  onProjectPathChange,
  vimMode,
  onVimModeChange,
  compactView,
  onCompactViewChange,
  layoutDirection,
  onLayoutDirectionChange,
  connections,
  onDeleteConnection,
  onEditConnection,
  onNewConnection,
  environments,
  activeEnvironmentId,
  activeVariables,
  params,
  onEnvironmentChange,
  onAddEnvironment,
  onVariableChange,
  onVariableRename,
  onAddVariable,
  onParamValueChange,
  onParamEnabledChange,
}: SettingsProps) {
  const variableEntries = Object.entries(activeVariables).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const [isChangingPath, setIsChangingPath] = useState(false);
  const [autoConnectEnabled, setAutoConnectEnabled] = useState(false);
  const [lastConnectionName, setLastConnectionName] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  // Load auto-connect settings and recent projects when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAutoConnectSettings();
      loadRecentProjects();
    }
  }, [isOpen]);

  const loadRecentProjects = useCallback(async () => {
    try {
      const projects = await invoke<RecentProject[]>("get_recent_projects");
      setRecentProjects(projects);
    } catch (error) {
      console.error("Failed to load recent projects:", error);
    }
  }, []);

  const loadAutoConnectSettings = useCallback(async () => {
    try {
      const enabled = await invoke<boolean>("get_auto_connect_enabled");
      const lastConn = await invoke<string | null>("get_last_connection");
      setAutoConnectEnabled(enabled);
      setLastConnectionName(lastConn);
    } catch (error) {
      console.error("Failed to load auto-connect settings:", error);
    }
  }, []);

  const handleAutoConnectToggle = useCallback(async (enabled: boolean) => {
    try {
      await invoke("set_auto_connect_enabled", { enabled });
      setAutoConnectEnabled(enabled);
    } catch (error) {
      console.error("Failed to set auto-connect:", error);
    }
  }, []);

  const handleChangeProjectPath = useCallback(async () => {
    setIsChangingPath(true);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Directory",
      });

      if (selected) {
        await invoke("set_project_path", { path: selected });
        await onProjectPathChange();
      }
    } catch (error) {
      console.error("Failed to change project path:", error);
    } finally {
      setIsChangingPath(false);
    }
  }, [onProjectPathChange]);

  const handleRevealProjectDirectory = useCallback(async () => {
    try {
      const path = currentProjectPath || `${await invoke<string>("get_app_dir")}/.query`;
      await revealItemInDir(path);
    } catch (error) {
      console.error("Failed to reveal project directory:", error);
    }
  }, [currentProjectPath]);

  const handleRemoveRecentProject = useCallback(async (path: string) => {
    try {
      await invoke("remove_recent_project", { path });
      await loadRecentProjects();
    } catch (error) {
      console.error("Failed to remove recent project:", error);
    }
  }, [loadRecentProjects]);

  const handleSwitchProject = useCallback(async (path: string) => {
    try {
      await invoke("set_project_path", { path });
      await onProjectPathChange();
      await loadRecentProjects();
    } catch (error) {
      console.error("Failed to switch project:", error);
    }
  }, [onProjectPathChange, loadRecentProjects]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Settings
          </DialogTitle>
          <DialogDescription>
            Manage your Query application preferences and connections
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general" className="gap-2">
              General
            </TabsTrigger>
            <TabsTrigger value="editor" className="gap-2">
              Editor
            </TabsTrigger>
            <TabsTrigger value="display" className="gap-2">
              Display
            </TabsTrigger>
            <TabsTrigger value="environments" className="gap-2">
              Environments
            </TabsTrigger>
            <TabsTrigger value="connections" className="gap-2">
              Connections
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[450px] mt-4">
            {/* General Tab */}
            <TabsContent value="general" className="space-y-6 px-1">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Project Location</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={currentProjectPath || "~/.query (default)"}
                          readOnly
                          className="flex-1 font-mono text-xs"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRevealProjectDirectory}
                          title="Reveal in Finder"
                        >
                          <FolderOpen className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleChangeProjectPath}
                          disabled={isChangingPath}
                        >
                          {isChangingPath ? "Changing..." : "Change"}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      All connections, queries, and history are stored in this directory
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Recent Projects */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Recent Projects</h3>
                  <div className="space-y-2">
                    {recentProjects.length > 0 ? (
                      recentProjects.map((project) => (
                        <div
                          key={project.path}
                          className="flex items-center gap-2 p-2 rounded-md border"
                        >
                          <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              {project.name || project.path.split("/").pop() || "Project"}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {project.path}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(project.last_accessed).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSwitchProject(project.path)}
                              disabled={project.path === currentProjectPath}
                              title="Switch to this project"
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRecentProject(project.path)}
                              title="Remove from recent"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No recent projects yet
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium mb-3">Startup Behavior</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="auto-connect">Auto-connect to last connection</Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically connect when opening the app
                          {lastConnectionName && ` (${lastConnectionName})`}
                        </p>
                      </div>
                      <Switch
                        id="auto-connect"
                        checked={autoConnectEnabled}
                        onCheckedChange={handleAutoConnectToggle}
                      />
                    </div>
                    {!lastConnectionName && (
                      <p className="text-xs text-muted-foreground">
                        Connect to a database first to enable auto-connect
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Editor Tab */}
            <TabsContent value="editor" className="space-y-6 px-1">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Editor Preferences</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="vim-mode">Vim Mode</Label>
                        <p className="text-xs text-muted-foreground">
                          Enable Vim keybindings in the SQL editor
                        </p>
                      </div>
                      <Switch
                        id="vim-mode"
                        checked={vimMode}
                        onCheckedChange={onVimModeChange}
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="theme">Theme</Label>
                        <p className="text-xs text-muted-foreground">
                          Editor color scheme
                        </p>
                      </div>
                      <Badge variant="secondary">Dark (default)</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Display Tab */}
            <TabsContent value="display" className="space-y-6 px-1">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Layout</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="layout-direction">Layout Direction</Label>
                        <p className="text-xs text-muted-foreground">
                          How the editor and results are arranged
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={layoutDirection === "vertical" ? "default" : "outline"}
                          size="sm"
                          onClick={() => onLayoutDirectionChange("vertical")}
                        >
                          Vertical
                        </Button>
                        <Button
                          variant={layoutDirection === "horizontal" ? "default" : "outline"}
                          size="sm"
                          onClick={() => onLayoutDirectionChange("horizontal")}
                        >
                          Horizontal
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="compact-view">Compact View</Label>
                        <p className="text-xs text-muted-foreground">
                          Show results in a more dense format
                        </p>
                      </div>
                      <Switch
                        id="compact-view"
                        checked={compactView}
                        onCheckedChange={onCompactViewChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Environments Tab */}
            <TabsContent value="environments" className="space-y-6 px-1">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium">Active Environment</h3>
                    <Button variant="outline" size="sm" onClick={onAddEnvironment} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Add Environment
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {environments.map((environment) => (
                      <Button
                        key={environment.id}
                        variant={environment.id === activeEnvironmentId ? "default" : "outline"}
                        size="sm"
                        onClick={() => onEnvironmentChange(environment.id)}
                      >
                        {environment.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-medium">Variables</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Reusable values for the selected environment
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={onAddVariable} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Add Variable
                    </Button>
                  </div>
                  {variableEntries.length > 0 ? (
                    <div className="space-y-2">
                      {variableEntries.map(([name, value]) => (
                        <div
                          key={name}
                          className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
                        >
                          <Input
                            defaultValue={name}
                            onBlur={(event) => onVariableRename(name, event.target.value)}
                            className="h-7 w-40 font-mono text-xs"
                          />
                          <Input
                            value={value}
                            onChange={(event) => onVariableChange(name, event.target.value)}
                            className="h-7 flex-1 text-xs"
                            placeholder="value"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                      No variables in this environment
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium mb-1">Query Params</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Template variables extracted from the current query
                  </p>
                  {params.length > 0 ? (
                    <div className="space-y-2">
                      {params.map((param) => (
                        <div
                          key={param.name}
                          className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
                        >
                          <Checkbox
                            checked={param.enabled}
                            onCheckedChange={(checked) =>
                              onParamEnabledChange(param.name, checked === true)
                            }
                          />
                          <span className="w-40 truncate font-mono text-xs text-muted-foreground">
                            {param.name}
                          </span>
                          <Input
                            value={param.value}
                            onChange={(event) => onParamValueChange(param.name, event.target.value)}
                            className="h-7 flex-1 text-xs"
                            placeholder="value"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                      No template params in the current query
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Connections Tab */}
            <TabsContent value="connections" className="space-y-6 px-1">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Saved Connections</h3>
                  <Button variant="default" size="sm" onClick={onNewConnection}>
                    New Connection
                  </Button>
                </div>

                <div className="space-y-2">
                  {connections.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No saved connections
                    </div>
                  ) : (
                    connections.map((conn) => (
                      <div
                        key={conn.name}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{conn.name}</p>
                            {conn.readOnly && (
                              <Badge variant="secondary" className="text-xs">
                                Read-only
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {conn.database}@{conn.host}:{conn.port} ({conn.username})
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditConnection(conn)}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteConnection(conn.name)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border">⌘,</kbd> to open settings
          </p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
