"""
RemoteOK scraper — public JSON API, no login needed.
"""
import httpx, logging
from models import Job

logger = logging.getLogger("huntly.remoteok")

async def scrape_remoteok(keywords: str, limit: int = 10) -> list[Job]:
    jobs = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://remoteok.com/api",
                headers={"User-Agent": "Huntly/1.0 (personal job hunter)"},
            )
            r.raise_for_status()
            data = r.json()
            # First item is metadata, skip it
            postings = [p for p in data[1:] if isinstance(p, dict)]
            kw = keywords.lower()
            matched = [
                p for p in postings
                if kw in (p.get("position") or "").lower()
                or any(kw in t.lower() for t in (p.get("tags") or []))
                or kw in (p.get("description") or "").lower()
            ]
            for p in matched[:limit]:
                jobs.append(Job(
                    title=p.get("position", ""),
                    company=p.get("company", ""),
                    platform="remoteok",
                    type="full-time",
                    salary=p.get("salary", ""),
                    location="Remote",
                    description=p.get("description", ""),
                    url=p.get("url", f"https://remoteok.com/remote-jobs/{p.get('id','')}"),
                    postedAt=p.get("date", "")[:10] if p.get("date") else "",
                ))
    except Exception as e:
        logger.error(f"[remoteok] {e}")
    return jobs
