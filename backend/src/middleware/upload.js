const multer = require('multer');

// Store uploaded files in memory as Buffer objects.
// This allows us to process or forward the data without writing to disk,
// which is important in ephemeral environments like Railway or Heroku.
const storage = multer.memoryStorage();

/**
 * File filter: only allow common image MIME types.
 */
function imageFileFilter(req, file, cb) {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `File type "${file.mimetype}" is not allowed. Please upload a JPEG, PNG, GIF, WEBP, or HEIC image.`
      ),
      false
    );
  }
}

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 5,                    // max 5 files per request
  },
});

module.exports = upload;
