const Airtable = require('airtable');

// ─── Initialization ────────────────────────────────────────────────────────────
const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID || 'app6m3AeF51whZ1Ah';
const TABLE_ID = 'tblTaFS0YtOCBM8Rz';

if (!apiKey || apiKey === 'your_key_here') {
  console.warn(
    '[Airtable] WARNING: AIRTABLE_API_KEY is not set. Item operations will fail.'
  );
}

Airtable.configure({
  endpointUrl: 'https://api.airtable.com',
  apiKey: apiKey,
});

const base = Airtable.base(baseId);
const table = base(TABLE_ID);

// ─── Helper: promisify Airtable callbacks ──────────────────────────────────────

/**
 * Create a new inventory item record in Airtable.
 *
 * @param {Object} fields - Key/value pairs using Airtable field IDs.
 *   Attachment fields must be arrays of { url: string } objects.
 * @returns {Promise<AirtableRecord>}
 */
async function createItem(fields) {
  return new Promise((resolve, reject) => {
    table.create(
      [{ fields }],
      { typecast: true }, // Allow Airtable to coerce types (e.g., string dates)
      (err, records) => {
        if (err) {
          return reject(new Error(`Airtable createItem failed: ${err.message}`));
        }
        if (!records || records.length === 0) {
          return reject(new Error('Airtable createItem returned no records'));
        }
        resolve(records[0]);
      }
    );
  });
}

/**
 * Update an existing inventory item record.
 *
 * @param {string} recordId - Airtable record ID (starts with "rec")
 * @param {Object} fields - Fields to update (partial update — PATCH semantics)
 * @returns {Promise<AirtableRecord>}
 */
async function updateItem(recordId, fields) {
  return new Promise((resolve, reject) => {
    table.update(
      [{ id: recordId, fields }],
      { typecast: true },
      (err, records) => {
        if (err) {
          return reject(new Error(`Airtable updateItem failed: ${err.message}`));
        }
        if (!records || records.length === 0) {
          return reject(new Error('Airtable updateItem returned no records'));
        }
        resolve(records[0]);
      }
    );
  });
}

/**
 * Fetch a single inventory item by its Airtable record ID.
 *
 * @param {string} recordId - Airtable record ID (starts with "rec")
 * @returns {Promise<AirtableRecord>}
 */
async function getItem(recordId) {
  return new Promise((resolve, reject) => {
    table.find(recordId, (err, record) => {
      if (err) {
        return reject(new Error(`Airtable getItem failed: ${err.message}`));
      }
      resolve(record);
    });
  });
}

module.exports = { createItem, updateItem, getItem };
