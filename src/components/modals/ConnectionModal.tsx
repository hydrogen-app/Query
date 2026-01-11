import { useState, memo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import type { ConnectionConfig } from "../../types";
import { testPostgresConnection } from "../../utils/tauri";
import { DEFAULT_CONNECTION } from "../../constants";

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (connection: ConnectionConfig) => void;
  initialConnection?: ConnectionConfig | null;
}

// DEFAULT_CONNECTION is imported from constants
// Note: The imported constant uses "New Connection" for name and "querytest" for database

export const ConnectionModal = memo(function ConnectionModal({
  isOpen,
  onClose,
  onSave,
  initialConnection,
}: ConnectionModalProps) {
  const [config, setConfig] = useState<ConnectionConfig>(
    initialConnection || DEFAULT_CONNECTION
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [connectionUrl, setConnectionUrl] = useState("");

  // Update config when initialConnection changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setConfig(initialConnection || DEFAULT_CONNECTION);
      setTestResult(null);
      setConnectionUrl("");
    }
  }, [isOpen, initialConnection]);

  const parseConnectionUrl = (url: string) => {
    try {
      // Support both postgres:// and postgresql:// schemes
      const urlPattern = /^(postgres|postgresql):\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/;
      const match = url.match(urlPattern);

      if (match) {
        const [, , username, password, host, port, database] = match;
        setConfig({
          ...config,
          host,
          port: parseInt(port, 10),
          database,
          username,
          password,
        });
        setConnectionUrl("");
        setTestResult({
          success: true,
          message: "Connection URL parsed successfully",
        });
      } else {
        setTestResult({
          success: false,
          message: "Invalid URL format. Expected: postgres://user:pass@host:port/database",
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: "Failed to parse connection URL",
      });
    }
  };

  const handleTestConnection = async () => {
    if (!config.host || !config.database || !config.username) {
      setTestResult({
        success: false,
        message: "Please fill in host, database, and username fields",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await testPostgresConnection(config);
      setTestResult({
        success: true,
        message: result,
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: String(error),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!config.name || !config.host || !config.database || !config.username) {
      alert("Please fill in all required fields");
      return;
    }
    onSave(config);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>
            {initialConnection ? "Edit Connection" : DEFAULT_CONNECTION.name || "New Connection"}
          </DialogTitle>
          <DialogDescription>
            Configure your PostgreSQL database connection. Password will be
            stored securely in your OS keychain.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Connection URL Parser */}
          <div className="grid gap-2">
            <Label htmlFor="connectionUrl">Quick Setup (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="connectionUrl"
                placeholder="postgres://user:pass@host:port/database"
                value={connectionUrl}
                onChange={(e) => setConnectionUrl(e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => parseConnectionUrl(connectionUrl)}
                disabled={!connectionUrl.trim()}
              >
                Parse
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste a connection URL to auto-fill the fields below
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or enter manually
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Connection Name *</Label>
            <Input
              id="name"
              placeholder="My Database"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="host">Host *</Label>
              <Input
                id="host"
                placeholder={DEFAULT_CONNECTION.host}
                value={config.host}
                onChange={(e) =>
                  setConfig({ ...config, host: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="port">Port *</Label>
              <Input
                id="port"
                type="number"
                placeholder={DEFAULT_CONNECTION.port.toString()}
                value={config.port}
                onChange={(e) =>
                  setConfig({ ...config, port: parseInt(e.target.value) || DEFAULT_CONNECTION.port })
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="database">Database *</Label>
            <Input
              id="database"
              placeholder={DEFAULT_CONNECTION.username}
              value={config.database}
              onChange={(e) =>
                setConfig({ ...config, database: e.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              placeholder={DEFAULT_CONNECTION.username}
              value={config.username}
              onChange={(e) =>
                setConfig({ ...config, username: e.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={config.password}
              onChange={(e) =>
                setConfig({ ...config, password: e.target.value })
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="readOnly"
              checked={config.readOnly || false}
              onCheckedChange={(checked: boolean) =>
                setConfig({ ...config, readOnly: checked })
              }
            />
            <Label htmlFor="readOnly" className="cursor-pointer text-sm font-normal">
              Read-only mode (only allow SELECT, DESCRIBE, and SHOW queries)
            </Label>
          </div>

          {/* Test Connection */}
          <div className="pt-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? "Testing..." : "Test Connection"}
            </Button>
            {testResult && (
              <div className="mt-2">
                <Badge
                  variant={testResult.success ? "default" : "destructive"}
                  className="w-full justify-center py-1.5"
                >
                  {testResult.success ? "✓" : "✗"} {testResult.message}
                </Badge>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">⌘↵ to save</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Connection</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
