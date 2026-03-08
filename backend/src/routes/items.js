const express = require('express');
const { createItem, updateItem, getItem } = require('../services/airtable');
const { uploadImage } = require('../services/cloudinary');

const router = express.Router();

// ─── POST /api/items ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    brand,
    productType,
    description,
    purchasePrice,
    purchaseDate,
    purchasedAt,
    imageBase64,  // base64 encoded image from phone camera
  } = req.body;

  if (!brand && !productType && !description) {
    return res.status(400).json({
      error: 'At least one of brand, productType, or description is required',
    });
  }

  try {
    const fields = {};

    // Field IDs from All Inventory table (tbl5Z8YEYzZoj9p5p)
    // Brand = singleSelect, Product Type = multipleSelects — must send as strings (Airtable accepts string for selects)
    if (brand) fields['fldIBF44OdMhBvjFB'] = brand;
    if (productType) fields['fldsjuajP979HZKzr'] = [productType]; // multipleSelects requires array
    if (description) fields['fldPSW12VYsVYr4QK'] = description;
    if (purchasePrice !== undefined && purchasePrice !== null) {
      fields['fldzubWJZKhF5GIK9'] = parseFloat(purchasePrice);
    }
    if (purchaseDate) fields['fldP9c5WDUmXWAOH7'] = purchaseDate;
    if (purchasedAt) fields['fldN5J11L6OTsQOIC'] = purchasedAt;

    // Upload image to Cloudinary if provided, then attach URL to Airtable
    if (imageBase64) {
      try {
        console.log('[items] Uploading image to Cloudinary, base64 length:', imageBase64.length);
        const imageUrl = await uploadImage(imageBase64);
        fields['fldKarfpdwhrjU91t'] = [{ url: imageUrl }];
        console.log('[items] Image uploaded successfully:', imageUrl);
      } catch (imgErr) {
        console.warn('[items] Image upload failed:', imgErr.message);
      }
    }

    const record = await createItem(fields);

    return res.status(201).json({
      id: record.id,
      fields: record.fields,
    });
  } catch (err) {
    console.error('[POST /api/items Error]', err.message);
    return res.status(500).json({
      error: 'Failed to create item in Airtable',
      details: err.message,
    });
  }
});

// ─── PATCH /api/items/:id/model-images ────────────────────────────────────────
// Attach virtual try-on generated images to an existing inventory record.
router.patch('/:id/model-images', async (req, res) => {
  const { id } = req.params;
  const { imageUrls } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Record ID is required' });
  }

  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return res.status(400).json({
      error: 'imageUrls must be a non-empty array of URL strings',
    });
  }

  try {
    // Map each URL string to Airtable attachment format
    const attachments = imageUrls.map((url) => ({ url }));

    const updatedRecord = await updateItem(id, {
      fldghRCaUSsNKCraM: attachments, // Additional Images field
    });

    return res.json({
      id: updatedRecord.id,
      fields: updatedRecord.fields,
    });
  } catch (err) {
    console.error('[PATCH /api/items/:id/model-images Error]', err.message);
    return res.status(500).json({
      error: 'Failed to update model images in Airtable',
      details: err.message,
    });
  }
});

// ─── GET /api/items/:id ────────────────────────────────────────────────────────
// Fetch a single inventory record by Airtable record ID.
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Record ID is required' });
  }

  try {
    const record = await getItem(id);

    return res.json({
      id: record.id,
      fields: record.fields,
    });
  } catch (err) {
    console.error('[GET /api/items/:id Error]', err.message);

    // Airtable returns a 404-like error when the record doesn't exist
    if (err.message && err.message.includes('NOT_FOUND')) {
      return res.status(404).json({ error: 'Item not found' });
    }

    return res.status(500).json({
      error: 'Failed to fetch item from Airtable',
      details: err.message,
    });
  }
});

module.exports = router;
