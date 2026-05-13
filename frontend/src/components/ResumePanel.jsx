import { useRef, useState, useCallback } from "react";

export default function ResumePanel({ resume, onUpload, onClear, backendUrl = "http://localhost:8000" }) {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    const isBinary = /\.(pdf|docx|doc)$/i.test(file.name);
    if (isBinary) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`${backendUrl}/resume/parse`, { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Parse failed");
        onUpload({ name: file.name, content: data.text, size: file.size, type: file.type });
      } catch (e) {
        setParseError(e.message);
      } finally {
        setParsing(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        onUpload({ name: file.name, content: e.target.result, size: file.size, type: file.type });
        setParsing(false);
      };
      reader.onerror = () => { setParseError("Could not read file"); setParsing(false); };
      reader.readAsText(file);
    }
  }, [onUpload, backendUrl]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  return (
    <div>
      <div className="page-title">Resume</div>
      <div className="page-subtitle">
        Your master document — the AI will only use what's here, never fabricate.
      </div>

      {!resume ? (
        <>
          {parseError && (
            <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(255,90,90,0.06)", border: "1px solid rgba(255,90,90,0.2)", borderRadius: "var(--radius)", fontSize: 12, color: "#ff6b6b", fontFamily: "var(--mono)" }}>
              ✗ {parseError}
            </div>
          )}
          <div
            className={`resume-drop ${drag ? "drag" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => ref.current.click()}
          >
            {parsing ? (
              <><div className="spinner" /><p className="drop-hint">Reading file…</p></>
            ) : (
              <>
                <div className="drop-icon">◈</div>
                <p className="drop-title">Drop your resume here</p>
                <p className="drop-hint">PDF · DOCX · TXT — or click to browse</p>
              </>
            )}
            <input ref={ref} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: "none" }}
              onChange={e => handleFile(e.target.files[0])} />
          </div>
        </>
      ) : (
        <div className="resume-loaded">
          <div className="resume-file-row">
            <div className="resume-file-icon">◈</div>
            <div className="resume-file-info">
              <div className="resume-file-name">{resume.name}</div>
              <div className="resume-file-meta">
                {(resume.size / 1024).toFixed(1)} KB
                &nbsp;·&nbsp;
                {resume.content.length.toLocaleString()} characters parsed
                &nbsp;·&nbsp;
                <span style={{ color: "var(--green)" }}>✓ ready</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              <button className="btn btn-ghost" onClick={() => ref.current.click()}>Replace</button>
              <button className="btn btn-danger" onClick={onClear}>Remove</button>
            </div>
            <input ref={ref} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: "none" }}
              onChange={e => handleFile(e.target.files[0])} />
          </div>

          <div className="resume-preview-label section-label" style={{ marginTop: 28 }}>
            Content preview
          </div>
          <pre className="resume-preview">{resume.content.slice(0, 2000)}{resume.content.length > 2000 ? "\n\n… [truncated — full content is used for generation]" : ""}</pre>

          <div className="resume-note">
            <span style={{ color: "var(--accent)" }}>◆</span>
            &nbsp;When you generate docs for a job, Claude reads this entire document
            and rewrites it to emphasise skills matching that specific role.
            Nothing is invented — only reframed and reordered.
          </div>
        </div>
      )}

      <style>{`
        .resume-drop {
          border: 2px dashed var(--border2);
          border-radius: var(--radius-lg);
          padding: 64px 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.15s;
          background: var(--bg1);
          max-width: 560px;
        }
        .resume-drop.drag {
          border-color: var(--accent2);
          background: rgba(232,255,71,0.04);
        }
        .drop-icon { font-size: 36px; color: var(--text3); }
        .drop-title { font-size: 15px; font-weight: 600; color: var(--text2); }
        .drop-hint { font-size: 12px; font-family: var(--mono); color: var(--text3); }

        .resume-loaded { max-width: 760px; }
        .resume-file-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 20px;
          background: var(--bg1);
          border: 1px solid var(--border2);
          border-radius: var(--radius-lg);
        }
        .resume-file-icon { font-size: 28px; color: var(--accent); flex-shrink: 0; }
        .resume-file-name { font-size: 14px; font-weight: 600; color: var(--text); }
        .resume-file-meta { font-size: 11px; font-family: var(--mono); color: var(--text3); margin-top: 3px; }

        .resume-preview {
          background: var(--bg1);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 18px 20px;
          font-family: var(--mono);
          font-size: 11.5px;
          line-height: 1.8;
          color: var(--text2);
          max-height: 300px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .resume-note {
          margin-top: 16px;
          padding: 14px 18px;
          background: rgba(232,255,71,0.04);
          border: 1px solid rgba(232,255,71,0.1);
          border-radius: var(--radius);
          font-size: 12px;
          color: var(--text2);
          font-family: var(--mono);
          line-height: 1.7;
        }
      `}</style>
    </div>
  );
}
