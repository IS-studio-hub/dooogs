import OpenAI from "openai";

const SYSTEM = `You are dooogs OS — a Jarvis-style local computer assistant for this Mac.
You can use tools to control the machine, but every sensitive action goes through a permission popup the user must approve.
Be concise, capable, and proactive. If a connector is pending (Figma, Adobe, Spotify, WhatsApp, iOS, Cursor), explain what access is needed and use the mcp tool so the permission popup can start setup.
Prefer small safe steps. Never invent that a tool succeeded if it returned denied/error.
When the user speaks casually, answer warmly; when they ask to do something, do it via tools.`;

export async function runAgentTurn({ apiKey, messages, locale, tools, mcpHub }) {
  const client = new OpenAI({ apiKey });
  const remoteTools = await mcpHub.listRemoteTools().catch(() => []);

  const openaiTools = [
    {
      type: "function",
      function: {
        name: "run_terminal",
        description: "Run a zsh command on this Mac (permission required).",
        parameters: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "open_chrome",
        description: "Open a URL in the default browser / Chrome.",
        parameters: {
          type: "object",
          properties: { url: { type: "string" } },
          required: ["url"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "github_gh",
        description: "Run a GitHub CLI (gh) command, e.g. 'pr list' or 'repo view'.",
        parameters: {
          type: "object",
          properties: { args: { type: "string" } },
          required: ["args"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "mcp_call",
        description:
          "Call a tool on a connected MCP server (blender, unreal, figma, adobe-*, spotify, whatsapp, cursor-ai, apple-ios, …).",
        parameters: {
          type: "object",
          properties: {
            server: { type: "string" },
            tool: { type: "string" },
            args: { type: "object" },
          },
          required: ["server", "tool"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_mcp",
        description: "List MCP connection status and available remote tools.",
        parameters: { type: "object", properties: {} },
      },
    },
  ];

  const chatMessages = [
    {
      role: "system",
      content:
        SYSTEM +
        `\nLocale: ${locale || "en"}.\nKnown remote MCP tools: ${JSON.stringify(
          remoteTools.map((t) => `${t.server}:${t.name}`).slice(0, 80)
        )}`,
    },
    ...messages.map((m) => ({
      role: m.role,
      content: String(m.content || "").slice(0, 8000),
    })),
  ];

  let guard = 0;
  while (guard++ < 8) {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o",
      temperature: 0.4,
      messages: chatMessages,
      tools: openaiTools,
      tool_choice: "auto",
    });

    const msg = completion.choices?.[0]?.message;
    if (!msg) {
      return { reply: "No response from model.", source: "error" };
    }

    if (!msg.tool_calls?.length) {
      return { reply: msg.content?.trim() || "Done.", source: "openai" };
    }

    chatMessages.push({
      role: "assistant",
      content: msg.content || "",
      tool_calls: msg.tool_calls,
    });

    for (const call of msg.tool_calls) {
      const name = call.function?.name;
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch {
        args = {};
      }

      let result;
      try {
        if (name === "run_terminal") result = await tools.runTerminal(args.command);
        else if (name === "open_chrome") result = await tools.openChrome(args.url);
        else if (name === "github_gh") result = await tools.github(args.args);
        else if (name === "mcp_call")
          result = await tools.mcpCall(args.server, args.tool, args.args || {});
        else if (name === "list_mcp")
          result = {
            servers: mcpHub.listStatus(),
            tools: remoteTools.slice(0, 100),
          };
        else result = { error: "unknown_tool", name };
      } catch (err) {
        result = { error: String(err?.message || err) };
      }

      chatMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 12000),
      });
    }
  }

  return {
    reply: "I hit the tool-step limit for this turn — ask me to continue.",
    source: "limit",
  };
}
