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
