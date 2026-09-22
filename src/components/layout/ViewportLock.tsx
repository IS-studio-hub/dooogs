"use client";

import { useEffect } from "react";

/**
 * Fixes the “page pushed up / blank viewport” bug when opening from LinkedIn,
 * Facebook, or other in-app browsers into Safari/Chrome. Those handoffs often
 * leave a non-zero scroll offset or a stale visualViewport height until refresh.
 */
export function ViewportLock() {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const vv = window.visualViewport;
      const h = Math.round(vv?.height || window.innerHeight || root.clientHeight);
      if (h > 0) {
        root.style.setProperty("--app-height", `${h}px`);
      }

      // Kill residual scroll from the in-app → browser transition
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
      if (root.scrollTop) root.scrollTop = 0;
      if (document.body.scrollTop) document.body.scrollTop = 0;

      // If the visual viewport is offset (iOS URL bar / keyboard glitch), nudge back
      if (vv && vv.offsetTop > 0) {
        window.scrollTo(0, Math.max(0, window.scrollY - vv.offsetTop));
        window.scrollTo(0, 0);
      }
    };

    apply();
    const timers = [50, 250, 600, 1200].map((ms) => window.setTimeout(apply, ms));

    const onShow = () => apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", onShow);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("focus", onShow);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") apply();
    });
    window.visualViewport?.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("scroll", apply);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", onShow);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("focus", onShow);
      window.visualViewport?.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("scroll", apply);
    };
  }, []);

  return null;
}
