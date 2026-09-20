#!/usr/bin/env bash
# Deploy the Dooogs! API worker (chat + STT + TTS).
# Requires: npx wrangler login   OR   export CLOUDFLARE_API_TOKEN=...
set -euo pipefail
cd "$(dirname "$0")/../workers/ginny-api"
npx wrangler deploy
echo "Worker deployed. Mic STT + shared TTS + dog chat are live."
