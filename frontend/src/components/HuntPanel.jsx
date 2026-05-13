import { useState, useCallback } from "react";
import JobDocModal from "./JobDocModal";

const PLATFORMS = [
  { id: "upwork",         label: "Upwork",          color: "#14a800", type: "freelance" },
  { id: "onlinejobsph",   label: "OnlineJobs.ph",   color: "#e05c1e", type: "full-time" },
  { id: "linkedin",       label: "LinkedIn",         color: "#0a66c2", type: "both" },
  { id: "remoteok",       label: "RemoteOK",         color: "#06d6a0", type: "both" },
  { id: "jobstreet",      label: "JobStreet",        color: "#f05537", type: "full-time" },
  { id: "freelancer",     label: "Freelancer.com",   color: "#0071c2", type: "freelance", disabled: true },
  { id: "indeed",         label: "Indeed",           color: "#2164f3", type: "full-time", disabled: true },
  { id: "weworkremotely", label: "WeWorkRemotely",   color: "#a855f7", type: "both" },
];

export default function HuntPanel({ resume, onSaveJobs, onUpdateJob, credentials }) {
  const { backendUrl = "http://localhost:8000", anthropicApiKey = "" } = credentials || {};
  const canGenerate = !!resume && !!anthropicApiKey;
  const [platforms, setPlatforms] = useState({ upwork: true, onlinejobsph: true, linkedin: true, remoteok: true });
  const [keywords, setKeywords] = useState("");
  const [jobType, setJobType] = useState("both");
  const [results, setResults] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [generating, setGenerating] = useState(new Set());
  const [viewJob, setViewJob] = useState(null);
  const [generatedDocs, setGeneratedDocs] = useState({});

  const togglePlatform = (id) => setPlatforms(p => ({ ...p, [id]: !p[id] }));
  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map(j => j.id)));
  };

  const fetchJobs = async () => {
    if (!keywords.trim()) return;
    setFetching(true);
    setResults([]);
    setSelected(new Set());
    setFetchError(null);
    try {
      const active = Object.entries(platforms).filter(([, v]) => v).map(([k]) => k);
      if (!active.length) return;
      const params = new URLSearchParams({
        q: keywords,
        platforms: active.join(","),
        limit: "25",
        ...(jobType !== "both" && { job_type: jobType }),
      });
      const res = await fetch(`${backendUrl}/scrape?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Scrape failed");
      setResults(data.jobs || []);
      if (data.errors && Object.keys(data.errors).length) {
        setFetchError(`Partial results — failed: ${Object.keys(data.errors).join(", ")}`);
      }
    } catch (e) {
      setFetchError(e.message);
    } finally {
      setFetching(false);
    }
  };

  const generateDocs = async (jobIds) => {
    if (!canGenerate) return;
    const jobs = results.filter(j => jobIds.includes(j.id));
    setGenerating(prev => new Set([...prev, ...jobIds]));

    const jobsToSave = jobs.map(j => ({
      ...j,
      status: "saved",
      savedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      coverLetter: null,
      tailoredResume: null,
    }));
    onSaveJobs(jobsToSave);

    await Promise.all(jobs.map(async (job) => {
      try {
        const res = await fetch(`${backendUrl}/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": anthropicApiKey,
          },
          body: JSON.stringify({
            resume: resume.content,
            job_title: job.title,
            job_company: job.company,
            job_description: job.description,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Generation failed");
        const docs = { coverLetter: data.coverLetter, tailoredResume: data.tailoredResume };
        setGeneratedDocs(prev => ({ ...prev, [job.id]: docs }));
        onUpdateJob({
          ...job, ...docs, status: "saved",
          savedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        });
      } catch (e) {
        console.error(`[generate] ${job.title}:`, e.message);
      } finally {
        setGenerating(prev => { const n = new Set(prev); n.delete(job.id); return n; });
      }
    }));
  };

  const selectedArr = [...selected];
  const activePlatformCount = Object.values(platforms).filter(Boolean).length;
  const platform = (id) => PLATFORMS.find(p => p.id === id);

  return (
    <div>
      <div className="page-title">Hunt</div>
      <div className="page-subtitle">
        Search across platforms · select jobs · generate tailored docs in bulk
      </div>

      {/* Search bar */}
      <div className="search-row">
        <input
          className="search-input"
          placeholder="Keywords — e.g. React Developer, Frontend Engineer…"
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchJobs()}
        />
        <select
          value={jobType}
          onChange={e => setJobType(e.target.value)}
          className="type-select"
        >
          <option value="both">All types</option>
          <option value="full-time">Full-time</option>
          <option value="freelance">Freelance</option>
        </select>
        <button
          className="btn btn-accent"
          onClick={fetchJobs}
          disabled={fetching || !keywords.trim() || activePlatformCount === 0}
        >
          {fetching ? <><span className="spinner" /> Fetching…</> : `Search ${activePlatformCount} platform${activePlatformCount !== 1 ? "s" : ""}`}
        </button>
      </div>

      {/* Platform toggles */}
      <div className="section-label" style={{ marginBottom: 10 }}>Platforms</div>
      <div className="platform-grid">
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            className={`platform-chip ${platforms[p.id] ? "on" : "off"} ${p.disabled ? "disabled" : ""}`}
            style={{ "--pc": p.color }}
            onClick={() => !p.disabled && togglePlatform(p.id)}
            disabled={p.disabled}
            title={p.disabled ? "Coming soon" : undefined}
          >
            <span className="platform-dot" />
            {p.label}
            <span className="platform-type">{p.disabled ? "soon" : p.type}</span>
          </button>
        ))}
      </div>

      <hr className="divider" />

      {/* Fetch error banner */}
      {fetchError && (
        <div style={{ fontSize: 12, color: "var(--amber)", fontFamily: "var(--mono)", marginBottom: 14, padding: "8px 14px", background: "rgba(255,190,11,0.05)", borderRadius: "var(--radius)", border: "1px solid rgba(255,190,11,0.15)" }}>
          ⚠ {fetchError}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          <div className="results-toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="checkbox" style={{ width: 18, height: 18 }}
                onClick={toggleAll}
                data-checked={selected.size === results.length}
              >
                {selected.size === results.length && <span style={{ fontSize: 11, color: "#080808", fontWeight: 800 }}>✓</span>}
                {selected.size > 0 && selected.size < results.length && (
                  <span style={{ width: 8, height: 2, background: "#080808", display: "block", borderRadius: 1 }} />
                )}
              </div>
              <span className="section-label" style={{ margin: 0 }}>
                {results.length} jobs found
                {selected.size > 0 && ` · ${selected.size} selected`}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!resume && (
                <span style={{ fontSize: 11, color: "var(--amber)", fontFamily: "var(--mono)" }}>
                  ⚠ Upload resume to generate docs
                </span>
              )}
              {resume && !anthropicApiKey && (
                <span style={{ fontSize: 11, color: "var(--amber)", fontFamily: "var(--mono)" }}>
                  ⚠ Add API key in Account settings
                </span>
              )}
              <button
                className="btn btn-accent"
                disabled={selected.size === 0 || !canGenerate || generating.size > 0}
                onClick={() => generateDocs(selectedArr)}
              >
                {generating.size > 0
                  ? <><span className="spinner" /> Generating {generating.size}…</>
                  : `⚡ Generate docs for ${selected.size || 0} job${selected.size !== 1 ? "s" : ""}`
                }
              </button>
            </div>
          </div>

          <div className="job-list">
            {results.map((job, i) => {
              const pl = platform(job.platform);
              const isSelected = selected.has(job.id);
              const isGenerating = generating.has(job.id);
              const hasDocs = !!generatedDocs[job.id];

              return (
                <div
                  key={job.id}
                  className={`job-card ${isSelected ? "selected" : ""}`}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div
                    className={`checkbox ${isSelected ? "checked" : ""}`}
                    onClick={() => toggleSelect(job.id)}
                  />

                  <div className="job-card-body" onClick={() => setViewJob(job)}>
                    <div className="job-card-top">
                      <div>
                        <div className="job-title">{job.title}</div>
                        <div className="job-meta">
                          <span>{job.company}</span>
                          <span className="meta-sep">·</span>
                          <span>{job.location}</span>
                          <span className="meta-sep">·</span>
                          <span style={{ color: "var(--green)", fontFamily: "var(--mono)" }}>{job.salary}</span>
                        </div>
                      </div>
                      <div className="job-card-right">
                        <span
                          className="platform-badge"
                          style={{ "--pc": pl?.color || "#888" }}
                        >{pl?.label || job.platform}</span>
                        <span className="job-posted">{job.postedAt}</span>
                      </div>
                    </div>

                    <p className="job-desc">{job.description.slice(0, 140)}…</p>

                    <div className="job-card-footer">
                      <span className={`badge badge-${job.type === "freelance" ? "interview" : "applied"}`}>
                        {job.type}
                      </span>
                      {job.url && (
                        <a href={job.url} target="_blank" rel="noreferrer"
                          className="job-link" onClick={e => e.stopPropagation()}>
                          ↗ View posting
                        </a>
                      )}
                      {isGenerating && (
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>
                          <span className="spinner" /> Generating docs…
                        </span>
                      )}
                      {hasDocs && !isGenerating && (
                        <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)" }}>✓ Docs ready</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {results.length === 0 && !fetching && (
        <div className="empty-state">
          <div className="empty-icon">⌖</div>
          <div className="empty-title">No results yet</div>
          <div className="empty-sub">Enter keywords and select platforms to start hunting</div>
        </div>
      )}

      {viewJob && (
        <JobDocModal
          job={viewJob}
          docs={generatedDocs[viewJob.id]}
          generating={generating.has(viewJob.id)}
          hasResume={!!resume}
          onGenerate={() => generateDocs([viewJob.id])}
          onClose={() => setViewJob(null)}
        />
      )}

      <style>{`
        .search-row {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          align-items: center;
        }
        .search-input {
          flex: 1;
          padding: 11px 16px;
          font-size: 14px;
          border-radius: var(--radius);
        }
        .type-select {
          padding: 11px 14px;
          font-size: 13px;
          border-radius: var(--radius);
          cursor: pointer;
          color: var(--text2);
          flex-shrink: 0;
        }

        .platform-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 8px;
        }
        .platform-chip {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          font-family: var(--font);
          cursor: pointer;
          transition: all 0.15s;
          border: 1.5px solid;
        }
        .platform-chip.on {
          background: rgba(var(--pc), 0.1);
          border-color: var(--pc);
          color: var(--text);
        }
        .platform-chip.off {
          background: transparent;
          border-color: var(--border);
          color: var(--text3);
          opacity: 0.5;
        }
        .platform-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--pc);
          flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .platform-chip.off .platform-dot { opacity: 0.3; }
        .platform-type {
          font-size: 9px;
          font-family: var(--mono);
          color: var(--text3);
          background: var(--bg2);
          padding: 1px 5px;
          border-radius: 3px;
        }

        .results-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--border);
        }

        .job-list { display: flex; flex-direction: column; gap: 8px; }

        .job-card {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px 18px;
          background: var(--bg1);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          transition: all 0.13s;
          animation: fadeUp 0.2s ease forwards;
          opacity: 0;
        }
        .job-card:hover { border-color: var(--border2); background: var(--bg2); }
        .job-card.selected { border-color: rgba(232,255,71,0.3); background: rgba(232,255,71,0.03); }

        .job-card-body { flex: 1; min-width: 0; cursor: pointer; }

        .job-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 8px;
        }

        .job-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .job-meta {
          font-size: 12px;
          color: var(--text2);
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .meta-sep { color: var(--text3); }

        .job-card-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
          flex-shrink: 0;
        }

        .platform-badge {
          font-size: 10px;
          font-weight: 700;
          font-family: var(--mono);
          padding: 3px 9px;
          border-radius: 20px;
          background: rgba(0,0,0,0.3);
          border: 1px solid var(--pc);
          color: var(--pc);
          letter-spacing: 0.04em;
        }

        .job-posted {
          font-size: 10px;
          font-family: var(--mono);
          color: var(--text3);
        }

        .job-desc {
          font-size: 12.5px;
          color: var(--text2);
          line-height: 1.6;
          margin-bottom: 12px;
          font-family: var(--mono);
        }

        .job-card-footer {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .job-link {
          font-size: 11px;
          font-family: var(--mono);
          color: var(--blue);
          text-decoration: none;
        }
        .job-link:hover { text-decoration: underline; }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 0;
          gap: 10px;
        }
        .empty-icon { font-size: 40px; color: var(--text3); }
        .empty-title { font-size: 15px; font-weight: 600; color: var(--text2); }
        .empty-sub { font-size: 12px; font-family: var(--mono); color: var(--text3); }
      `}</style>
    </div>
  );
}
