const cloudinary = require('cloudinary').v2;

// Lazy init — only configure when first used
let _configured = false;

function getCloudinary() {
  if (_configured) return cloudinary;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in Railway.');
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  _configured = true;
  return cloudinary;
}

/**
 * Upload a base64-encoded image to Cloudinary.
 * Returns the secure public URL.
 *
 * @param {string} base64Data - base64 string (with or without data URI prefix)
 * @param {string} folder - Cloudinary folder to store in
 * @returns {Promise<string>} public URL
 */
async function uploadImage(base64Data, folder = 'thrift-scout') {
  const cld = getCloudinary();

  // Ensure it has the data URI prefix Cloudinary expects
  const dataUri = base64Data.startsWith('data:')
    ? base64Data
    : `data:image/jpeg;base64,${base64Data}`;

  const result = await cld.uploader.upload(dataUri, {
    folder,
    resource_type: 'image',
    transformation: [{ width: 1200, crop: 'limit', quality: 'auto:good' }],
  });

  return result.secure_url;
}

module.exports = { uploadImage };
