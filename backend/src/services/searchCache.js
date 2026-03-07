/**
 * searchCache.js — Simple in-memory cache for search results.
 *
 * Results are keyed by a normalised query string and expire after 24 hours.
 * This avoids hammering eBay / Poshmark for repeated identical searches
 * within the same server process lifetime.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** @type {Map<string, { results: any[], timestamp: number }>} */
const cache = new Map();

/**
 * Normalise a query string so minor casing/whitespace differences share the
 * same cache entry.
 * @param {string} query
 * @returns {string}
 */
function normalise(query) {
  return (query || '').trim().toLowerCase();
}

/**
 * Return cached results for `query` if they are still fresh, otherwise null.
 * @param {string} query
 * @returns {any[] | null}
 */
function getCached(query) {
  const key = normalise(query);
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age >= CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.results;
}

/**
 * Store `results` in the cache under `query`.
 * @param {string} query
 * @param {any[]} results
 */
function setCached(query, results) {
  const key = normalise(query);
  cache.set(key, { results, timestamp: Date.now() });
}

module.exports = { getCached, setCached };
