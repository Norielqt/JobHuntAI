"""
Upwork scraper — uses Playwright with session cookies.

FIRST RUN: Upwork requires login. Run `python scrapers/upwork.py --login`
to open a headed browser, log in manually, and save your session cookies.
After that, the headless scraper reuses those cookies automatically.
"""

import asyncio, logging, argparse
from urllib.parse import quote_plus
from playwright.async_api import async_playwright
from .base import BaseScraper, USER_AGENT
from models import Job

logger = logging.getLogger("huntly.upwork")


class UpworkScraper(BaseScraper):
    platform_id = "upwork"
    BASE_URL = "https://www.upwork.com"

    async def scrape(self, keywords: str, limit: int = 10) -> list[Job]:
        jobs = []
        async with async_playwright() as pw:
            context, browser = await self.get_context(pw)
            page = await context.new_page()
            try:
                url = f"{self.BASE_URL}/nx/jobs/search/?q={quote_plus(keywords)}&sort=recency"
                logger.info(f"[upwork] Navigating to {url}")
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await self.human_delay(1200, 2400)

                # Check if redirected to login
                if "login" in page.url or "signup" in page.url:
                    logger.warning("[upwork] Not logged in — run with --login flag first")
                    return []

                # Wait for job cards
                await page.wait_for_selector('[data-test="job-tile-list"]', timeout=15000)

                tiles = await page.query_selector_all('section[data-test="JobTile"]')
                logger.info(f"[upwork] Found {len(tiles)} job tiles")

                for tile in tiles[:limit]:
                    try:
                        title_el   = await tile.query_selector('[data-test="job-title"]')
                        desc_el    = await tile.query_selector('[data-test="job-description-text"]')
                        budget_el  = await tile.query_selector('[data-test="budget"]')
                        skills_els = await tile.query_selector_all('[data-test="token"]')
                        link_el    = await tile.query_selector('[data-test="job-title"] a')

                        title  = (await title_el.inner_text()).strip()  if title_el  else ""
                        desc   = (await desc_el.inner_text()).strip()   if desc_el   else ""
                        salary = (await budget_el.inner_text()).strip() if budget_el else ""
                        href   = await link_el.get_attribute("href")    if link_el   else ""
                        skills = [await s.inner_text() for s in skills_els]

                        if skills:
                            desc += f"\n\nSkills: {', '.join(skills)}"

                        jobs.append(Job(
                            title=title,
                            company="Upwork Client",
                            platform="upwork",
                            type="freelance",
                            salary=salary,
                            description=desc,
                            url=f"{self.BASE_URL}{href}" if href.startswith("/") else href,
                            location="Remote",
                            postedAt="recent",
                        ))
                    except Exception as e:
                        logger.debug(f"[upwork] Error parsing tile: {e}")
                        continue

                await self.save_cookies(context)

            except Exception as e:
                logger.error(f"[upwork] Scrape failed: {e}")
            finally:
                await browser.close()

        return jobs


async def scrape_upwork(keywords: str, limit: int = 10) -> list[Job]:
    return await UpworkScraper().scrape(keywords, limit)


# ── Manual login helper ───────────────────────────────────────────────────────
async def login_and_save():
    """
    Opens a HEADED browser for manual login.
    Run once: python -m scrapers.upwork --login
    """
    scraper = UpworkScraper()
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1440, "height": 900},
        )
        page = await context.new_page()
        await page.goto("https://www.upwork.com/ab/account-security/login")
        print("\n⟶  Log in to Upwork in the browser window that opened.")
        print("⟶  Once you're on your dashboard, press ENTER here to save cookies.\n")
        input()
        await scraper.save_cookies(context)
        print("✓  Cookies saved. You can now run the scraper headlessly.")
        await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--login", action="store_true", help="Open browser for manual login")
    args = parser.parse_args()
    if args.login:
        asyncio.run(login_and_save())
    else:
        results = asyncio.run(scrape_upwork("React Developer", limit=5))
        for j in results:
            print(f"  • {j.title} — {j.salary}")
