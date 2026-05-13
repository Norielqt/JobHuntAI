"""
WeWorkRemotely scraper — uses their public RSS feed.
No login, no scraping, just RSS parsing.
"""
import httpx, logging
from xml.etree import ElementTree as ET
from bs4 import BeautifulSoup
from models import Job

logger = logging.getLogger("huntly.weworkremotely")

RSS_URLS = [
    "https://weworkremotely.com/remote-jobs.rss",
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-design-jobs.rss",
]

async def scrape_weworkremotely(keywords: str, limit: int = 10) -> list[Job]:
    jobs = []
    kw = keywords.lower()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            for rss_url in RSS_URLS:
                try:
                    r = await client.get(rss_url)
                    r.raise_for_status()
                    root = ET.fromstring(r.text)
                    items = root.findall(".//item")
                    for item in items:
                        title   = (item.findtext("title") or "").strip()
                        desc_raw = item.findtext("description") or ""
                        desc    = BeautifulSoup(desc_raw, "lxml").get_text(separator="\n").strip()
                        link    = (item.findtext("link") or "").strip()
                        pubdate = (item.findtext("pubDate") or "")[:16]
                        # Extract company from title (format: "Company: Role")
                        if ": " in title:
                            company, role = title.split(": ", 1)
                        else:
                            company, role = "Company", title

                        if kw in title.lower() or kw in desc.lower():
                            jobs.append(Job(
                                title=role,
                                company=company,
                                platform="weworkremotely",
                                type="full-time",
                                location="Remote",
                                description=desc,
                                url=link,
                                postedAt=pubdate,
                            ))
                        if len(jobs) >= limit:
                            return jobs
                except Exception as e:
                    logger.debug(f"[weworkremotely] RSS {rss_url} failed: {e}")
    except Exception as e:
        logger.error(f"[weworkremotely] {e}")
    return jobs[:limit]
