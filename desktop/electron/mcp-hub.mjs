import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Always-on MCP connection hub.
 * Built-ins stay local; stdio/http clients are kept warm and reconnected.
 */
export class McpHub {
  constructor(servers, { askPermission } = {}) {
    this.defs = servers || {};
    this.askPermission = askPermission;
    /** @type {Map<string, { client?: import('@modelcontextprotocol/sdk/client/index.js').Client, status: string, kind: string, description?: string, envHint?: string[], error?: string }>} */
    this.live = new Map();
  }

  getServer(name) {
    return this.defs[name] ? { name, ...this.defs[name], ...(this.live.get(name) || {}) } : null;
  }

  listStatus() {
    return Object.keys(this.defs).map((name) => {
      const def = this.defs[name];
      const live = this.live.get(name) || {};
      return {
        name,
        kind: def.kind,
        description: def.description,
        status: live.status || (def.kind === "pending" ? "pending" : "idle"),
        error: live.error || null,
        envHint: def.envHint || [],
      };
    });
  }

  async connectAll() {
    for (const name of Object.keys(this.defs)) {
      await this.connectOne(name);
    }
  }

  async reconnectAll() {
    for (const [name, live] of this.live) {
      try {
        await live.client?.close?.();
      } catch {
        /* ignore */
      }
      this.live.delete(name);
    }
    await this.connectAll();
  }

  async keepalive() {
    for (const [name, live] of this.live) {
      if (live.kind !== "stdio" && live.kind !== "http") continue;
      if (live.status !== "connected") {
        await this.connectOne(name);
        continue;
      }
      try {
        await live.client?.listTools?.();
      } catch {
        live.status = "reconnecting";
        await this.connectOne(name);
      }
    }
  }

  async connectOne(name) {
    const def = this.defs[name];
    if (!def) return;
    if (def.kind === "builtin") {
      this.live.set(name, { status: "connected", kind: "builtin", description: def.description });
      return;
    }
    if (def.kind === "pending") {
      this.live.set(name, {
        status: "pending",
        kind: "pending",
        description: def.description,
        envHint: def.envHint,
      });
      return;
    }

    try {
      const client = new Client({ name: `dooogs-${name}`, version: "0.1.0" });
      if (def.kind === "stdio") {
        const transport = new StdioClientTransport({
          command: def.command,
          args: def.args || [],
          env: process.env,
        });
        await client.connect(transport);
      } else if (def.kind === "http") {
        const transport = new StreamableHTTPClientTransport(new URL(def.url));
        await client.connect(transport);
      } else {
        this.live.set(name, { status: "unsupported", kind: def.kind, description: def.description });
        return;
      }
      this.live.set(name, {
        client,
        status: "connected",
        kind: def.kind,
        description: def.description,
      });
    } catch (err) {
      this.live.set(name, {
        status: "error",
        kind: def.kind,
        description: def.description,
        error: String(err?.message || err),
      });
    }
  }

  async callTool(server, toolName, args) {
    const live = this.live.get(server);
    if (!live?.client) {
      await this.connectOne(server);
    }
    const again = this.live.get(server);
    if (!again?.client) {
      return { error: "not_connected", status: again?.status, detail: again?.error };
    }
    try {
      const result = await again.client.callTool({
        name: toolName,
        arguments: args || {},
      });
      return { ok: true, result };
    } catch (err) {
      again.status = "error";
      again.error = String(err?.message || err);
      return { error: "tool_failed", detail: again.error };
    }
  }

  async listRemoteTools() {
    const out = [];
    for (const [name, live] of this.live) {
      if (!live.client) continue;
      try {
        const listed = await live.client.listTools();
        for (const t of listed.tools || []) {
          out.push({ server: name, ...t });
        }
      } catch {
        /* ignore */
      }
    }
    return out;
  }
}
