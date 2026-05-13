"""
JobStreet scraper — Playwright required (JS-rendered).
Covers PH, SG, MY markets.
"""
import asyncio, logging
from urllib.parse import quote_plus
from playwright.async_api import async_playwright
from .base import BaseScraper
from models import Job

logger = logging.getLogger("huntly.jobstreet")

class JobStreetScraper(BaseScraper):
    platform_id = "jobstreet"
    BASE_URL = "https://www.jobstreet.com.ph"

    async def scrape(self, keywords: str, limit: int = 10) -> list[Job]:
        jobs = []
        async with async_playwright() as pw:
            context, browser = await self.get_context(pw)
            page = await context.new_page()
            try:
                url = f"{self.BASE_URL}/{quote_plus(keywords.replace(' ','-'))}-jobs"
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await self.human_delay(1500, 2500)

                cards = await page.query_selector_all('[data-automation="job-card-desktop-detail"]')
                if not cards:
                    cards = await page.query_selector_all('article[data-automation]')
                logger.info(f"[jobstreet] {len(cards)} cards")

                for card in cards[:limit]:
                    try:
                        title_el   = await card.query_selector('[data-automation="job-title"]')
                        company_el = await card.query_selector('[data-automation="job-card-company-name"]')
                        loc_el     = await card.query_selector('[data-automation="job-card-location"]')
                        salary_el  = await card.query_selector('[data-automation="job-card-salary"]')
                        link_el    = await card.query_selector('a[data-automation="job-title"]')

                        title   = (await title_el.inner_text()).strip()   if title_el   else ""
                        company = (await company_el.inner_text()).strip() if company_el else ""
                        loc     = (await loc_el.inner_text()).strip()     if loc_el     else "PH"
                        salary  = (await salary_el.inner_text()).strip()  if salary_el  else ""
                        href    = await link_el.get_attribute("href")     if link_el    else ""
                        full_url = f"{self.BASE_URL}{href}" if href.startswith("/") else href

                        jobs.append(Job(
                            title=title,
                            company=company,
                            platform="jobstreet",
                            type="full-time",
                            salary=salary,
                            location=loc,
                            description=f"{title} position at {company} in {loc}.",
                            url=full_url,
                        ))
                    except Exception as e:
                        logger.debug(f"[jobstreet] Parse error: {e}")

                await self.save_cookies(context)
            except Exception as e:
                logger.error(f"[jobstreet] Failed: {e}")
            finally:
                await browser.close()
        return jobs


async def scrape_jobstreet(keywords: str, limit: int = 10) -> list[Job]:
    return await JobStreetScraper().scrape(keywords, limit)
