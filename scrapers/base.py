"""
Base scraper — shared Playwright browser logic.
Each platform scraper inherits from this.
"""

from playwright.async_api import async_playwright, Page, BrowserContext
from pathlib import Path
import json, asyncio, logging

logger = logging.getLogger("huntly.scraper")

COOKIES_DIR = Path(__file__).parent.parent / "cookies"
COOKIES_DIR.mkdir(exist_ok=True)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


class BaseScraper:
    platform_id: str = "base"
    cookies_file: Path = None

    def __init__(self):
        self.cookies_file = COOKIES_DIR / f"{self.platform_id}.json"

    async def get_context(self, playwright) -> BrowserContext:
        """Launch a stealth browser context with saved cookies if available."""
        browser = await playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
            ],
        )
        context = await browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1440, "height": 900},
            locale="en-US",
            timezone_id="Asia/Manila",
        )

        # Mask webdriver flag
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
            window.chrome = { runtime: {} };
        """)

        # Load saved cookies
        if self.cookies_file.exists():
            try:
                cookies = json.loads(self.cookies_file.read_text())
                await context.add_cookies(cookies)
                logger.info(f"[{self.platform_id}] Loaded {len(cookies)} saved cookies")
            except Exception as e:
                logger.warning(f"[{self.platform_id}] Could not load cookies: {e}")

        return context, browser

    async def save_cookies(self, context: BrowserContext):
        """Persist session cookies for reuse."""
        try:
            cookies = await context.cookies()
            self.cookies_file.write_text(json.dumps(cookies, indent=2))
            logger.info(f"[{self.platform_id}] Saved {len(cookies)} cookies")
        except Exception as e:
            logger.warning(f"[{self.platform_id}] Could not save cookies: {e}")

    async def human_delay(self, min_ms=600, max_ms=1800):
        """Random delay to mimic human reading speed."""
        import random
        await asyncio.sleep(random.uniform(min_ms / 1000, max_ms / 1000))

    async def scrape(self, keywords: str, limit: int = 10) -> list:
        """Override this in each subclass."""
        raise NotImplementedError
