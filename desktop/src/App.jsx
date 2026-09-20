import { useEffect, useRef, useState } from "react";

function MicButton({ listening, onToggle, disabled }) {
  return (
    <button
      type="button"
      className={`mic ${listening ? "on" : ""}`}
      aria-label={listening ? "Stop listening" : "Talk"}
      disabled={disabled}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {listening ? (
          <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
        ) : (
          <>
            <path
              d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3z"
              fill="currentColor"
            />
            <path
              d="M5 11a7 7 0 0 0 14 0M12 18v3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </button>
  );
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "I’m dooogs OS — your local Jarvis. Ask me to control this Mac. Sensitive actions will pop up for your approval. MCP connectors stay warm in the background.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState(null);
  const [permission, setPermission] = useState(null);
  const recRef = useRef(null);
  const scroller = useRef(null);

  useEffect(() => {
    window.dooogs?.getStatus?.().then(setStatus).catch(() => undefined);
    const off = window.dooogs?.onPermission?.((req) => setPermission(req));
    return () => off?.();
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text) {
    const value = (text ?? input).trim();
    if (!value || busy) return;
    const next = [...messages, { role: "user", content: value }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await window.dooogs.sendChat({
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        locale: "en",
      });
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res?.reply || "No reply." },
      ]);
      window.dooogs?.getStatus?.().then(setStatus).catch(() => undefined);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${String(err?.message || err)}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Microphone speech recognition isn’t available in this build — type instead.",
        },
      ]);
      return;
    }
    if (listening) {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (ev) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < ev.results.length; i++) {
        const row = ev.results[i];
        const piece = row?.[0]?.transcript || "";
        if (row.isFinal) finalText += piece;
        else interim += piece;
      }
      const next = (finalText || interim).trim();
      if (next) setInput(next);
      if (finalText.trim()) {
        setListening(false);
        void send(finalText.trim());
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function answerPermission(allow) {
    if (!permission) return;
    await window.dooogs.respondPermission({ id: permission.id, allow });
    setPermission(null);
  }

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">dooogs OS</div>
        <p className="tag">Local Jarvis · always-on MCP</p>
        <button
          type="button"
          className="ghost"
          onClick={() =>
            window.dooogs
              ?.reconnectMcp?.()
              .then(() => window.dooogs.getStatus())
              .then(setStatus)
          }
        >
          Reconnect MCP
        </button>
        <ul className="mcp-list">
          {(status?.servers || []).map((s) => (
            <li key={s.name} className={`mcp ${s.status}`}>
              <span className="dot" />
              <div>
                <strong>{s.name}</strong>
                <small>{s.status}{s.error ? ` · ${s.error}` : ""}</small>
              </div>
            </li>
          ))}
        </ul>
        <div className="foot">
          {status?.openaiReady ? "OpenAI ready" : "Add OPENAI_API_KEY"}
        </div>
      </aside>

      <main className="stage">
        <div className="log" ref={scroller}>
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.content}
            </div>
          ))}
          {busy ? <div className="bubble assistant dim">Working…</div> : null}
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask dooogs OS anything…"
            disabled={busy}
            aria-label="Message"
          />
          <MicButton listening={listening} onToggle={toggleMic} disabled={busy} />
          <button type="submit" className="send" disabled={busy || !input.trim()}>
            →
          </button>
        </form>
      </main>

      {permission ? (
        <div className="perm-backdrop" role="dialog" aria-modal="true">
          <div className="perm-card">
            <h2>{permission.title || "Permission needed"}</h2>
            <pre>{permission.detail}</pre>
            <div className="perm-actions">
              <button type="button" className="ghost" onClick={() => answerPermission(false)}>
                Deny
              </button>
              <button type="button" className="allow" onClick={() => answerPermission(true)}>
                Allow
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
