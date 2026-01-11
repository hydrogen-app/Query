import { useState, useCallback } from "react";
import type { ConnectionConfig } from "../types";

export type ModalName =
  | "saveModal"
  | "commandPalette"
  | "queryBuilder"
  | "connectionModal"
  | "settings"
  | "schemaComparison"
  | "erd"
  | "projectPicker";

interface ModalState {
  saveModal: boolean;
  commandPalette: boolean;
  queryBuilder: boolean;
  connectionModal: boolean;
  settings: boolean;
  schemaComparison: boolean;
  erd: boolean;
  projectPicker: boolean;
}

interface UseModalsReturn {
  modals: ModalState;
  editingConnection: ConnectionConfig | null;
  setEditingConnection: (connection: ConnectionConfig | null) => void;
  openModal: (name: ModalName) => void;
  closeModal: (name: ModalName) => void;
  toggleModal: (name: ModalName) => void;
  closeAllModals: () => void;
  isAnyModalOpen: () => boolean;
  closeActiveModal: () => boolean;
}

const initialState: ModalState = {
  saveModal: false,
  commandPalette: false,
  queryBuilder: false,
  connectionModal: false,
  settings: false,
  schemaComparison: false,
  erd: false,
  projectPicker: false,
};

export function useModals(): UseModalsReturn {
  const [modals, setModals] = useState<ModalState>(initialState);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);

  const openModal = useCallback((name: ModalName) => {
    setModals((prev) => ({ ...prev, [name]: true }));
  }, []);

  const closeModal = useCallback((name: ModalName) => {
    setModals((prev) => ({ ...prev, [name]: false }));
    // Clear editing connection when closing connection modal
    if (name === "connectionModal") {
      setEditingConnection(null);
    }
  }, []);

  const toggleModal = useCallback((name: ModalName) => {
    setModals((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals(initialState);
    setEditingConnection(null);
  }, []);

  // Check if any modal is open (excludes ERD which is a panel, not a modal)
  const isAnyModalOpen = useCallback(() => {
    return (
      modals.saveModal ||
      modals.commandPalette ||
      modals.queryBuilder ||
      modals.connectionModal ||
      modals.settings ||
      modals.schemaComparison ||
      modals.projectPicker
    );
  }, [modals]);

  // Close the first active modal (for Cmd+W), returns true if a modal was closed
  const closeActiveModal = useCallback(() => {
    const modalPriority: ModalName[] = [
      "commandPalette",
      "queryBuilder",
      "saveModal",
      "connectionModal",
      "settings",
      "projectPicker",
      "schemaComparison",
    ];
    for (const name of modalPriority) {
      if (modals[name]) {
        closeModal(name);
        return true;
      }
    }
    return false;
  }, [modals, closeModal]);

  return {
    modals,
    editingConnection,
    setEditingConnection,
    openModal,
    closeModal,
    toggleModal,
    closeAllModals,
    isAnyModalOpen,
    closeActiveModal,
  };
}
