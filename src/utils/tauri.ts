import { invoke } from "@tauri-apps/api/core";
import type {
  ConnectionConfig,
  DatabaseSchema,
  EnhancedDatabaseSchema,
  QueryResult,
  QueryHistoryEntry,
  SavedQuery,
  GitStatus,
  GitCommit,
  RecentProject,
  SchemaComparison,
} from "../types";

// Connection Management
export async function testPostgresConnection(
  config: ConnectionConfig
): Promise<string> {
  return await invoke<string>("test_postgres_connection", { config });
}

export async function getDatabaseSchema(
  config: ConnectionConfig,
  schema?: string
): Promise<DatabaseSchema> {
  return await invoke<DatabaseSchema>("get_database_schema", { config, schema });
}

export async function getDatabaseSchemas(
  config: ConnectionConfig
): Promise<string[]> {
  return await invoke<string[]>("get_database_schemas", { config });
}

export async function getEnhancedDatabaseSchema(
  config: ConnectionConfig,
  schema?: string
): Promise<EnhancedDatabaseSchema> {
  return await invoke<EnhancedDatabaseSchema>("get_enhanced_database_schema", { config, schema });
}

export async function compareSchemas(
  sourceConfig: ConnectionConfig,
  targetConfig: ConnectionConfig,
  schema?: string
): Promise<SchemaComparison> {
  return await invoke<SchemaComparison>("compare_schemas", {
    sourceConfig,
    targetConfig,
    schema
  });
}

export async function generateMigrationSql(
  comparison: SchemaComparison
): Promise<string> {
  return await invoke<string>("generate_migration_sql", { comparison });
}

export async function executeQuery(
  config: ConnectionConfig,
  query: string
): Promise<QueryResult> {
  return await invoke<QueryResult>("execute_query", { config, query });
}

// Connection Storage
export async function loadConnections(): Promise<ConnectionConfig[]> {
  return await invoke<ConnectionConfig[]>("load_connections");
}

export async function saveConnections(
  connections: ConnectionConfig[]
): Promise<void> {
  await invoke("save_connections", { connections });
}

export async function saveConnectionPassword(
  connectionName: string,
  password: string
): Promise<void> {
  await invoke("save_connection_password", { name: connectionName, password });
}

export async function getConnectionPassword(
  connectionName: string
): Promise<string | null> {
  return await invoke<string | null>("get_connection_password", {
    name: connectionName,
  });
}

export async function deleteConnectionPassword(
  connectionName: string
): Promise<void> {
  await invoke("delete_connection_password", { name: connectionName });
}

// Query History
export async function saveQueryToHistory(
  query: string,
  connectionName: string,
  executionTimeMs: number,
  rowCount: number
): Promise<void> {
  await invoke("save_query_to_history", {
    query,
    connectionName,
    executionTimeMs,
    rowCount,
  });
}

export async function getQueryHistory(
  limit: number = 20
): Promise<QueryHistoryEntry[]> {
  return await invoke<QueryHistoryEntry[]>("get_query_history", { limit });
}

export async function clearQueryHistory(): Promise<void> {
  await invoke("clear_query_history");
}

// Saved Queries
export async function saveQuery(
  name: string,
  query: string,
  description: string | null
): Promise<void> {
  await invoke("save_query", { name, query, description });
}

export async function getSavedQueries(): Promise<SavedQuery[]> {
  return await invoke<SavedQuery[]>("get_saved_queries");
}

export async function deleteSavedQuery(id: number): Promise<void> {
  await invoke("delete_saved_query", { id });
}

export async function togglePinQuery(id: number): Promise<void> {
  await invoke("toggle_pin_query", { id });
}

// Settings/Project
export async function loadProjectSettings(): Promise<void> {
  await invoke("load_project_settings");
}

export async function getCurrentProjectPath(): Promise<string | null> {
  return await invoke<string | null>("get_current_project_path");
}

export async function setProjectPath(path: string): Promise<void> {
  await invoke("set_project_path", { path });
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  return await invoke<RecentProject[]>("get_recent_projects");
}

export async function removeRecentProject(path: string): Promise<void> {
  await invoke("remove_recent_project", { path });
}

export async function getAppDir(): Promise<string> {
  return await invoke<string>("get_app_dir");
}

export async function verifyProjectAccess(): Promise<boolean> {
  return await invoke<boolean>("verify_project_access");
}

export async function getAutoConnectEnabled(): Promise<boolean> {
  return await invoke<boolean>("get_auto_connect_enabled");
}

export async function setAutoConnectEnabled(enabled: boolean): Promise<void> {
  await invoke("set_auto_connect_enabled", { enabled });
}

export async function getVimModeEnabled(): Promise<boolean> {
  return await invoke<boolean>("get_vim_mode_enabled");
}

export async function setVimModeEnabled(enabled: boolean): Promise<void> {
  await invoke("set_vim_mode_enabled", { enabled });
}

export async function getLastConnection(): Promise<string | null> {
  return await invoke<string | null>("get_last_connection");
}

export async function setLastConnection(name: string): Promise<void> {
  await invoke("set_last_connection", { connectionName: name });
}

// Git Operations
export async function checkGitRepo(): Promise<boolean> {
  return await invoke<boolean>("check_git_repo");
}

export async function gitInit(): Promise<string> {
  return await invoke<string>("git_init");
}

export async function getGitStatus(): Promise<GitStatus> {
  return await invoke<GitStatus>("get_git_status");
}

export async function getGitLog(limit: number = 10): Promise<GitCommit[]> {
  return await invoke<GitCommit[]>("get_git_log", { limit });
}

export async function gitCommit(message: string): Promise<string> {
  return await invoke<string>("git_commit", { message });
}

export async function gitPush(): Promise<string> {
  return await invoke<string>("git_push");
}

export async function gitPull(): Promise<string> {
  return await invoke<string>("git_pull");
}
