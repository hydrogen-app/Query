// Database types
export type {
  ColumnInfo,
  TableInfo,
  DatabaseSchema,
  ConnectionConfig,
  IndexInfo,
  ViewInfo,
  RoutineInfo,
  EnhancedColumnInfo,
  EnhancedTableInfo,
  EnhancedDatabaseSchema,
  ForeignKeyInfo,
  // Schema comparison types
  DiffStatus,
  WarningSeverity,
  ColumnChange,
  IndexChange,
  ForeignKeyChange,
  TableDifference,
  ViewChange,
  RoutineChange,
  ComparisonWarning,
  ComparisonSummary,
  SchemaComparison,
} from './database';

// Query types
export type {
  QueryResult,
  QueryHistoryEntry,
  SavedQuery,
} from './query';

// Git types
export type {
  GitStatus,
  GitStatusFile,
  GitCommit,
} from './git';

// Settings types
export type {
  RecentProject,
} from './settings';
