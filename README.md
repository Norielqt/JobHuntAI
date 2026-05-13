# Huntly — AI Job Hunter

Personal job hunting web app. Scrapes multiple platforms, lets you bulk-select jobs,
and auto-generates tailored resumes and cover letters using your real experience.

---

## Project Structure

```
huntly/
├── frontend/          React app (Vite)
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   ├── ResumePanel.jsx
│       │   ├── HuntPanel.jsx
│       │   ├── TrackerPanel.jsx
│       │   └── JobDocModal.jsx
│       └── styles/
└── backend/           FastAPI + Playwright
    ├── main.py
    ├── models.py
    ├── requirements.txt
    └── scrapers/
        ├── base.py          Shared Playwright logic
        ├── upwork.py        Login required
        ├── linkedin.py      Login recommended
        ├── onlinejobsph.py  Login required
        ├── remoteok.py      Public API — no login
        ├── weworkremotely.py RSS feed — no login
        └── jobstreet.py     Playwright
```

---

## Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
uvicorn main:app --reload --port 8000
```

### Login to platforms (one-time setup)

Platforms that require login — run each once to save session cookies:

```bash
# Upwork
python -m scrapers.upwork --login

# OnlineJobs.ph — add --login flag similarly
# linkedin — optional but reduces rate-limiting
```

A headed browser will open. Log in normally. Press ENTER in the terminal.
Cookies are saved to `backend/cookies/` and reused automatically.

### Test the API

```bash
# Health check
curl http://localhost:8000/health

# Search across platforms
curl "http://localhost:8000/scrape?q=React+Developer&platforms=remoteok,weworkremotely&limit=5"
```

---

## Frontend Setup

```bash
cd frontend
npm create vite@latest . -- --template react
# Copy src/ files from this project into the Vite src/ folder
npm install
npm run dev
```

### Connect to backend

In `HuntPanel.jsx`, replace the mock results block with a real fetch:

```js
// Replace the mock await + MOCK_RESULTS filter with:
const activePlatforms = Object.entries(platforms)
  .filter(([, v]) => v)
  .map(([k]) => k)
  .join(",");

const res = await fetch(
  `http://localhost:8000/scrape?q=${encodeURIComponent(keywords)}&platforms=${activePlatforms}&limit=10`
);
const data = await res.json();
setResults(data.jobs);
```

---

## How the AI generation works

When you select jobs and click **Generate docs**, the frontend calls the Claude API directly
with your uploaded resume text and each job's description. The system prompt enforces:

- Only real experience from your resume is used
- Keywords from the JD are woven in naturally
- Cover letter stays under 350 words
- Tailored resume reorders and reframes — never invents

You can edit any generated doc inline before saving or copying.

---

## Adding more platforms

1. Create `backend/scrapers/yourplatform.py`
2. Inherit from `BaseScraper`, implement `async def scrape(self, keywords, limit) -> list[Job]`
3. Add to `SCRAPER_MAP` in `main.py`
4. Add to `PLATFORMS` array in `frontend/src/components/HuntPanel.jsx`

---

## Notes on scraping legality

- **RemoteOK** and **WeWorkRemotely** use public APIs/RSS — fully fine.
- **LinkedIn**, **Upwork**, **OnlineJobs.ph**, **JobStreet** — scraped for personal use.
  Their ToS prohibit automated scraping; this is a personal tool, not a commercial product.
  Keep request rates low (10 jobs per run, human-like delays built in).
- Respect `robots.txt` and rate limits. If a site blocks you, back off.
