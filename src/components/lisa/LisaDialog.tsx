"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeDialogHtml } from "@/lib/safe-html";

function tokenize(html: string): string[] {
  const parts = html.split(/(<[^>]+>|\s+)/).filter((p) => p.length > 0);
  return parts;
}

export function LisaDialog({
  html,
  showCursor,
  onComplete,
}: {
  html: string;
  showCursor: boolean;
  onComplete?: () => void;
}) {
  const safeHtml = useMemo(() => sanitizeDialogHtml(html), [html]);
  const tokens = useMemo(() => tokenize(safeHtml), [safeHtml]);
  const [visibleCount, setVisibleCount] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setVisibleCount(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= tokens.length) {
        window.clearInterval(id);
        onCompleteRef.current?.();
      }
    }, 28);
    return () => window.clearInterval(id);
  }, [tokens]);

  const shown = tokens.slice(0, visibleCount).join("");

  return (
    <div
      className={`c-lisa-step_dialog${showCursor && visibleCount < tokens.length ? " -show-cursor" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      <span dangerouslySetInnerHTML={{ __html: shown || "&nbsp;" }} />
    </div>
  );
}
