import { useEffect, useCallback, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { UI_LAYOUT, MACOS_TITLEBAR_LEFT_PADDING } from "./constants";
import { getAppDir, getConnectionPassword, setLastConnection } from "./utils/tauri";
import {
  useConnection,
  useQueryExecution,
  useModals,
  useLayoutPreferences,
  useStorageData,
  useProjectManagement,
  useRequestWorkspace,
} from "./hooks";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "./components/ui/sidebar";
import { AppSidebar } from "./components/layout/AppSidebar";
import { StatusBar } from "./components/layout/StatusBar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./components/ui/resizable";
import { Button } from "./components/ui/button";
import { Separator } from "./components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  Settings as SettingsIcon,
  Lock,
  Unlock,
  LayoutGrid,
  Command,
  Maximize,
  Minimize,
  Plus,
  Database,
  Folder,
  GitCompareArrows,
  RefreshCw,
} from "lucide-react";
import { SqlEditor } from "./components/editor/SqlEditor";
import { ResultsTableEnhanced } from "./components/results/ResultsTableEnhanced";
import { ErdDiagram } from "./components/erd/ErdDiagram";
import { RequestBar } from "./components/request/RequestBar";
import { SaveQueryModal, type SaveQueryInput } from "./components/modals/SaveQueryModal";
import { CommandPalette } from "./components/modals/CommandPalette";
import { ProjectSettings } from "./components/modals/ProjectSettings";
import { ConnectionModal } from "./components/modals/ConnectionModal";
import { Settings } from "./components/modals/Settings";
import { SchemaComparisonPage } from "./components/comparison/SchemaComparisonPage";
import type { SavedQuery } from "./types";
import {
  encodeRequestDescription,
  getQueryKind,
  getRequestCollection,
  isWriteQuery as checkIsWriteQuery,
  type QuerySafetyMode,
} from "./utils/queryRequest";

export default function App() {
  // Custom hooks
  const connection = useConnection();
  const queryExecution = useQueryExecution();
  const modals = useModals();
  const layout = useLayoutPreferences();
  const storage = useStorageData();
  const project = useProjectManagement();
  const requestWorkspace = useRequestWorkspace(
    project.currentProjectPath,
    queryExecution.query
  );

  // When the user clicks the "+" on a specific collection group, we preset
  // the save modal's collection field — otherwise the modal falls back to
  // the workspace's current collection.
  const [saveModalCollectionOverride, setSaveModalCollectionOverride] = useState<
    string | null
  >(null);

  const requestCollections = useMemo(() => {
    const collections = new Set(
      storage.savedQueries.map((savedQuery) => getRequestCollection(savedQuery))
    );
    storage.collections.forEach((c) => collections.add(c));
    collections.add(requestWorkspace.collection || "General");
    return Array.from(collections).sort((a, b) => a.localeCompare(b));
  }, [requestWorkspace.collection, storage.savedQueries, storage.collections]);

  const queryKind = useMemo(
    () => getQueryKind(queryExecution.query),
    [queryExecution.query]
  );

  const currentQueryIsWrite = useMemo(
    () => checkIsWriteQuery(queryExecution.query),
    [queryExecution.query]
  );

  // Initialize on mount
  useEffect(() => {
    async function initialize() {
      const hasAccess = await project.initializeProjectSettings();
      if (hasAccess) {
        // Only load data if we have access to the project directory
        await storage.loadSavedConnections();
        storage.loadQueryHistory().catch((err) => console.error("Failed to load query history:", err));
        storage.loadSavedQueries().catch((err) => console.error("Failed to load saved queries:", err));
        storage.loadCollections().catch((err) => console.error("Failed to load collections:", err));
        await connection.autoConnect();
      }
    }
    initialize();
  }, []);

  // Handle project reselection when access is lost (macOS sandbox)
  useEffect(() => {
    if (project.needsProjectReselection) {
      connection.setStatus("Please re-select your project directory to restore access");
      // Automatically open the directory picker
      import("@tauri-apps/plugin-dialog")
        .then(({ open }) => {
          return open({
            directory: true,
            multiple: false,
            title: "Re-select Project Directory (access was lost)",
            defaultPath: project.currentProjectPath || undefined,
          }).then(async (selected) => {
            if (selected) {
              await project.changeProject(selected);
              // Reload all data after re-selection
              await storage.loadSavedConnections();
              await storage.loadQueryHistory();
              await storage.loadSavedQueries();
              connection.setStatus("Project directory access restored");
            } else {
              // User cancelled - show message but don't keep prompting
              project.clearReselectionFlag();
              connection.setStatus("Project access not restored - using default location");
            }
          });
        })
        .catch((err) => {
          console.error("Failed to open directory picker:", err);
          project.clearReselectionFlag();
        });
    }
  }, [project.needsProjectReselection]);

  // Handlers
  const handleSaveQuery = useCallback(
    async (input: SaveQueryInput) => {
      try {
        const params = Object.fromEntries(
          requestWorkspace.params.map((param) => [param.name, param.value])
        );
        const description = encodeRequestDescription(input.description || null, {
          collection: input.collection || requestWorkspace.collection || "General",
          environmentId: requestWorkspace.activeEnvironmentId,
          safetyMode: input.safetyMode,
          maxRows: requestWorkspace.maxRows,
          connectionName: connection.config.name || null,
          params,
        });

        await storage.saveNewQuery(input.name, queryExecution.query, description);
        requestWorkspace.setRequestName(input.name);
        requestWorkspace.setCollection(input.collection || "General");
        requestWorkspace.setSafetyMode(input.safetyMode);
        connection.setStatus(`Request "${input.name}" saved successfully`);
        setSaveModalCollectionOverride(null);
        modals.closeModal("saveModal");
      } catch (error) {
        connection.setStatus(`Failed to save request: ${error}`);
      }
    },
    [connection, modals, queryExecution.query, requestWorkspace, storage]
  );

  const handleNewQuery = useCallback(
    (collection?: string) => {
      setSaveModalCollectionOverride(collection ?? null);
      modals.openModal("saveModal");
    },
    [modals]
  );

  // True when the workspace has a real, user-chosen name (not the default
  // placeholder and not empty). Used to skip the Save modal on Cmd+S.
  const hasNamedRequest = useMemo(() => {
    const name = requestWorkspace.requestName.trim();
    return name !== "" && name !== "Untitled request";
  }, [requestWorkspace.requestName]);

  // Direct save without opening the modal — reuses every field the modal
  // would have collected from the current workspace state.
  const saveCurrentRequest = useCallback(async () => {
    try {
      const name = requestWorkspace.requestName.trim();
      if (!name) {
        modals.openModal("saveModal");
        return;
      }
      const params = Object.fromEntries(
        requestWorkspace.params.map((param) => [param.name, param.value])
      );
      const description = encodeRequestDescription(null, {
        collection: requestWorkspace.collection || "General",
        environmentId: requestWorkspace.activeEnvironmentId,
        safetyMode: requestWorkspace.safetyMode,
        maxRows: requestWorkspace.maxRows,
        connectionName: connection.config.name || null,
        params,
      });
      await storage.saveNewQuery(name, queryExecution.query, description);
      connection.setStatus(`Saved "${name}"`);
    } catch (error) {
      connection.setStatus(`Failed to save: ${error}`);
    }
  }, [connection, modals, queryExecution.query, requestWorkspace, storage]);

  // Cmd+S entry point. Direct-saves a named request, prompts otherwise.
  const handleSaveShortcut = useCallback(() => {
    if (hasNamedRequest) {
      saveCurrentRequest();
    } else {
      modals.openModal("saveModal");
    }
  }, [hasNamedRequest, modals, saveCurrentRequest]);

  const handleNewCollection = useCallback(async () => {
    const name = window.prompt("New collection name?");
    if (!name) return;
    try {
      await storage.addCollection(name);
      connection.setStatus(`Collection "${name}" created`);
    } catch (error) {
      connection.setStatus(`Failed to create collection: ${error}`);
    }
  }, [storage, connection]);

  const handleDeleteSavedQuery = useCallback(
    async (id: number) => {
      try {
        await storage.deleteQuery(id);
        connection.setStatus("Query deleted");
      } catch (error) {
        connection.setStatus(`Failed to delete query: ${error}`);
      }
    },
    [storage, connection]
  );

  const handleTogglePin = useCallback(
    async (id: number) => {
      try {
        await storage.togglePin(id);
      } catch (error) {
        connection.setStatus(`Failed to toggle pin: ${error}`);
      }
    },
    [storage, connection]
  );

  const handleSaveConnection = useCallback(
    async (conn: import("./types").ConnectionConfig) => {
      try {
        await storage.saveConnection(conn, storage.connections);
        const connected = await connection.connect(conn);
        if (connected) {
          await setLastConnection(conn.name);
          layout.setReadOnlyMode(conn.readOnly || false);
          connection.setStatus(`Connection "${conn.name}" saved and connected`);
        }
        modals.closeModal("connectionModal");
      } catch (error) {
        connection.setStatus(`Failed to save connection: ${error}`);
      }
    },
    [storage, connection, layout, modals]
  );

  const handleDeleteConnection = useCallback(
    async (name: string) => {
      try {
        await storage.deleteConnection(name);
        connection.setStatus(`Connection "${name}" deleted`);
      } catch (error) {
        connection.setStatus(`Failed to delete connection: ${error}`);
      }
    },
    [storage, connection]
  );

  const handleEditConnection = useCallback(
    async (conn: import("./types").ConnectionConfig) => {
      try {
        const password = await getConnectionPassword(conn.name);
        modals.setEditingConnection({ ...conn, password: password || "" });
        modals.openModal("connectionModal");
      } catch (err) {
        console.error("Error retrieving password from keychain:", err);
        modals.setEditingConnection(conn);
        modals.openModal("connectionModal");
      }
    },
    [modals]
  );

  const executeQueryText = useCallback(async (
    sourceQuery: string,
    options?: {
      executableQuery?: string;
      environmentName?: string;
      safetyMode?: QuerySafetyMode;
    }
  ) => {
    const executableQuery =
      options?.executableQuery ?? requestWorkspace.buildExecutableQuery(sourceQuery);
    const safetyMode = options?.safetyMode ?? requestWorkspace.safetyMode;
    const safetyReadOnly = layout.readOnlyMode || safetyMode === "read_only";

    if (
      safetyMode === "confirm_writes" &&
      checkIsWriteQuery(executableQuery) &&
      !window.confirm("Run this write query against the selected connection?")
    ) {
      connection.setStatus("Write query cancelled");
      return;
    }

    const { status } = await queryExecution.runQuery(
      connection.config,
      connection.connectedRef,
      safetyReadOnly,
      async (result, executedQuery) => {
        await storage.addToHistory(
          executedQuery,
          connection.config.name,
          result.execution_time_ms,
          result.row_count
        );
      },
      {
        queryOverride: executableQuery,
        environmentName: options?.environmentName ?? requestWorkspace.activeEnvironment.name,
      }
    );
    connection.setStatus(status);
  }, [connection, layout.readOnlyMode, queryExecution, requestWorkspace, storage]);

  const runQuery = useCallback(async () => {
    await executeQueryText(queryExecution.query);
  }, [executeQueryText, queryExecution.query]);

  // Keyboard shortcuts (must be after runQuery is defined)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModalOpen = modals.isAnyModalOpen();

      // Cmd+W: Close active modal (works even when modal is open)
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        if (modals.closeActiveModal()) {
          e.preventDefault();
          return;
        }
        // If no modal was closed, let the default behavior happen
      }

      // Cmd+H: Hide app (standard macOS behavior)
      if ((e.metaKey || e.ctrlKey) && e.key === "h" && !e.shiftKey) {
        e.preventDefault();
        getCurrentWindow().hide();
        return;
      }

      // Block most shortcuts when a modal is open
      if (isModalOpen) {
        return;
      }

      // Cmd+K: Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        modals.toggleModal("commandPalette");
      }
      // Cmd+,: Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        modals.toggleModal("settings");
      }
      // Cmd+Shift+F: Toggle full-screen results
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        layout.toggleFullScreenResults();
      }
      // Cmd+Enter: Run query (global - works even outside editor)
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        runQuery();
      }
      // Cmd+S: Save query (direct-save if named, otherwise prompt)
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSaveShortcut();
      }
      // Cmd+N: New connection
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        modals.setEditingConnection(null);
        modals.openModal("connectionModal");
      }
      // Cmd+Shift+C: Connection picker (quick switch)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "C") {
        e.preventDefault();
        // Focus the connection dropdown - for now, just open command palette
        // which has connection switching capabilities
        modals.openModal("commandPalette");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modals, layout, runQuery, handleSaveShortcut]);

  // Listen for menu events from macOS menubar
  useEffect(() => {
    const listeners = [
      listen("reveal-project-directory", async () => {
        const path = project.currentProjectPath || `${await getAppDir()}/.query`;
        await revealItemInDir(path);
      }),
      listen("menu-new-connection", () => {
        modals.setEditingConnection(null);
        modals.openModal("connectionModal");
      }),
      listen("menu-save-query", () => handleSaveShortcut()),
      listen("menu-command-palette", () => modals.toggleModal("commandPalette")),
      listen("menu-toggle-sidebar", () => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "b",
            metaKey: true,
            bubbles: true,
          })
        );
      }),
      listen("menu-toggle-fullscreen", () => layout.toggleFullScreenResults()),
      listen("menu-settings", () => modals.toggleModal("settings")),
      listen("menu-run-query", () => runQuery()),
      listen("menu-connection-picker", () => modals.openModal("commandPalette")),
      listen("menu-close-modal", () => modals.closeActiveModal()),
    ];

    return () => {
      listeners.forEach((unlisten) => unlisten.then((fn) => fn()));
    };
  }, [project.currentProjectPath, modals, layout, runQuery, handleSaveShortcut]);

  const handleProjectPathChanged = useCallback(async () => {
    await project.loadCurrentProjectPath();
    await storage.loadSavedConnections();
    await storage.loadQueryHistory();
    await storage.loadSavedQueries();
    connection.setStatus("Project location changed - data reloaded");
  }, [project, storage, connection]);

  const handleClearHistory = useCallback(async () => {
    try {
      await storage.clearHistory();
      connection.setStatus("History cleared");
    } catch (error) {
      connection.setStatus(`Failed to clear history: ${error}`);
    }
  }, [storage, connection]);

  const handleConnectionChange = useCallback(
    async (value: string) => {
      if (value === "__new__") {
        modals.openModal("connectionModal");
        return;
      }

      await connection.switchConnection(value, storage.connections);
      const conn = storage.connections.find((c) => c.name === value);
      if (conn) {
        layout.setReadOnlyMode(conn.readOnly || false);
      }
    },
    [connection, storage.connections, modals, layout]
  );

  const handleReconnect = useCallback(async () => {
    const activeConnection = await connection.reconnect(storage.connections);

    if (activeConnection) {
      layout.setReadOnlyMode(activeConnection.readOnly || false);
    }
  }, [connection, layout, storage.connections]);

  const handleProjectChange = useCallback(
    async (path: string) => {
      try {
        await project.changeProject(path);
        await storage.refreshAll();
        connection.disconnect();
        queryExecution.setResult(null);
        connection.setStatus(`Switched to project: ${path}`);
      } catch (error) {
        connection.setStatus(`Failed to switch project: ${error}`);
        console.error("Failed to switch project:", error);
      }
    },
    [project, storage, connection, queryExecution]
  );

  const handleSelectSavedQuery = useCallback(
    (savedQuery: SavedQuery) => {
      requestWorkspace.loadSavedRequest(savedQuery);
      queryExecution.setQuery(savedQuery.query);
      connection.setStatus(`Loaded request "${savedQuery.name}"`);
    },
    [connection, queryExecution, requestWorkspace]
  );

  const handleInsertFromPalette = useCallback(
    (q: string) => {
      queryExecution.setQuery(q);
      modals.closeModal("commandPalette");
    },
    [modals, queryExecution]
  );

  const handleInsertSavedFromPalette = useCallback(
    (savedQuery: SavedQuery) => {
      handleSelectSavedQuery(savedQuery);
      modals.closeModal("commandPalette");
    },
    [handleSelectSavedQuery, modals]
  );

  // Render full-page schema comparison if active
  if (modals.modals.schemaComparison) {
    return (
      <SchemaComparisonPage
        connections={storage.connections}
        onClose={() => modals.closeModal("schemaComparison")}
      />
    );
  }

  return (
    <SidebarProvider>
      <div className="flex flex-col h-screen w-full">
        {/* Full-width Header */}
        <header
          data-tauri-drag-region
          className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-card px-3 z-20"
          style={{ paddingLeft: `${MACOS_TITLEBAR_LEFT_PADDING}px` }}
        >
          {/* Sidebar toggle */}
          <div data-tauri-drag-region="false">
            <SidebarTrigger />
          </div>
          <Separator orientation="vertical" className="h-5" />

          {/* Environment/Connection Dropdown */}
          <div data-tauri-drag-region="false" className="min-w-[180px]">
            <Select value={connection.config.name} onValueChange={handleConnectionChange}>
              <SelectTrigger className="h-7 border-none shadow-none text-sm font-medium hover:bg-accent transition-colors">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-2 w-2 rounded-full ${
                      connection.connected ? "bg-status-success" : "bg-muted-foreground/50"
                    }`}
                  />
                  <SelectValue placeholder="No connection" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {storage.connections.map((conn) => (
                  <SelectItem key={conn.name} value={conn.name}>
                    {conn.name}
                  </SelectItem>
                ))}
                <SelectItem value="__new__">
                  <div className="flex items-center gap-2">
                    <Plus className="h-3 w-3" />
                    <span>New Connection</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div data-tauri-drag-region="false">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReconnect}
              disabled={connection.loading}
              title={connection.connected ? "Reconnect" : "Connect to last saved connection"}
              className="h-7 w-7"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${connection.loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Project Selector Dropdown */}
          <div data-tauri-drag-region="false" className="min-w-[150px]">
            <Select
              value={project.currentProjectPath || "default"}
              onValueChange={(value) => {
                if (value === "__browse__") {
                  import("@tauri-apps/plugin-dialog")
                    .then(({ open }) => {
                      return open({
                        directory: true,
                        multiple: false,
                        title: "Select Project Directory",
                      }).then((selected) => {
                        if (selected) {
                          handleProjectChange(selected);
                        }
                      });
                    })
                    .catch((err) => {
                      console.error("Failed to open file dialog:", err);
                      connection.setStatus("Failed to open file dialog");
                    });
                } else if (value !== "default") {
                  handleProjectChange(value);
                }
              }}
            >
              <SelectTrigger className="h-7 border-none shadow-none text-sm hover:bg-accent">
                <div className="flex items-center gap-2">
                  <Folder className="h-3 w-3 text-muted-foreground" />
                  <SelectValue placeholder="Project" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {project.recentProjects.length > 0 ? (
                  project.recentProjects.map((proj) => (
                    <SelectItem key={proj.path} value={proj.path}>
                      {proj.name || proj.path.split("/").pop() || "Project"}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="default" disabled>
                    <span className="text-xs text-muted-foreground">No recent projects</span>
                  </SelectItem>
                )}
                <SelectItem value="__browse__">
                  <div className="flex items-center gap-2">
                    <Folder className="h-3 w-3" />
                    <span>Browse...</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Read-only mode toggle */}
          <div data-tauri-drag-region="false">
            <Button
              variant={layout.readOnlyMode ? "default" : "ghost"}
              size="sm"
              onClick={() => layout.setReadOnlyMode(!layout.readOnlyMode)}
              title={
                layout.readOnlyMode ? "Read-only mode active" : "Enable read-only mode"
              }
              className="h-7 gap-1.5"
            >
              {layout.readOnlyMode ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Unlock className="h-3 w-3" />
              )}
              <span className="text-xs">Read-only</span>
            </Button>
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-1.5" data-tauri-drag-region="false">
            <Button
              variant="ghost"
              size="icon"
              onClick={layout.toggleLayoutDirection}
              title={`Switch to ${layout.layoutDirection === "vertical" ? "horizontal" : "vertical"} layout`}
              className="h-7 w-7"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={modals.modals.erd ? "default" : "ghost"}
              size="icon"
              onClick={() => modals.toggleModal("erd")}
              title="Toggle ERD (Entity Relationship Diagram)"
              className="h-7 w-7"
            >
              <Database className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => modals.openModal("commandPalette")}
              className="h-7 gap-1.5"
            >
              <Command className="h-3 w-3" />
              <span className="text-xs font-mono">K</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => modals.openModal("schemaComparison")}
              className="h-7 w-7"
              title="Compare Schemas"
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => modals.openModal("settings")}
              className="h-7 w-7"
              title="Settings (Cmd+,)"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        {/* Main area with sidebar and content */}
        <div className="flex flex-1 min-h-0">
          <AppSidebar
            schema={connection.schema}
            availableSchemas={connection.availableSchemas}
            selectedSchema={connection.selectedSchema}
            onSchemaChange={connection.switchSchema}
            history={storage.history}
            savedQueries={storage.savedQueries}
            collections={storage.collections}
            onTableClick={queryExecution.handleTableClick}
            onColumnClick={queryExecution.handleColumnClick}
            onSelectQuery={queryExecution.setQuery}
            onSelectSavedQuery={handleSelectSavedQuery}
            onDeleteQuery={handleDeleteSavedQuery}
            onTogglePin={handleTogglePin}
            onClearHistory={handleClearHistory}
            onNewQuery={handleNewQuery}
            onNewCollection={handleNewCollection}
            onTableInsert={queryExecution.handleTableInsert}
            onTableUpdate={queryExecution.handleTableUpdate}
            onTableDelete={queryExecution.handleTableDelete}
          />

          <SidebarInset className="flex flex-1 flex-col min-h-0">
            {/* Main Content with Resizable Panels */}
          <div className="flex-1 overflow-hidden">
            <ResizablePanelGroup direction={layout.layoutDirection}>
              {/* SQL Editor Panel - Hidden in full-screen mode */}
              {!layout.fullScreenResults && (
                <>
                  <ResizablePanel defaultSize={UI_LAYOUT.DEFAULT_PANEL_SIZE} minSize={UI_LAYOUT.MIN_PANEL_SIZE}>
                    <div className="flex h-full flex-col min-h-0">
                      <RequestBar
                        requestName={requestWorkspace.requestName}
                        collection={requestWorkspace.collection}
                        collections={requestCollections}
                        queryKind={queryKind}
                        isWriteQuery={currentQueryIsWrite}
                        environments={requestWorkspace.environments}
                        activeEnvironmentId={requestWorkspace.activeEnvironmentId}
                        safetyMode={requestWorkspace.safetyMode}
                        maxRows={requestWorkspace.maxRows}
                        vimMode={layout.vimMode}
                        isRunning={queryExecution.loading}
                        isConnectionLoading={connection.loading}
                        onRequestNameChange={requestWorkspace.setRequestName}
                        onCollectionChange={requestWorkspace.setCollection}
                        onEnvironmentChange={requestWorkspace.setActiveEnvironmentId}
                        onSafetyModeChange={requestWorkspace.setSafetyMode}
                        onMaxRowsChange={requestWorkspace.setMaxRows}
                        onVimModeChange={layout.setVimMode}
                        onSave={handleSaveShortcut}
                        onRun={runQuery}
                      />
                      <div className="flex-1">
                        <SqlEditor
                          value={queryExecution.query}
                          onChange={queryExecution.setQuery}
                          onRunQuery={runQuery}
                          schema={connection.schema}
                          onEditorReady={(insertAt, insertSnip) => {
                            queryExecution.setInsertAtCursor(insertAt);
                            queryExecution.setInsertSnippet(insertSnip);
                          }}
                          vimMode={layout.vimMode}
                          onToggleCommandPalette={() => modals.toggleModal("commandPalette")}
                        />
                      </div>
                      <StatusBar
                        status={connection.status}
                        onClear={() => connection.setStatus("")}
                        connected={connection.connected}
                        connectionName={connection.config.name}
                      />
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle />
                </>
              )}

              {/* Results Panel */}
              <ResizablePanel defaultSize={layout.fullScreenResults ? 100 : UI_LAYOUT.DEFAULT_PANEL_SIZE} minSize={UI_LAYOUT.MIN_PANEL_SIZE}>
                <div className="flex h-full flex-col min-h-0">
                  <div className="flex h-10 items-center justify-between gap-3 border-b border-border/50 bg-muted/30 px-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {modals.modals.erd ? "ERD" : "Results"}
                      </h3>
                      {queryExecution.lastExecution && !modals.modals.erd && (
                        <>
                          <span
                            className={`inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${
                              queryExecution.lastExecution.status === "success"
                                ? "bg-emerald-500"
                                : "bg-rose-500"
                            }`}
                          />
                          {queryExecution.result && (
                            <div className="flex items-center gap-3 text-xs">
                              <span className="font-mono font-medium">
                                {queryExecution.result.row_count.toLocaleString()}
                                <span className="ml-1 text-muted-foreground">
                                  row{queryExecution.result.row_count === 1 ? "" : "s"}
                                </span>
                              </span>
                              <span className="font-mono text-muted-foreground">
                                {queryExecution.result.execution_time_ms}ms
                              </span>
                            </div>
                          )}
                          <span className="truncate text-xs text-muted-foreground">
                            {queryExecution.lastExecution.connectionName}
                            {queryExecution.lastExecution.environmentName
                              ? ` / ${queryExecution.lastExecution.environmentName}`
                              : ""}
                          </span>
                        </>
                      )}
                    </div>
                    {queryExecution.result && !modals.modals.erd && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => layout.setCompactView(!layout.compactView)}
                          title="Toggle compact view"
                          className={`h-7 text-xs ${layout.compactView ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          Compact
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={queryExecution.exportToCSV}
                          title="Export as CSV"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <span className="text-[10px] font-medium">CSV</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={queryExecution.exportToJSON}
                          title="Export as JSON"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <span className="text-[10px] font-medium">JSON</span>
                        </Button>
                        <div className="mx-1 h-4 w-px bg-border" />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={layout.toggleFullScreenResults}
                          title="Toggle full-screen results (⌘⇧F)"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          {layout.fullScreenResults ? (
                            <Minimize className="h-3.5 w-3.5" />
                          ) : (
                            <Maximize className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  {modals.modals.erd ? (
                    <ErdDiagram schema={connection.schema} />
                  ) : (
                    <ResultsTableEnhanced
                      result={queryExecution.result}
                      compact={layout.compactView}
                      config={connection.config}
                      schema={connection.schema}
                      originalQuery={queryExecution.query}
                      onRefresh={runQuery}
                      isLoading={queryExecution.loading}
                    />
                  )}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </SidebarInset>
      </div>
      </div>

      {/* Modals */}
      <SaveQueryModal
        isOpen={modals.modals.saveModal}
        onClose={() => {
          modals.closeModal("saveModal");
          setSaveModalCollectionOverride(null);
        }}
        onSave={handleSaveQuery}
        currentQuery={queryExecution.query}
        initialName={requestWorkspace.requestName}
        initialCollection={saveModalCollectionOverride ?? requestWorkspace.collection}
        initialSafetyMode={requestWorkspace.safetyMode}
        collections={requestCollections}
      />

      <CommandPalette
        isOpen={modals.modals.commandPalette}
        onClose={() => modals.closeModal("commandPalette")}
        schema={connection.schema}
        history={storage.history}
        savedQueries={storage.savedQueries}
        onInsertQuery={handleInsertFromPalette}
        onInsertSavedQuery={handleInsertSavedFromPalette}
      />

      <Settings
        isOpen={modals.modals.settings}
        onClose={() => modals.closeModal("settings")}
        currentProjectPath={project.currentProjectPath}
        onProjectPathChange={handleProjectPathChanged}
        vimMode={layout.vimMode}
        onVimModeChange={(enabled) => layout.setVimMode(enabled)}
        compactView={layout.compactView}
        onCompactViewChange={layout.setCompactView}
        layoutDirection={layout.layoutDirection}
        onLayoutDirectionChange={layout.setLayoutDirection}
        connections={storage.connections}
        onDeleteConnection={handleDeleteConnection}
        onEditConnection={handleEditConnection}
        onNewConnection={() => {
          modals.setEditingConnection(null);
          modals.openModal("connectionModal");
        }}
        environments={requestWorkspace.environments}
        activeEnvironmentId={requestWorkspace.activeEnvironmentId}
        activeVariables={requestWorkspace.activeVariables}
        params={requestWorkspace.params}
        onEnvironmentChange={requestWorkspace.setActiveEnvironmentId}
        onAddEnvironment={requestWorkspace.addEnvironment}
        onVariableChange={requestWorkspace.setEnvironmentVariable}
        onVariableRename={requestWorkspace.renameEnvironmentVariable}
        onAddVariable={requestWorkspace.addEnvironmentVariable}
        onParamValueChange={requestWorkspace.setParamValue}
        onParamEnabledChange={requestWorkspace.setParamEnabled}
      />

      <ProjectSettings
        isOpen={modals.modals.projectPicker}
        onClose={() => modals.closeModal("projectPicker")}
        onPathChanged={handleProjectPathChanged}
        currentPath={project.currentProjectPath}
      />

      <ConnectionModal
        isOpen={modals.modals.connectionModal}
        onClose={() => modals.closeModal("connectionModal")}
        onSave={handleSaveConnection}
        initialConnection={modals.editingConnection}
      />
    </SidebarProvider>
  );
}
