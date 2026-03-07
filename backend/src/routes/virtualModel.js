const express = require('express');
const axios = require('axios');

const router = express.Router();

const FAL_QUEUE_URL = 'https://queue.fal.run/fal-ai/cat-vton';

// Default model image — a neutral-pose model photo from Unsplash.
// TODO: Allow users to upload their own model photo via multipart/form-data
//       using the multer middleware in src/middleware/upload.js, then upload
//       the buffer to a temporary CDN (e.g., Cloudinary or S3 presigned URL)
//       and pass that URL as human_image_url instead.
const DEFAULT_MODEL_IMAGE_URL =
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=512';

// ─── POST /api/virtual-model/generate ─────────────────────────────────────────
// Generate a virtual try-on image using fal.ai CatVTON model.
//
// Body:
//   garmentImageUrl  {string}  Public URL of the garment photo
//   clothType        {string}  "upper" | "lower" | "overall"
//
// Returns:
//   { imageUrls: [string] }
router.post('/generate', async (req, res) => {
  const { garmentImageUrl, clothType } = req.body;

  if (!garmentImageUrl) {
    return res.status(400).json({ error: 'garmentImageUrl is required' });
  }

  const validClothTypes = ['upper', 'lower', 'overall'];
  const resolvedClothType = validClothTypes.includes(clothType)
    ? clothType
    : 'overall';

  const falApiKey = process.env.FAL_API_KEY;
  if (!falApiKey || falApiKey === 'your_fal_api_key') {
    return res.status(503).json({
      error: 'fal.ai API key not configured. Set FAL_API_KEY in .env',
    });
  }

  try {
    // ── Step 1: Submit job to fal.ai queue ──────────────────────────────────
    const submitResponse = await axios.post(
      FAL_QUEUE_URL,
      {
        human_image_url: DEFAULT_MODEL_IMAGE_URL,
        garment_image_url: garmentImageUrl,
        cloth_type: resolvedClothType,
      },
      {
        headers: {
          Authorization: `Key ${falApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const { request_id, response_url, status_url } = submitResponse.data;

    if (!request_id || !response_url) {
      console.error('[virtualModel] Unexpected fal.ai submit response:', submitResponse.data);
      return res.status(502).json({
        error: 'Unexpected response from fal.ai queue submission',
      });
    }

    console.log(`[virtualModel] Job submitted. request_id=${request_id}`);

    // ── Step 2: Poll status_url until complete ───────────────────────────────
    const pollUrl = status_url || `https://queue.fal.run/fal-ai/cat-vton/requests/${request_id}/status`;
    const maxAttempts = 30;  // 30 × 3s = ~90 seconds max
    const pollIntervalMs = 3000;

    let attempt = 0;
    let jobComplete = false;
    let finalResult = null;

    while (attempt < maxAttempts && !jobComplete) {
      await sleep(pollIntervalMs);
      attempt++;

      try {
        const statusResponse = await axios.get(pollUrl, {
          headers: { Authorization: `Key ${falApiKey}` },
          timeout: 10000,
        });

        const status = statusResponse.data?.status;
        console.log(`[virtualModel] Poll attempt ${attempt}: status=${status}`);

        if (status === 'COMPLETED') {
          // Fetch the actual result from response_url
          const resultResponse = await axios.get(response_url, {
            headers: { Authorization: `Key ${falApiKey}` },
            timeout: 10000,
          });
          finalResult = resultResponse.data;
          jobComplete = true;
        } else if (status === 'FAILED' || status === 'CANCELLED') {
          const errMsg = statusResponse.data?.error || `Job ${status}`;
          return res.status(502).json({ error: `fal.ai job ${status}: ${errMsg}` });
        }
        // Otherwise keep polling (IN_QUEUE, IN_PROGRESS, etc.)
      } catch (pollErr) {
        // Non-fatal poll error — log and continue
        console.warn(`[virtualModel] Poll attempt ${attempt} error:`, pollErr.message);
      }
    }

    if (!jobComplete) {
      return res.status(504).json({
        error: 'Virtual model generation timed out. The job may still be running — check fal.ai dashboard.',
        request_id,
      });
    }

    // ── Step 3: Extract image URLs from result ───────────────────────────────
    // fal.ai CatVTON typically returns { images: [{ url: '...' }] }
    // or { image: { url: '...' } } — handle both shapes.
    let imageUrls = [];

    if (Array.isArray(finalResult?.images)) {
      imageUrls = finalResult.images.map((img) => img.url || img).filter(Boolean);
    } else if (finalResult?.image?.url) {
      imageUrls = [finalResult.image.url];
    } else if (typeof finalResult?.output === 'string') {
      imageUrls = [finalResult.output];
    } else {
      console.warn('[virtualModel] Could not parse image URLs from result:', finalResult);
    }

    return res.json({ imageUrls });
  } catch (err) {
    console.error('[POST /api/virtual-model/generate Error]', err.message);
    return res.status(500).json({
      error: 'Virtual model generation failed',
      details: err.message,
    });
  }
});

/** Simple promise-based sleep */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = router;
