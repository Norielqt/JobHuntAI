"""
WeWorkRemotely scraper — uses their public RSS feed.
No login, no scraping, just RSS parsing.
"""
import httpx, logging
from xml.etree import ElementTree as ET
from bs4 import BeautifulSoup
from models import Job

logger = logging.getLogger("huntly.weworkremotely")

# All public RSS feeds — covers every category on the site
RSS_URLS = [
    "https://weworkremotely.com/remote-jobs.rss",
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-design-jobs.rss",
    "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
    "https://weworkremotely.com/categories/remote-management-finance-jobs.rss",
    "https://weworkremotely.com/categories/remote-product-jobs.rss",
    "https://weworkremotely.com/categories/remote-marketing-jobs.rss",
    "https://weworkremotely.com/categories/remote-sales-jobs.rss",
    "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
    "https://weworkremotely.com/categories/remote-data-science-jobs.rss",
]


def _matches(text: str, tokens: list[str]) -> bool:
    """Return True if ANY keyword token appears in the text."""
    t = text.lower()
    return any(tok in t for tok in tokens)


async def scrape_weworkremotely(keywords: str, limit: int = 10) -> list[Job]:
    # Split multi-word query into tokens so "full stack developer" matches
    # jobs containing "full stack" OR "developer" OR "full-stack"
    raw_tokens = keywords.lower().split()
    # Also add the full phrase and a hyphenated variant
    tokens = list(dict.fromkeys([
        keywords.lower(),
        "-".join(raw_tokens),
        *raw_tokens,
    ]))

    seen_urls: set[str] = set()
    all_jobs: list[Job] = []

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            for rss_url in RSS_URLS:
                try:
                    r = await client.get(rss_url)
                    r.raise_for_status()
                    root = ET.fromstring(r.text)
                    items = root.findall(".//item")
                    for item in items:
                        title    = (item.findtext("title") or "").strip()
                        desc_raw = item.findtext("description") or ""
                        desc     = BeautifulSoup(desc_raw, "lxml").get_text(separator="\n").strip()
                        link     = (item.findtext("link") or "").strip()
                        pubdate  = (item.findtext("pubDate") or "")[:16]

                        if link in seen_urls:
                            continue

                        if ": " in title:
                            company, role = title.split(": ", 1)
                        else:
                            company, role = "Company", title

                        if _matches(title, tokens) or _matches(desc, tokens):
                            seen_urls.add(link)
                            all_jobs.append(Job(
                                title=role,
                                company=company,
                                platform="weworkremotely",
                                type="full-time",
                                location="Remote",
                                description=desc[:800],
                                url=link,
                                postedAt=pubdate,
                            ))
                except Exception as e:
                    logger.debug(f"[weworkremotely] RSS {rss_url} failed: {e}")
    except Exception as e:
        logger.error(f"[weworkremotely] {e}")

    return all_jobs[:limit]
