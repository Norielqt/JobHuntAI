import { useState, useEffect } from "react";

const LOGIN_PLATFORMS = [
  { id: "upwork",      label: "Upwork",        color: "#14a800", required: true  },
  { id: "onlinejobsph",label: "OnlineJobs.ph", color: "#e05c1e", required: true  },
  { id: "linkedin",    label: "LinkedIn",       color: "#0a66c2", required: false },
];

export default function AccountPanel({ credentials, onSave }) {
  const [apiKey, setApiKey]         = useState(credentials?.anthropicApiKey || "");
  const [backendUrl, setBackendUrl] = useState(credentials?.backendUrl || "http://localhost:8000");
  const [showKey, setShowKey]       = useState(false);
  const [health, setHealth]         = useState(null);
  const [checking, setChecking]     = useState(false);
  const [platformStatuses, setPlatformStatuses] = useState({});
  const [saved, setSaved]           = useState(false);
  const [loginStates, setLoginStates] = useState({});

  const checkBackend = async (url = backendUrl) => {
    setChecking(true);
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(4000) });
      setHealth(res.ok ? "ok" : "error");
      if (res.ok) {
        const s = await fetch(`${url}/platforms/status`);
        if (s.ok) setPlatformStatuses((await s.json()).statuses || {});
      }
    } catch {
      setHealth("offline");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { checkBackend(); }, []); // eslint-disable-line

  const handleSave = () => {
    onSave({ anthropicApiKey: apiKey, backendUrl });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const connectPlatform = async (platformId) => {
    setLoginStates(s => ({ ...s, [platformId]: "connecting" }));
    try {
      const res = await fetch(`${backendUrl}/platforms/${platformId}/login`, { method: "POST" });
      if (res.status === 409) {
        setLoginStates(s => ({ ...s, [platformId]: "already-open" }));
      } else if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLoginStates(s => ({ ...s, [platformId]: `error: ${err.detail || res.status}` }));
      } else {
        // Login flow completed — refresh statuses
        setLoginStates(s => ({ ...s, [platformId]: "done" }));
        await checkBackend(backendUrl);
        setTimeout(() => setLoginStates(s => ({ ...s, [platformId]: null })), 3000);
      }
    } catch (e) {
      setLoginStates(s => ({ ...s, [platformId]: "error: backend unreachable" }));
    }
  };

  return (
    <div>
      <div className="page-title">Account</div>
      <div className="page-subtitle">API keys, backend connection, and platform sessions</div>

      {/* ── Configuration ── */}
      <div className="section-label" style={{ marginBottom: 12 }}>Configuration</div>
      <div className="acc-card">

        {/* Anthropic API key */}
        <div className="acc-field">
          <label className="acc-label">Anthropic API Key</label>
          <div className="acc-row">
            <input
              type={showKey ? "text" : "password"}
              className="acc-input"
              placeholder="sk-ant-api03-…"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
            <button className="btn btn-ghost acc-toggle" onClick={() => setShowKey(s => !s)}>
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <div className="acc-hint">
            Sent to your own backend to call Claude — never exposed in the browser.
            <a
              href="https://console.anthropic.com/account/keys"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--blue)", marginLeft: 8 }}
            >
              Get a key →
            </a>
          </div>
        </div>

        {/* Backend URL */}
        <div className="acc-field" style={{ marginTop: 20 }}>
          <label className="acc-label">Backend URL</label>
          <div className="acc-row">
            <input
              className="acc-input"
              value={backendUrl}
              onChange={e => setBackendUrl(e.target.value)}
              placeholder="http://localhost:8000"
            />
            <button className="btn btn-ghost acc-toggle" disabled={checking} onClick={() => checkBackend(backendUrl)}>
              {checking ? "…" : "Check"}
            </button>
          </div>
          {health && (
            <div className={`acc-status ${health === "ok" ? "ok" : "err"}`}>
              {health === "ok"
                ? "✓ Backend is reachable"
                : "✗ Cannot reach backend — run: python -m uvicorn main:app --reload --port 8000"}
            </div>
          )}
        </div>

        <button className="btn btn-accent" style={{ marginTop: 20 }} onClick={handleSave}>
          {saved ? "✓ Saved" : "Save settings"}
        </button>
      </div>

      <hr className="divider" />

      {/* ── Platform Sessions ── */}
      <div className="section-label" style={{ marginBottom: 8 }}>Platform Sessions</div>
      <div className="page-subtitle" style={{ marginBottom: 16 }}>
        Click <strong>Connect</strong> — a browser window opens on your screen. Log in normally, then the session is saved automatically.
      </div>
      <div className="acc-card">
        {LOGIN_PLATFORMS.map((p, i) => {
          const active = platformStatuses[p.id];
          const ls = loginStates[p.id];
          const isConnecting = ls === "connecting";
          return (
            <div key={p.id} className="plat-row" style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)", paddingTop: i === 0 ? 0 : 14, marginTop: i === 0 ? 0 : 14 }}>
              <div className="plat-row-left">
                <span className="plat-dot" style={{ background: p.color }} />
                <div>
                  <div className="plat-name">{p.label}</div>
                  <div className="plat-note">{p.required ? "Login required to search" : "Optional — reduces rate limiting"}</div>
                </div>
              </div>
              <div className="plat-row-right">
                {ls && ls !== "done" && ls !== "connecting" && (
                  <span style={{ fontSize: 11, color: "var(--red)", fontFamily: "var(--mono)" }}>{ls}</span>
                )}
                <span className={`sess-badge ${active ? "active" : "missing"}`}>
                  {active === undefined ? "—" : active ? "Session active" : "Not connected"}
                </span>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12 }}
                  disabled={isConnecting}
                  onClick={() => connectPlatform(p.id)}
                >
                  {isConnecting ? <><span className="spinner" /> Waiting…</> : ls === "done" ? "✓ Connected" : active ? "Re-connect" : "Connect"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        className="btn btn-ghost"
        style={{ marginTop: 12, fontSize: 12 }}
        onClick={() => checkBackend()}
      >
        ↺ Refresh session status
      </button>

      <div className="acc-note">
        <span style={{ color: "var(--accent)" }}>◆</span>
        &nbsp;Sessions are stored in <code>cookies/</code> in the project root. They expire eventually — click <strong>Re-connect</strong> if a platform stops returning results.
      </div>

      <style>{`
        .acc-card {
          background: var(--bg1);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 22px 24px;
          max-width: 640px;
        }
        .acc-field { display: flex; flex-direction: column; gap: 8px; }
        .acc-label {
          font-size: 11px;
          font-weight: 700;
          font-family: var(--mono);
          color: var(--text3);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .acc-row { display: flex; gap: 8px; align-items: center; }
        .acc-input {
          flex: 1;
          padding: 10px 14px;
          font-size: 13px;
          border-radius: var(--radius);
          font-family: var(--mono);
        }
        .acc-toggle { flex-shrink: 0; font-size: 12px; }
        .acc-hint {
          font-size: 11px;
          color: var(--text3);
          font-family: var(--mono);
          line-height: 1.6;
        }
        .acc-status {
          font-size: 11px;
          font-family: var(--mono);
          padding: 7px 12px;
          border-radius: var(--radius);
          line-height: 1.6;
          margin-top: 2px;
        }
        .acc-status.ok  { color: var(--green);  background: rgba(6,214,160,0.06);  border: 1px solid rgba(6,214,160,0.15); }
        .acc-status.err { color: var(--amber); background: rgba(255,190,11,0.06); border: 1px solid rgba(255,190,11,0.15); }

        .plat-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        .plat-row-left  { display: flex; align-items: center; gap: 12px; }
        .plat-row-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .plat-dot  { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .plat-name { font-size: 13px; font-weight: 600; color: var(--text); }
        .plat-note { font-size: 11px; color: var(--text3); font-family: var(--mono); margin-top: 2px; }

        .sess-badge {
          font-size: 10px;
          font-family: var(--mono);
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 20px;
          letter-spacing: 0.04em;
        }
        .sess-badge.active  { background: rgba(6,214,160,0.1);  color: var(--green); border: 1px solid rgba(6,214,160,0.2); }
        .sess-badge.missing { background: rgba(255,255,255,0.03); color: var(--text3); border: 1px solid var(--border); }

        .acc-note {
          margin-top: 16px;
          max-width: 640px;
          padding: 14px 18px;
          background: rgba(232,255,71,0.04);
          border: 1px solid rgba(232,255,71,0.1);
          border-radius: var(--radius);
          font-size: 12px;
          color: var(--text2);
          font-family: var(--mono);
          line-height: 1.7;
        }
        .acc-note code {
          background: var(--bg3);
          padding: 1px 6px;
          border-radius: 3px;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
}
