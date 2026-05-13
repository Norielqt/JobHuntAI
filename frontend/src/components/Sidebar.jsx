import "../styles/sidebar.css";

const Icon = ({ children }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const NAV = [
  { id: "hunt",    label: "Hunt",    desc: "Find new jobs",
    icon: <Icon><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Icon> },
  { id: "tracker", label: "Tracker", desc: "Saved applications",
    icon: <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M8 4v4" /></Icon> },
  { id: "resume",  label: "Resume",  desc: "Your source doc",
    icon: <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></Icon> },
  { id: "account", label: "Account", desc: "Keys & connections",
    icon: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon> },
];

export default function Sidebar({ activeTab, setActiveTab, stats, hasResume, hasApiKey }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">J</div>
        <div className="logo-text">
          JobHunter<span className="logo-tld">.io</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? "active" : ""}`}
            onClick={() => setActiveTab(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <div className="nav-label-wrap">
              <span className="nav-label">{item.label}</span>
              <span className="nav-desc">{item.desc}</span>
            </div>
            {item.id === "resume" && !hasResume && (
              <span className="nav-dot" title="No resume uploaded" />
            )}
            {item.id === "account" && !hasApiKey && (
              <span className="nav-dot" title="API key not configured" />
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-stats">
        <div className="stat-label">Overview</div>
        <div className="stat-row">
          <span className="stat-key">Saved</span>
          <span className="stat-val">{stats.saved}</span>
        </div>
        <div className="stat-row">
          <span className="stat-key">Applied</span>
          <span className="stat-val">{stats.applied}</span>
        </div>
        <div className="stat-row">
          <span className="stat-key">With docs</span>
          <span className="stat-val accent">{stats.withDocs}</span>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="footer-text">JobHunter.io v1.0</div>
        <div className="footer-sub">AI-powered job hunter</div>
      </div>
    </aside>
  );
}
