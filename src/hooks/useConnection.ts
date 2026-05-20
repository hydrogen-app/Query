import { useState, useCallback, useRef } from "react";
import {
  testPostgresConnection,
  getDatabaseSchema,
  getDatabaseSchemas,
  getConnectionPassword,
  setLastConnection,
  getAutoConnectEnabled,
  getLastConnection,
  loadConnections,
} from "../utils/tauri";
import { DEFAULT_CONNECTION } from "../constants";
import type { ConnectionConfig, DatabaseSchema } from "../types";

interface UseConnectionReturn {
  // State
  config: ConnectionConfig;
  setConfig: (config: ConnectionConfig) => void;
  connected: boolean;
  connectedRef: React.MutableRefObject<boolean>;
  schema: DatabaseSchema | null;
  availableSchemas: string[];
  selectedSchema: string;
  loading: boolean;
  status: string;
  setStatus: (status: string) => void;

  // Operations
  connect: (connection: ConnectionConfig) => Promise<boolean>;
  reconnect: (connections?: ConnectionConfig[]) => Promise<ConnectionConfig | null>;
  disconnect: () => void;
  switchConnection: (connectionName: string, connections: ConnectionConfig[]) => Promise<void>;
  switchSchema: (schemaName: string) => Promise<void>;
  autoConnect: () => Promise<void>;
  clearSchema: () => void;
}

export function useConnection(): UseConnectionReturn {
  const [config, setConfig] = useState<ConnectionConfig>(DEFAULT_CONNECTION);
  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState("public");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const connect = useCallback(async (connection: ConnectionConfig): Promise<boolean> => {
    setLoading(true);
    setStatus("");

    try {
      const result = await testPostgresConnection(connection);
      setStatus(result);
      setConnected(true);
      connectedRef.current = true;
      setConfig(connection);

      // Load available schemas
      const schemas = await getDatabaseSchemas(connection);
      setAvailableSchemas(schemas);

      // Load default schema
      const dbSchema = await getDatabaseSchema(connection, "public");
      setSchema(dbSchema);
      setSelectedSchema("public");

      return true;
    } catch (error) {
      setStatus(`Connection failed: ${error}`);
      setConnected(false);
      connectedRef.current = false;
      setSchema(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const connectSavedConnection = useCallback(async (
    connection: ConnectionConfig
  ): Promise<boolean> => {
    const password = await getConnectionPassword(connection.name);
    const connWithPassword = { ...connection, password: password || connection.password || "" };
    const success = await connect(connWithPassword);

    if (success) {
      await setLastConnection(connection.name);
    }

    return success;
  }, [connect]);

  const reconnect = useCallback(async (
    connections: ConnectionConfig[] = []
  ): Promise<ConnectionConfig | null> => {
    try {
      const savedConnections = connections.length > 0 ? connections : await loadConnections();
      const lastConnectionName = await getLastConnection();
      const currentConnection = savedConnections.find((conn) => conn.name === config.name);
      const lastConnection = lastConnectionName
        ? savedConnections.find((conn) => conn.name === lastConnectionName)
        : null;
      const singleConnection = savedConnections.length === 1 ? savedConnections[0] : null;
      const configuredConnection =
        config.name &&
        config.host &&
        config.database &&
        config.username &&
        config.name !== DEFAULT_CONNECTION.name
          ? config
          : null;
      const target =
        currentConnection || lastConnection || configuredConnection || singleConnection;

      if (!target) {
        setStatus("No saved connection to reconnect");
        return null;
      }

      const success = await connectSavedConnection(target);
      return success ? target : null;
    } catch (error) {
      setStatus(`Reconnect failed: ${error}`);
      setConnected(false);
      connectedRef.current = false;
      setSchema(null);
      return null;
    }
  }, [config, connectSavedConnection]);

  const disconnect = useCallback(() => {
    setConnected(false);
    connectedRef.current = false;
    setSchema(null);
    setAvailableSchemas([]);
    setSelectedSchema("public");
  }, []);

  const switchConnection = useCallback(async (
    connectionName: string,
    connections: ConnectionConfig[]
  ) => {
    const conn = connections.find((c) => c.name === connectionName);
    if (!conn) return;

    await connectSavedConnection(conn);
  }, [connectSavedConnection]);

  const switchSchema = useCallback(async (schemaName: string) => {
    if (!connected || !config) return;

    setSelectedSchema(schemaName);
    setLoading(true);

    try {
      const dbSchema = await getDatabaseSchema(config, schemaName);
      setSchema(dbSchema);
      setStatus(`Loaded schema: ${schemaName}`);
    } catch (error) {
      setStatus(`Failed to load schema ${schemaName}: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connected, config]);

  const autoConnect = useCallback(async () => {
    try {
      const autoConnectEnabled = await getAutoConnectEnabled();
      if (!autoConnectEnabled) return;

      const lastConnectionName = await getLastConnection();
      const savedConns = await loadConnections();
      const lastConn = lastConnectionName
        ? savedConns.find((c) => c.name === lastConnectionName)
        : null;
      const targetConn = lastConn || (savedConns.length === 1 ? savedConns[0] : null);

      if (!targetConn) {
        if (lastConnectionName) {
          console.warn("Connection not found:", lastConnectionName);
        }
        return;
      }

      const password = await getConnectionPassword(targetConn.name);
      const connWithPassword = { ...targetConn, password: password || "" };

      setLoading(true);
      try {
        const result = await testPostgresConnection(connWithPassword);
        setStatus(`Auto-connected: ${result}`);
        setConnected(true);
        connectedRef.current = true;
        setConfig(connWithPassword);
        await setLastConnection(targetConn.name);

        const schemas = await getDatabaseSchemas(connWithPassword);
        setAvailableSchemas(schemas);

        const dbSchema = await getDatabaseSchema(connWithPassword, "public");
        setSchema(dbSchema);
        setSelectedSchema("public");
      } catch (error) {
        setStatus(`Auto-connect failed: ${error}`);
        setConnected(false);
        connectedRef.current = false;
        setSchema(null);
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.error("Auto-connect failed:", error);
    }
  }, []);

  const clearSchema = useCallback(() => {
    setSchema(null);
    setAvailableSchemas([]);
  }, []);

  return {
    config,
    setConfig,
    connected,
    connectedRef,
    schema,
    availableSchemas,
    selectedSchema,
    loading,
    status,
    setStatus,
    connect,
    reconnect,
    disconnect,
    switchConnection,
    switchSchema,
    autoConnect,
    clearSchema,
  };
}
