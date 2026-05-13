"""
Huntly Backend — FastAPI + Playwright
"""

from fastapi import FastAPI, Query, HTTPException, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import asyncio
import logging
import os

from dotenv import load_dotenv
load_dotenv()

from scrapers.upwork import scrape_upwork
from scrapers.linkedin import scrape_linkedin
from scrapers.onlinejobsph import scrape_onlinejobsph
from scrapers.remoteok import scrape_remoteok
from scrapers.weworkremotely import scrape_weworkremotely
from scrapers.jobstreet import scrape_jobstreet
from models import Job, ScrapeRequest, ScrapeResponse, GenerateRequest, GenerateResponse
from scrapers.base import COOKIES_DIR
import services.ai as ai_service
import services.resume as resume_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("huntly")

app = FastAPI(title="Huntly API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

SCRAPER_MAP = {
    "upwork":         scrape_upwork,
    "linkedin":       scrape_linkedin,
    "onlinejobsph":   scrape_onlinejobsph,
    "remoteok":       scrape_remoteok,
    "weworkremotely": scrape_weworkremotely,
    "jobstreet":      scrape_jobstreet,
}


async def _scrape_with_timeout(platform: str, keywords: str, limit: int, timeout: int = 45):
    try:
        return await asyncio.wait_for(
            SCRAPER_MAP[platform](keywords, limit=limit),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        raise TimeoutError(f"{platform} timed out after {timeout}s")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/platforms")
async def list_platforms():
    """Return supported platforms and their metadata."""
    return {
        "platforms": [
            {"id": "upwork",         "label": "Upwork",          "type": "freelance", "color": "#14a800"},
            {"id": "linkedin",       "label": "LinkedIn",         "type": "both",      "color": "#0a66c2"},
            {"id": "onlinejobsph",   "label": "OnlineJobs.ph",   "type": "full-time", "color": "#e05c1e"},
            {"id": "remoteok",       "label": "RemoteOK",         "type": "both",      "color": "#06d6a0"},
            {"id": "weworkremotely", "label": "WeWorkRemotely",   "type": "both",      "color": "#a855f7"},
            {"id": "jobstreet",      "label": "JobStreet",        "type": "full-time", "color": "#f05537"},
        ]
    }


@app.get("/platforms/status")
async def platform_status():
    statuses = {
        pid: (COOKIES_DIR / f"{pid}.json").exists()
        for pid in SCRAPER_MAP
    }
    return {"statuses": statuses}


@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_jobs(req: ScrapeRequest):
    """
    Scrape selected platforms in parallel for the given keywords.
    Each scraper returns a list of Job objects.
    """
    if not req.keywords.strip():
        raise HTTPException(400, "Keywords cannot be empty")
    if not req.platforms:
        raise HTTPException(400, "Select at least one platform")

    unknown = [p for p in req.platforms if p not in SCRAPER_MAP]
    if unknown:
        raise HTTPException(400, f"Unknown platforms: {unknown}")

    logger.info(f"Scraping: '{req.keywords}' on {req.platforms}")

    tasks = [
        _scrape_with_timeout(platform, req.keywords, req.limit_per_platform)
        for platform in req.platforms
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_jobs: list[Job] = []
    errors: dict[str, str] = {}

    for platform, result in zip(req.platforms, results):
        if isinstance(result, Exception):
            logger.error(f"{platform} scrape failed: {result}")
            errors[platform] = str(result)
        else:
            all_jobs.extend(result)

    # Deduplicate by fingerprint (title + company hash)
    seen = set()
    unique_jobs = []
    for job in all_jobs:
        fp = job.url if job.url else f"{job.title.lower().strip()}|{job.company.lower().strip()}"
        if fp not in seen:
            seen.add(fp)
            unique_jobs.append(job)

    logger.info(f"Found {len(unique_jobs)} unique jobs across {len(req.platforms)} platforms")

    return ScrapeResponse(
        jobs=unique_jobs,
        total=len(unique_jobs),
        errors=errors,
    )


@app.get("/scrape")
async def scrape_jobs_get(
    q: str = Query(..., description="Search keywords"),
    platforms: str = Query("upwork,linkedin,remoteok", description="Comma-separated platform IDs"),
    limit: int = Query(10, ge=1, le=30, description="Max results per platform"),
    job_type: Optional[str] = Query(None, description="freelance | full-time | both"),
):
    """GET version for easy browser/curl testing."""
    platform_list = [p.strip() for p in platforms.split(",") if p.strip()]
    req = ScrapeRequest(keywords=q, platforms=platform_list, limit_per_platform=limit)
    return await scrape_jobs(req)


@app.post("/generate", response_model=GenerateResponse)
async def generate_docs_endpoint(
    req: GenerateRequest,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    api_key = x_api_key or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            400,
            "Anthropic API key required. Set it in Account settings or as ANTHROPIC_API_KEY env var.",
        )
    try:
        cover, tailored = await asyncio.wait_for(
            ai_service.generate_docs(
                api_key=api_key,
                resume=req.resume,
                job_title=req.job_title,
                job_company=req.job_company,
                job_description=req.job_description,
            ),
            timeout=90,
        )
        return GenerateResponse(coverLetter=cover, tailoredResume=tailored)
    except asyncio.TimeoutError:
        raise HTTPException(504, "AI generation timed out")
    except Exception as e:
        raise HTTPException(500, f"Generation failed: {e}")


@app.post("/resume/parse")
async def parse_resume_endpoint(file: UploadFile = File(...)):
    content = await file.read()
    try:
        text = await resume_service.parse_resume_file(content, file.filename or "resume.txt")
        return {"text": text, "characters": len(text)}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Parse failed: {e}")
