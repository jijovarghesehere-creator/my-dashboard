# My Dashboard

A local dashboard that shows weather and news for your current location using browser geolocation.

## Features

- **Weather** — current conditions and 5-day forecast via [Open-Meteo](https://open-meteo.com/) (no API key)
- **Local news** — headlines for your city via Google News RSS
- **Location** — browser geolocation with manual city entry as a fallback

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`) and allow location access when prompted.

To preview the production build with Cloudflare Functions (same as deployed):

```bash
npm run preview:cf
```

## Deploy to Cloudflare Pages (free)

### 1. Push to GitHub

Create a repo and push this project:

```bash
git remote add origin https://github.com/YOUR_USERNAME/my-dashboard.git
git push -u origin main
```

### 2. Create a Cloudflare Pages project

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/)
2. Go to **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Select your GitHub repo

### 3. Configure build settings

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |

Cloudflare automatically picks up:

- **`functions/`** — serverless proxies for geocoding and news
- **`wrangler.toml`** — output directory config

### 4. Deploy

Click **Save and Deploy**. Cloudflare builds the site and deploys it to a `*.pages.dev` URL.

Every push to `main` triggers a new deployment automatically.

## How it works in production

| Feature | Source |
|---|---|
| Weather | Open-Meteo (direct from browser) |
| Location lookup | `functions/api/nominatim/` → OpenStreetMap Nominatim |
| Local news | `functions/api/news/` → Google News RSS |

During local dev, Vite proxies these same `/api/*` routes. On Cloudflare, Pages Functions handle them instead.

## Build

```bash
npm run build
```

The static files land in `dist/`. Use `npm run preview:cf` to test the full stack locally before deploying.
