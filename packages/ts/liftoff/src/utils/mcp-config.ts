import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getMcpServerUrl } from "./config.js";

/**
 * Supported MCP-capable editor identifiers.
 */
export type EditorId =
  | "cursor"
  | "claude-code"
  | "windsurf"
  | "vscode"
  | "opencode";

interface EditorConfig {
  /** Display name shown in the wizard */
  name: string;
  /** How the editor is configured: file-based JSON or CLI command */
  configType: "file" | "cli";
  /** Returns the path to the MCP config file (file-based editors only) */
  configPath?: (projectDir: string) => string;
  /** Returns paths to check for editor detection */
  detectPaths: (projectDir: string) => string[];
}

/**
 * Configuration map for all supported MCP-capable editors.
 *
 * Each entry defines how to detect the editor and where to write MCP config.
 */
export const EDITOR_CONFIGS: Record<EditorId, EditorConfig> = {
  cursor: {
    name: "Cursor",
    configType: "file",
    configPath: (projectDir) =>
      path.join(projectDir, ".cursor", "mcp.json"),
    detectPaths: (projectDir) => [
      path.join(projectDir, ".cursor"),
      path.join(os.homedir(), ".cursor"),
    ],
  },
  "claude-code": {
    name: "Claude Code",
    configType: "cli",
    detectPaths: () => [],
  },
  windsurf: {
    name: "Windsurf",
    configType: "file",
    configPath: () =>
      path.join(
        os.homedir(),
        ".codeium",
        "windsurf",
        "mcp_config.json",
      ),
    detectPaths: () => [
      path.join(os.homedir(), ".codeium", "windsurf"),
    ],
  },
  vscode: {
    name: "VS Code",
    configType: "file",
    configPath: (projectDir) =>
      path.join(projectDir, ".vscode", "mcp.json"),
    detectPaths: (projectDir) => [
      path.join(projectDir, ".vscode"),
    ],
  },
  opencode: {
    name: "OpenCode",
    configType: "file",
    configPath: (projectDir) =>
      path.join(projectDir, ".opencode", "mcp.json"),
    detectPaths: (projectDir) => [
      path.join(projectDir, ".opencode"),
    ],
  },
};

/**
 * Detect which MCP-capable editors are installed/present for the given project.
 *
 * Checks filesystem paths and CLI availability to determine which editors
 * the user has installed. Returns an array of detected editor IDs.
 *
 * @param projectDir - Root directory of the user's project
 * @returns Array of detected EditorId values
 */
export function detectEditors(projectDir: string): EditorId[] {
  const detected: EditorId[] = [];

  for (const [id, config] of Object.entries(EDITOR_CONFIGS)) {
    const editorId = id as EditorId;

    if (editorId === "claude-code") {
      // Claude Code is detected by checking if the `claude` binary is on PATH
      try {
        execSync("which claude", {
          stdio: ["pipe", "pipe", "pipe"],
        });
        detected.push(editorId);
      } catch {
        // Not installed
      }
      continue;
    }

    const paths = config.detectPaths(projectDir);
    if (paths.some((p) => fs.existsSync(p))) {
      detected.push(editorId);
    }
  }

  return detected;
}

/**
 * Build the MCP server entry object for The Context Company.
 *
 * @param readonlyKey - The readonly API key (tcc_key_ prefix)
 * @returns MCP server configuration object
 */
export function buildMcpServerEntry(readonlyKey: string): {
  type: string;
  url: string;
  headers: { Authorization: string };
} {
  return {
    type: "http",
    url: getMcpServerUrl(),
    headers: {
      Authorization: `Bearer ${readonlyKey}`,
    },
  };
}

/**
 * Write or merge MCP config for a file-based editor.
 *
 * Reads the existing config file (if any), ensures `mcpServers` key exists,
 * and sets the `context-company` server entry. All other existing servers
 * are preserved.
 *
 * @param editorId - The editor to configure
 * @param projectDir - Root directory of the user's project
 * @param readonlyKey - The readonly API key (tcc_key_ prefix)
 */
export function writeMcpConfig(
  editorId: EditorId,
  projectDir: string,
  readonlyKey: string,
): void {
  const config = EDITOR_CONFIGS[editorId];
  if (config.configType !== "file" || !config.configPath) {
    throw new Error(
      `Editor ${editorId} does not use file-based config`,
    );
  }

  const configPath = config.configPath(projectDir);
  const dir = path.dirname(configPath);

  // Ensure parent directories exist
  fs.mkdirSync(dir, { recursive: true });

  // Read existing config or start fresh
  let parsed: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      // If file is corrupt, start fresh
      console.error(
        `[TCC] Could not parse ${configPath}, creating new config`,
      );
      parsed = {};
    }
  }

  // Ensure mcpServers key exists
  if (
    !parsed.mcpServers ||
    typeof parsed.mcpServers !== "object"
  ) {
    parsed.mcpServers = {};
  }

  // Add/update only the context-company entry, preserving others
  (parsed.mcpServers as Record<string, unknown>)[
    "context-company"
  ] = buildMcpServerEntry(readonlyKey);

  // Write back
  fs.writeFileSync(
    configPath,
    JSON.stringify(parsed, null, 2) + "\n",
    "utf-8",
  );
}

/**
 * Run `claude mcp add` to configure Claude Code for MCP.
 *
 * @param readonlyKey - The readonly API key (tcc_key_ prefix)
 * @returns Object indicating success or failure with optional error message
 */
export function runClaudeMcpAdd(readonlyKey: string): {
  success: boolean;
  error?: string;
} {
  try {
    execSync(
      `claude mcp add --transport http context-company ${getMcpServerUrl()} --header "Authorization: Bearer ${readonlyKey}"`,
      {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 10_000,
      },
    );
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
