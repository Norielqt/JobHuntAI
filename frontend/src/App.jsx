import { useState, useEffect, useCallback } from "react";
import ResumePanel from "./components/ResumePanel";
import HuntPanel from "./components/HuntPanel";
import TrackerPanel from "./components/TrackerPanel";
import Sidebar from "./components/Sidebar";
import AccountPanel from "./components/AccountPanel";
import "./styles/global.css";

const DEFAULT_CREDENTIALS = { backendUrl: "http://localhost:8000", anthropicApiKey: "" };

function loadLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export default function App() {
  const [activeTab, setActiveTab] = useState("hunt");
  const [resume, setResume] = useState(() => loadLS("huntly_resume", null));
  const [savedJobs, setSavedJobs] = useState(() => loadLS("huntly_jobs", []));
  const [credentials, setCredentials] = useState(() => loadLS("huntly_credentials", DEFAULT_CREDENTIALS));

  useEffect(() => {
    if (resume) localStorage.setItem("huntly_resume", JSON.stringify(resume));
    else localStorage.removeItem("huntly_resume");
  }, [resume]);

  useEffect(() => {
    localStorage.setItem("huntly_jobs", JSON.stringify(savedJobs));
  }, [savedJobs]);

  const saveCredentials = useCallback((creds) => {
    setCredentials(creds);
    localStorage.setItem("huntly_credentials", JSON.stringify(creds));
  }, []);

  const addJobs = useCallback((jobs) => {
    setSavedJobs(prev => {
      const existingIds = new Set(prev.map(j => j.id));
      const newJobs = jobs.filter(j => !existingIds.has(j.id));
      return [...prev, ...newJobs];
    });
  }, []);

  const updateJob = useCallback((updatedJob) => {
    setSavedJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
  }, []);

  const deleteJob = useCallback((jobId) => {
    setSavedJobs(prev => prev.filter(j => j.id !== jobId));
  }, []);

  const stats = {
    saved: savedJobs.length,
    applied: savedJobs.filter(j => j.status === "applied").length,
    withDocs: savedJobs.filter(j => j.coverLetter && j.tailoredResume).length,
  };

  return (
    <div className="app">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        hasResume={!!resume}
        hasApiKey={!!credentials.anthropicApiKey}
      />
      <main className="main-content">
        {activeTab === "resume" && (
          <ResumePanel
            resume={resume}
            onUpload={setResume}
            onClear={() => setResume(null)}
            backendUrl={credentials.backendUrl}
          />
        )}
        {activeTab === "hunt" && (
          <HuntPanel
            resume={resume}
            onSaveJobs={addJobs}
            onUpdateJob={updateJob}
            credentials={credentials}
          />
        )}
        {activeTab === "tracker" && (
          <TrackerPanel jobs={savedJobs} onUpdate={updateJob} onDelete={deleteJob} />
        )}
        {activeTab === "account" && (
          <AccountPanel credentials={credentials} onSave={saveCredentials} />
        )}
      </main>
    </div>
  );
}
