"""
OnlineJobs.ph scraper.
Requires login — run --login once to save session.
"""

import asyncio, logging, argparse
from urllib.parse import quote_plus
from playwright.async_api import async_playwright
from .base import BaseScraper, USER_AGENT
from models import Job

logger = logging.getLogger("huntly.onlinejobsph")


class OnlineJobsPhScraper(BaseScraper):
    platform_id = "onlinejobsph"
    BASE_URL = "https://www.onlinejobs.ph"

    async def scrape(self, keywords: str, limit: int = 10) -> list[Job]:
        jobs = []
        async with async_playwright() as pw:
            context, browser = await self.get_context(pw)
            page = await context.new_page()
            try:
                url = f"{self.BASE_URL}/jobseekers/jobsearch/job?q={quote_plus(keywords)}"
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await self.human_delay(1200, 2200)

                if "/login" in page.url:
                    logger.warning("[onlinejobsph] Not logged in")
                    return []

                await page.wait_for_selector(".job-post", timeout=12000)
                posts = await page.query_selector_all(".job-post")
                logger.info(f"[onlinejobsph] {len(posts)} posts")

                for post in posts[:limit]:
                    try:
                        title_el   = await post.query_selector("h2 a, h3 a")
                        company_el = await post.query_selector(".company-name, .employer-name")
                        salary_el  = await post.query_selector(".salary")
                        link_el    = await post.query_selector("h2 a, h3 a")

                        title   = (await title_el.inner_text()).strip()   if title_el   else ""
                        company = (await company_el.inner_text()).strip() if company_el else "PH Employer"
                        salary  = (await salary_el.inner_text()).strip()  if salary_el  else ""
                        href    = await link_el.get_attribute("href")     if link_el    else ""
                        full_url = f"{self.BASE_URL}{href}" if href.startswith("/") else href

                        # Get description
                        description = ""
                        if full_url:
                            try:
                                dp = await context.new_page()
                                await dp.goto(full_url, wait_until="domcontentloaded", timeout=20000)
                                await self.human_delay(600, 1200)
                                desc_el = await dp.query_selector(".job-description, #job-description")
                                if desc_el:
                                    description = (await desc_el.inner_text()).strip()
                                await dp.close()
                            except Exception:
                                pass

                        jobs.append(Job(
                            title=title,
                            company=company,
                            platform="onlinejobsph",
                            type="full-time",
                            salary=salary,
                            location="Philippines / Remote",
                            description=description or f"Job posting: {title}",
                            url=full_url,
                        ))
                    except Exception as e:
                        logger.debug(f"[onlinejobsph] Parse error: {e}")

                await self.save_cookies(context)
            except Exception as e:
                logger.error(f"[onlinejobsph] Failed: {e}")
            finally:
                await browser.close()
        return jobs


async def scrape_onlinejobsph(keywords: str, limit: int = 10) -> list[Job]:
    return await OnlineJobsPhScraper().scrape(keywords, limit)


async def login_and_save():
    scraper = OnlineJobsPhScraper()
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context(user_agent=USER_AGENT, viewport={"width": 1440, "height": 900})
        page = await context.new_page()
        await page.goto("https://www.onlinejobs.ph/login")
        print("\n⟶  Log in to OnlineJobs.ph in the browser window that opened.")
        print("⟶  Once logged in, press ENTER here to save cookies.\n")
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
        results = asyncio.run(scrape_onlinejobsph("React Developer", limit=3))
        for j in results:
            print(f"  • {j.title} @ {j.company}")
