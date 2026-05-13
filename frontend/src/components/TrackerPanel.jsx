import { useState } from "react";
import JobDocModal from "./JobDocModal";

const STATUS_ORDER = ["saved", "applied", "interview", "offer", "rejected"];

const COLS = [
  { key: "title",    label: "Role",     w: "24%" },
  { key: "company",  label: "Company",  w: "16%" },
  { key: "platform", label: "Platform", w: "13%" },
  { key: "type",     label: "Type",     w: "10%" },
  { key: "status",   label: "Status",   w: "12%" },
  { key: "savedAt",  label: "Saved",    w: "12%" },
  { key: "docs",     label: "Docs",     w: "8%"  },
];

export default function TrackerPanel({ jobs, onUpdate, onDelete }) {
  const [sort, setSort] = useState({ key: "savedAt", dir: -1 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewJob, setViewJob] = useState(null);

  const toggleSort = (key) => setSort(s => ({ key, dir: s.key === key ? -s.dir : -1 }));

  const filtered = jobs
    .filter(j => statusFilter === "all" || j.status === statusFilter)
    .filter(j => !search || [j.title, j.company, j.platform].join(" ").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sort.key] || "";
      const bv = b[sort.key] || "";
      return av < bv ? sort.dir : av > bv ? -sort.dir : 0;
    });

  const statusCounts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = jobs.filter(j => j.status === s).length;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-title">Tracker</div>
      <div className="page-subtitle">
        All saved applications — update status, view docs, manage pipeline
      </div>

      {/* Status pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          className={`status-pill ${statusFilter === "all" ? "active" : ""}`}
          onClick={() => setStatusFilter("all")}
        >
          All <span className="pill-count">{jobs.length}</span>
        </button>
        {STATUS_ORDER.map(s => (
          <button
            key={s}
            className={`status-pill ${statusFilter === s ? "active" : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            <span className="pill-count">{statusCounts[s]}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          style={{ width: "100%", maxWidth: 400, padding: "9px 14px", fontSize: 13 }}
          placeholder="Search roles or companies…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {jobs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text3)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>◫</div>
          <div style={{ fontSize: 14, fontFamily: "var(--mono)" }}>No saved jobs yet</div>
          <div style={{ fontSize: 12, marginTop: 6, fontFamily: "var(--mono)", color: "var(--border2)" }}>
            Go to Hunt, select jobs, and generate docs to save them here
          </div>
        </div>
      ) : (
        <div className="tracker-table">
          {/* Header */}
          <div className="tracker-header">
            {COLS.map(col => (
              <div
                key={col.key}
                className={`th ${sort.key === col.key ? "sorted" : ""}`}
                style={{ width: col.w }}
                onClick={() => col.key !== "docs" && toggleSort(col.key)}
              >
                {col.label}
                {sort.key === col.key && (
                  <span style={{ marginLeft: 4, fontSize: 9 }}>{sort.dir === -1 ? "↓" : "↑"}</span>
                )}
              </div>
            ))}
            <div className="th" style={{ width: "5%" }} />
          </div>

          {/* Rows */}
          {filtered.length === 0
            ? <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text3)", fontSize: 13, fontFamily: "var(--mono)" }}>
                No results match your filters
              </div>
            : filtered.map(job => (
              <TrackerRow
                key={job.id}
                job={job}
                onOpen={() => setViewJob(job)}
                onStatusChange={(s) => onUpdate({ ...job, status: s })}
                onDelete={() => onDelete(job.id)}
              />
            ))
          }
        </div>
      )}

      {viewJob && (
        <JobDocModal
          job={viewJob}
          docs={{ coverLetter: viewJob.coverLetter, tailoredResume: viewJob.tailoredResume }}
          generating={false}
          hasResume={true}
          onGenerate={() => {}}
          onClose={() => setViewJob(null)}
        />
      )}

      <style>{`
        .status-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          font-family: var(--font);
          cursor: pointer;
          border: 1px solid var(--border2);
          background: transparent;
          color: var(--text2);
          transition: all 0.12s;
        }
        .status-pill:hover { background: var(--bg2); color: var(--text); }
        .status-pill.active { background: var(--bg2); border-color: var(--border2); color: var(--text); }
        .pill-count {
          background: var(--bg3);
          color: var(--text3);
          font-size: 10px;
          font-family: var(--mono);
          padding: 1px 6px;
          border-radius: 10px;
        }

        .tracker-table {
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .tracker-header {
          display: flex;
          align-items: center;
          background: var(--bg2);
          border-bottom: 1px solid var(--border);
          padding: 0 14px;
        }

        .th {
          padding: 10px 8px;
          font-size: 10px;
          font-weight: 600;
          font-family: var(--mono);
          letter-spacing: 0.08em;
          color: var(--text3);
          text-transform: uppercase;
          cursor: pointer;
          user-select: none;
          flex-shrink: 0;
          transition: color 0.12s;
        }
        .th:hover { color: var(--text2); }
        .th.sorted { color: var(--accent); }
      `}</style>
    </div>
  );
}

function TrackerRow({ job, onOpen, onStatusChange, onDelete }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="tracker-row"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? "var(--bg2)" : "var(--bg1)" }}
    >
      {/* Role */}
      <div style={{ width: "24%", padding: "12px 8px 12px 14px" }}>
        <div
          style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", cursor: "pointer", marginBottom: 2 }}
          onClick={onOpen}
        >{job.title}</div>
        {job.url && (
          <a href={job.url} target="_blank" rel="noreferrer"
            style={{ fontSize: 10, color: "var(--blue)", fontFamily: "var(--mono)", textDecoration: "none" }}>
            ↗ posting
          </a>
        )}
      </div>

      {/* Company */}
      <div style={{ width: "16%", padding: "12px 8px", fontSize: 12, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {job.company}
      </div>

      {/* Platform */}
      <div style={{ width: "13%", padding: "12px 8px", fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>
        {job.platform || "—"}
      </div>

      {/* Type */}
      <div style={{ width: "10%", padding: "12px 8px" }}>
        <span className={`badge badge-${job.type === "freelance" ? "interview" : "applied"}`}>{job.type}</span>
      </div>

      {/* Status select */}
      <div style={{ width: "12%", padding: "12px 8px" }}>
        <select
          value={job.status}
          onChange={e => onStatusChange(e.target.value)}
          style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, cursor: "pointer", color: "var(--text2)", fontFamily: "var(--mono)" }}
        >
          {STATUS_ORDER.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {/* Saved date */}
      <div style={{ width: "12%", padding: "12px 8px", fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>
        {job.savedAt}
      </div>

      {/* Docs status */}
      <div style={{ width: "8%", padding: "12px 8px", display: "flex", gap: 5, alignItems: "center" }}>
        <span title="Cover letter" style={{ fontSize: 14, opacity: job.coverLetter ? 1 : 0.15 }}>✉</span>
        <span title="Tailored resume" style={{ fontSize: 14, opacity: job.tailoredResume ? 1 : 0.15 }}>◈</span>
      </div>

      {/* Actions */}
      <div style={{ width: "5%", padding: "12px 8px 12px 0", display: "flex", gap: 4, justifyContent: "flex-end" }}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 11, padding: "4px 10px" }}
          onClick={onOpen}
        >Open</button>
      </div>
    </div>
  );
}
