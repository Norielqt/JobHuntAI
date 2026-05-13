"""
RemoteOK scraper — public JSON API, no login needed.
"""
import httpx, logging
from models import Job

logger = logging.getLogger("huntly.remoteok")

def _remoteok_matches(p: dict, tokens: list[str]) -> bool:
    haystack = " ".join([
        (p.get("position") or "").lower(),
        " ".join(t.lower() for t in (p.get("tags") or [])),
        (p.get("description") or "").lower(),
    ])
    return any(tok in haystack for tok in tokens)


async def scrape_remoteok(keywords: str, limit: int = 10) -> list[Job]:
    jobs = []
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                "https://remoteok.com/api",
                headers={"User-Agent": "JobHunterIO/1.0 (personal job hunter)"},
            )
            r.raise_for_status()
            data = r.json()
            # First item is metadata, skip it
            postings = [p for p in data[1:] if isinstance(p, dict)]
            raw_tokens = keywords.lower().split()
            tokens = list(dict.fromkeys([
                keywords.lower(),
                "-".join(raw_tokens),
                *raw_tokens,
            ]))
            matched = [p for p in postings if _remoteok_matches(p, tokens)]
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
