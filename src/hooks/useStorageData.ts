import { useState, useCallback } from "react";
import {
  loadConnections,
  saveConnections,
  getQueryHistory,
  saveQueryToHistory,
  clearQueryHistory,
  getSavedQueries,
  saveQuery,
  deleteSavedQuery,
  togglePinQuery,
  listCollections,
  createCollection,
  saveConnectionPassword,
  getConnectionPassword,
  deleteConnectionPassword,
} from "../utils/tauri";
import { DEFAULTS } from "../constants";
import type { ConnectionConfig, QueryHistoryEntry, SavedQuery } from "../types";

interface UseStorageDataReturn {
  // State
  connections: ConnectionConfig[];
  history: QueryHistoryEntry[];
  savedQueries: SavedQuery[];
  collections: string[];

  // Connection operations
  loadSavedConnections: () => Promise<void>;
  saveConnection: (connection: ConnectionConfig, existingConnections: ConnectionConfig[]) => Promise<void>;
  deleteConnection: (name: string) => Promise<void>;
  getPassword: (name: string) => Promise<string | null>;

  // History operations
  loadQueryHistory: () => Promise<void>;
  addToHistory: (query: string, connectionName: string, timeMs: number, rowCount: number) => Promise<void>;
  clearHistory: () => Promise<void>;

  // Saved queries operations
  loadSavedQueries: () => Promise<void>;
  saveNewQuery: (name: string, query: string, description: string | null) => Promise<void>;
  deleteQuery: (id: number) => Promise<void>;
  togglePin: (id: number) => Promise<void>;

  // Collection operations
  loadCollections: () => Promise<void>;
  addCollection: (name: string) => Promise<void>;

  // Bulk refresh
  refreshAll: () => Promise<void>;
}

export function useStorageData(): UseStorageDataReturn {
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [collections, setCollections] = useState<string[]>([]);

  // Connection operations
  const loadSavedConnections = useCallback(async () => {
    try {
      const saved = await loadConnections();
      setConnections(saved);
    } catch (error) {
      console.error("Failed to load connections:", error);
    }
  }, []);

  const saveConnection = useCallback(async (connection: ConnectionConfig, existingConnections: ConnectionConfig[]) => {
    // Save password to keychain if provided
    if (connection.password) {
      await saveConnectionPassword(connection.name, connection.password);
    }

    // Add or update connection in list
    const existing = existingConnections.find((c) => c.name === connection.name);
    let updated: ConnectionConfig[];

    if (existing) {
      updated = existingConnections.map((c) =>
        c.name === connection.name ? { ...connection, password: "" } : c
      );
    } else {
      updated = [...existingConnections, { ...connection, password: "" }];
    }

    await saveConnections(updated);
    setConnections(updated);
  }, []);

  const deleteConnection = useCallback(async (name: string) => {
    const updated = connections.filter((c) => c.name !== name);
    await deleteConnectionPassword(name);
    await saveConnections(updated);
    setConnections(updated);
  }, [connections]);

  const getPassword = useCallback(async (name: string): Promise<string | null> => {
    try {
      return await getConnectionPassword(name);
    } catch {
      return null;
    }
  }, []);

  // History operations
  const loadQueryHistory = useCallback(async () => {
    try {
      const hist = await getQueryHistory(DEFAULTS.HISTORY_LIMIT);
      setHistory(hist);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  }, []);

  const addToHistory = useCallback(async (
    query: string,
    connectionName: string,
    timeMs: number,
    rowCount: number
  ) => {
    await saveQueryToHistory(query, connectionName, timeMs, rowCount);
    await loadQueryHistory();
  }, [loadQueryHistory]);

  const clearHistory = useCallback(async () => {
    await clearQueryHistory();
    await loadQueryHistory();
  }, [loadQueryHistory]);

  // Saved queries / collections operations
  const loadSavedQueries = useCallback(async () => {
    try {
      const queries = await getSavedQueries();
      setSavedQueries(queries);
    } catch (error) {
      console.error("Failed to load saved queries:", error);
    }
  }, []);

  const loadCollections = useCallback(async () => {
    try {
      const list = await listCollections();
      setCollections(list);
    } catch (error) {
      console.error("Failed to load collections:", error);
    }
  }, []);

  const saveNewQuery = useCallback(
    async (name: string, query: string, description: string | null) => {
      await saveQuery(name, query, description);
      await Promise.all([loadSavedQueries(), loadCollections()]);
    },
    [loadSavedQueries, loadCollections]
  );

  const deleteQuery = useCallback(async (id: number) => {
    await deleteSavedQuery(id);
    await loadSavedQueries();
  }, [loadSavedQueries]);

  const togglePin = useCallback(async (id: number) => {
    await togglePinQuery(id);
    await loadSavedQueries();
  }, [loadSavedQueries]);

  const addCollection = useCallback(
    async (name: string) => {
      await createCollection(name);
      await loadCollections();
    },
    [loadCollections]
  );

  // Bulk refresh
  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadSavedConnections(),
      loadQueryHistory(),
      loadSavedQueries(),
      loadCollections(),
    ]);
  }, [loadSavedConnections, loadQueryHistory, loadSavedQueries, loadCollections]);

  return {
    connections,
    history,
    savedQueries,
    collections,
    loadSavedConnections,
    saveConnection,
    deleteConnection,
    getPassword,
    loadQueryHistory,
    addToHistory,
    clearHistory,
    loadSavedQueries,
    saveNewQuery,
    deleteQuery,
    togglePin,
    loadCollections,
    addCollection,
    refreshAll,
  };
}
