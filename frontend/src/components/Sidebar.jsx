import "../styles/sidebar.css";

const NAV = [
  { id: "hunt",    icon: "⌖", label: "Hunt",    desc: "Find jobs" },
  { id: "tracker", icon: "◫", label: "Tracker",  desc: "Saved applications" },
  { id: "resume",  icon: "◈", label: "Resume",   desc: "Your source doc" },  { id: "account", icon: "⬡", label: "Account",  desc: "Keys & connections" },];

export default function Sidebar({ activeTab, setActiveTab, stats, hasResume, hasApiKey }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-mark">H</span>
        <span className="logo-text">untly</span>
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
        <div className="footer-text">Huntly v1.0</div>
        <div className="footer-sub">Personal job hunter</div>
      </div>
    </aside>
  );
}
