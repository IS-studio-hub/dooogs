/** Prefix public URLs when hosted under a repo base path (GitHub Pages). */
export function withBase(path: string): string {
  if (!path.startsWith("/")) return path;
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
  if (!base) return path;
  return `${base}${path}`;
}
