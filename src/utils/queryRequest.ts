import type { SavedQuery } from "../types";

export type QuerySafetyMode = "read_only" | "confirm_writes" | "allow_writes";

export interface QueryRequestMetadata {
  kind: "query-request";
  description: string | null;
  collection: string;
  environmentId: string;
  safetyMode: QuerySafetyMode;
  maxRows: number;
  connectionName: string | null;
  params: Record<string, string>;
}

export interface QueryParameter {
  name: string;
  value: string;
  enabled: boolean;
}

const DEFAULT_COLLECTION = "General";
const DEFAULT_MAX_ROWS = 1000;

const WRITE_COMMANDS = [
  "ALTER",
  "CREATE",
  "DELETE",
  "DROP",
  "GRANT",
  "INSERT",
  "REINDEX",
  "REPLACE",
  "REVOKE",
  "TRUNCATE",
  "UPDATE",
  "VACUUM",
];

export function getQueryKind(query: string): string {
  const match = query.trim().match(/^([a-zA-Z]+)/);
  return match ? match[1].toUpperCase() : "SQL";
}

export function isWriteQuery(query: string): boolean {
  const kind = getQueryKind(query);
  return WRITE_COMMANDS.includes(kind);
}

export function extractTemplateVariables(query: string): string[] {
  const names = new Set<string>();
  for (const match of query.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)) {
    names.add(match[1]);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export function quoteSqlValue(value: string): string {
  const trimmed = value.trim();

  if (trimmed === "") return "NULL";
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^null$/i.test(trimmed)) return "NULL";

  return `'${value.replace(/'/g, "''")}'`;
}

export function resolveQueryTemplate(
  query: string,
  variables: Record<string, string>,
  params: QueryParameter[]
): string {
  const enabledParams = new Map(
    params.filter((param) => param.enabled).map((param) => [param.name, param.value])
  );

  return query.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_match, name: string) => {
    if (enabledParams.has(name)) {
      return quoteSqlValue(enabledParams.get(name) ?? "");
    }

    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      return quoteSqlValue(variables[name]);
    }

    return "NULL";
  });
}

export function applySelectLimit(query: string, maxRows: number): string {
  const trimmed = query.trim();
  if (maxRows <= 0 || !/^select\b/i.test(trimmed) || /\blimit\s+\d+\b/i.test(trimmed)) {
    return query;
  }

  const semicolon = trimmed.endsWith(";") ? ";" : "";
  const body = semicolon ? trimmed.slice(0, -1).trimEnd() : trimmed;
  return `${body} LIMIT ${maxRows}${semicolon}`;
}

export function encodeRequestDescription(
  description: string | null,
  metadata: Omit<QueryRequestMetadata, "kind" | "description">
): string {
  return JSON.stringify(
    {
      kind: "query-request",
      description,
      ...metadata,
    } satisfies QueryRequestMetadata,
    null,
    2
  );
}

export function decodeRequestMetadata(savedQuery: SavedQuery): QueryRequestMetadata {
  if (savedQuery.description) {
    try {
      const parsed = JSON.parse(savedQuery.description) as Partial<QueryRequestMetadata>;
      if (parsed.kind === "query-request") {
        return {
          kind: "query-request",
          description: parsed.description ?? null,
          collection: parsed.collection || DEFAULT_COLLECTION,
          environmentId: parsed.environmentId || "local",
          safetyMode: parsed.safetyMode || "confirm_writes",
          maxRows: Number(parsed.maxRows || DEFAULT_MAX_ROWS),
          connectionName: parsed.connectionName ?? null,
          params: parsed.params ?? {},
        };
      }
    } catch {
      // Existing saved queries stored plain text descriptions.
    }
  }

  return {
    kind: "query-request",
    description: savedQuery.description ?? null,
    collection: DEFAULT_COLLECTION,
    environmentId: "local",
    safetyMode: "confirm_writes",
    maxRows: DEFAULT_MAX_ROWS,
    connectionName: null,
    params: {},
  };
}

export function getRequestDescription(savedQuery: SavedQuery): string | null {
  return decodeRequestMetadata(savedQuery).description;
}

export function getRequestCollection(savedQuery: SavedQuery): string {
  return decodeRequestMetadata(savedQuery).collection;
}
