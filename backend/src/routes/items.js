const express = require('express');
const { createItem, updateItem, getItem } = require('../services/airtable');

const router = express.Router();

// ─── POST /api/items ──────────────────────────────────────────────────────────
// Save a newly purchased thrift item to the Airtable inventory.
router.post('/', async (req, res) => {
  const {
    brand,
    productType,
    description,
    purchasePrice,
    purchaseDate,
    purchasedAt,
    imageUrl,
  } = req.body;

  // Basic validation
  if (!brand && !productType && !description) {
    return res.status(400).json({
      error: 'At least one of brand, productType, or description is required',
    });
  }

  try {
    // Map to Airtable field IDs
    const fields = {};

    if (brand) fields['fldwMcYqO7BvT82rL'] = brand;
    if (productType) fields['fldgu14FP3WnZCtlB'] = productType;
    if (description) fields['fldD3tVoVSh9g4NCU'] = description;
    if (purchasePrice !== undefined && purchasePrice !== null) {
      fields['fldnFIQ5ZE6Tnjrwj'] = parseFloat(purchasePrice);
    }
    if (purchaseDate) fields['fldDkJZiDObbedxth'] = purchaseDate;
    if (purchasedAt) fields['fldBggVnL0D7KtxuM'] = purchasedAt;

    // Primary image stored as an Airtable attachment array
    if (imageUrl) {
      fields['fldFVjNPwQG2mt6Hp'] = [{ url: imageUrl }];
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
      fldEZ8uzS0OlHuwKo: attachments, // Additional Images field
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
