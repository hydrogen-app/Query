import { Editor } from '@monaco-editor/react';
import { useRef, useEffect, memo } from 'react';
import { initVimMode } from 'monaco-vim';
import type * as Monaco from 'monaco-editor';
import type { DatabaseSchema } from '../../types';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRunQuery: () => void;
  schema?: DatabaseSchema | null;
  onEditorReady?: (
    insertAtCursor: (text: string) => void,
    insertSnippet: (snippet: string) => void
  ) => void;
  vimMode?: boolean;
  onToggleCommandPalette?: () => void;
}

export const SqlEditor = memo(function SqlEditor({ value, onChange, onRunQuery, schema, onEditorReady, vimMode = false, onToggleCommandPalette }: SqlEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const schemaRef = useRef(schema);
  const onRunQueryRef = useRef(onRunQuery);
  const onToggleCommandPaletteRef = useRef(onToggleCommandPalette);
  const completionProviderRef = useRef<Monaco.IDisposable | null>(null);
  const vimModeRef = useRef<{ dispose: () => void } | null>(null);

  // Update refs when props change
  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  useEffect(() => {
    onRunQueryRef.current = onRunQuery;
  }, [onRunQuery]);

  useEffect(() => {
    onToggleCommandPaletteRef.current = onToggleCommandPalette;
  }, [onToggleCommandPalette]);

  // Cleanup completion provider on unmount
  useEffect(() => {
    return () => {
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
      const statusNode = document.getElementById('vim-status');
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
    onChange(newValue || '');
  }

  function handleEditorMount(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) {
    // Store editor instance
    editorRef.current = editor;

    // Define custom theme matching app's dark color scheme (CSS variables)
    // --card: hsl(224 71.4% 4.1%) ≈ #050a14
    // --background: hsl(229 12% 11%) ≈ #181b20
    // --border/muted: hsl(215 27.9% 16.9%) ≈ #1f2937
    // --muted-foreground: hsl(217.9 10.6% 64.9%) ≈ #9ca3af
    // --foreground: hsl(210 20% 98%) ≈ #f8fafc
    // --primary: hsl(262.1 83.3% 57.8%) ≈ #8b5cf6
    monaco.editor.defineTheme('query-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword.sql', foreground: '8b5cf6', fontStyle: 'bold' },
        { token: 'string.sql', foreground: '34d399' },
        { token: 'number', foreground: 'f59e0b' },
        { token: 'comment', foreground: '9ca3af', fontStyle: 'italic' },
        { token: 'operator.sql', foreground: '60a5fa' },
      ],
      colors: {
        'editor.background': '#050a14', // --card: hsl(224 71.4% 4.1%)
        'editor.foreground': '#f8fafc', // --foreground: hsl(210 20% 98%)
        'editor.lineHighlightBackground': '#181b20', // --background
        'editor.selectionBackground': '#8b5cf640', // --primary with opacity
        'editor.inactiveSelectionBackground': '#8b5cf620',
        'editorLineNumber.foreground': '#9ca3af', // --muted-foreground
        'editorLineNumber.activeForeground': '#a78bfa', // primary lighter
        'editorCursor.foreground': '#a78bfa', // primary lighter
        'editor.selectionHighlightBackground': '#8b5cf620',
        'editorWhitespace.foreground': '#1f2937', // --border
        'editorIndentGuide.background': '#1f2937', // --border
        'editorIndentGuide.activeBackground': '#9ca3af', // --muted-foreground
        'editorSuggestWidget.background': '#181b20', // --background
        'editorSuggestWidget.border': '#1f2937', // --border
        'editorSuggestWidget.foreground': '#f8fafc', // --foreground
        'editorSuggestWidget.selectedBackground': '#8b5cf640', // --primary with opacity
        'editorWidget.background': '#181b20', // --background
        'editorWidget.border': '#1f2937', // --border
        'input.background': '#181b20', // --background
        'input.border': '#1f2937', // --border
      },
    });

    // Set the custom theme
    monaco.editor.setTheme('query-dark');

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
        editor.executeEdits('', [{
          range: range,
          text: text,
          forceMoveMarkers: true,
        }]);
        editor.focus();
      };

      const insertSnippet = (snippet: string) => {
        // Use Monaco's native snippet controller for proper tab stop support
        const snippetController = editor.getContribution('snippetController2') as any;
        if (snippetController && typeof snippetController.insert === 'function') {
          snippetController.insert(snippet);
        } else {
          // Fallback: insert as plain text if snippet controller not available
          const plainText = snippet.replace(/\$\{\d+:([^}]+)\}/g, '$1').replace(/\$\d+/g, '');
          const position = editor.getPosition();
          if (!position) return;

          const range = new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          );

          editor.executeEdits('', [{
            range: range,
            text: plainText,
            forceMoveMarkers: true,
          }]);
        }
        editor.focus();
      };

      onEditorReady(insertAtCursor, insertSnippet);
    }

    // Cmd+Enter to run query (read current editor value and sync state first)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      // Get the current value from the editor to ensure we have the latest
      const currentValue = editor.getValue();
      // Update the parent state with current editor value
      onChange(currentValue);
      // Use setTimeout to ensure state update completes before running query
      setTimeout(() => {
        onRunQueryRef.current();
      }, 0);
    });

    // Cmd+/ to comment
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.trigger('keyboard', 'editor.action.commentLine', {});
    });

    // Cmd+K to open command palette (works inside editor)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      onToggleCommandPaletteRef.current?.();
    });

    // Register completion provider with schema (dispose old one first if exists)
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
    }

    completionProviderRef.current = monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: Monaco.editor.ITextModel, position: Monaco.Position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        }).toLowerCase();

        const suggestions: Monaco.languages.CompletionItem[] = [];

        // SQL Keywords
        const keywords = [
          'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
          'INNER JOIN', 'ON', 'AND', 'OR', 'ORDER BY', 'GROUP BY',
          'HAVING', 'LIMIT', 'OFFSET', 'INSERT INTO', 'UPDATE', 'DELETE',
          'CREATE', 'ALTER', 'DROP', 'AS', 'DISTINCT', 'COUNT', 'SUM',
          'AVG', 'MIN', 'MAX', 'IN', 'NOT IN', 'LIKE', 'BETWEEN',
        ];

        keywords.forEach(kw => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range: range,
          });
        });

        // Add SQL snippets
        const snippets = [
          {
            label: 'sel',
            detail: 'SELECT with WHERE',
            insertText: 'SELECT ${1:columns}\nFROM ${2:table}\nWHERE ${3:condition};',
            documentation: 'SELECT statement with WHERE clause',
          },
          {
            label: 'selj',
            detail: 'SELECT with JOIN',
            insertText: 'SELECT ${1:t1}.${2:column}, ${3:t2}.${4:column}\nFROM ${5:table1} ${1:t1}\nJOIN ${6:table2} ${3:t2} ON ${1:t1}.${7:id} = ${3:t2}.${8:fk_id}\nWHERE ${9:condition};',
            documentation: 'SELECT with INNER JOIN',
          },
          {
            label: 'sellj',
            detail: 'SELECT with LEFT JOIN',
            insertText: 'SELECT ${1:t1}.${2:column}, ${3:t2}.${4:column}\nFROM ${5:table1} ${1:t1}\nLEFT JOIN ${6:table2} ${3:t2} ON ${1:t1}.${7:id} = ${3:t2}.${8:fk_id}\nWHERE ${9:condition};',
            documentation: 'SELECT with LEFT JOIN',
          },
          {
            label: 'selagg',
            detail: 'SELECT with GROUP BY',
            insertText: 'SELECT ${1:column}, COUNT(*) as count\nFROM ${2:table}\nGROUP BY ${1:column}\nORDER BY count DESC;',
            documentation: 'SELECT with aggregation and GROUP BY',
          },
          {
            label: 'ins',
            detail: 'INSERT INTO',
            insertText: 'INSERT INTO ${1:table} (${2:column1}, ${3:column2})\nVALUES (${4:value1}, ${5:value2});',
            documentation: 'INSERT statement',
          },
          {
            label: 'upd',
            detail: 'UPDATE',
            insertText: 'UPDATE ${1:table}\nSET ${2:column1} = ${3:value1}\nWHERE ${4:condition};',
            documentation: 'UPDATE statement',
          },
          {
            label: 'del',
            detail: 'DELETE FROM',
            insertText: 'DELETE FROM ${1:table}\nWHERE ${2:condition};',
            documentation: 'DELETE statement',
          },
          {
            label: 'cte',
            detail: 'WITH (Common Table Expression)',
            insertText: 'WITH ${1:cte_name} AS (\n  ${2:SELECT * FROM table}\n)\nSELECT * FROM ${1:cte_name};',
            documentation: 'Common Table Expression (CTE)',
          },
        ];

        snippets.forEach(snippet => {
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

        // Add table names from schema (use ref to get latest schema value)
        const currentSchema = schemaRef.current;
        if (currentSchema?.tables) {
          currentSchema.tables.forEach(table => {
            suggestions.push({
              label: table.table_name,
              kind: monaco.languages.CompletionItemKind.Class,
              detail: `Table (${table.columns.length} columns)`,
              insertText: table.table_name,
              range: range,
            });
          });

          // If typing after "table." suggest columns
          const dotMatch = /(\w+)\.(\w*)$/.exec(textUntilPosition);
          if (dotMatch) {
            const tableName = dotMatch[1];
            const table = currentSchema.tables.find(t =>
              t.table_name.toLowerCase() === tableName.toLowerCase()
            );

            if (table) {
              // Clear suggestions and only show columns
              suggestions.length = 0;
              table.columns.forEach(col => {
                suggestions.push({
                  label: col.column_name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  detail: col.data_type,
                  insertText: col.column_name,
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
    <div className="relative rounded-lg border border-border overflow-hidden bg-card">
      <Editor
        height="300px"
        language="sql"
        theme="query-dark"
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
          tabCompletion: 'on',
          snippetSuggestions: 'top',
          suggest: {
            snippetsPreventQuickSuggestions: false,
          },
          padding: { top: 12, bottom: 12 },
          fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
          fontLigatures: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          renderLineHighlight: 'all',
          renderWhitespace: 'selection',
          bracketPairColorization: {
            enabled: true,
          },
        }}
      />
      {vimMode && (
        <div
          id="vim-status"
          className="absolute bottom-0 left-0 right-0 bg-muted border-t border-border px-3 py-1 text-xs font-mono text-muted-foreground"
        ></div>
      )}
    </div>
  );
});
