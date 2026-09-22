/**
 * Detect social / messenger in-app browsers (LinkedIn, Facebook, Instagram, …).
 * These WebViews often break WebGL, autoplay audio, mic, and device sensors.
 */
export function isInAppBrowser(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  if (!ua) return false;
  if (
    /LinkedIn|LinkedInApp|FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|Snapchat|MicroMessenger|BytedanceWebview|GSA\//i.test(
      ua
    )
  ) {
    return true;
  }
  // iOS WebView that isn't Safari (common for LinkedIn / Mail / etc.)
  const ios = /iPhone|iPad|iPod/i.test(ua);
  if (ios && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)) return true;
  return false;
}

export function canUseWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}
