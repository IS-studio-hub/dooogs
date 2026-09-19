import type { NextConfig } from "next";
import { existsSync, rmSync } from "fs";
import { join } from "path";

// Local: GITHUB_PAGES=true. CI: GitHub Actions Pages workflow.
const isGithubPages =
  process.env.GITHUB_PAGES === "true" ||
  process.env.GITHUB_ACTIONS === "true";

// GitHub Pages static export cannot include Route Handlers.
if (isGithubPages) {
  const apiDir = join(process.cwd(), "src/app/api");
  if (existsSync(apiDir)) {
    rmSync(apiDir, { recursive: true, force: true });
  }
}

/** Repo name on GitHub Pages: https://<user>.github.io/dooogs/ */
const repoName = "dooogs";
const basePath = isGithubPages ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  ...(isGithubPages
    ? {
        output: "export" as const,
        basePath,
        assetPrefix: `${basePath}/`,
        // GitHub Pages serves `en.html` reliably; trailingSlash caused /en/ → 404
        trailingSlash: false,
        images: { unoptimized: true },
      }
    : {}),
  env: {
    // Always bake the public base path for client asset URLs
    NEXT_PUBLIC_BASE_PATH: basePath,
    // GitHub Pages has no Node API — chat/TTS hit Cloudflare Worker
    NEXT_PUBLIC_API_ORIGIN: isGithubPages
      ? process.env.NEXT_PUBLIC_API_ORIGIN ||
        "https://ginny-dooogs-api.auspicious-turn.workers.dev"
      : process.env.NEXT_PUBLIC_API_ORIGIN || "",
  },
};

export default nextConfig;
