const express = require('express');
const axios = require('axios');

const { scrapePoshmarkSoldListings } = require('../services/poshmarkScraper');
const { getCached, setCached } = require('../services/searchCache');

const router = express.Router();

const EBAY_FINDING_API_URL =
  'https://svcs.ebay.com/services/search/FindingService/v1';

// ─── POST /api/search/ebay ─────────────────────────────────────────────────────
// Search eBay completed (sold) listings to get real-world pricing data.
router.post('/ebay', async (req, res) => {
  const { query, category } = req.body;

  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'query is required' });
  }

  // Check in-memory cache first
  const cacheKey = `ebay:${query.trim().toLowerCase()}:${category || ''}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json({ results: cached, fromCache: true });
  }

  const appId = process.env.EBAY_APP_ID;
  if (!appId || appId === 'your_ebay_app_id') {
    return res.status(503).json({
      error: 'eBay API credentials not configured. Set EBAY_APP_ID in .env',
    });
  }

  try {
    const params = {
      'OPERATION-NAME': 'findCompletedItems',
      'SERVICE-VERSION': '1.13.0',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      keywords: query.trim(),
      'itemFilter(0).name': 'SoldItemsOnly',
      'itemFilter(0).value': 'true',
      'sortOrder': 'EndTimeSoonest',
      'paginationInput.entriesPerPage': '20',
    };

    // Optionally filter by category
    if (category) {
      params['categoryId'] = category;
    }

    const response = await axios.get(EBAY_FINDING_API_URL, {
      params,
      headers: {
        'X-EBAY-SOA-OPERATION-NAME': 'findCompletedItems',
        'X-EBAY-SOA-SERVICE-VERSION': '1.13.0',
        'X-EBAY-SOA-SECURITY-APPNAME': appId,
        'X-EBAY-SOA-RESPONSE-DATA-FORMAT': 'JSON',
      },
      timeout: 10000,
    });

    const searchResult =
      response.data?.findCompletedItemsResponse?.[0];

    if (!searchResult || searchResult.ack?.[0] !== 'Success') {
      const errorMsg =
        searchResult?.errorMessage?.[0]?.error?.[0]?.message?.[0] ||
        'eBay API returned an unexpected response';
      return res.status(502).json({ error: errorMsg });
    }

    const rawItems =
      searchResult.searchResult?.[0]?.item || [];

    const results = rawItems.map((item) => ({
      title: item.title?.[0] || '',
      soldPrice: parseFloat(
        item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__ ||
          item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ ||
          '0'
      ),
      imageUrl: item.galleryURL?.[0] || null,
      listingUrl: item.viewItemURL?.[0] || null,
      dateSold: item.listingInfo?.[0]?.endTime?.[0] || null,
    }));

    // Store in cache
    setCached(cacheKey, results);

    return res.json({ results });
  } catch (err) {
    console.error('[eBay Search Error]', err.message);
    return res.status(500).json({
      error: 'Failed to fetch eBay data',
      details: err.message,
    });
  }
});

// ─── POST /api/search/poshmark ────────────────────────────────────────────────
// Playwright-based scraper for Poshmark sold listings.
router.post('/poshmark', async (req, res) => {
  const { query } = req.body;

  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'query is required' });
  }

  // Check in-memory cache first (keyed separately from eBay)
  const cacheKey = `poshmark:${query.trim().toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json({ results: cached, fromCache: true });
  }

  try {
    const results = await scrapePoshmarkSoldListings(query);

    // Even if results is empty we cache it to avoid repeated failed scrapes
    setCached(cacheKey, results);

    return res.json({ results });
  } catch (err) {
    // scrapePoshmarkSoldListings should never throw, but be safe
    console.error('[Poshmark Route Error]', err.message);
    return res.json({
      results: [],
      message: 'Poshmark search unavailable',
    });
  }
});

// ─── POST /api/search/combined ────────────────────────────────────────────────
// Call eBay and Poshmark in parallel, combine results, and calculate pricing insights.
router.post('/combined', async (req, res) => {
  const { query, category } = req.body;

  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'query is required' });
  }

  try {
    // Fire both searches concurrently
    const [ebayResponse, poshmarkResponse] = await Promise.allSettled([
      axios.post(
        `${getBaseUrl(req)}/api/search/ebay`,
        { query, category },
        { timeout: 12000 }
      ),
      axios.post(
        `${getBaseUrl(req)}/api/search/poshmark`,
        { query },
        { timeout: 45000 } // Playwright scraping needs extra time
      ),
    ]);

    // Extract results (fall back to empty on failure)
    const ebayResults =
      ebayResponse.status === 'fulfilled'
        ? ebayResponse.value.data?.results || []
        : [];

    const poshmarkResults =
      poshmarkResponse.status === 'fulfilled'
        ? poshmarkResponse.value.data?.results || []
        : [];

    // Log any individual errors without failing the whole request
    if (ebayResponse.status === 'rejected') {
      console.warn('[combined] eBay search failed:', ebayResponse.reason?.message);
    }
    if (poshmarkResponse.status === 'rejected') {
      console.warn('[combined] Poshmark search failed:', poshmarkResponse.reason?.message);
    }

    // Calculate average sold price across all results with valid prices
    const allResults = [...ebayResults, ...poshmarkResults];
    const pricesWithValues = allResults
      .map((item) => item.soldPrice)
      .filter((price) => typeof price === 'number' && price > 0);

    const averageSoldPrice =
      pricesWithValues.length > 0
        ? parseFloat(
            (
              pricesWithValues.reduce((sum, p) => sum + p, 0) /
              pricesWithValues.length
            ).toFixed(2)
          )
        : 0;

    const BUY_THRESHOLD = 30;

    return res.json({
      averageSoldPrice,
      totalResults: allResults.length,
      ebayResults,
      poshmarkResults,
      buyRecommendation: averageSoldPrice > BUY_THRESHOLD,
    });
  } catch (err) {
    console.error('[Combined Search Error]', err.message);
    return res.status(500).json({
      error: 'Combined search failed',
      details: err.message,
    });
  }
});

/**
 * Build the base URL for internal self-calls (combined route calls sub-routes).
 * In production, replace self-calls with direct function imports for efficiency.
 */
function getBaseUrl(req) {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
}

module.exports = router;
