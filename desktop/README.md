# dooogs OS

Local Jarvis-style desktop app for macOS.

## Run locally

```bash
cd desktop
npm install
npm run dev
```

Uses `OPENAI_API_KEY` from the website `.env.local` (sibling folder).

## Voice

Click the mic next to the input. Speech recognition uses the system / Chromium API; replies use your OpenAI key via the agent backend.

## MCP

Connectors are defined in `config/mcp-servers.json`.

- **Connected now (when apps are running):** terminal, github (`gh`), chrome, blender (`uvx mcp-for-blender`), unreal (`http://127.0.0.1:8000/mcp`)
- **Pending until you approve setup:** figma, adobe-photoshop, adobe-illustrator, adobe-aftereffects, spotify, whatsapp, cursor-ai, apple-ios

Every sensitive tool call shows an **Allow / Deny** popup. Denying does not crash the chat — the agent continues.

## Package for the website download button

From the website root:

```bash
./scripts/pack-desktop.sh
```

Writes `public/downloads/dooogs-os-mac.zip`.
