/**
 * poshmarkScraper.js — Playwright-based scraper for Poshmark sold listings.
 *
 * Designed to run on Railway (Linux, no GPU, no sandbox) using headless
 * Chromium.  The scraper is intentionally defensive: DOM structure changes
 * on Poshmark's end will cause graceful empty-result returns rather than
 * server crashes.
 */

const { chromium } = require('playwright');

// Realistic desktop User-Agent (Chrome 122 / Windows 10)
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/122.0.0.0 Safari/537.36';

/**
 * Return a random integer delay between `min` and `max` milliseconds.
 * @param {number} min
 * @param {number} max
 * @returns {Promise<void>}
 */
function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for the first selector from `selectors` that appears on `page`.
 * Returns the matching selector string, or null if none appear within the
 * timeout.
 *
 * @param {import('playwright').Page} page
 * @param {string[]} selectors
 * @param {number} [timeout=10000]
 * @returns {Promise<string|null>}
 */
async function waitForFirstSelector(page, selectors, timeout = 10000) {
  const results = await Promise.allSettled(
    selectors.map((sel) =>
      page.waitForSelector(sel, { timeout }).then(() => sel)
    )
  );

  for (const r of results) {
    if (r.status === 'fulfilled') return r.value;
  }
  return null;
}

/**
 * Scrape up to 20 sold listings from Poshmark for `query`.
 *
 * @param {string} query  The search term.
 * @returns {Promise<Array<{
 *   title: string,
 *   soldPrice: number,
 *   imageUrl: string|null,
 *   listingUrl: string|null,
 *   dateSold: null
 * }>>}
 */
async function scrapePoshmarkSoldListings(query) {
  if (!query || query.trim() === '') return [];

  const encodedQuery = encodeURIComponent(query.trim());
  const url =
    `https://poshmark.com/search?query=${encodedQuery}` +
    `&availability=sold_out&department=Women`;

  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,800',
      ],
    });

    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const page = await context.newPage();

    // Navigate with a generous timeout; Poshmark can be slow
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Random human-like delay after page load
    await randomDelay(2000, 4000);

    // Candidate selectors (most → least specific) — if Poshmark's DOM changes
    // we try several fallbacks before giving up.
    const candidateSelectors = [
      '[data-et-name="listing"]',
      '.tile.listing-item',
      '.listing-card',
      '.tile',
      '[class*="listing"]',
    ];

    const matchedSelector = await waitForFirstSelector(
      page,
      candidateSelectors,
      12000
    );

    if (!matchedSelector) {
      console.warn(
        '[PoshmarkScraper] No listing selector matched — Poshmark DOM may have changed or bot detection triggered.'
      );
      return [];
    }

    // Extract up to 20 items using the selector that worked
    const listings = await page.evaluate((sel) => {
      const cards = Array.from(document.querySelectorAll(sel)).slice(0, 20);

      return cards.map((card) => {
        // ── Title ──────────────────────────────────────────────────────────
        const titleEl =
          card.querySelector('[class*="title"]') ||
          card.querySelector('[data-et-prop-title]') ||
          card.querySelector('a[title]') ||
          card.querySelector('h3') ||
          card.querySelector('h4');

        const title =
          titleEl?.getAttribute('title') ||
          titleEl?.textContent?.trim() ||
          '';

        // ── Price ──────────────────────────────────────────────────────────
        const priceEl =
          card.querySelector('[class*="price"]') ||
          card.querySelector('[data-et-prop-price]');

        const rawPrice = priceEl?.textContent?.trim() || '0';
        // Strip everything except digits and decimal point
        const soldPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0;

        // ── Image ──────────────────────────────────────────────────────────
        const imgEl =
          card.querySelector('img[src]') ||
          card.querySelector('img[data-src]');

        const imageUrl =
          imgEl?.getAttribute('src') ||
          imgEl?.getAttribute('data-src') ||
          null;

        // ── Listing URL ────────────────────────────────────────────────────
        const linkEl =
          card.querySelector('a[href*="/listing/"]') ||
          card.querySelector('a[href]');

        const href = linkEl?.getAttribute('href') || null;
        const listingUrl = href
          ? href.startsWith('http')
            ? href
            : `https://poshmark.com${href}`
          : null;

        return { title, soldPrice, imageUrl, listingUrl, dateSold: null };
      });
    }, matchedSelector);

    // Filter out junk rows (no title AND no price)
    const cleaned = listings.filter((l) => l.title || l.soldPrice > 0);

    return cleaned;
  } catch (err) {
    console.warn('[PoshmarkScraper] Scraping failed:', err.message);
    return [];
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {
        // Ignore close errors
      }
    }
  }
}

module.exports = { scrapePoshmarkSoldListings };
