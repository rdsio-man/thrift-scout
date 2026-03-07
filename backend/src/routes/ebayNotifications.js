const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// eBay sends a challenge code to verify you own the endpoint.
// Respond with SHA-256 hash of: challengeCode + verificationToken + endpoint URL
// https://developer.ebay.com/devzone/client-alerts/docs/concepts/pubsubnotifications.html

const VERIFICATION_TOKEN = process.env.EBAY_VERIFICATION_TOKEN || 'thrift-scout-ebay-verification-token-2026';
const ENDPOINT_URL = process.env.EBAY_NOTIFICATION_ENDPOINT_URL || 'https://thrift-scout-production.up.railway.app/api/ebay/notifications';

// ── GET /api/ebay/notifications ─────────────────────────────────────────────
// eBay calls this to verify endpoint ownership during setup
router.get('/', (req, res) => {
  const { challenge_code } = req.query;

  if (!challenge_code) {
    return res.status(400).json({ error: 'Missing challenge_code' });
  }

  // Hash = SHA-256(challengeCode + verificationToken + endpointUrl)
  const hash = crypto
    .createHash('sha256')
    .update(challenge_code + VERIFICATION_TOKEN + ENDPOINT_URL)
    .digest('hex');

  console.log(`[eBay] Endpoint verification challenge received. Responding with hash.`);

  return res.status(200).json({ challengeResponse: hash });
});

// ── POST /api/ebay/notifications ────────────────────────────────────────────
// eBay sends account deletion/closure notifications here.
// We don't store eBay user data, so we just acknowledge and log.
router.post('/', (req, res) => {
  const notification = req.body;

  const notificationType = notification?.metadata?.topic || 'unknown';
  const userId = notification?.notification?.data?.userId || 'unknown';

  console.log(`[eBay] Notification received: type=${notificationType} userId=${userId}`);

  // We don't store any eBay user personal data, so no deletion action needed.
  // Just acknowledge receipt with 200 OK as required by eBay.
  return res.status(200).json({ received: true });
});

module.exports = router;
