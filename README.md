# AXION TERMINAL v3.0

> Bloomberg-style financial terminal — built with React + Vite

---

## Modules
| Module | Command | Key |
|---|---|---|
| Market Overview + Quote Detail | `MKT GO` | `1` |
| Portfolio Tracker (Multi-Account) | `PORT` | `2` |
| P&L Charts (4 views) | `PNL` | `3` |
| Options Chain | `OPT` | `4` |
| Price Alerts | `ALT` | `5` |
| Watchlists | `WL` | `6` |

**Keyboard shortcuts:** Press `F1` inside the terminal for the full list.

---

## Deploy to Render (Free Tier)

### Option A — Render Dashboard (recommended)

1. Push this folder to a GitHub or GitLab repo
2. Go to [dashboard.render.com](https://dashboard.render.com)
3. Click **New → Static Site**
4. Connect your repo
5. Render reads `render.yaml` automatically — no config needed
6. Click **Deploy** — live in ~2 minutes

Your URL will be: `https://axion-terminal.onrender.com`

### Option B — Render CLI

```bash
npm install -g @render-inc/cli
render login
render deploy
```

---

## Run Locally

```bash
# Install dependencies
npm install

# Development server (hot reload)
npm run dev
# → http://localhost:3000

# Production build
npm run build

# Preview production build locally
npm run preview
```

---

## Wiring Live Yahoo Finance Data

The `YahooAdapter` in `src/App.jsx` is the single integration point.
Yahoo Finance blocks direct browser requests — you need a backend proxy.

### Quick proxy with Express (Node)

```js
// proxy-server.js
import express from 'express'
import fetch from 'node-fetch'

const app = express()
app.use((_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  next()
})

app.get('/api/quote/:symbol', async (req, res) => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${req.params.symbol}?interval=1d&range=3mo`
  const data = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }).then(r => r.json())
  res.json(data)
})

app.listen(4000)
```

Then in `src/App.jsx`, replace `YahooAdapter.fetchQuote`:

```js
async fetchQuote(symbol) {
  const res = await fetch(`/api/quote/${symbol}`)
  const data = await res.json()
  const q = data.chart.result[0].meta
  return {
    symbol,
    price: q.regularMarketPrice,
    prevClose: q.previousClose,
    change: q.regularMarketPrice - q.previousClose,
    changePct: ((q.regularMarketPrice - q.previousClose) / q.previousClose) * 100,
    bid: q.bid || q.regularMarketPrice - 0.02,
    ask: q.ask || q.regularMarketPrice + 0.02,
    volume: q.regularMarketVolume,
    mktCap: (q.marketCap / 1e12).toFixed(2),
    high52: q.fiftyTwoWeekHigh,
    low52: q.fiftyTwoWeekLow,
    pe: q.trailingPE || 0,
  }
},
```

Deploy the proxy as a second Render **Web Service** and set `VITE_API_BASE` env var.

---

## Project Structure

```
axion-terminal/
├── index.html          # Entry HTML with boot screen
├── render.yaml         # Render.com deployment config
├── vite.config.js      # Vite build config
├── package.json
└── src/
    ├── main.jsx        # React root mount
    └── App.jsx         # Full terminal (all modules)
```

---

## Stack
- **React 18** — UI framework
- **Vite 5** — Build tool
- **IBM Plex Mono** — Typography (Google Fonts)
- **Yahoo Finance v8 API** — Data source (SIM mode by default)
- **localStorage** — Workspace persistence (alerts, watchlists, active tab)
