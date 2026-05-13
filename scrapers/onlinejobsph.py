"""
OnlineJobs.ph scraper.

Login: POST /platforms/onlinejobsph/login via the Account panel.
Searching: httpx + BeautifulSoup with saved cookies — no Playwright needed.
"""

import logging
import json
import asyncio
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup

from .base import COOKIES_DIR, USER_AGENT
from models import Job

logger = logging.getLogger("huntly.onlinejobsph")

BASE_URL = "https://www.onlinejobs.ph"
COOKIES_FILE = COOKIES_DIR / "onlinejobsph.json"

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": BASE_URL + "/",
}


def _load_cookies() -> dict:
    if not COOKIES_FILE.exists():
        return {}
    try:
        raw = json.loads(COOKIES_FILE.read_text())
        return {c["name"]: c["value"] for c in raw}
    except Exception:
        return {}


def _parse_card(card) -> dict | None:
    """Extract basic job data from a .jobpost-cat-box element."""
    try:
        link_el = card.find_parent("a", href=True)
        href = link_el["href"] if link_el else ""
        url = BASE_URL + href if href.startswith("/") else href

        title_el = card.select_one("h4")
        for badge in title_el.find_all("span") if title_el else []:
            badge.decompose()
        title = title_el.get_text(strip=True) if title_el else ""

        badge_el = card.select_one(".badge")
        job_type = badge_el.get_text(strip=True).lower() if badge_el else "full-time"

        img = card.select_one("img.jobpost-cat-box-logo")
        company = img.get("alt", "").strip() if img else ""
        if not company:
            comp_el = card.select_one("h5, .employer-name, .company-name")
            company = comp_el.get_text(strip=True) if comp_el else "PH Employer"

        return dict(title=title, company=company, url=url, type=job_type)
    except Exception as e:
        logger.debug(f"[onlinejobsph] parse_card error: {e}")
        return None


def _get_dt_value(soup, label: str) -> str:
    """Find a dt/dd pair in the job-post sidebar card by label text."""
    for dt in soup.select(".card.job-post dt, .card.job-post .card-body dt, .card.job-post .card-body strong"):
        if label.lower() in dt.get_text(strip=True).lower():
            dd = dt.find_next_sibling("dd")
            if dd:
                return dd.get_text(strip=True)
    # Fallback: find label text then grab next text node sibling
    el = soup.find(string=lambda t: t and label.lower() in t.lower())
    if el:
        parent = el.find_parent()
        if parent:
            nxt = parent.find_next_sibling()
            if nxt:
                return nxt.get_text(strip=True)
    return ""


async def _fetch_description(client: httpx.AsyncClient, url: str) -> tuple[str, str, str, str]:
    """Fetch job detail page and return (url, description, salary, date_updated)."""
    try:
        r = await client.get(url, timeout=15)
        if r.status_code != 200:
            return url, "", "", ""
        soup = BeautifulSoup(r.text, "lxml")

        # ── Salary / pay ────────────────────────────────────────────────────────
        salary = ""
        job_card = soup.select_one(".card.job-post")
        if job_card:
            # Try structured dt/dd pairs first
            for dt in job_card.select("dt"):
                if "wage" in dt.get_text(strip=True).lower() or "salary" in dt.get_text(strip=True).lower():
                    dd = dt.find_next_sibling("dd")
                    salary = dd.get_text(strip=True) if dd else ""
                    break
            if not salary:
                # Fallback: find label span then sibling/parent text
                lbl = job_card.find(string=lambda t: t and ("WAGE" in t.upper() or "SALARY" in t.upper()))
                if lbl:
                    parent = lbl.find_parent()
                    nxt = parent.find_next_sibling() if parent else None
                    salary = nxt.get_text(strip=True) if nxt else ""

        # ── Date updated ────────────────────────────────────────────────────────
        date_updated = ""
        if job_card:
            lbl = job_card.find(string=lambda t: t and "DATE UPDATED" in t.upper())
            if lbl:
                parent = lbl.find_parent()
                nxt = parent.find_next_sibling() if parent else None
                date_updated = nxt.get_text(strip=True) if nxt else ""

        # ── Description ─────────────────────────────────────────────────────────
        description = ""
        overview_text = soup.find(string=lambda t: t and "JOB OVERVIEW" in t)
        if overview_text:
            header = overview_text.find_parent("div", class_="card-header")
            card = header.find_parent("div", class_="card") if header else None
            if card:
                body = card.select_one(".card-body")
                if body:
                    description = body.get_text(separator="\n", strip=True)

        if not description:
            for sel in [".job-description", "#job-description", ".jobpost-desc"]:
                el = soup.select_one(sel)
                if el:
                    description = el.get_text(separator="\n", strip=True)
                    break

        return url, description, salary, date_updated
    except Exception as e:
        logger.debug(f"[onlinejobsph] description fetch failed for {url}: {e}")
        return url, "", "", ""


async def scrape_onlinejobsph(keywords: str, limit: int = 25) -> list[Job]:
    cookies = _load_cookies()
    if not cookies:
        logger.warning("[onlinejobsph] No saved cookies — use Account > Connect first")
        return []

    cards_data: list[dict] = []
    seen_urls: set[str] = set()
    offset = 0
    per_page = 30

    async with httpx.AsyncClient(
        headers=HEADERS,
        cookies=cookies,
        follow_redirects=True,
        timeout=20,
    ) as client:
        # ── Phase 1: collect job cards from listing pages ──────────────────────
        while len(cards_data) < limit:
            url = f"{BASE_URL}/jobseekers/jobsearch/{offset}?jobkeyword={quote_plus(keywords)}"
            try:
                r = await client.get(url)
                r.raise_for_status()
            except Exception as e:
                logger.error(f"[onlinejobsph] fetch error: {e}")
                break

            if "onlinejobs.ph/login" in str(r.url):
                logger.warning("[onlinejobsph] Session expired — reconnect in Account panel")
                break

            soup = BeautifulSoup(r.text, "lxml")
            cards = soup.select("div.jobpost-cat-box")
            if not cards:
                break

            for card in cards:
                if len(cards_data) >= limit:
                    break
                data = _parse_card(card)
                if not data or not data["title"] or data["url"] in seen_urls:
                    continue
                seen_urls.add(data["url"])
                cards_data.append(data)

            if len(cards) < per_page:
                break
            offset += per_page

        # ── Phase 2: fetch descriptions in parallel (max 8 concurrent) ─────────
        semaphore = asyncio.Semaphore(8)

        async def _bounded_fetch(u):
            async with semaphore:
                return await _fetch_description(client, u)

        desc_tasks = [_bounded_fetch(d["url"]) for d in cards_data]
        desc_results = await asyncio.gather(*desc_tasks)
        # Map url -> (description, salary, date_updated)
        detail_map = {u: (desc, sal, date) for u, desc, sal, date in desc_results}

        # ── Phase 3: assemble Job objects ──────────────────────────────────────
        jobs: list[Job] = []
        for data in cards_data:
            description, salary, date_updated = detail_map.get(data["url"], ("", "", ""))
            # Prepend date to description if available
            if date_updated:
                description = f"Updated: {date_updated}\n\n{description}" if description else f"Updated: {date_updated}"
            jobs.append(Job(
                title=data["title"],
                company=data["company"],
                platform="onlinejobsph",
                type="full-time" if "full" in data["type"] else data["type"],
                salary=salary,
                location="Philippines / Remote",
                description=description or f"{data['title']} at {data['company']}",
                url=data["url"],
            ))

    logger.info(f"[onlinejobsph] Returning {len(jobs)} jobs")
    return jobs
