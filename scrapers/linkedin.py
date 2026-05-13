"""
LinkedIn Jobs scraper.

LinkedIn serves job listings on a public search page (no login required for basic data).
For full job descriptions, a second page fetch per job is needed.

RATE LIMITING: LinkedIn aggressively rate-limits. Keep limit low (5-8 per run).
If blocked, run --login to save a session and use it.
"""

import asyncio, logging, argparse
from urllib.parse import quote_plus
from playwright.async_api import async_playwright
from .base import BaseScraper, USER_AGENT
from models import Job

logger = logging.getLogger("huntly.linkedin")


class LinkedInScraper(BaseScraper):
    platform_id = "linkedin"
    BASE_URL = "https://www.linkedin.com"

    async def scrape(self, keywords: str, limit: int = 10) -> list[Job]:
        jobs = []
        async with async_playwright() as pw:
            context, browser = await self.get_context(pw)
            page = await context.new_page()
            try:
                # Public job search (no login needed for titles/companies)
                url = (
                    f"{self.BASE_URL}/jobs/search?"
                    f"keywords={quote_plus(keywords)}"
                    f"&f_WT=2"          # Remote filter
                    f"&sortBy=DD"       # Most recent
                )
                logger.info(f"[linkedin] {url}")
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await self.human_delay(1500, 3000)

                # Accept cookies if banner appears
                try:
                    await page.click('button[action-type="ACCEPT"]', timeout=3000)
                except Exception:
                    pass

                await page.wait_for_selector(".jobs-search__results-list, .base-card", timeout=15000)

                cards = await page.query_selector_all(".base-card.job-search-card")
                logger.info(f"[linkedin] Found {len(cards)} cards")

                for card in cards[:limit]:
                    try:
                        title_el   = await card.query_selector(".base-search-card__title")
                        company_el = await card.query_selector(".base-search-card__subtitle a")
                        location_el= await card.query_selector(".job-search-card__location")
                        time_el    = await card.query_selector("time")
                        link_el    = await card.query_selector("a.base-card__full-link")

                        title    = (await title_el.inner_text()).strip()    if title_el    else ""
                        company  = (await company_el.inner_text()).strip()  if company_el  else ""
                        location = (await location_el.inner_text()).strip() if location_el else "Remote"
                        posted   = await time_el.get_attribute("datetime")  if time_el     else ""
                        href     = await link_el.get_attribute("href")      if link_el     else ""

                        # Fetch description from job detail page
                        description = ""
                        if href:
                            try:
                                detail_page = await context.new_page()
                                await detail_page.goto(href, wait_until="domcontentloaded", timeout=20000)
                                await self.human_delay(800, 1600)
                                desc_el = await detail_page.query_selector(".show-more-less-html__markup")
                                if desc_el:
                                    description = (await desc_el.inner_text()).strip()
                                await detail_page.close()
                            except Exception as de:
                                logger.debug(f"[linkedin] Detail fetch failed: {de}")

                        jobs.append(Job(
                            title=title,
                            company=company,
                            platform="linkedin",
                            type="full-time",
                            location=location,
                            description=description or f"LinkedIn job posting for {title} at {company}.",
                            url=href,
                            postedAt=posted[:10] if posted else "",
                        ))
                    except Exception as e:
                        logger.debug(f"[linkedin] Card parse error: {e}")

                await self.save_cookies(context)

            except Exception as e:
                logger.error(f"[linkedin] Scrape failed: {e}")
            finally:
                await browser.close()

        return jobs


async def scrape_linkedin(keywords: str, limit: int = 10) -> list[Job]:
    return await LinkedInScraper().scrape(keywords, limit)


async def login_and_save():
    scraper = LinkedInScraper()
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context(user_agent=USER_AGENT, viewport={"width": 1440, "height": 900})
        page = await context.new_page()
        await page.goto("https://www.linkedin.com/login")
        print("\n⟶  Log in to LinkedIn in the browser window that opened.")
        print("⟶  Once on your feed/dashboard, press ENTER here to save cookies.\n")
        input()
        await scraper.save_cookies(context)
        print("✓  Cookies saved.")
        await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--login", action="store_true", help="Open browser for manual login")
    args = parser.parse_args()
    if args.login:
        asyncio.run(login_and_save())
    else:
        results = asyncio.run(scrape_linkedin("React Developer", limit=5))
        for j in results:
            print(f"  • {j.title} @ {j.company} — {j.location}")
