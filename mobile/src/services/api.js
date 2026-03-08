import axios from 'axios';
import { API_BASE_URL } from '../config';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s — real photo uploads to Cloudinary can take a while on mobile
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor (logging / auth headers go here later) ────────────────
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor (normalize errors) ───────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';

    // Re-throw with a clean message
    return Promise.reject(new Error(message));
  }
);

/**
 * Search eBay and Poshmark sold listings and get pricing insights.
 *
 * @param {string} query - Item name or brand to search
 * @param {string} [category] - Optional eBay category ID
 * @returns {Promise<{averageSoldPrice, totalResults, ebayResults, poshmarkResults, buyRecommendation}>}
 */
export async function searchCombined(query, category) {
  const response = await api.post('/api/search/combined', { query, category });
  return response.data;
}

/**
 * Save a purchased item to the Airtable inventory.
 *
 * @param {Object} data
 * @param {string} [data.brand]
 * @param {string} [data.productType]
 * @param {string} [data.description]
 * @param {number} [data.purchasePrice]
 * @param {string} [data.purchaseDate]  YYYY-MM-DD
 * @param {string} [data.purchasedAt]
 * @param {string} [data.imageUrl]
 * @returns {Promise<{id: string, fields: Object}>}
 */
export async function createItem(data) {
  const response = await api.post('/api/items', data);
  return response.data;
}

/**
 * Generate virtual try-on model images via fal.ai CatVTON.
 *
 * @param {string} garmentImageUrl - Public URL of the garment photo
 * @param {string} clothType - "upper" | "lower" | "overall"
 * @returns {Promise<{imageUrls: string[]}>}
 */
export async function generateModelImages(garmentImageUrl, clothType = 'overall') {
  const response = await api.post('/api/virtual-model/generate', {
    garmentImageUrl,
    clothType,
  });
  return response.data;
}

export default api;
