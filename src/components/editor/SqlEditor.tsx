import { Editor } from "@monaco-editor/react";
import { useRef, useEffect, memo } from "react";
import { initVimMode } from "monaco-vim";
import type * as Monaco from "monaco-editor";
import type { DatabaseSchema, TableInfo } from "../../types";
import { defineQueryMonacoTheme, QUERY_MONACO_THEME_NAME } from "../../constants";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onDraftChange?: (value: string) => void;
  onRunQuery: (value: string) => void;
  onSaveQuery?: (value: string) => void;
  schema?: DatabaseSchema | null;
  onEditorReady?: (
    insertAtCursor: (text: string) => void,
    insertSnippet: (snippet: string) => void
  ) => void;
  vimMode?: boolean;
  onToggleCommandPalette?: () => void;
}

const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "INNER JOIN",
  "ON",
  "AND",
  "OR",
  "ORDER BY",
  "GROUP BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "INSERT INTO",
  "UPDATE",
  "DELETE",
  "CREATE",
  "ALTER",
  "DROP",
  "AS",
  "DISTINCT",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "IN",
  "NOT IN",
  "LIKE",
  "BETWEEN",
] as const;

const SQL_SNIPPETS = [
  {
    label: "sel",
    detail: "SELECT with WHERE",
    insertText: "SELECT ${1:columns}\nFROM ${2:table}\nWHERE ${3:condition};",
    documentation: "SELECT statement with WHERE clause",
  },
  {
    label: "selj",
    detail: "SELECT with JOIN",
    insertText:
      "SELECT ${1:t1}.${2:column}, ${3:t2}.${4:column}\nFROM ${5:table1} ${1:t1}\nJOIN ${6:table2} ${3:t2} ON ${1:t1}.${7:id} = ${3:t2}.${8:fk_id}\nWHERE ${9:condition};",
    documentation: "SELECT with INNER JOIN",
  },
  {
    label: "sellj",
    detail: "SELECT with LEFT JOIN",
    insertText:
      "SELECT ${1:t1}.${2:column}, ${3:t2}.${4:column}\nFROM ${5:table1} ${1:t1}\nLEFT JOIN ${6:table2} ${3:t2} ON ${1:t1}.${7:id} = ${3:t2}.${8:fk_id}\nWHERE ${9:condition};",
    documentation: "SELECT with LEFT JOIN",
  },
  {
    label: "selagg",
    detail: "SELECT with GROUP BY",
    insertText:
      "SELECT ${1:column}, COUNT(*) as count\nFROM ${2:table}\nGROUP BY ${1:column}\nORDER BY count DESC;",
    documentation: "SELECT with aggregation and GROUP BY",
  },
  {
    label: "ins",
    detail: "INSERT INTO",
    insertText:
      "INSERT INTO ${1:table} (${2:column1}, ${3:column2})\nVALUES (${4:value1}, ${5:value2});",
    documentation: "INSERT statement",
  },
  {
    label: "upd",
    detail: "UPDATE",
    insertText: "UPDATE ${1:table}\nSET ${2:column1} = ${3:value1}\nWHERE ${4:condition};",
    documentation: "UPDATE statement",
  },
  {
    label: "del",
    detail: "DELETE FROM",
    insertText: "DELETE FROM ${1:table}\nWHERE ${2:condition};",
    documentation: "DELETE statement",
  },
  {
    label: "cte",
    detail: "WITH (Common Table Expression)",
    insertText:
      "WITH ${1:cte_name} AS (\n  ${2:SELECT * FROM table}\n)\nSELECT * FROM ${1:cte_name};",
    documentation: "Common Table Expression (CTE)",
  },
] as const;

interface SchemaCompletionIndex {
  tables: TableInfo[];
  tableByName: Map<string, TableInfo>;
}

export const SqlEditor = memo(function SqlEditor({
  value,
  onChange,
  onDraftChange,
  onRunQuery,
  onSaveQuery,
  schema,
  onEditorReady,
  vimMode = false,
  onToggleCommandPalette,
}: SqlEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const latestValueRef = useRef(value);
  const committedValueRef = useRef(value);
  const commitTimerRef = useRef<number | null>(null);
  const schemaIndexRef = useRef<SchemaCompletionIndex>({
    tables: [],
    tableByName: new Map(),
  });
  const onChangeRef = useRef(onChange);
  const onDraftChangeRef = useRef(onDraftChange);
  const onRunQueryRef = useRef(onRunQuery);
  const onSaveQueryRef = useRef(onSaveQuery);
  const onToggleCommandPaletteRef = useRef(onToggleCommandPalette);
  const completionProviderRef = useRef<Monaco.IDisposable | null>(null);
  const vimModeRef = useRef<{ dispose: () => void } | null>(null);

  // Update refs when props change
  useEffect(() => {
    schemaIndexRef.current = {
      tables: schema?.tables ?? [],
      tableByName: new Map(
        (schema?.tables ?? []).map((table) => [table.table_name.toLowerCase(), table])
      ),
    };
  }, [schema]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  useEffect(() => {
    onRunQueryRef.current = onRunQuery;
  }, [onRunQuery]);

  useEffect(() => {
    onSaveQueryRef.current = onSaveQuery;
  }, [onSaveQuery]);

  useEffect(() => {
    onToggleCommandPaletteRef.current = onToggleCommandPalette;
  }, [onToggleCommandPalette]);

  useEffect(() => {
    committedValueRef.current = value;

    const editor = editorRef.current;
    if (!editor) {
      latestValueRef.current = value;
      return;
    }

    if (value !== latestValueRef.current && editor.getValue() !== value) {
      if (commitTimerRef.current) {
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
      latestValueRef.current = value;
      editor.setValue(value);
    }
  }, [value]);

  function commitEditorValue(nextValue = latestValueRef.current) {
    if (commitTimerRef.current) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    if (nextValue === committedValueRef.current) return;

    committedValueRef.current = nextValue;
    onChangeRef.current(nextValue);
  }

  // Cleanup completion provider on unmount
  useEffect(() => {
    return () => {
      if (commitTimerRef.current) {
        window.clearTimeout(commitTimerRef.current);
      }
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
      }
    };
  }, []);

  // Handle vim mode toggle
  useEffect(() => {
    if (!editorRef.current) return;

    // Dispose existing vim mode
    if (vimModeRef.current) {
      vimModeRef.current.dispose();
      vimModeRef.current = null;
    }

    // Initialize vim mode if enabled
    if (vimMode) {
      const statusNode = document.getElementById("vim-status");
      vimModeRef.current = initVimMode(editorRef.current, statusNode);
    }

    return () => {
      if (vimModeRef.current) {
        vimModeRef.current.dispose();
        vimModeRef.current = null;
      }
    };
  }, [vimMode]);

  function handleEditorChange(newValue: string | undefined) {
    const nextValue = newValue || "";
    latestValueRef.current = nextValue;
    onDraftChangeRef.current?.(nextValue);

    if (commitTimerRef.current) {
      window.clearTimeout(commitTimerRef.current);
    }

    commitTimerRef.current = window.setTimeout(() => {
      commitEditorValue(nextValue);
    }, 150);
  }

  function handleEditorMount(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) {
    // Store editor instance
    editorRef.current = editor;
    latestValueRef.current = editor.getValue();

    defineQueryMonacoTheme(monaco);
    monaco.editor.setTheme(QUERY_MONACO_THEME_NAME);

    // Provide insert-at-cursor and insert-snippet functions to parent
    if (onEditorReady) {
      const insertAtCursor = (text: string) => {
        const position = editor.getPosition();
        if (!position) return;

        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column,
          endColumn: position.column,
        };
        editor.executeEdits("", [
          {
            range: range,
            text: text,
            forceMoveMarkers: true,
          },
        ]);
        editor.focus();
      };

      const insertSnippet = (snippet: string) => {
        // Use Monaco's native snippet controller for proper tab stop support
        const snippetController = editor.getContribution("snippetController2") as any;
        if (snippetController && typeof snippetController.insert === "function") {
          snippetController.insert(snippet);
        } else {
          // Fallback: insert as plain text if snippet controller not available
          const plainText = snippet.replace(/\$\{\d+:([^}]+)\}/g, "$1").replace(/\$\d+/g, "");
          const position = editor.getPosition();
          if (!position) return;

          const range = new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          );

          editor.executeEdits("", [
            {
              range: range,
              text: plainText,
              forceMoveMarkers: true,
            },
          ]);
        }
        editor.focus();
      };

      onEditorReady(insertAtCursor, insertSnippet);
    }

    // Cmd+Enter to run query (read current editor value and sync state first)
    editor.onDidBlurEditorText(() => {
      commitEditorValue(editor.getValue());
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      const currentValue = editor.getValue();
      latestValueRef.current = currentValue;
      onDraftChangeRef.current?.(currentValue);
      commitEditorValue(currentValue);
      onRunQueryRef.current(currentValue);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const currentValue = editor.getValue();
      latestValueRef.current = currentValue;
      onDraftChangeRef.current?.(currentValue);
      commitEditorValue(currentValue);
      onSaveQueryRef.current?.(currentValue);
    });

    // Cmd+/ to comment
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.trigger("keyboard", "editor.action.commentLine", {});
    });

    // Cmd+K to open command palette (works inside editor)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      const currentValue = editor.getValue();
      latestValueRef.current = currentValue;
      onDraftChangeRef.current?.(currentValue);
      commitEditorValue(currentValue);
      onToggleCommandPaletteRef.current?.();
    });

    // Register completion provider with schema (dispose old one first if exists)
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
    }

    completionProviderRef.current = monaco.languages.registerCompletionItemProvider("sql", {
      provideCompletionItems: (model: Monaco.editor.ITextModel, position: Monaco.Position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const textUntilPosition = model
          .getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          })
          .toLowerCase();

        const suggestions: Monaco.languages.CompletionItem[] = [];

        SQL_KEYWORDS.forEach((kw) => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range: range,
          });
        });

        SQL_SNIPPETS.forEach((snippet) => {
          suggestions.push({
            label: snippet.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: snippet.detail,
            documentation: snippet.documentation,
            insertText: snippet.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
          });
        });

        const schemaIndex = schemaIndexRef.current;
        if (schemaIndex.tables.length > 0) {
          const dotMatch = /(\w+)\.(\w*)$/.exec(textUntilPosition);
          if (dotMatch) {
            const tableName = dotMatch[1];
            const table = schemaIndex.tableByName.get(tableName.toLowerCase());

            if (table) {
              // Clear suggestions and only show columns
              suggestions.length = 0;
              table.columns.forEach((col) => {
                suggestions.push({
                  label: col.column_name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  detail: col.data_type,
                  insertText: col.column_name,
                  range: range,
                });
              });
            }
          } else {
            const shouldSuggestSchema =
              word.word.length >= 2 ||
              /\b(from|join|update|into|table)\s+\w*$/.test(textUntilPosition);

            if (shouldSuggestSchema) {
              schemaIndex.tables.forEach((table) => {
                suggestions.push({
                  label: table.table_name,
                  kind: monaco.languages.CompletionItemKind.Class,
                  detail: `Table (${table.columns.length} columns)`,
                  insertText: table.table_name,
                  range: range,
                });
              });
            }
          }
        }

        return { suggestions };
      },
    });
  }

  return (
    <div className="border-border bg-card relative overflow-hidden rounded-lg border">
      <Editor
        height="300px"
        language="sql"
        theme={QUERY_MONACO_THEME_NAME}
        defaultValue={value}
        onChange={handleEditorChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
          tabCompletion: "on",
          snippetSuggestions: "top",
          wordBasedSuggestions: "off",
          suggest: {
            snippetsPreventQuickSuggestions: false,
          },
          padding: { top: 12, bottom: 12 },
          fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
          fontLigatures: false,
          cursorBlinking: "blink",
          cursorSmoothCaretAnimation: "off",
          smoothScrolling: false,
          renderLineHighlight: "line",
          renderWhitespace: "none",
          selectionHighlight: false,
          occurrencesHighlight: "off",
          bracketPairColorization: {
            enabled: false,
          },
        }}
      />
      {vimMode && (
        <div
          id="vim-status"
          className="bg-muted border-border text-muted-foreground absolute right-0 bottom-0 left-0 border-t px-3 py-1 font-mono text-xs"
        ></div>
      )}
    </div>
  );
});
