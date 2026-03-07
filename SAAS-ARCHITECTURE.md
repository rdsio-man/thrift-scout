# Thrift Scout — SaaS Architecture

## System Architecture (ASCII)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MOBILE APP (Expo/RN)                         │
│   iOS App Store          Android Play Store          Expo Go (dev)  │
│                                                                     │
│  Auth Screen → Camera → Results → Confirm → Inventory → Profile     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTPS / REST
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Railway)                            │
│              Rate limiting · JWT validation · CORS                  │
└──┬──────────────┬──────────────┬──────────────┬─────────────────────┘
   │              │              │              │
   ▼              ▼              ▼              ▼
┌──────┐    ┌──────────┐  ┌──────────┐  ┌──────────────┐
│ Auth │    │  Search  │  │Inventory │  │  AI Images   │
│ Svc  │    │   API    │  │   API    │  │     API      │
│      │    │          │  │          │  │              │
│Clerk │    │eBay API  │  │Postgres  │  │fal.ai queue  │
│      │    │Poshmark  │  │(per-user │  │→ Cloudflare  │
│      │    │scraper   │  │RLS)      │  │    R2        │
└──────┘    └────┬─────┘  └──────────┘  └──────┬───────┘
                 │                              │
                 ▼                              ▼
          ┌─────────────────────────────────────────┐
          │         BACKGROUND JOBS (BullMQ)        │
          │  Redis queue on Railway                 │
          │  • poshmark-scrape worker               │
          │  • fal-ai-generate worker               │
          │  • search-cache worker                  │
          └─────────────────────────────────────────┘
                            │
                            ▼
          ┌─────────────────────────────────────────┐
          │              BILLING                    │
          │  Stripe (web + Android)                 │
          │  Apple IAP (iOS subscriptions)          │
          │  Webhook handler → update DB            │
          └─────────────────────────────────────────┘
```

---

## Database Schema (PostgreSQL)

### users
```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id        TEXT UNIQUE NOT NULL,       -- Clerk auth provider ID
  email           TEXT UNIQUE NOT NULL,
  full_name       TEXT,
  avatar_url      TEXT,
  tier            TEXT NOT NULL DEFAULT 'free', -- free | pro | business
  stripe_customer_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  apple_original_transaction_id TEXT,
  platform              TEXT NOT NULL,        -- stripe | apple | google
  plan                  TEXT NOT NULL,        -- free | pro | business
  status                TEXT NOT NULL,        -- active | cancelled | past_due | trialing
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
```

### inventory_items
```sql
CREATE TABLE inventory_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  brand             TEXT,
  product_type      TEXT,
  description       TEXT,
  serial_number     TEXT,
  purchase_price    NUMERIC(10,2),
  purchase_date     DATE,
  purchased_at      TEXT,                     -- store name
  location          TEXT,                     -- bin/storage location
  status            TEXT DEFAULT 'in_inventory', -- in_inventory | listed | sold | loss
  posted_price      NUMERIC(10,2),
  posted_date       DATE,
  sold_date         DATE,
  gross_sold_price  NUMERIC(10,2),
  shipping_received NUMERIC(10,2),
  platform_fees     NUMERIC(10,2),
  shipping_cost     NUMERIC(10,2),
  platform_sold     TEXT,                     -- eBay | Poshmark | Mercari | Depop | ThredUp
  net_profit        NUMERIC(10,2) GENERATED ALWAYS AS
                    (gross_sold_price - purchase_price - platform_fees - shipping_cost) STORED,
  photo_shot        BOOLEAN DEFAULT false,
  needs_repair      BOOLEAN DEFAULT false,
  primary_image_url TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inventory_user_id ON inventory_items(user_id);
CREATE INDEX idx_inventory_status ON inventory_items(user_id, status);
CREATE INDEX idx_inventory_sold_date ON inventory_items(user_id, sold_date);
```

### generated_images
```sql
CREATE TABLE generated_images (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  item_id          UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  fal_request_id   TEXT,
  status           TEXT DEFAULT 'pending',    -- pending | processing | complete | failed
  image_urls       TEXT[],                    -- array of R2 URLs
  cloth_type       TEXT,                      -- upper | lower | overall
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

### search_history (cache + rate limiting)
```sql
CREATE TABLE search_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  query        TEXT NOT NULL,
  results      JSONB,                         -- cached response
  searched_at  TIMESTAMPTZ DEFAULT now(),
  cache_expires TIMESTAMPTZ DEFAULT now() + INTERVAL '24 hours'
);

CREATE INDEX idx_search_user_month ON search_history(user_id, searched_at);
CREATE INDEX idx_search_cache ON search_history(query, cache_expires);
```

### api_usage (tier enforcement)
```sql
CREATE TABLE api_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,                  -- search | generate_image
  used_at     TIMESTAMPTZ DEFAULT now(),
  month       TEXT GENERATED ALWAYS AS (to_char(used_at, 'YYYY-MM')) STORED
);

CREATE INDEX idx_usage_user_month ON api_usage(user_id, month, action);
```

---

## Authentication: Clerk

**Recommendation: Clerk**

| Factor | Clerk | Supabase Auth | Auth0 | Firebase |
|--------|-------|---------------|-------|----------|
| React Native SDK | ✅ First-class | ✅ Good | ⚠️ Expo issues | ✅ Good |
| Apple Sign-In | ✅ Built-in | ✅ | ✅ | ✅ |
| Google Sign-In | ✅ Built-in | ✅ | ✅ | ✅ |
| Pricing (< 10k MAU) | Free | Free | $23+/mo | Free |
| Dashboard/UX | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Webhooks | ✅ | ✅ | ✅ | ⚠️ |

Clerk is free up to 10,000 MAU, has the best React Native SDK, and handles Apple + Google Sign-In out of the box with minimal config.

### JWT Flow
```
1. User logs in via Clerk (email/Google/Apple)
2. Clerk issues a signed JWT (short-lived, 1hr)
3. Mobile app attaches JWT to every API request:
   Authorization: Bearer <clerk_jwt>
4. Backend middleware verifies JWT with Clerk's JWKS endpoint
5. Extracts clerk_id → looks up user in DB → attaches to req.user
6. All DB queries filter by req.user.id (row-level security)
```

---

## Subscription Tiers

| Feature | Free | Pro ($9.99/mo) | Business ($24.99/mo) |
|---------|------|----------------|----------------------|
| Searches/month | 20 | 200 | Unlimited |
| Inventory items | 50 | 500 | Unlimited |
| AI model photos | 5 | 50 | 200 |
| Search history | 7 days | 30 days | 1 year |
| Export to CSV | ❌ | ✅ | ✅ |
| Analytics dashboard | ❌ | Basic | Advanced |
| Multi-platform posting | ❌ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ |

### Limit Enforcement (API middleware)
```javascript
// middleware/checkLimits.js
async function checkSearchLimit(req, res, next) {
  const { user } = req;
  const limits = TIER_LIMITS[user.tier]; // { searches: 20 | 200 | Infinity }

  const thisMonth = new Date().toISOString().slice(0, 7); // "2026-03"
  const { count } = await db.query(
    `SELECT COUNT(*) FROM api_usage
     WHERE user_id = $1 AND action = 'search' AND month = $2`,
    [user.id, thisMonth]
  );

  if (count >= limits.searches) {
    return res.status(429).json({
      error: 'Monthly search limit reached',
      limit: limits.searches,
      upgrade_url: 'https://thriftscout.app/upgrade'
    });
  }

  next();
}
```

---

## Billing Architecture

### Stripe (Web + Android)
- Products: Pro Monthly, Pro Annual, Business Monthly, Business Annual
- Checkout: Stripe Payment Links or custom checkout screen
- Webhooks: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- On webhook: update `subscriptions` table + `users.tier`

### Apple In-App Purchase (iOS — Required by Apple)
- Must use StoreKit 2 for iOS subscriptions sold through App Store
- Apple takes 15% (small business) or 30% cut
- Use `react-native-iap` library
- Backend validates Apple receipts via Apple's `/verifyReceipt` endpoint
- Store `apple_original_transaction_id` in subscriptions table

### Reconciliation
```
User on iOS? → IAP only (Apple requires it)
User on Android/Web? → Stripe
Backend checks both sources when verifying subscription status
```

### RevenueCat (Recommended shortcut)
RevenueCat ($0 up to $2,500 MRR) abstracts both Stripe and IAP into a single SDK and webhook. Strongly recommended — saves weeks of billing work.

---

## Multi-Tenancy

Every table has `user_id`. Every query filters by it. No exceptions.

```sql
-- Enable Row Level Security on all tables
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation ON inventory_items
  USING (user_id = current_setting('app.current_user_id')::uuid);
```

On the API layer, set the user context before any query:
```javascript
await db.query(`SET app.current_user_id = '${req.user.id}'`);
```

This means even if there's a bug in the query logic, Postgres won't return another user's data.

---

## Background Jobs (BullMQ + Redis)

```
Mobile App
    │
    ├─ POST /api/search/combined
    │     └─ If cached → return immediately
    │        If not → enqueue poshmark-scrape job → return job_id
    │        Mobile polls GET /api/jobs/:job_id/status
    │
    └─ POST /api/virtual-model/generate
          └─ Enqueue fal-generate job → return job_id
             Mobile polls GET /api/jobs/:job_id/status
             On complete → save URLs to generated_images table
             Push notification to mobile (Expo Push Notifications)
```

### Railway Redis + BullMQ
- Add Redis service on Railway (~$5-10/month)
- BullMQ workers run as separate Railway services (easy to scale)
- Expo Push Notifications (free) to notify user when AI images are ready

---

## Image Storage: Cloudflare R2

**Why R2 over S3:**
- $0 egress fees (S3 charges ~$0.09/GB out)
- $0.015/GB storage (same as S3)
- S3-compatible API (same code)
- Free tier: 10GB storage, 1M Class A ops/month

### Flow
```
1. User takes photo in app
2. App uploads to backend (multipart)
3. Backend uploads to R2 bucket: users/{user_id}/items/{item_id}/original.jpg
4. fal.ai result URLs → download → re-upload to R2: users/{user_id}/items/{item_id}/model-1.jpg
5. Store R2 URLs in DB
6. Serve via R2 public URL or Cloudflare CDN
```

---

## Railway Deployment Layout

```
Railway Project: thrift-scout
├── Services:
│   ├── api              (Node.js — main API, always-on)
│   ├── worker           (Node.js — BullMQ workers)
│   ├── postgres         (Railway managed Postgres)
│   └── redis            (Railway managed Redis)
│
├── Environments:
│   ├── production       (main branch)
│   ├── staging          (staging branch)
│   └── development      (local)
```

### Monorepo Structure
```
thrift-scout/
├── backend/
│   ├── src/
│   │   ├── api/         (Express routes)
│   │   ├── workers/     (BullMQ job processors)
│   │   ├── services/    (DB, auth, billing, storage)
│   │   └── middleware/  (auth, limits, upload)
│   ├── migrations/      (SQL migrations)
│   └── package.json
├── mobile/
│   └── (Expo app)
└── README.md
```

---

## Monthly Infrastructure Cost Estimates

### At 100 Users
| Service | Cost |
|---------|------|
| Railway API service | $5-8 |
| Railway Postgres | $5 |
| Railway Redis | $5 |
| Railway Worker service | $3-5 |
| Cloudflare R2 (free tier) | $0 |
| Clerk (free < 10k MAU) | $0 |
| fal.ai (100 users × 5 images avg) | ~$20 |
| **Total** | **~$38-43/month** |

Revenue at 50% paid (50 × $9.99): **$499/month → ~$456 profit**

### At 1,000 Users
| Service | Cost |
|---------|------|
| Railway (scaled up) | $25-40 |
| Postgres (larger) | $20 |
| Redis | $10 |
| Cloudflare R2 | ~$5 |
| Clerk (free < 10k MAU) | $0 |
| fal.ai (1k users × 5 images) | ~$200 |
| RevenueCat (free < $2.5k MRR) | $0 |
| **Total** | **~$260-275/month** |

Revenue at 40% paid (400 × $9.99): **$3,996/month → ~$3,720 profit**

### At 10,000 Users
| Service | Cost |
|---------|------|
| Railway or move to AWS ECS | $150-300 |
| Postgres (RDS or Railway) | $50-100 |
| Redis (ElastiCache or Railway) | $30-50 |
| Cloudflare R2 | ~$25 |
| Clerk ($0.02/MAU over 10k) | ~$0 |
| fal.ai (10k × 5 images) | ~$2,000 |
| RevenueCat (~1% of revenue) | ~$250 |
| **Total** | **~$2,500-2,700/month** |

Revenue at 30% paid (3k × $9.99): **$29,970/month → ~$27,300 profit**

---

## Key Decisions Summary

| Decision | Choice | Reason |
|----------|--------|--------|
| Auth | Clerk | Best RN SDK, free to 10k MAU, Apple+Google built-in |
| Database | PostgreSQL on Railway | Row-level security, relational, familiar |
| Billing | RevenueCat | Abstracts Stripe + Apple IAP in one SDK |
| Images | Cloudflare R2 | Zero egress fees, S3-compatible |
| Jobs | BullMQ + Redis | Battle-tested, Railway-hostable |
| Notifications | Expo Push | Free, zero config with Expo |
| Deployment | Railway | Git push deploys, low ops overhead |
