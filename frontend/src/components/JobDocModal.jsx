import { useState } from "react";

export default function JobDocModal({ job, docs, generating, hasResume, onGenerate, onClose }) {
  const [tab, setTab] = useState("jd");
  const [editingCover, setEditingCover] = useState(false);
  const [editingResume, setEditingResume] = useState(false);
  const [coverText, setCoverText] = useState(docs?.coverLetter || "");
  const [resumeText, setResumeText] = useState(docs?.tailoredResume || "");

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const TABS = [
    { id: "jd",     label: "Job Description" },
    { id: "cover",  label: "Cover Letter" },
    { id: "resume", label: "Tailored Resume" },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
              {job.title}
            </div>
            <div style={{ fontSize: 12, color: "var(--text2)", fontFamily: "var(--mono)", display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span>{job.company}</span>
              <span style={{ color: "var(--text3)" }}>·</span>
              <span>{job.location}</span>
              <span style={{ color: "var(--text3)" }}>·</span>
              <span style={{ color: "var(--green)" }}>{job.salary}</span>
              {job.url && <>
                <span style={{ color: "var(--text3)" }}>·</span>
                <a href={job.url} target="_blank" rel="noreferrer"
                  style={{ color: "var(--blue)", textDecoration: "none" }}>↗ View posting</a>
              </>}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ flexShrink: 0 }}>✕</button>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ padding: "0 24px", marginBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
              {t.id === "cover" && docs?.coverLetter && <span style={{ marginLeft: 6, color: "var(--accent)", fontSize: 10 }}>✓</span>}
              {t.id === "resume" && docs?.tailoredResume && <span style={{ marginLeft: 6, color: "var(--accent)", fontSize: 10 }}>✓</span>}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Job Description tab */}
          {tab === "jd" && (
            <pre style={{
              fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.8,
              color: "var(--text2)", whiteSpace: "pre-wrap", wordBreak: "break-word"
            }}>{job.description}</pre>
          )}

          {/* Cover Letter tab */}
          {tab === "cover" && (
            <DocContent
              label="Cover Letter"
              content={docs?.coverLetter}
              editedContent={coverText}
              isEditing={editingCover}
              generating={generating}
              hasResume={hasResume}
              onGenerate={onGenerate}
              onEdit={() => setEditingCover(true)}
              onSave={() => setEditingCover(false)}
              onCopy={() => copyToClipboard(coverText || docs?.coverLetter || "")}
              onTextChange={setCoverText}
            />
          )}

          {/* Tailored Resume tab */}
          {tab === "resume" && (
            <DocContent
              label="Tailored Resume"
              content={docs?.tailoredResume}
              editedContent={resumeText}
              isEditing={editingResume}
              generating={generating}
              hasResume={hasResume}
              onGenerate={onGenerate}
              onEdit={() => setEditingResume(true)}
              onSave={() => setEditingResume(false)}
              onCopy={() => copyToClipboard(resumeText || docs?.tailoredResume || "")}
              onTextChange={setResumeText}
            />
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {!docs && !generating && hasResume && (
            <button className="btn btn-accent" onClick={onGenerate}>
              ⚡ Generate docs for this job
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function DocContent({ label, content, editedContent, isEditing, generating, hasResume, onGenerate, onEdit, onSave, onCopy, onTextChange }) {
  if (generating) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "60px 0" }}>
        <span className="spinner" style={{ width: 20, height: 20 }} />
        <div style={{ fontSize: 13, color: "var(--text2)", fontFamily: "var(--mono)" }}>Generating {label.toLowerCase()}…</div>
        <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>Reading your resume · matching keywords · drafting</div>
      </div>
    );
  }

  if (!content) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "60px 0", textAlign: "center" }}>
        <div style={{ fontSize: 32, color: "var(--text3)" }}>◈</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>No {label.toLowerCase()} yet</div>
        {!hasResume
          ? <div style={{ fontSize: 12, color: "var(--text3)", fontFamily: "var(--mono)" }}>Upload your resume first to enable generation</div>
          : <button className="btn btn-accent" onClick={onGenerate}>⚡ Generate now</button>
        }
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}>
        <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={onCopy}>Copy</button>
        {isEditing
          ? <button className="btn btn-default" style={{ fontSize: 11 }} onClick={onSave}>Save edits</button>
          : <button className="btn btn-default" style={{ fontSize: 11 }} onClick={onEdit}>Edit</button>
        }
      </div>
      {isEditing
        ? <textarea
            value={editedContent || content}
            onChange={e => onTextChange(e.target.value)}
            style={{
              width: "100%", minHeight: 380, padding: "14px 16px",
              fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.8,
              color: "var(--text)", resize: "vertical",
              background: "var(--bg)", border: "1px solid var(--border2)",
              borderRadius: "var(--radius)",
            }}
          />
        : <pre style={{
            fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.85,
            color: "var(--text2)", whiteSpace: "pre-wrap", wordBreak: "break-word"
          }}>{editedContent || content}</pre>
      }
    </div>
  );
}
