import type { NextConfig } from "next";


import { existsSync, rmSync } from "fs";
import { join } from "path";

// GitHub Pages static export cannot include Route Handlers.
if (process.env.GITHUB_PAGES === "true") {
  const apiDir = join(process.cwd(), "src/app/api");
  if (existsSync(apiDir)) {
    rmSync(apiDir, { recursive: true, force: true });
  }
}

const isGithubPages = process.env.GITHUB_PAGES === "true";
/** Repo name on GitHub Pages: https://<user>.github.io/dooogs/ */
const repoName = "dooogs";
const basePath = isGithubPages ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  ...(isGithubPages
    ? {
        output: "export" as const,
        basePath,
        assetPrefix: `${basePath}/`,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
