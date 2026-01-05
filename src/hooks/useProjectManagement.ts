import { useState, useCallback } from "react";
import {
  getCurrentProjectPath,
  setProjectPath,
  getRecentProjects,
  loadProjectSettings,
  verifyProjectAccess,
} from "../utils/tauri";
import type { RecentProject } from "../types";

interface UseProjectManagementReturn {
  currentProjectPath: string | null;
  recentProjects: RecentProject[];
  needsProjectReselection: boolean;
  loadCurrentProjectPath: () => Promise<void>;
  loadRecentProjects: () => Promise<void>;
  changeProject: (path: string) => Promise<void>;
  initializeProjectSettings: () => Promise<boolean>; // Returns true if access verified
  clearReselectionFlag: () => void;
}

export function useProjectManagement(): UseProjectManagementReturn {
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [needsProjectReselection, setNeedsProjectReselection] = useState(false);

  const loadCurrentProjectPath = useCallback(async () => {
    try {
      const path = await getCurrentProjectPath();
      setCurrentProjectPath(path);
    } catch (error) {
      console.error("Failed to load project path:", error);
    }
  }, []);

  const loadRecentProjects = useCallback(async () => {
    try {
      const projects = await getRecentProjects();
      setRecentProjects(projects);
    } catch (error) {
      console.error("Failed to load recent projects:", error);
    }
  }, []);

  const changeProject = useCallback(async (path: string) => {
    await setProjectPath(path);
    setCurrentProjectPath(path);
    setNeedsProjectReselection(false); // Clear flag after successful selection
    await loadRecentProjects();
  }, [loadRecentProjects]);

  const clearReselectionFlag = useCallback(() => {
    setNeedsProjectReselection(false);
  }, []);

  const initializeProjectSettings = useCallback(async (): Promise<boolean> => {
    try {
      await loadProjectSettings();
      await loadCurrentProjectPath();
      await loadRecentProjects();

      // Verify we can actually access the project directory
      const hasAccess = await verifyProjectAccess();
      if (!hasAccess) {
        console.warn("Lost access to project directory - user needs to re-select");
        setNeedsProjectReselection(true);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Failed to initialize project settings:", error);
      return false;
    }
  }, [loadCurrentProjectPath, loadRecentProjects]);

  return {
    currentProjectPath,
    recentProjects,
    needsProjectReselection,
    loadCurrentProjectPath,
    loadRecentProjects,
    changeProject,
    initializeProjectSettings,
    clearReselectionFlag,
  };
}
