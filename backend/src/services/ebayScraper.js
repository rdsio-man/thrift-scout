/**
 * eBay sold listings scraper — fallback when Finding API is rate limited.
 * Scrapes the public eBay sold search results page directly.
 */
const axios = require('axios');

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

/**
 * Scrape eBay sold listings for a query.
 * Returns array of { title, soldPrice, imageUrl, dateSold } objects.
 */
async function scrapeEbaySoldListings(query, limit = 20) {
  try {
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=48`;

    const response = await axios.get(url, {
      headers: HEADERS,
      timeout: 15000,
    });

    const html = response.data;
    const results = [];

    // Parse item listings from eBay search results HTML
    // Each sold item is in a <li> with class "s-item"
    const itemRegex = /<li[^>]+class="[^"]*s-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
    let match;

    while ((match = itemRegex.exec(html)) !== null && results.length < limit) {
      const block = match[1];

      // Title
      const titleMatch = block.match(/class="[^"]*s-item__title[^"]*"[^>]*>(?:<span[^>]*>[^<]*<\/span>)?\s*([^<]+)</);
      const title = titleMatch ? titleMatch[1].trim() : null;
      if (!title || title === 'Shop on eBay') continue;

      // Sold price — look for green "Sold" price
      const priceMatch = block.match(/class="[^"]*s-item__price[^"]*"[^>]*>[\s\S]*?\$([\d,]+\.?\d*)/);
      const soldPrice = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
      if (!soldPrice) continue;

      // Image
      const imgMatch = block.match(/class="[^"]*s-item__image-img[^"]*"[^>]*src="([^"]+)"/);
      const imageUrl = imgMatch ? imgMatch[1] : null;

      // Date sold
      const dateMatch = block.match(/class="[^"]*s-item__ended-date[^"]*"[^>]*>([^<]+)/);
      const dateSold = dateMatch ? dateMatch[1].trim() : null;

      results.push({ title, soldPrice, imageUrl, dateSold, source: 'ebay_scrape' });
    }

    console.log(`[ebayScraper] Found ${results.length} results for "${query}"`);
    return results;
  } catch (err) {
    console.error('[ebayScraper] Error:', err.message);
    return [];
  }
}

module.exports = { scrapeEbaySoldListings };
