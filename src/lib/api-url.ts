import { withBase } from "@/lib/base-path";

/** Cloudflare Worker that serves /api/chat + /api/tts for GitHub Pages. */
const PAGES_API_ORIGIN = "https://ginny-dooogs-api.encouraging-tablecloth-a0e.workers.dev";

/**
 * API routes on GitHub Pages must hit an external origin (Cloudflare Worker).
 * Locally, same-origin /api/* via Next route handlers.
 */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  let origin = (process.env.NEXT_PUBLIC_API_ORIGIN || "").replace(/\/$/, "");

  if (
    !origin &&
    typeof window !== "undefined" &&
    window.location.hostname.endsWith("github.io")
  ) {
    origin = PAGES_API_ORIGIN;
  }

  if (origin) return `${origin}${normalized}`;
  return withBase(normalized);
}
