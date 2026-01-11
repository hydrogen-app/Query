// Keyboard shortcuts used throughout the application
export const SHORTCUTS = {
  // Command Palette
  COMMAND_PALETTE: {
    key: "K",
    modifier: "Cmd",
    description: "Open command palette",
  },

  // Connection Picker
  CONNECTION_PICKER: {
    key: "C",
    modifier: "Cmd+Shift",
    description: "Quick switch connections",
  },

  // Editor
  EXECUTE_QUERY: {
    key: "Enter",
    modifier: "Cmd",
    description: "Execute query (works globally)",
  },

  COMMENT_LINE: {
    key: "/",
    modifier: "Cmd",
    description: "Toggle comment",
  },

  // Query Management
  SAVE_QUERY: {
    key: "S",
    modifier: "Cmd",
    description: "Save current query",
  },

  // Navigation
  QUERY_BUILDER: {
    key: "B",
    modifier: "Cmd+Shift",
    description: "Open query builder",
  },

  TOGGLE_SIDEBAR: {
    key: "B",
    modifier: "Cmd",
    description: "Toggle sidebar",
  },

  SETTINGS: {
    key: ",",
    modifier: "Cmd",
    description: "Open settings",
  },

  FULLSCREEN_RESULTS: {
    key: "F",
    modifier: "Cmd+Shift",
    description: "Toggle full-screen results",
  },

  // Window Management
  HIDE_APP: {
    key: "H",
    modifier: "Cmd",
    description: "Hide application (macOS)",
  },

  CLOSE_MODAL: {
    key: "W",
    modifier: "Cmd",
    description: "Close active modal",
  },

  // New Items
  NEW_CONNECTION: {
    key: "N",
    modifier: "Cmd",
    description: "Create new connection",
  },
} as const;

// Default connection configuration
export const DEFAULT_CONNECTION = {
  name: "New Connection",
  host: "localhost",
  port: 5432,
  database: "querytest",
  username: "postgres",
  password: "",
} as const;

// Default limits
export const DEFAULTS = {
  HISTORY_LIMIT: 20,
  QUERY_LIMIT: 100,
  DEFAULT_PORT: 5432,
  RECENT_HISTORY_LIMIT: 5, // For command palette
} as const;

// UI Layout constants
export const UI_LAYOUT = {
  DEFAULT_PANEL_SIZE: 50, // percentage
  MIN_PANEL_SIZE: 30, // percentage
  QUERY_PREVIEW_LENGTH: 60, // characters
} as const;

// Database ports
export const DB_PORTS = {
  POSTGRES: 5432,
  MYSQL: 3306,
  MONGODB: 27017,
} as const;

// Dialog sizes
export const DIALOG_SIZES = {
  SMALL: "sm:max-w-[500px]",
  MEDIUM: "sm:max-w-[600px]",
  LARGE: "sm:max-w-[800px]",
} as const;
