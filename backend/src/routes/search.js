const express = require('express');
const axios = require('axios');

const { scrapePoshmarkSoldListings } = require('../services/poshmarkScraper');
const { scrapeEbaySoldListings } = require('../services/ebayScraper');
const { getCached, setCached } = require('../services/searchCache');

const router = express.Router();

const EBAY_FINDING_API_URL =
  'https://svcs.ebay.com/services/search/FindingService/v1';

// ─── Thresholds (tune these to your margin targets) ───────────────────────────
const BUY_MIN_AVG_PRICE = 15;   // avg sold price must exceed this
const BUY_MIN_SOLD_COUNT = 3;   // at least this many sold in last 365 days

// ─── eBay OAuth token cache ────────────────────────────────────────────────────
let _ebayToken = null;
let _ebayTokenExpiry = 0;

async function getEbayToken() {
  if (_ebayToken && Date.now() < _ebayTokenExpiry - 60000) return _ebayToken;

  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  if (!appId || !certId) throw new Error('eBay credentials not set');

  const creds = Buffer.from(`${appId}:${certId}`).toString('base64');
  const resp = await axios.post(
    'https://api.ebay.com/identity/v1/oauth2/token',
    'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    {
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    }
  );

  _ebayToken = resp.data.access_token;
  _ebayTokenExpiry = Date.now() + resp.data.expires_in * 1000;
  return _ebayToken;
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Parse a raw eBay Finding API item into a normalized shape.
 * Works for both findCompletedItems and findItemsAdvanced responses.
 */
function parseEbayItem(item) {
  return {
    itemId: item.itemId?.[0] || null,
    title: item.title?.[0] || '',
    soldPrice: parseFloat(
      item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__ ||
      item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0'
    ),
    currency:
      item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.['@currencyId'] ||
      item.sellingStatus?.[0]?.currentPrice?.[0]?.['@currencyId'] ||
      'USD',
    condition: item.condition?.[0]?.conditionDisplayName?.[0] || 'Unknown',
    imageUrl: item.galleryURL?.[0] || null,
    listingUrl: item.viewItemURL?.[0] || null,
    dateSold: item.listingInfo?.[0]?.endTime?.[0] || null,
    listingType: item.listingInfo?.[0]?.listingType?.[0] || null,
    source: 'ebay_api',
  };
}

/**
 * Calculate price stats from an array of normalized items.
 */
function calcStats(items) {
  const prices = items
    .map((i) => i.soldPrice)
    .filter((p) => typeof p === 'number' && p > 0)
    .sort((a, b) => a - b);

  if (!prices.length) return { avg: 0, min: 0, max: 0, median: 0, count: 0 };

  const sum = prices.reduce((a, b) => a + b, 0);
  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2
      ? prices[mid]
      : (prices[mid - 1] + prices[mid]) / 2;

  return {
    avg: +( sum / prices.length).toFixed(2),
    min: +prices[0].toFixed(2),
    max: +prices[prices.length - 1].toFixed(2),
    median: +median.toFixed(2),
    count: prices.length,
  };
}

/**
 * Group sold items into monthly buckets for the last 365 days.
 * Returns array sorted oldest → newest:
 *   [{ month: "Mar 2025", count, avgPrice, minPrice, maxPrice, totalRevenue }]
 */
function groupByMonth(items) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  const monthMap = {};

  items.forEach((item) => {
    if (!item.dateSold) return;
    const date = new Date(item.dateSold);
    if (date < cutoff) return;

    const key = date.toLocaleString('default', { month: 'short', year: 'numeric' });
    if (!monthMap[key]) {
      monthMap[key] = { month: key, _date: date, count: 0, prices: [] };
    }
    monthMap[key].count += 1;
    if (item.soldPrice > 0) monthMap[key].prices.push(item.soldPrice);
  });

  return Object.values(monthMap)
    .sort((a, b) => a._date - b._date)
    .map(({ month, count, prices }) => {
      const total = prices.reduce((s, p) => s + p, 0);
      return {
        month,
        count,
        avgPrice: prices.length ? +(total / prices.length).toFixed(2) : 0,
        minPrice: prices.length ? +Math.min(...prices).toFixed(2) : 0,
        maxPrice: prices.length ? +Math.max(...prices).toFixed(2) : 0,
        totalRevenue: +total.toFixed(2),
      };
    });
}

/**
 * Fetch multiple pages of eBay findCompletedItems (sold listings).
 * Returns up to maxPages * 100 raw parsed items.
 */
async function fetchEbaySoldPages(query, category, maxPages = 3) {
  const appId = process.env.EBAY_APP_ID;
  const pages = await Promise.allSettled(
    Array.from({ length: maxPages }, (_, i) => {
      const params = {
        'OPERATION-NAME': 'findCompletedItems',
        'SERVICE-VERSION': '1.13.0',
        'SECURITY-APPNAME': appId,
        'RESPONSE-DATA-FORMAT': 'JSON',
        'REST-PAYLOAD': '',
        keywords: query,
        'itemFilter(0).name': 'SoldItemsOnly',
        'itemFilter(0).value': 'true',
        sortOrder: 'EndTimeSoonest',
        'paginationInput.entriesPerPage': '100',
        'paginationInput.pageNumber': i + 1,
      };
      if (category) params['categoryId'] = category;
      return axios.get(EBAY_FINDING_API_URL, { params, timeout: 12000 });
    })
  );

  return pages.flatMap((result) => {
    if (result.status !== 'fulfilled') return [];
    const items =
      result.value.data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
    return items.map(parseEbayItem);
  });
}

/**
 * Filter items to the last 365 days.
 */
function filterToLastYear(items) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return items.filter((i) => i.dateSold && new Date(i.dateSold) >= cutoff);
}

// ─── POST /api/search/ebay ─────────────────────────────────────────────────────
// Sold listings for last 365 days with monthly breakdown and full stats.
router.post('/ebay', async (req, res) => {
  const { query, category } = req.body;

  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'query is required' });
  }

  const q = query.trim();
  const cacheKey = `ebay:${q.toLowerCase()}:${category || ''}`;
  const cached = getCached(cacheKey);
  if (cached) {
    console.log('[eBay] Cache hit for:', q);
    return res.json({ ...cached, fromCache: true });
  }

  const appId = process.env.EBAY_APP_ID;
  if (!appId || appId === 'your_ebay_app_id') {
    return res.status(503).json({ error: 'eBay API credentials not configured.' });
  }

  // ── Try Finding API (up to 3 pages = 300 items) ────────────────────────────
  let useScraper = false;
  try {
    const allItems = await fetchEbaySoldPages(q, category, 3);

    if (allItems.length > 0) {
      const recentItems = filterToLastYear(allItems);
      const stats = calcStats(recentItems);
      const byMonth = groupByMonth(recentItems);

      const payload = { query: q, stats, byMonth, results: recentItems.slice(0, 50) };
      setCached(cacheKey, payload);
      return res.json(payload);
    }

    console.warn('[eBay] Finding API returned 0 items — falling back to scraper');
    useScraper = true;
  } catch (err) {
    console.warn('[eBay] Finding API failed:', err.message);
    useScraper = true;
  }

  // ── Scraper fallback ───────────────────────────────────────────────────────
  if (useScraper) {
    console.log('[eBay] Using scraper fallback for:', q);
    try {
      const scraped = await scrapeEbaySoldListings(q, 50);
      if (scraped.length > 0) {
        // Scraped items use soldPrice field directly; normalize for stats
        const normalized = scraped.map((i) => ({ ...i, dateSold: i.dateSold || null }));
        const recentItems = filterToLastYear(normalized);
        const stats = calcStats(recentItems.length ? recentItems : normalized);
        const byMonth = groupByMonth(recentItems);

        const payload = {
          query: q,
          stats,
          byMonth,
          results: normalized.slice(0, 50),
          fromScraper: true,
        };
        setCached(cacheKey, payload);
        return res.json(payload);
      }
    } catch (scrapeErr) {
      console.error('[eBay] Scraper also failed:', scrapeErr.message);
    }
  }

  return res.json({ query: q, stats: calcStats([]), byMonth: [], results: [] });
});

// ─── POST /api/search/ebay/active ─────────────────────────────────────────────
// Currently active (not sold) eBay listings with stats.
router.post('/ebay/active', async (req, res) => {
  const { query, category } = req.body;

  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'query is required' });
  }

  const q = query.trim();
  const cacheKey = `ebay-active:${q.toLowerCase()}:${category || ''}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json({ ...cached, fromCache: true });

  const appId = process.env.EBAY_APP_ID;
  if (!appId || appId === 'your_ebay_app_id') {
    return res.status(503).json({ error: 'eBay API credentials not configured.' });
  }

  try {
    const params = {
      'OPERATION-NAME': 'findItemsAdvanced',
      'SERVICE-VERSION': '1.13.0',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      keywords: q,
      'itemFilter(0).name': 'ListingType',
      'itemFilter(0).value[0]': 'FixedPrice',
      'itemFilter(0).value[1]': 'Auction',
      'itemFilter(0).value[2]': 'AuctionWithBIN',
      sortOrder: 'BestMatch',
      'paginationInput.entriesPerPage': '20',
    };
    if (category) params['categoryId'] = category;

    const response = await axios.get(EBAY_FINDING_API_URL, { params, timeout: 10000 });
    const rawItems =
      response.data?.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || [];
    const items = rawItems.map(parseEbayItem);
    const stats = calcStats(items);

    const payload = { query: q, stats, results: items };
    setCached(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error('[eBay active] Failed:', err.message);
    return res.status(500).json({ error: 'eBay active search failed', detail: err.message });
  }
});

// ─── POST /api/search/poshmark ────────────────────────────────────────────────
router.post('/poshmark', async (req, res) => {
  const { query } = req.body;

  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'query is required' });
  }

  const cacheKey = `poshmark:${query.trim().toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json({ results: cached, fromCache: true });

  try {
    const results = await scrapePoshmarkSoldListings(query);
    setCached(cacheKey, results);
    return res.json({ results });
  } catch (err) {
    console.error('[Poshmark Route Error]', err.message);
    return res.json({ results: [], message: 'Poshmark search unavailable' });
  }
});

// ─── POST /api/search/combined ────────────────────────────────────────────────
// eBay sold (365-day) + Poshmark sold + active eBay listings in one call.
// Response shape:
// {
//   query, recommendation,       ← "BUY" | "PASS"
//   sold:   { stats, byMonth, ebayResults, poshmarkResults },
//   active: { stats, results },
// }
router.post('/combined', async (req, res) => {
  const { query, category } = req.body;

  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'query is required' });
  }

  const base = getBaseUrl(req);

  try {
    const [ebayRes, poshmarkRes, activeRes] = await Promise.allSettled([
      axios.post(`${base}/api/search/ebay`, { query, category }, { timeout: 20000 }),
      axios.post(`${base}/api/search/poshmark`, { query }, { timeout: 45000 }),
      axios.post(`${base}/api/search/ebay/active`, { query, category }, { timeout: 12000 }),
    ]);

    // ── Sold results ────────────────────────────────────────────────────────
    const ebayData = ebayRes.status === 'fulfilled' ? ebayRes.value.data : null;
    const poshmarkResults =
      poshmarkRes.status === 'fulfilled'
        ? poshmarkRes.value.data?.results || []
        : [];

    if (ebayRes.status === 'rejected')
      console.warn('[combined] eBay failed:', ebayRes.reason?.message);
    if (poshmarkRes.status === 'rejected')
      console.warn('[combined] Poshmark failed:', poshmarkRes.reason?.message);
    if (activeRes.status === 'rejected')
      console.warn('[combined] eBay active failed:', activeRes.reason?.message);

    // Merge eBay + Poshmark sold for combined stats
    const allSold = [
      ...(ebayData?.results || []),
      ...poshmarkResults.map((i) => ({ ...i, soldPrice: i.soldPrice || 0 })),
    ];
    const soldStats = calcStats(allSold);
    const byMonth = ebayData?.byMonth || groupByMonth(allSold);

    // ── Active results ──────────────────────────────────────────────────────
    const activeData = activeRes.status === 'fulfilled' ? activeRes.value.data : null;
    const activeStats = activeData ? calcStats(activeData.results || []) : calcStats([]);

    // ── BUY/PASS recommendation ─────────────────────────────────────────────
    const recommendation =
      soldStats.avg >= BUY_MIN_AVG_PRICE && soldStats.count >= BUY_MIN_SOLD_COUNT
        ? 'BUY'
        : 'PASS';

    return res.json({
      query,
      recommendation,
      sold: {
        stats: soldStats,
        byMonth,
        ebayResults: (ebayData?.results || []).slice(0, 20),
        poshmarkResults: poshmarkResults.slice(0, 20),
      },
      active: {
        stats: activeStats,
        results: (activeData?.results || []).slice(0, 10),
      },
    });
  } catch (err) {
    console.error('[Combined Search Error]', err.message);
    return res.status(500).json({ error: 'Combined search failed', details: err.message });
  }
});

/**
 * Build the base URL for internal self-calls.
 * In production, consider refactoring to direct function imports for efficiency.
 */
function getBaseUrl(req) {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
}

module.exports = router;
