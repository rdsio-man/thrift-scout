# Thrift Scout 🔍

**Scan thrift items. Check sold prices. Know before you buy.**

Thrift Scout is a mobile-first resale research tool for thrift store shoppers. Point your phone at an item, type the brand/name, and instantly see what it's actually selling for — so you never leave money on the table (or overpay for something that won't sell).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    THRIFT SCOUT SYSTEM                          │
└─────────────────────────────────────────────────────────────────┘

  📱 MOBILE APP (React Native + Expo)
  ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐   ┌──────────────┐
  │ CameraScreen │──▶│ ResultsScreen│──▶│ConfirmPurchase    │──▶│SuccessScreen │
  │              │   │              │   │Screen             │   │              │
  │ • Take photo │   │ • Avg price  │   │ • Brand / type    │   │ • Saved! 🎉  │
  │ • Type brand │   │ • Buy/Pass   │   │ • Purchase details│   │ • View record│
  │ • Search     │   │ • Listing    │   │ • Save to Airtable│   │ • Scan more  │
  └──────┬───────┘   │  feed        │   └─────────┬─────────┘   └──────────────┘
         │           └──────────────┘             │
         │ POST /api/search/combined               │ POST /api/items
         ▼                                        ▼
  ☁️  BACKEND API (Node.js + Express — Railway)
  ┌─────────────────────────────────────────────────────────────┐
  │  /api/search/ebay      → eBay Finding API (sold items)      │
  │  /api/search/poshmark  → Poshmark scraper (TODO: Playwright)│
  │  /api/search/combined  → Parallel search + avg price calc   │
  │  /api/items            → CRUD against Airtable              │
  │  /api/virtual-model    → fal.ai CatVTON try-on generation   │
  └────────────┬────────────────────────────────────────────────┘
               │
       ┌───────┼───────────┐
       ▼       ▼           ▼
  📦 Airtable  🛒 eBay API  🤖 fal.ai
  (inventory)  (sold data)  (try-on AI)
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- An Airtable account with the base configured (see below)
- eBay developer account (for API keys)
- fal.ai account (for virtual try-on)

---

## Backend Setup

```bash
cd thrift-scout/backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

The API will start on `http://localhost:3000`.

**Test it:**
```bash
curl http://localhost:3000/
# → {"status":"ok","service":"thrift-scout-backend"}
```

---

## Mobile App Setup

```bash
cd thrift-scout/mobile
npm install
# Edit src/config.js — set API_BASE_URL to your backend URL
npx expo start
```

Scan the QR code in the Expo Go app (iOS or Android) to run on your device.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable           | Description                                     | Required |
|--------------------|-------------------------------------------------|----------|
| `PORT`             | Server port (default: 3000)                     | No       |
| `AIRTABLE_API_KEY` | Airtable personal access token                  | Yes      |
| `AIRTABLE_BASE_ID` | Airtable base ID (`app6m3AeF51whZ1Ah`)          | Yes      |
| `EBAY_APP_ID`      | eBay developer App ID (Finding API)             | Yes      |
| `EBAY_CERT_ID`     | eBay developer Cert ID                          | No*      |
| `FAL_API_KEY`      | fal.ai API key for CatVTON virtual try-on       | Yes      |

*`EBAY_CERT_ID` is reserved for OAuth flows — not needed for the Finding API.

### Mobile (`src/config.js`)

| Export            | Description                                     |
|-------------------|-------------------------------------------------|
| `API_BASE_URL`    | Your backend URL (localhost or Railway)         |
| `BUY_THRESHOLD`   | Minimum avg price for "BUY IT" recommendation   |

---

## Airtable Schema

**Base ID:** `app6m3AeF51whZ1Ah`  
**Table ID:** `tblTaFS0YtOCBM8Rz`

| Field Name        | Field ID              | Type          |
|-------------------|-----------------------|---------------|
| Brand             | `fldwMcYqO7BvT82rL`   | Single line   |
| Product Type      | `fldgu14FP3WnZCtlB`   | Single line   |
| Item Description  | `fldD3tVoVSh9g4NCU`   | Long text     |
| Purchase Price    | `fldnFIQ5ZE6Tnjrwj`   | Currency      |
| Purchase Date     | `fldDkJZiDObbedxth`   | Date          |
| Purchased At      | `fldBggVnL0D7KtxuM`   | Single line   |
| Primary Image     | `fldFVjNPwQG2mt6Hp`   | Attachment    |
| Additional Images | `fldEZ8uzS0OlHuwKo`   | Attachment    |

---

## Deploy Backend to Railway

1. Create a Railway account at [railway.app](https://railway.app)
2. Install Railway CLI: `npm install -g @railway/cli`
3. From the `backend/` directory:

```bash
railway login
railway init          # creates a new project
railway up            # deploys current directory

# Set environment variables in Railway dashboard or via CLI:
railway variables set AIRTABLE_API_KEY=your_key
railway variables set AIRTABLE_BASE_ID=app6m3AeF51whZ1Ah
railway variables set EBAY_APP_ID=your_ebay_app_id
railway variables set FAL_API_KEY=your_fal_api_key
```

4. Railway will auto-detect Node.js and use the `start` script.
5. Copy the Railway URL and update `API_BASE_URL` in `mobile/src/config.js`.

**Railway auto-detects `PORT` from the environment — no changes needed in code.**

---

## API Endpoints

### Search

| Method | Path                     | Body                        | Description                        |
|--------|--------------------------|-----------------------------|------------------------------------|
| POST   | `/api/search/ebay`       | `{query, category?}`        | eBay sold listings                 |
| POST   | `/api/search/poshmark`   | `{query}`                   | Poshmark sold (placeholder)        |
| POST   | `/api/search/combined`   | `{query, category?}`        | Both platforms + avg price         |

### Items (Inventory)

| Method | Path                          | Body / Params              | Description                        |
|--------|-------------------------------|----------------------------|------------------------------------|
| POST   | `/api/items`                  | Item fields                | Create new inventory record        |
| GET    | `/api/items/:id`              | Record ID in URL           | Fetch a single item                |
| PATCH  | `/api/items/:id/model-images` | `{imageUrls: []}`          | Attach virtual try-on images       |

### Virtual Try-On

| Method | Path                          | Body                              | Description              |
|--------|-------------------------------|-----------------------------------|--------------------------|
| POST   | `/api/virtual-model/generate` | `{garmentImageUrl, clothType}`    | Generate model try-on    |

---

## Pending / TODO Items

### 🔑 Credentials Needed
- **eBay Developer Keys**: Apply at [developer.ebay.com](https://developer.ebay.com). You need App ID (client ID) for the Finding API. Free tier available.
- **fal.ai API Key**: Sign up at [fal.ai](https://fal.ai). CatVTON is a pay-per-use model.

### 🕷️ Poshmark Scraper
The Poshmark endpoint (`POST /api/search/poshmark`) returns a placeholder. Implementation plan:
- Use **Playwright** (or `playwright-extra` with stealth plugin) to scrape `poshmark.com/search?query=<q>&availability=sold_out`
- Extract listing cards: title, price, image, date
- Consider a dedicated scraping service (ScrapingBee, Apify) for scale + anti-bot bypass
- Alternative: use a Poshmark unofficial API library if one becomes available

### 🤖 Vision AI Item Detection
Currently the user types the item name manually on the Camera screen.  
Future: Send the captured photo to a vision model (GPT-4o, Google Vision, or AWS Rekognition) to auto-detect brand/product type and pre-fill the search query.

### 👗 Custom Model Photo
The virtual try-on uses a default Unsplash model photo. Future: let users upload their own photo (handled by `src/middleware/upload.js` on the backend, then upload to S3/Cloudinary and pass URL to fal.ai).

### 📦 Build & Distribution
- Use **EAS Build** (`eas build`) for production APK/IPA
- Set `projectId` in `app.json` after creating EAS project
- Consider **EAS Update** for OTA updates without App Store re-submission

---

## Project Structure

```
thrift-scout/
├── backend/
│   ├── src/
│   │   ├── index.js                  # Express app entry point
│   │   ├── routes/
│   │   │   ├── search.js             # eBay + Poshmark search routes
│   │   │   ├── items.js              # Airtable inventory CRUD
│   │   │   └── virtualModel.js       # fal.ai try-on generation
│   │   ├── services/
│   │   │   └── airtable.js           # Airtable helper functions
│   │   └── middleware/
│   │       └── upload.js             # multer image upload config
│   ├── .env.example
│   └── package.json
├── mobile/
│   ├── App.js                        # Navigation setup
│   ├── app.json                      # Expo config
│   ├── babel.config.js
│   ├── src/
│   │   ├── config.js                 # API URL + thresholds
│   │   ├── screens/
│   │   │   ├── CameraScreen.js       # Scan + search
│   │   │   ├── ResultsScreen.js      # Price display + buy/pass
│   │   │   ├── ConfirmPurchaseScreen.js  # Item details form
│   │   │   └── SuccessScreen.js      # Confirmation + Airtable link
│   │   └── services/
│   │       └── api.js                # Axios API client
│   └── package.json
└── README.md
```

---

## License

MIT — build something great.
