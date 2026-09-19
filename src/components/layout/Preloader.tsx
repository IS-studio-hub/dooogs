"use client";

import { useEffect, useState } from "react";
import { DooogsLogo } from "@/components/layout/DooogsLogo";

export function Preloader() {
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("is-first-loading", "is-loading");
    const quick =
      typeof window !== "undefined" &&
      sessionStorage.getItem("ginny.quickpreload") === "1";
    const delay = quick ? 400 : 1200;

    const t = window.setTimeout(() => {
      setDone(true);
      document.documentElement.classList.remove("is-first-loading", "is-loading");
      document.documentElement.classList.add("is-loaded", "is-ready");
      sessionStorage.setItem("ginny.quickpreload", "1");
    }, delay);

    const hide = window.setTimeout(() => setHidden(true), delay + 900);

    return () => {
      window.clearTimeout(t);
      window.clearTimeout(hide);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className={`c-preloader${done ? " is-done" : ""}`}
      aria-hidden="true"
      id="preloader"
    >
      <DooogsLogo className="c-preloader_logo c-preloader_logo_img" invert />
    </div>
  );
}
