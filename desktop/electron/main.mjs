import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { McpHub } from "./mcp-hub.mjs";
import { runAgentTurn } from "./agent.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const isDev = !app.isPackaged;

let mainWindow = null;
let mcpHub = null;
const pendingPermissions = new Map();

function userDataPath(...parts) {
  return path.join(app.getPath("userData"), ...parts);
}

function loadConfig() {
  const cfgPath = path.join(__dirname, "..", "config", "mcp-servers.json");
  return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
}

function getOpenAIKey() {
  // Prefer env, then sibling website .env.local, then stored key
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  try {
    const envPath = path.resolve(__dirname, "../../.env.local");
    if (fs.existsSync(envPath)) {
      const line = fs
        .readFileSync(envPath, "utf8")
        .split("\n")
        .find((l) => l.startsWith("OPENAI_API_KEY="));
      if (line) return line.slice("OPENAI_API_KEY=".length).trim();
    }
  } catch {
    /* ignore */
  }
  const stored = userDataPath("secrets.json");
  if (fs.existsSync(stored)) {
    try {
      const raw = JSON.parse(fs.readFileSync(stored, "utf8"));
      if (raw.openaiKeyB64 && safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(raw.openaiKeyB64, "base64"));
      }
      return raw.openaiKey || "";
    } catch {
      return "";
    }
  }
  return "";
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 880,
    minHeight: 560,
    title: "dooogs OS",
    backgroundColor: "#0b0b0b",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    await mainWindow.loadURL("http://127.0.0.1:5177");
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

function askPermission(payload) {
  return new Promise((resolve) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingPermissions.set(id, resolve);
    mainWindow?.webContents.send("permission:request", { id, ...payload });
    // Auto-deny after 2 minutes if ignored
    setTimeout(() => {
      if (pendingPermissions.has(id)) {
        pendingPermissions.delete(id);
        resolve(false);
      }
    }, 120_000);
  });
}

function registerIpc() {
  ipcMain.handle("app:getStatus", async () => {
    const servers = mcpHub?.listStatus() || [];
    return {
      openaiReady: Boolean(getOpenAIKey()),
      servers,
      version: app.getVersion(),
    };
  });

  ipcMain.handle("permission:respond", async (_e, { id, allow }) => {
    const resolve = pendingPermissions.get(id);
    if (resolve) {
      pendingPermissions.delete(id);
      resolve(Boolean(allow));
    }
    return true;
  });

  ipcMain.handle("chat:send", async (_e, { messages, locale }) => {
    const key = getOpenAIKey();
    if (!key) {
      return {
        reply:
          "OpenAI key missing. Add OPENAI_API_KEY to the website .env.local or set it in dooogs OS settings.",
        source: "error",
      };
    }

    const tools = {
      askPermission,
      runTerminal: async (command) => {
        const ok = await askPermission({
          title: "Terminal access",
          detail: `Allow dooogs OS to run:\n\n${command}`,
          scope: "terminal",
        });
        if (!ok) return { error: "denied" };
        return runShell(command);
      },
      openChrome: async (url) => {
        const ok = await askPermission({
          title: "Open browser",
          detail: `Open this URL in your browser?\n\n${url}`,
          scope: "chrome",
        });
        if (!ok) return { error: "denied" };
        await shell.openExternal(url);
        return { ok: true };
      },
      github: async (args) => {
        const ok = await askPermission({
          title: "GitHub (gh)",
          detail: `Run: gh ${args}`,
          scope: "github",
        });
        if (!ok) return { error: "denied" };
        return runShell(`gh ${args}`);
      },
      mcpCall: async (server, toolName, args) => {
        const meta = mcpHub?.getServer(server);
        if (!meta) return { error: "unknown_server", server };
        if (meta.kind === "pending") {
          const ok = await askPermission({
            title: `Connect ${server}`,
            detail:
              meta.description +
              "\n\nThis connector isn’t installed yet. Allow dooogs OS to guide setup / retry when ready?",
            scope: server,
          });
          return {
            error: "pending_connector",
            allowedSetup: ok,
            hint: meta.envHint || [],
            description: meta.description,
          };
        }
        const ok = await askPermission({
          title: `${server} → ${toolName}`,
          detail: `Allow MCP tool “${toolName}” on ${server}?\n\nArgs: ${JSON.stringify(args || {}, null, 2).slice(0, 800)}`,
          scope: server,
        });
        if (!ok) return { error: "denied" };
        return mcpHub.callTool(server, toolName, args || {});
      },
    };

    return runAgentTurn({
      apiKey: key,
      messages,
      locale: locale || "en",
      tools,
      mcpHub,
    });
  });

  ipcMain.handle("mcp:reconnect", async () => {
    await mcpHub?.reconnectAll();
    return mcpHub?.listStatus() || [];
  });
}

function runShell(command) {
  return new Promise((resolve) => {
    const child = spawn("/bin/zsh", ["-lc", command], {
      env: process.env,
      cwd: app.getPath("home"),
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      resolve({
        code,
        stdout: stdout.slice(0, 12000),
        stderr: stderr.slice(0, 4000),
      });
    });
  });
}

app.whenReady().then(async () => {
  const config = loadConfig();
  mcpHub = new McpHub(config.mcpServers, { askPermission });
  // Keep MCP connections warm in the background
  mcpHub.connectAll().catch((err) => console.error("MCP connect", err));
  setInterval(() => {
    mcpHub?.keepalive().catch(() => undefined);
  }, 30_000);

  registerIpc();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
