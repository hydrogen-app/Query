import { useCallback, useEffect, useMemo, useState } from "react";
import type { SavedQuery } from "../types";
import {
  applySelectLimit,
  decodeRequestMetadata,
  extractTemplateVariables,
  resolveQueryTemplate,
  type QueryParameter,
  type QuerySafetyMode,
} from "../utils/queryRequest";

export interface RequestEnvironment {
  id: string;
  name: string;
  variables: Record<string, string>;
}

interface StoredRequestWorkspace {
  requestName: string;
  collection: string;
  activeEnvironmentId: string;
  environments: RequestEnvironment[];
  safetyMode: QuerySafetyMode;
  maxRows: number;
  params: QueryParameter[];
}

interface UseRequestWorkspaceReturn extends StoredRequestWorkspace {
  activeEnvironment: RequestEnvironment;
  activeVariables: Record<string, string>;
  setRequestName: (name: string) => void;
  setCollection: (collection: string) => void;
  setActiveEnvironmentId: (id: string) => void;
  setSafetyMode: (mode: QuerySafetyMode) => void;
  setMaxRows: (maxRows: number) => void;
  setParamValue: (name: string, value: string) => void;
  setParamEnabled: (name: string, enabled: boolean) => void;
  addEnvironment: () => void;
  setEnvironmentVariable: (name: string, value: string) => void;
  renameEnvironmentVariable: (oldName: string, newName: string) => void;
  addEnvironmentVariable: () => void;
  loadSavedRequest: (savedQuery: SavedQuery) => void;
  buildExecutableQuery: (query: string) => string;
}

const DEFAULT_ENVIRONMENT: RequestEnvironment = {
  id: "local",
  name: "Local",
  variables: {},
};

const DEFAULT_WORKSPACE: StoredRequestWorkspace = {
  requestName: "Untitled request",
  collection: "General",
  activeEnvironmentId: "local",
  environments: [DEFAULT_ENVIRONMENT],
  safetyMode: "confirm_writes",
  maxRows: 1000,
  params: [],
};

function normalizeWorkspace(workspace: Partial<StoredRequestWorkspace>): StoredRequestWorkspace {
  const environments =
    workspace.environments && workspace.environments.length > 0
      ? workspace.environments
      : [DEFAULT_ENVIRONMENT];

  const activeEnvironmentId = environments.some((env) => env.id === workspace.activeEnvironmentId)
    ? workspace.activeEnvironmentId || environments[0].id
    : environments[0].id;

  return {
    requestName: workspace.requestName || DEFAULT_WORKSPACE.requestName,
    collection: workspace.collection || DEFAULT_WORKSPACE.collection,
    activeEnvironmentId,
    environments,
    safetyMode: workspace.safetyMode || DEFAULT_WORKSPACE.safetyMode,
    maxRows: Number(workspace.maxRows || DEFAULT_WORKSPACE.maxRows),
    params: workspace.params || [],
  };
}

function syncParamsWithQuery(query: string, params: QueryParameter[]): QueryParameter[] {
  const names = extractTemplateVariables(query);
  const byName = new Map(params.map((param) => [param.name, param]));

  return names.map((name) => byName.get(name) ?? { name, value: "", enabled: true });
}

function areParamsEqual(a: QueryParameter[], b: QueryParameter[]): boolean {
  return (
    a.length === b.length &&
    a.every((param, index) => {
      const other = b[index];
      return (
        other &&
        param.name === other.name &&
        param.value === other.value &&
        param.enabled === other.enabled
      );
    })
  );
}

function makeStorageKey(projectPath: string | null): string {
  return `query:request-workspace:${projectPath || "default"}`;
}

export function useRequestWorkspace(
  projectPath: string | null,
  query: string
): UseRequestWorkspaceReturn {
  const storageKey = useMemo(() => makeStorageKey(projectPath), [projectPath]);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<StoredRequestWorkspace>(DEFAULT_WORKSPACE);

  useEffect(() => {
    setHydratedKey(null);

    try {
      const stored = localStorage.getItem(storageKey);
      setWorkspace(stored ? normalizeWorkspace(JSON.parse(stored)) : DEFAULT_WORKSPACE);
    } catch (error) {
      console.error("Failed to load request workspace:", error);
      setWorkspace(DEFAULT_WORKSPACE);
    } finally {
      setHydratedKey(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (hydratedKey !== storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(workspace));
  }, [hydratedKey, storageKey, workspace]);

  useEffect(() => {
    setWorkspace((current) => {
      const params = syncParamsWithQuery(query, current.params);
      return areParamsEqual(current.params, params) ? current : { ...current, params };
    });
  }, [query]);

  const activeEnvironment = useMemo(() => {
    return (
      workspace.environments.find((env) => env.id === workspace.activeEnvironmentId) ??
      workspace.environments[0] ??
      DEFAULT_ENVIRONMENT
    );
  }, [workspace.activeEnvironmentId, workspace.environments]);

  const updateActiveEnvironment = useCallback(
    (updater: (environment: RequestEnvironment) => RequestEnvironment) => {
      setWorkspace((current) => ({
        ...current,
        environments: current.environments.map((environment) =>
          environment.id === current.activeEnvironmentId ? updater(environment) : environment
        ),
      }));
    },
    []
  );

  const setRequestName = useCallback((name: string) => {
    setWorkspace((current) => ({ ...current, requestName: name }));
  }, []);

  const setCollection = useCallback((collection: string) => {
    setWorkspace((current) => ({ ...current, collection }));
  }, []);

  const setActiveEnvironmentId = useCallback((id: string) => {
    setWorkspace((current) => ({ ...current, activeEnvironmentId: id }));
  }, []);

  const setSafetyMode = useCallback((mode: QuerySafetyMode) => {
    setWorkspace((current) => ({ ...current, safetyMode: mode }));
  }, []);

  const setMaxRows = useCallback((maxRows: number) => {
    setWorkspace((current) => ({ ...current, maxRows: Math.max(0, Math.floor(maxRows || 0)) }));
  }, []);

  const setParamValue = useCallback((name: string, value: string) => {
    setWorkspace((current) => ({
      ...current,
      params: current.params.map((param) => (param.name === name ? { ...param, value } : param)),
    }));
  }, []);

  const setParamEnabled = useCallback((name: string, enabled: boolean) => {
    setWorkspace((current) => ({
      ...current,
      params: current.params.map((param) =>
        param.name === name ? { ...param, enabled } : param
      ),
    }));
  }, []);

  const addEnvironment = useCallback(() => {
    setWorkspace((current) => {
      const id = `env_${Date.now()}`;
      return {
        ...current,
        activeEnvironmentId: id,
        environments: [
          ...current.environments,
          {
            id,
            name: `Environment ${current.environments.length + 1}`,
            variables: {},
          },
        ],
      };
    });
  }, []);

  const setEnvironmentVariable = useCallback(
    (name: string, value: string) => {
      updateActiveEnvironment((environment) => ({
        ...environment,
        variables: {
          ...environment.variables,
          [name]: value,
        },
      }));
    },
    [updateActiveEnvironment]
  );

  const renameEnvironmentVariable = useCallback(
    (oldName: string, newName: string) => {
      const normalizedName = newName.trim();
      if (!normalizedName || normalizedName === oldName) return;

      updateActiveEnvironment((environment) => {
        const { [oldName]: value, ...rest } = environment.variables;
        return {
          ...environment,
          variables: {
            ...rest,
            [normalizedName]: value ?? "",
          },
        };
      });
    },
    [updateActiveEnvironment]
  );

  const addEnvironmentVariable = useCallback(() => {
    updateActiveEnvironment((environment) => {
      let index = Object.keys(environment.variables).length + 1;
      let name = `variable_${index}`;
      while (Object.prototype.hasOwnProperty.call(environment.variables, name)) {
        index += 1;
        name = `variable_${index}`;
      }

      return {
        ...environment,
        variables: {
          ...environment.variables,
          [name]: "",
        },
      };
    });
  }, [updateActiveEnvironment]);

  const loadSavedRequest = useCallback((savedQuery: SavedQuery) => {
    const metadata = decodeRequestMetadata(savedQuery);
    setWorkspace((current) => ({
      ...current,
      requestName: savedQuery.name,
      collection: metadata.collection,
      activeEnvironmentId: current.environments.some((env) => env.id === metadata.environmentId)
        ? metadata.environmentId
        : current.activeEnvironmentId,
      safetyMode: metadata.safetyMode,
      maxRows: metadata.maxRows,
      params: syncParamsWithQuery(
        savedQuery.query,
        extractTemplateVariables(savedQuery.query).map((name) => ({
          name,
          value: metadata.params[name] ?? "",
          enabled: true,
        }))
      ),
    }));
  }, []);

  const buildExecutableQuery = useCallback(
    (sourceQuery: string) => {
      const resolvedQuery = resolveQueryTemplate(
        sourceQuery,
        activeEnvironment.variables,
        workspace.params
      );
      return applySelectLimit(resolvedQuery, workspace.maxRows);
    },
    [activeEnvironment.variables, workspace.maxRows, workspace.params]
  );

  return {
    ...workspace,
    activeEnvironment,
    activeVariables: activeEnvironment.variables,
    setRequestName,
    setCollection,
    setActiveEnvironmentId,
    setSafetyMode,
    setMaxRows,
    setParamValue,
    setParamEnabled,
    addEnvironment,
    setEnvironmentVariable,
    renameEnvironmentVariable,
    addEnvironmentVariable,
    loadSavedRequest,
    buildExecutableQuery,
  };
}
