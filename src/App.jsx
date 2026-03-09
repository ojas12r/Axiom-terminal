import { useState, useEffect, useRef, useCallback, useReducer } from "react";

// ════════════════════════════════════════════════════════════════════════════
// AXION TERMINAL v3.0  —  Sprint 1 + 2 + 3
// Modules: Market Overview · Portfolio · P&L Charts · Options Chain
//          Multi-Account · Keyboard Navigation · Price Alerts · Watchlists
//          Workspace Persistence (localStorage)
// Data: Yahoo Finance Adapter (SIM MODE — swap internals for live proxy)
// ════════════════════════════════════════════════════════════════════════════

// ─── YAHOO FINANCE ADAPTER ───────────────────────────────────────────────────
// Production swap: replace mock bodies with fetch to your backend proxy
// Proxy target: https://query1.finance.yahoo.com/v8/finance/chart/{symbol}
const YahooAdapter = {
  async fetchQuote(symbol) {
    const res = await fetch(`/api/quote/${symbol}`);
    const data = await res.json();
    const q = data.chart.result[0].meta;
    const price = q.regularMarketPrice;
    const prevClose = q.previousClose;
    return {
      symbol,
      price: +price.toFixed(2),
      prevClose: +prevClose.toFixed(2),
      change: +(price - prevClose).toFixed(2),
      changePct: +(((price - prevClose) / prevClose) * 100).toFixed(2),
      bid: +(q.bid || price - 0.02).toFixed(2),
      ask: +(q.ask || price + 0.02).toFixed(2),
      volume: q.regularMarketVolume,
      mktCap: ((q.marketCap || 0) / 1e12).toFixed(2),
      high52: +q.fiftyTwoWeekHigh.toFixed(2),
      low52: +q.fiftyTwoWeekLow.toFixed(2),
      pe: +(q.trailingPE || 0).toFixed(1),
    };
  },
  async fetchCandles(symbol) { return generateCandles(BASE_PRICES[symbol] || 100); },
};

// ─── MOCK DATA ENGINE ────────────────────────────────────────────────────────
const BASE_PRICES = {
  AAPL: 189.45, MSFT: 415.20, GOOGL: 175.80, AMZN: 198.60,
  NVDA: 875.30, TSLA: 245.10, META: 512.40, SPY: 521.80,
  QQQ: 445.20, JPM: 198.30, GS: 478.50, BAC: 38.20,
  AMD: 178.40, INTC: 43.20, NFLX: 628.50, DIS: 112.30,
  V: 278.60, MA: 468.90, BRK: 380.20, XOM: 118.40,
};

function generateCandles(base, count = 90) {
  const candles = []; let price = base * 0.88; const now = Date.now();
  for (let i = count; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.48) * price * 0.018;
    const close = open + change;
    candles.push({
      time: Math.floor((now - i * 3600000) / 1000),
      open: +open.toFixed(2),
      high: +(Math.max(open, close) + Math.random() * price * 0.008).toFixed(2),
      low: +(Math.min(open, close) - Math.random() * price * 0.008).toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(Math.random() * 8e6 + 2e6),
    });
    price = close;
  }
  return candles;
}

function makeStock(sym) {
  const base = BASE_PRICES[sym] || 100;
  const price = base + (Math.random() - 0.5) * base * 0.04;
  const prevClose = price * (1 + (Math.random() - 0.52) * 0.03);
  const chg = price - prevClose;
  return {
    symbol: sym, price: +price.toFixed(2), prevClose: +prevClose.toFixed(2),
    change: +chg.toFixed(2), changePct: +((chg / prevClose) * 100).toFixed(2),
    bid: +(price - 0.02).toFixed(2), ask: +(price + 0.02).toFixed(2),
    volume: Math.floor(Math.random() * 50e6 + 5e6),
    mktCap: (price * (Math.random() * 5e9 + 1e9) / 1e12).toFixed(2),
    high52: +(price * (1 + Math.random() * 0.35)).toFixed(2),
    low52: +(price * (1 - Math.random() * 0.3)).toFixed(2),
    pe: +(Math.random() * 40 + 10).toFixed(1),
    candles: generateCandles(price),
  };
}

// ─── MULTI-ACCOUNT DEFINITIONS ───────────────────────────────────────────────
const ACCOUNTS_DATA = {
  main: {
    id: "main", label: "MAIN ACCOUNT", color: "#00d26a",
    holdings: [
      { symbol: "AAPL", shares: 150, avgCost: 155.20, sector: "Technology" },
      { symbol: "MSFT", shares: 80, avgCost: 380.50, sector: "Technology" },
      { symbol: "NVDA", shares: 45, avgCost: 620.00, sector: "Semiconductors" },
      { symbol: "JPM", shares: 200, avgCost: 175.30, sector: "Financials" },
      { symbol: "GOOGL", shares: 60, avgCost: 140.20, sector: "Communication" },
      { symbol: "TSLA", shares: 100, avgCost: 210.00, sector: "Consumer Disc." },
      { symbol: "GS", shares: 30, avgCost: 420.00, sector: "Financials" },
      { symbol: "AMZN", shares: 55, avgCost: 175.00, sector: "Consumer Disc." },
    ],
  },
  ira: {
    id: "ira", label: "IRA ACCOUNT", color: "#f5a623",
    holdings: [
      { symbol: "SPY", shares: 200, avgCost: 480.00, sector: "ETF" },
      { symbol: "QQQ", shares: 120, avgCost: 410.00, sector: "ETF" },
      { symbol: "V", shares: 90, avgCost: 240.00, sector: "Financials" },
      { symbol: "MA", shares: 60, avgCost: 430.00, sector: "Financials" },
      { symbol: "BRK", shares: 50, avgCost: 340.00, sector: "Conglomerate" },
      { symbol: "XOM", shares: 150, avgCost: 95.00, sector: "Energy" },
    ],
  },
  trading: {
    id: "trading", label: "TRADING ACCT", color: "#ff8800",
    holdings: [
      { symbol: "AMD", shares: 300, avgCost: 140.00, sector: "Semiconductors" },
      { symbol: "NFLX", shares: 40, avgCost: 580.00, sector: "Communication" },
      { symbol: "META", shares: 70, avgCost: 450.00, sector: "Technology" },
      { symbol: "DIS", shares: 180, avgCost: 105.00, sector: "Consumer Disc." },
      { symbol: "INTC", shares: 400, avgCost: 38.00, sector: "Semiconductors" },
    ],
  },
};

// ─── OPTIONS GENERATOR ───────────────────────────────────────────────────────
function generateOptions(strike_base) {
  return [-15, -10, -5, 0, 5, 10, 15].map(d => +(strike_base + d).toFixed(0)).map(strike => {
    const itm = strike < strike_base;
    const intrinsic = Math.max(0, strike_base - strike);
    const callDelta = +(itm ? 0.6 + Math.random() * 0.35 : 0.1 + Math.random() * 0.45).toFixed(2);
    const callBid = +(intrinsic + Math.random() * 3 + 0.5).toFixed(2);
    const putBid = +(Math.max(0, strike - strike_base) + Math.random() * 2 + 0.3).toFixed(2);
    return {
      strike, callIV: (0.25 + Math.random() * 0.15).toFixed(2), putIV: (0.27 + Math.random() * 0.15).toFixed(2),
      callDelta, putDelta: +(-1 + callDelta).toFixed(2),
      callBid, callAsk: +(+callBid + 0.15).toFixed(2), putBid, putAsk: +(+putBid + 0.15).toFixed(2),
      callOI: Math.floor(Math.random() * 15000 + 500), putOI: Math.floor(Math.random() * 12000 + 300),
      callVol: Math.floor(Math.random() * 8000), putVol: Math.floor(Math.random() * 6000),
      atm: Math.abs(strike - strike_base) < 5,
    };
  });
}

// ─── P&L HISTORY ─────────────────────────────────────────────────────────────
function generatePnLHistory(holdings, stocks) {
  const days = 90; const now = Date.now();
  const totalCost = holdings.reduce((a, h) => a + h.avgCost * h.shares, 0);
  let val = totalCost * 0.88;
  const history = [];
  for (let i = days; i >= 0; i--) {
    const date = new Date(now - i * 86400000);
    val = Math.max(totalCost * 0.65, val + (Math.random() - 0.47) * val * 0.012);
    const spyVal = totalCost * (0.88 + (days - i) * 0.0015 + (Math.random() - 0.5) * 0.008);
    history.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      portfolioVal: +val.toFixed(2), pnl: +(val - totalCost).toFixed(2),
      pnlPct: +((val - totalCost) / totalCost * 100).toFixed(2),
      spyPnl: +(spyVal - totalCost).toFixed(2),
    });
  }
  const dailyBars = history.slice(1).map((d, i) => ({ date: d.date, dayPnl: +(d.portfolioVal - history[i].portfolioVal).toFixed(2) }));
  const positions = holdings.map(h => {
    const s = stocks[h.symbol]; if (!s) return null;
    const currentVal = s.price * h.shares; const costBasis = h.avgCost * h.shares; const pnl = currentVal - costBasis;
    const realized = +(Math.random() * Math.abs(pnl) * 0.3 * Math.sign(pnl)).toFixed(2);
    return { symbol: h.symbol, pnl, pnlPct: (pnl / costBasis) * 100, realized, unrealized: +(pnl - realized).toFixed(2), costBasis, currentVal };
  }).filter(Boolean).sort((a, b) => b.pnl - a.pnl);
  return {
    history, dailyBars, positions, totalCost,
    totalRealized: positions.reduce((a, p) => a + p.realized, 0),
    totalUnrealized: positions.reduce((a, p) => a + p.unrealized, 0),
  };
}

// ─── PERSISTENCE HELPERS ─────────────────────────────────────────────────────
const WS_KEY = "axion_workspace_v3";
function loadWorkspace() {
  try { return JSON.parse(localStorage.getItem(WS_KEY)) || {}; } catch { return {}; }
}
function saveWorkspace(data) {
  try { localStorage.setItem(WS_KEY, JSON.stringify(data)); } catch {}
}

// ─── SHARED UI ───────────────────────────────────────────────────────────────
const MONO = "'IBM Plex Mono', monospace";

function SectionHeader({ label, tag, extra }) {
  const [time, setTime] = useState(new Date().toLocaleTimeString("en-US", { hour12: false }));
  useEffect(() => { const t = setInterval(() => setTime(new Date().toLocaleTimeString("en-US", { hour12: false })), 1000); return () => clearInterval(t); }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", background: "#060e06", borderBottom: "1px solid #1a2a1a", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ background: "#00a855", color: "#000", fontFamily: MONO, fontSize: 8, fontWeight: 700, padding: "1px 5px", letterSpacing: 1 }}>{tag}</div>
        <span style={{ fontFamily: MONO, fontSize: 10, color: "#4a7a4a", letterSpacing: 1 }}>{label}</span>
        {extra}
      </div>
      <span style={{ fontFamily: MONO, fontSize: 9, color: "#2a4a2a" }}>{time}</span>
    </div>
  );
}

function Sparkline({ candles, color, width = 80, height = 28 }) {
  if (!candles || candles.length < 2) return null;
  const closes = candles.slice(-20).map(c => c.close);
  const min = Math.min(...closes), max = Math.max(...closes), range = max - min || 1;
  const pts = closes.map((v, i) => `${(i / (closes.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  return <svg width={width} height={height} style={{ display: "block" }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

function CandleChart({ candles, width = 900, height = 420 }) {
  if (!candles || candles.length < 2) return null;
  const visible = candles.slice(-50);
  const prices = visible.flatMap(c => [c.high, c.low]);
  const minP = Math.min(...prices), maxP = Math.max(...prices), range = maxP - minP || 1;
  const pL = 48, pR = 8, pT = 10, pB = 22;
  const cW = width - pL - pR, cH = height - pT - pB;
  const candleW = Math.max(2, (cW / visible.length) - 1.5);
  const toY = v => pT + cH - ((v - minP) / range) * cH;
  const toX = i => pL + (i / visible.length) * cW + candleW / 2;
  const yLines = Array.from({ length: 5 }, (_, i) => { const val = minP + (range / 4) * i; return { val, y: toY(val) }; });
  return (
    <svg width={width} height={height} style={{ fontFamily: MONO }}>
      {yLines.map(({ val, y }, i) => (
        <g key={i}>
          <line x1={pL} x2={width - pR} y1={y} y2={y} stroke="#1a2a1a" strokeWidth="1" strokeDasharray="3,3" />
          <text x={pL - 4} y={y + 4} textAnchor="end" fill="#3a6a3a" fontSize="8">{val.toFixed(0)}</text>
        </g>
      ))}
      {visible.map((c, i) => {
        const x = toX(i), up = c.close >= c.open, col = up ? "#00d26a" : "#ff4444";
        const bT = toY(Math.max(c.open, c.close)), bB = toY(Math.min(c.open, c.close));
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={toY(c.high)} y2={toY(c.low)} stroke={col} strokeWidth="1" />
            <rect x={x - candleW / 2} y={bT} width={candleW} height={Math.max(1, bB - bT)} fill={col} fillOpacity="0.85" />
          </g>
        );
      })}
      {visible.filter((_, i) => i % 10 === 0).map((c, idx) => {
        const i = idx * 10, d = new Date(c.time * 1000);
        return <text key={i} x={toX(i)} y={height - 5} textAnchor="middle" fill="#2a4a2a" fontSize="7">{`${d.getMonth() + 1}/${d.getDate()}`}</text>;
      })}
    </svg>
  );
}

// ─── TICKER STRIP ─────────────────────────────────────────────────────────────
function TickerStrip({ stocks }) {
  const items = Object.values(stocks);
  const doubled = [...items, ...items];
  return (
    <div style={{ background: "#040a04", borderBottom: "1px solid #1a2a1a", overflow: "hidden", height: 26, display: "flex", alignItems: "center", flexShrink: 0 }}>
      <div style={{ display: "flex", animation: "tickerScroll 80s linear infinite", whiteSpace: "nowrap" }}>
        {doubled.map((s, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0 16px", borderRight: "1px solid #0f1a0f", fontFamily: MONO, fontSize: 10 }}>
            <span style={{ color: "#8aff8a", fontWeight: 700 }}>{s.symbol}</span>
            <span style={{ color: "#c0c0c0" }}>{s.price.toFixed(2)}</span>
            <span style={{ color: s.change >= 0 ? "#00d26a" : "#ff4444", fontSize: 9 }}>{s.change >= 0 ? "▲" : "▼"}{Math.abs(s.changePct).toFixed(2)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── MARKET OVERVIEW ─────────────────────────────────────────────────────────
function MarketOverview({ stocks, onSelect, selected }) {
  const indices = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSLA", "META", "JPM", "GS", "BAC", "AMD", "NFLX", "V", "XOM"];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <SectionHeader label="MARKET OVERVIEW" tag="MKT" />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ display: "flex", gap: 3, padding: "4px 6px 6px" }}>
          {["SPY", "QQQ"].map(sym => {
            const s = stocks[sym]; if (!s) return null;
            const up = s.change >= 0;
            return (
              <div key={sym} onClick={() => onSelect(sym)} style={{ flex: 1, background: "#070e07", border: `1px solid ${up ? "#1a3a1a" : "#3a1a1a"}`, padding: "7px 8px", cursor: "pointer", boxShadow: selected === sym ? `0 0 0 1px ${up ? "#00d26a" : "#ff4444"}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: "#8aff8a", fontWeight: 700 }}>{sym}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: up ? "#00d26a" : "#ff4444" }}>{up ? "▲" : "▼"}{Math.abs(s.changePct).toFixed(2)}%</span>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 15, color: "#e8e8e8", fontWeight: 600, margin: "2px 0" }}>{s.price.toFixed(2)}</div>
                <Sparkline candles={s.candles} color={up ? "#00d26a" : "#ff4444"} width={95} height={20} />
              </div>
            );
          })}
        </div>
        <div style={{ padding: "0 6px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 1, marginBottom: 3 }}>
            {["SYM", "LAST", "CHG", "CHG%", "VOL"].map(h => <div key={h} style={{ fontFamily: MONO, fontSize: 8, color: "#2a5a2a", padding: "1px 3px", borderBottom: "1px solid #0a180a" }}>{h}</div>)}
          </div>
          {indices.filter(s => s !== "SPY" && s !== "QQQ").map(sym => {
            const s = stocks[sym]; if (!s) return null; const up = s.change >= 0;
            return (
              <div key={sym} onClick={() => onSelect(sym)} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 1, padding: "2px 0", cursor: "pointer", borderBottom: "1px solid #070d07", background: selected === sym ? "#091409" : "transparent" }}
                onMouseEnter={e => e.currentTarget.style.background = "#0b160b"}
                onMouseLeave={e => e.currentTarget.style.background = selected === sym ? "#091409" : "transparent"}>
                <div style={{ fontFamily: MONO, fontSize: 10, color: "#8aff8a", padding: "0 3px", fontWeight: 700 }}>{sym}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: "#d0d0d0", padding: "0 3px" }}>{s.price.toFixed(2)}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: up ? "#00d26a" : "#ff4444", padding: "0 3px" }}>{up ? "+" : ""}{s.change.toFixed(2)}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: up ? "#00d26a" : "#ff4444", padding: "0 3px" }}>{up ? "+" : ""}{s.changePct.toFixed(2)}%</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: "#3a5a3a", padding: "0 3px" }}>{(s.volume / 1e6).toFixed(1)}M</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── QUOTE DETAIL ─────────────────────────────────────────────────────────────
function QuoteDetail({ stock, symbol }) {
  if (!stock) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SectionHeader label="QUOTE DETAIL" tag="QD" />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#1a3a1a", fontFamily: MONO, fontSize: 11 }}>← SELECT SECURITY</div>
    </div>
  );
  const up = stock.change >= 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <SectionHeader label={`QUOTE — ${symbol}`} tag="QD" />
      <div style={{ padding: "8px 10px", flex: 1, overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 26, color: "#e8e8e8", fontWeight: 700, letterSpacing: -1 }}>{stock.price.toFixed(2)}</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: up ? "#00d26a" : "#ff4444" }}>{up ? "▲ +" : "▼ "}{stock.change.toFixed(2)} ({up ? "+" : ""}{stock.changePct.toFixed(2)}%)</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {[["BID", stock.bid, "#00d26a"], ["ASK", stock.ask, "#ff4444"]].map(([k, v, c]) => (
              <div key={k} style={{ textAlign: "center" }}><div style={{ fontFamily: MONO, fontSize: 8, color: "#3a5a3a" }}>{k}</div><div style={{ fontFamily: MONO, fontSize: 13, color: c, fontWeight: 600 }}>{v}</div></div>
            ))}
          </div>
        </div>
        <div style={{ width: "100%", overflowX: "hidden" }}>
          <CandleChart candles={stock.candles} width={900} height={300} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 40px", marginTop: 10 }}>
          {[["VOLUME", (stock.volume / 1e6).toFixed(2) + "M"], ["MKT CAP", "$" + stock.mktCap + "T"], ["52W HIGH", stock.high52], ["52W LOW", stock.low52], ["P/E RATIO", stock.pe], ["PREV CLOSE", stock.prevClose]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #091409", padding: "2px 0" }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: "#3a5a3a" }}>{k}</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: "#90b890" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PORTFOLIO (MULTI-ACCOUNT) ────────────────────────────────────────────────
function Portfolio({ stocks, activeAccount, setActiveAccount }) {
  const account = ACCOUNTS_DATA[activeAccount];
  const holdings = account.holdings.map(h => {
    const s = stocks[h.symbol]; if (!s) return null;
    const currentVal = s.price * h.shares, costBasis = h.avgCost * h.shares, pnl = currentVal - costBasis;
    return { ...h, ...s, currentVal, costBasis, pnl, pnlPct: (pnl / costBasis) * 100 };
  }).filter(Boolean);

  const totalVal = holdings.reduce((a, h) => a + h.currentVal, 0);
  const totalCost = holdings.reduce((a, h) => a + h.costBasis, 0);
  const totalPnl = totalVal - totalCost;
  const dayPnl = holdings.reduce((a, h) => a + h.change * h.shares, 0);

  // Aggregate across ALL accounts
  const allHoldings = Object.values(ACCOUNTS_DATA).flatMap(acc => acc.holdings.map(h => {
    const s = stocks[h.symbol]; if (!s) return null;
    return { ...h, currentVal: s.price * h.shares, costBasis: h.avgCost * h.shares };
  }).filter(Boolean));
  const grandTotal = allHoldings.reduce((a, h) => a + h.currentVal, 0);
  const grandCost = allHoldings.reduce((a, h) => a + h.costBasis, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <SectionHeader label="PORTFOLIO TRACKER" tag="PORT" />

      {/* Account selector */}
      <div style={{ display: "flex", gap: 0, background: "#040c04", borderBottom: "1px solid #0f1f0f", flexShrink: 0 }}>
        {Object.values(ACCOUNTS_DATA).map(acc => (
          <button key={acc.id} onClick={() => setActiveAccount(acc.id)} style={{
            fontFamily: MONO, fontSize: 8, padding: "4px 12px", letterSpacing: 0.5,
            background: activeAccount === acc.id ? "#070f07" : "transparent",
            color: activeAccount === acc.id ? acc.color : "#3a5a3a",
            border: "none", borderBottom: `2px solid ${activeAccount === acc.id ? acc.color : "transparent"}`,
            cursor: "pointer",
          }}>{acc.label}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", padding: "0 10px", gap: 16 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: "#2a4a2a" }}>ALL ACCOUNTS TOTAL:</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: grandTotal - grandCost >= 0 ? "#00d26a" : "#ff4444", fontWeight: 700 }}>
            ${(grandTotal / 1000).toFixed(1)}K ({grandTotal - grandCost >= 0 ? "+" : ""}{(((grandTotal - grandCost) / grandCost) * 100).toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* KPI bar */}
      <div style={{ display: "flex", gap: 0, padding: "4px 8px", background: "#050d05", borderBottom: "1px solid #0a180a", flexShrink: 0, flexWrap: "wrap" }}>
        {[
          ["VALUE", `$${(totalVal / 1000).toFixed(1)}K`, "#c8c8c8"],
          ["TOTAL P&L", `${totalPnl >= 0 ? "+" : ""}$${(totalPnl / 1000).toFixed(1)}K (${((totalPnl / totalCost) * 100).toFixed(1)}%)`, totalPnl >= 0 ? "#00d26a" : "#ff4444"],
          ["DAY P&L", `${dayPnl >= 0 ? "+" : ""}$${dayPnl.toFixed(0)}`, dayPnl >= 0 ? "#00d26a" : "#ff4444"],
          ["POSITIONS", holdings.length, account.color],
        ].map(([k, v, c]) => (
          <div key={k} style={{ padding: "0 10px", borderRight: "1px solid #0a180a" }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: "#3a5a3a" }}>{k}</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: c, fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Holdings table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "65px 40px 60px 60px 65px 72px 55px", padding: "2px 8px", borderBottom: "1px solid #0a180a", position: "sticky", top: 0, background: "#060e06" }}>
          {["SYMBOL", "SHS", "PRICE", "AVG", "VALUE", "P&L", "P&L%"].map(h => <div key={h} style={{ fontFamily: MONO, fontSize: 8, color: "#2a4a2a", padding: "1px 2px" }}>{h}</div>)}
        </div>
        {holdings.map(h => { const up = h.pnl >= 0; return (
          <div key={h.symbol} style={{ display: "grid", gridTemplateColumns: "65px 40px 60px 60px 65px 72px 55px", padding: "3px 8px", borderBottom: "1px solid #070d07" }}
            onMouseEnter={e => e.currentTarget.style.background = "#091409"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: account.color, fontWeight: 700 }}>{h.symbol}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: "#5a8a5a" }}>{h.shares}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: "#d0d0d0" }}>{h.price.toFixed(2)}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: "#4a6a4a" }}>{h.avgCost.toFixed(2)}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: "#90b890" }}>${(h.currentVal / 1000).toFixed(1)}K</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: up ? "#00d26a" : "#ff4444" }}>{up ? "+" : ""}${h.pnl.toFixed(0)}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: up ? "#00d26a" : "#ff4444" }}>{up ? "+" : ""}{h.pnlPct.toFixed(1)}%</div>
          </div>
        );})}
      </div>

      {/* Sector breakdown */}
      <div style={{ padding: "5px 8px", borderTop: "1px solid #0a180a", background: "#050d05", flexShrink: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 8, color: "#2a4a2a", marginBottom: 3 }}>SECTOR ALLOCATION — {account.label}</div>
        {Object.entries(holdings.reduce((acc, h) => { acc[h.sector] = (acc[h.sector] || 0) + h.currentVal; return acc; }, {}))
          .sort((a, b) => b[1] - a[1]).map(([sector, val]) => {
            const pct = (val / totalVal) * 100;
            return (
              <div key={sector} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                <div style={{ fontFamily: MONO, fontSize: 7, color: "#3a5a3a", width: 85, flexShrink: 0 }}>{sector}</div>
                <div style={{ flex: 1, height: 5, background: "#091409" }}><div style={{ height: "100%", width: `${pct}%`, background: account.color, opacity: 0.7 }} /></div>
                <div style={{ fontFamily: MONO, fontSize: 7, color: "#4a7a4a", width: 26, textAlign: "right" }}>{pct.toFixed(0)}%</div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── P&L CHARTS ───────────────────────────────────────────────────────────────
function PnLCharts({ stocks, activeAccount }) {
  const [view, setView] = useState("cumulative");
  const [range, setRange] = useState(90);
  const account = ACCOUNTS_DATA[activeAccount];
  const { history, dailyBars, positions, totalCost, totalRealized, totalUnrealized } = generatePnLHistory(account.holdings, stocks);
  const totalPnl = positions.reduce((a, p) => a + p.pnl, 0);
  const totalPnlPct = (totalPnl / totalCost) * 100;
  const W = 660, H = 220, pL = 56, pR = 16, pT = 18, pB = 28;
  const cW = W - pL - pR, cH = H - pT - pB;

  const CumulativeChart = () => {
    const slice = history.slice(-range);
    const allV = slice.flatMap(d => [d.pnl, d.spyPnl]);
    const minV = Math.min(...allV), maxV = Math.max(...allV), rng = maxV - minV || 1;
    const toY = v => pT + cH - ((v - minV) / rng) * cH;
    const toX = i => pL + (i / (slice.length - 1)) * cW;
    const portPts = slice.map((d, i) => `${toX(i)},${toY(d.pnl)}`).join(" ");
    const spyPts = slice.map((d, i) => `${toX(i)},${toY(d.spyPnl)}`).join(" ");
    const zeroY = toY(0);
    const yLines = Array.from({ length: 5 }, (_, i) => { const v = minV + (rng / 4) * i; return { v, y: toY(v) }; });
    return (
      <svg width={W} height={H} style={{ fontFamily: MONO }}>
        {yLines.map(({ v, y }, i) => (<g key={i}><line x1={pL} x2={W - pR} y1={y} y2={y} stroke="#0d1d0d" strokeWidth="1" strokeDasharray="4,4" /><text x={pL - 4} y={y + 4} textAnchor="end" fill="#2a4a2a" fontSize="8">{v >= 0 ? "+" : ""}{(v / 1000).toFixed(0)}K</text></g>))}
        <line x1={pL} x2={W - pR} y1={zeroY} y2={zeroY} stroke="#2a4a2a" strokeWidth="1" />
        <polygon points={`${pL},${zeroY} ${portPts} ${toX(slice.length - 1)},${zeroY}`} fill={account.color} fillOpacity="0.05" />
        <polyline points={spyPts} fill="none" stroke="#f5a623" strokeWidth="1" strokeDasharray="4,3" strokeOpacity="0.55" />
        <polyline points={portPts} fill="none" stroke={account.color} strokeWidth="1.5" strokeLinejoin="round" />
        {slice.filter((_, i) => i % Math.floor(slice.length / 6) === 0).map((d, idx) => { const i = idx * Math.floor(slice.length / 6); return <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fill="#1a3a1a" fontSize="7">{d.date}</text>; })}
        <line x1={W - 120} x2={W - 106} y1={pT + 7} y2={pT + 7} stroke={account.color} strokeWidth="1.5" />
        <text x={W - 100} y={pT + 11} fill="#3a7a3a" fontSize="7">{account.label}</text>
        <line x1={W - 120} x2={W - 106} y1={pT + 19} y2={pT + 19} stroke="#f5a623" strokeWidth="1" strokeDasharray="4,3" />
        <text x={W - 100} y={pT + 23} fill="#7a5a2a" fontSize="7">SPY BENCH</text>
      </svg>
    );
  };

  const DailyChart = () => {
    const slice = dailyBars.slice(-range);
    const maxAbs = Math.max(...slice.map(d => Math.abs(d.dayPnl)), 1);
    const zeroY = pT + cH / 2;
    const toY = v => pT + cH / 2 - (v / maxAbs) * (cH / 2);
    const barW = Math.max(2, (cW / slice.length) - 1);
    const toX = i => pL + (i / slice.length) * cW;
    return (
      <svg width={W} height={H} style={{ fontFamily: MONO }}>
        {[-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs].map((v, i) => { const y = toY(v); return <g key={i}><line x1={pL} x2={W - pR} y1={y} y2={y} stroke={v === 0 ? "#2a4a2a" : "#0d1d0d"} strokeWidth="1" strokeDasharray={v === 0 ? "none" : "3,3"} /><text x={pL - 4} y={y + 4} textAnchor="end" fill="#2a4a2a" fontSize="8">{v >= 0 ? "+" : ""}{(v / 1000).toFixed(0)}K</text></g>; })}
        {slice.map((d, i) => { const up = d.dayPnl >= 0; const x = toX(i); const barY = up ? toY(d.dayPnl) : zeroY; const h = Math.abs(toY(d.dayPnl) - zeroY); return <rect key={i} x={x} y={barY} width={barW} height={Math.max(1, h)} fill={up ? "#00d26a" : "#ff4444"} fillOpacity="0.82" />; })}
        {slice.filter((_, i) => i % Math.floor(slice.length / 6) === 0).map((d, idx) => { const i = idx * Math.floor(slice.length / 6); return <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" fill="#1a3a1a" fontSize="7">{d.date}</text>; })}
      </svg>
    );
  };

  const PositionChart = () => {
    const sorted = [...positions].sort((a, b) => b.pnl - a.pnl);
    const maxAbs = Math.max(...sorted.map(p => Math.abs(p.pnl)), 1);
    const barH = Math.max(14, Math.floor((cH - sorted.length * 4) / sorted.length));
    const zeroX = pL + cW / 2;
    const svgH = sorted.length * (barH + 5) + pT + pB;
    return (
      <svg width={W} height={svgH} style={{ fontFamily: MONO }}>
        <line x1={zeroX} x2={zeroX} y1={pT} y2={svgH - pB} stroke="#2a4a2a" strokeWidth="1" />
        {sorted.map((p, i) => { const up = p.pnl >= 0; const w = (Math.abs(p.pnl) / maxAbs) * (cW / 2 - 4); const y = pT + i * (barH + 5); const x = up ? zeroX : zeroX - w; return (
          <g key={p.symbol}>
            <rect x={x} y={y} width={Math.max(2, w)} height={barH} fill={up ? "#00d26a" : "#ff4444"} fillOpacity="0.78" />
            <text x={zeroX - 6} y={y + barH / 2 + 4} textAnchor="end" fill="#4a8a4a" fontSize="9" fontWeight="600">{p.symbol}</text>
            <text x={up ? zeroX + w + 4 : zeroX - w - 4} y={y + barH / 2 + 4} textAnchor={up ? "start" : "end"} fill={up ? "#00d26a" : "#ff4444"} fontSize="8">{up ? "+" : ""}${p.pnl.toFixed(0)} ({up ? "+" : ""}{p.pnlPct.toFixed(1)}%)</text>
          </g>
        );
        })}
      </svg>
    );
  };

  const RealizedChart = () => {
    const tG = Math.abs(totalRealized) + Math.abs(totalUnrealized) || 1;
    const rPct = (Math.abs(totalRealized) / tG) * 100;
    const maxAbs = Math.max(...positions.map(p => Math.abs(p.pnl)), 1);
    const barW = Math.floor((cW - positions.length * 4) / positions.length);
    const toH = v => Math.abs(v / maxAbs) * (cH * 0.48);
    const zeroY = pT + cH * 0.82;
    return (
      <svg width={W} height={H} style={{ fontFamily: MONO }}>
        {[["REALIZED", totalRealized, pL], ["UNREALIZED", totalUnrealized, pL + 130], ["TOTAL P&L", totalPnl, pL + 268]].map(([k, v, x]) => (
          <g key={k}><text x={x} y={pT + 10} fill="#2a4a2a" fontSize="8">{k}</text><text x={x} y={pT + 24} fill={v >= 0 ? "#00d26a" : "#ff4444"} fontSize="13" fontWeight="700">{v >= 0 ? "+" : ""}${(v / 1000).toFixed(1)}K</text></g>
        ))}
        <text x={pL} y={pT + 40} fill="#1a3a1a" fontSize="8">REALIZED / UNREALIZED RATIO</text>
        <rect x={pL} y={pT + 44} width={cW * (rPct / 100)} height={8} fill={totalRealized >= 0 ? "#00a855" : "#cc2222"} />
        <rect x={pL + cW * (rPct / 100)} y={pT + 44} width={cW * ((100 - rPct) / 100)} height={8} fill={totalUnrealized >= 0 ? "#005533" : "#881111"} />
        <text x={pL + cW * (rPct / 100) / 2} y={pT + 61} textAnchor="middle" fill="#2a5a2a" fontSize="7">{rPct.toFixed(0)}% REALIZED</text>
        <text x={pL + cW * (rPct / 100) + cW * ((100 - rPct) / 100) / 2} y={pT + 61} textAnchor="middle" fill="#1a3a1a" fontSize="7">{(100 - rPct).toFixed(0)}% UNREALIZED</text>
        <line x1={pL} x2={W - pR} y1={zeroY} y2={zeroY} stroke="#1a2a1a" strokeWidth="1" />
        {positions.map((p, i) => { const x = pL + i * (barW + 4); const up = p.pnl >= 0; const uH = toH(p.unrealized); const rH = toH(p.realized); return (
          <g key={p.symbol}>
            <rect x={x} y={up ? zeroY - uH - rH : zeroY} width={barW} height={uH} fill={up ? "#005533" : "#881111"} />
            <rect x={x} y={up ? zeroY - rH : zeroY + uH} width={barW} height={rH} fill={up ? "#00a855" : "#cc2222"} />
            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fill="#2a4a2a" fontSize="7">{p.symbol}</text>
          </g>
        );})}
        <rect x={W - 116} y={pT + 8} width={7} height={7} fill="#00a855" /><text x={W - 106} y={pT + 15} fill="#2a6a2a" fontSize="7">REALIZED</text>
        <rect x={W - 116} y={pT + 20} width={7} height={7} fill="#005533" /><text x={W - 106} y={pT + 27} fill="#1a4a1a" fontSize="7">UNREALIZED</text>
      </svg>
    );
  };

  const views = [{ id: "cumulative", label: "CUMULATIVE" }, { id: "daily", label: "DAILY BARS" }, { id: "position", label: "BY POSITION" }, { id: "realized", label: "REAL vs UNREAL" }];
  const desc = { cumulative: "Running P&L vs cost basis. Orange = SPY benchmark. Measures alpha vs the index.", daily: "Day-over-day bars. Green = profitable session. Red = loss day. Identify patterns in performance rhythm.", position: "Per-holding contribution sorted best to worst. Spot your winners, your drags, and concentration risk.", realized: "Realized (locked-in) vs Unrealized (on-paper) per position. Key for tax planning and risk management." };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <SectionHeader label={`P&L ANALYTICS — ${account.label}`} tag="PNL" />
      <div style={{ display: "flex", gap: 0, padding: "4px 8px", background: "#050d05", borderBottom: "1px solid #0a180a", flexShrink: 0, flexWrap: "wrap" }}>
        {[["TOTAL P&L", `${totalPnl >= 0 ? "+" : ""}$${(totalPnl / 1000).toFixed(1)}K`, totalPnl >= 0 ? "#00d26a" : "#ff4444"], ["RETURN", `${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%`, totalPnlPct >= 0 ? "#00d26a" : "#ff4444"], ["REALIZED", `${totalRealized >= 0 ? "+" : ""}$${(totalRealized / 1000).toFixed(1)}K`, totalRealized >= 0 ? "#00a855" : "#cc2222"], ["UNREALIZED", `${totalUnrealized >= 0 ? "+" : ""}$${(totalUnrealized / 1000).toFixed(1)}K`, totalUnrealized >= 0 ? "#006633" : "#881111"], ["BEST", positions[0]?.symbol || "—", "#8aff8a"], ["WORST", positions[positions.length - 1]?.symbol || "—", "#ff8888"]].map(([k, v, c]) => (
          <div key={k} style={{ padding: "0 9px", borderRight: "1px solid #0a180a" }}><div style={{ fontFamily: MONO, fontSize: 8, color: "#2a4a2a" }}>{k}</div><div style={{ fontFamily: MONO, fontSize: 11, color: c, fontWeight: 700 }}>{v}</div></div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", background: "#040c04", borderBottom: "1px solid #0a180a", flexShrink: 0 }}>
        {views.map(v => <button key={v.id} onClick={() => setView(v.id)} style={{ fontFamily: MONO, fontSize: 8, padding: "2px 9px", background: view === v.id ? "#091409" : "transparent", color: view === v.id ? "#8aff8a" : "#2a4a2a", border: "1px solid " + (view === v.id ? "#1a4a1a" : "#0a1a0a"), cursor: "pointer" }}>{v.label}</button>)}
        {(view === "cumulative" || view === "daily") && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
            {[30, 60, 90].map(r => <button key={r} onClick={() => setRange(r)} style={{ fontFamily: MONO, fontSize: 8, padding: "2px 7px", background: range === r ? "#001800" : "transparent", color: range === r ? "#00d26a" : "#1a3a1a", border: "1px solid " + (range === r ? "#1a3a1a" : "#0a1a0a"), cursor: "pointer" }}>{r}D</button>)}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "6px 8px 4px" }}>
        <div style={{ overflowX: "auto" }}>
          {view === "cumulative" && <CumulativeChart />}
          {view === "daily" && <DailyChart />}
          {view === "position" && <PositionChart />}
          {view === "realized" && <RealizedChart />}
        </div>
        <div style={{ marginTop: 5, padding: "3px 8px", background: "#040c04", border: "1px solid #091409", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontFamily: MONO, fontSize: 7, color: "#1a3a1a" }}>▸ {desc[view]}</span>
          <span style={{ fontFamily: MONO, fontSize: 7, color: "#0f2a0f", whiteSpace: "nowrap", marginLeft: 12 }}>YAHOO FINANCE — SIM MODE</span>
        </div>
      </div>
    </div>
  );
}

// ─── OPTIONS CHAIN ─────────────────────────────────────────────────────────────
function OptionsChain({ stocks }) {
  const [selected, setSelected] = useState("AAPL");
  const [expiry, setExpiry] = useState("04-18");
  const stock = stocks[selected];
  const options = stock ? generateOptions(Math.round(stock.price / 5) * 5) : [];
  const expiries = ["03-21", "04-18", "05-16", "06-20", "09-19"];
  const syms = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "AMZN", "AMD", "META"];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <SectionHeader label="OPTIONS CHAIN" tag="OPT" />
      <div style={{ display: "flex", gap: 6, padding: "4px 8px", background: "#050d05", borderBottom: "1px solid #0a180a", alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 2 }}>{syms.map(s => <button key={s} onClick={() => setSelected(s)} style={{ fontFamily: MONO, fontSize: 8, padding: "2px 5px", background: selected === s ? "#00a855" : "#070d07", color: selected === s ? "#000" : "#4a7a4a", border: "1px solid " + (selected === s ? "#00d26a" : "#0f1f0f"), cursor: "pointer" }}>{s}</button>)}</div>
        <div style={{ display: "flex", gap: 2 }}>{expiries.map(e => <button key={e} onClick={() => setExpiry(e)} style={{ fontFamily: MONO, fontSize: 8, padding: "2px 5px", background: expiry === e ? "#0a1f00" : "#070d07", color: expiry === e ? "#8aff8a" : "#2a4a2a", border: "1px solid " + (expiry === e ? "#1a3a00" : "#0a180a"), cursor: "pointer" }}>25-{e}</button>)}</div>
        {stock && <span style={{ fontFamily: MONO, fontSize: 9, color: "#3a6a3a", marginLeft: "auto" }}>SPOT <span style={{ color: "#e8e8e8", fontWeight: 700 }}>{stock.price.toFixed(2)}</span></span>}
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "44px 36px 36px 36px 36px 36px 50px 36px 36px 36px 36px 36px 44px", background: "#060e06", borderBottom: "1px solid #182818", padding: "2px 6px", position: "sticky", top: 0, gap: 1 }}>
          {["OI", "VOL", "BID", "ASK", "Δ", "IV", "STRIKE", "IV", "Δ", "BID", "ASK", "VOL", "OI"].map((h, i) => <div key={i} style={{ fontFamily: MONO, fontSize: 7, color: i === 6 ? "#8aff8a" : i < 6 ? "#00a855" : "#cc3333", textAlign: "center", padding: "1px 1px" }}>{h}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 50px 1fr", padding: "1px 6px", background: "#040c04" }}>
          <div style={{ fontFamily: MONO, fontSize: 7, color: "#007733", textAlign: "center" }}>◄ CALLS</div><div />
          <div style={{ fontFamily: MONO, fontSize: 7, color: "#aa2222", textAlign: "center" }}>PUTS ►</div>
        </div>
        {options.map((opt, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 36px 36px 36px 36px 36px 50px 36px 36px 36px 36px 36px 44px", padding: "2px 6px", gap: 1, background: opt.atm ? "#080f00" : "transparent", borderBottom: "1px solid #060d06", borderLeft: opt.atm ? "2px solid #00d26a" : "2px solid transparent" }}
            onMouseEnter={e => e.currentTarget.style.background = "#091609"}
            onMouseLeave={e => e.currentTarget.style.background = opt.atm ? "#080f00" : "transparent"}>
            {[[opt.callOI.toLocaleString(), "#2a5a2a"], [(opt.callVol / 1000).toFixed(1) + "K", "#2a5a2a"], [opt.callBid, "#00a855"], [opt.callAsk, "#005522"], [opt.callDelta, "#1a6a1a"], [(+opt.callIV * 100).toFixed(0) + "%", "#1a4a1a"]].map(([v, c], j) => <div key={j} style={{ fontFamily: MONO, fontSize: 8, color: c, textAlign: "right", padding: "0 1px" }}>{v}</div>)}
            <div style={{ fontFamily: MONO, fontSize: 9, color: opt.atm ? "#00ff88" : "#7adf7a", textAlign: "center", fontWeight: opt.atm ? 700 : 400, background: opt.atm ? "#091f09" : "#050d05", padding: "0 1px" }}>{opt.strike}</div>
            {[[(+opt.putIV * 100).toFixed(0) + "%", "#4a1a1a"], [opt.putDelta, "#6a1a1a"], [opt.putBid, "#882222"], [opt.putAsk, "#aa2222"], [(opt.putVol / 1000).toFixed(1) + "K", "#5a1a1a"], [opt.putOI.toLocaleString(), "#3a1a1a"]].map(([v, c], j) => <div key={j} style={{ fontFamily: MONO, fontSize: 8, color: c, textAlign: "right", padding: "0 1px" }}>{v}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PRICE ALERTS ─────────────────────────────────────────────────────────────
function PriceAlerts({ stocks, alerts, setAlerts, triggered }) {
  const [sym, setSym] = useState("");
  const [price, setPrice] = useState("");
  const [dir, setDir] = useState("above");
  const allSyms = Object.keys(BASE_PRICES);

  const addAlert = () => {
    const s = sym.trim().toUpperCase();
    const p = parseFloat(price);
    if (!s || isNaN(p) || !BASE_PRICES[s]) return;
    const newAlert = { id: Date.now(), symbol: s, price: p, direction: dir, active: true, created: new Date().toLocaleTimeString() };
    setAlerts(prev => [...prev, newAlert]);
    setSym(""); setPrice("");
  };

  const removeAlert = (id) => setAlerts(prev => prev.filter(a => a.id !== id));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <SectionHeader label="PRICE ALERTS" tag="ALT" />

      {/* Add alert form */}
      <div style={{ padding: "6px 8px", background: "#050d05", borderBottom: "1px solid #0a180a", flexShrink: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 8, color: "#2a4a2a", marginBottom: 5 }}>NEW ALERT</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <input value={sym} onChange={e => setSym(e.target.value.toUpperCase())} placeholder="SYMBOL" style={{ fontFamily: MONO, fontSize: 10, background: "#070f07", border: "1px solid #1a2a1a", color: "#8aff8a", padding: "3px 6px", width: 80, outline: "none" }} />
          <select value={dir} onChange={e => setDir(e.target.value)} style={{ fontFamily: MONO, fontSize: 9, background: "#070f07", border: "1px solid #1a2a1a", color: "#c0c0c0", padding: "3px 5px", outline: "none" }}>
            <option value="above">ABOVE ▲</option>
            <option value="below">BELOW ▼</option>
          </select>
          <input value={price} onChange={e => setPrice(e.target.value)} placeholder="PRICE" type="number" step="0.01" style={{ fontFamily: MONO, fontSize: 10, background: "#070f07", border: "1px solid #1a2a1a", color: "#f5a623", padding: "3px 6px", width: 80, outline: "none" }} />
          <button onClick={addAlert} style={{ fontFamily: MONO, fontSize: 9, padding: "3px 12px", background: "#001a00", border: "1px solid #00a855", color: "#00d26a", cursor: "pointer", letterSpacing: 1 }}>SET ALERT</button>
          <span style={{ fontFamily: MONO, fontSize: 8, color: "#1a3a1a", marginLeft: "auto" }}>SUPPORTS: {allSyms.join(" · ")}</span>
        </div>
      </div>

      {/* Triggered alerts */}
      {triggered.length > 0 && (
        <div style={{ padding: "4px 8px", background: "#1a0a00", borderBottom: "1px solid #3a1a00", flexShrink: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: "#ff8800", marginBottom: 3 }}>⚡ TRIGGERED ALERTS</div>
          {triggered.map((a, i) => (
            <div key={i} style={{ fontFamily: MONO, fontSize: 9, color: "#ff8800", padding: "1px 0" }}>
              {a.symbol} {a.direction === "above" ? "▲" : "▼"} {a.price} — FIRED AT {a.firedAt}
            </div>
          ))}
        </div>
      )}

      {/* Active alerts list */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {alerts.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#1a3a1a", fontFamily: MONO, fontSize: 10 }}>NO ACTIVE ALERTS</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "70px 60px 80px 70px 70px 60px 40px", padding: "2px 8px", borderBottom: "1px solid #0a180a", background: "#060e06", position: "sticky", top: 0 }}>
              {["SYMBOL", "DIRECTION", "ALERT PRICE", "CURRENT", "DIST", "SET AT", ""].map(h => <div key={h} style={{ fontFamily: MONO, fontSize: 8, color: "#2a4a2a", padding: "1px 2px" }}>{h}</div>)}
            </div>
            {alerts.map(a => {
              const s = stocks[a.symbol];
              const curr = s ? s.price : null;
              const dist = curr ? ((curr - a.price) / a.price * 100) : null;
              const proximity = Math.abs(dist) < 1;
              return (
                <div key={a.id} style={{ display: "grid", gridTemplateColumns: "70px 60px 80px 70px 70px 60px 40px", padding: "4px 8px", borderBottom: "1px solid #070d07", background: proximity ? "#1a1000" : "transparent" }}
                  onMouseEnter={e => e.currentTarget.style.background = proximity ? "#1a1200" : "#091409"}
                  onMouseLeave={e => e.currentTarget.style.background = proximity ? "#1a1000" : "transparent"}>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "#8aff8a", fontWeight: 700 }}>{a.symbol}</div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: a.direction === "above" ? "#00d26a" : "#ff4444" }}>{a.direction === "above" ? "▲ ABOVE" : "▼ BELOW"}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "#f5a623", fontWeight: 600 }}>{a.price.toFixed(2)}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "#c0c0c0" }}>{curr ? curr.toFixed(2) : "—"}</div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: proximity ? "#ff8800" : (dist !== null ? (dist >= 0 ? "#4a8a4a" : "#8a4a4a") : "#3a5a3a") }}>
                    {dist !== null ? `${dist >= 0 ? "+" : ""}${dist.toFixed(2)}%` : "—"}
                    {proximity && " ⚡"}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: "#2a4a2a" }}>{a.created}</div>
                  <button onClick={() => removeAlert(a.id)} style={{ fontFamily: MONO, fontSize: 9, background: "transparent", border: "1px solid #3a1a1a", color: "#cc3333", cursor: "pointer", padding: "0 4px" }}>✕</button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ─── WATCHLIST ────────────────────────────────────────────────────────────────
function Watchlist({ stocks, watchlists, setWatchlists, onSelectStock }) {
  const [activeList, setActiveList] = useState(Object.keys(watchlists)[0] || "default");
  const [newSym, setNewSym] = useState("");
  const [newListName, setNewListName] = useState("");
  const [editingName, setEditingName] = useState(null);

  const currentList = watchlists[activeList] || [];

  const addSymbol = () => {
    const s = newSym.trim().toUpperCase();
    if (!s || !BASE_PRICES[s] || currentList.includes(s)) return;
    setWatchlists(prev => ({ ...prev, [activeList]: [...(prev[activeList] || []), s] }));
    setNewSym("");
  };

  const removeSymbol = (sym) => setWatchlists(prev => ({ ...prev, [activeList]: prev[activeList].filter(s => s !== sym) }));

  const createList = () => {
    const name = newListName.trim().toUpperCase().replace(/\s+/g, "_") || `LIST_${Date.now()}`;
    setWatchlists(prev => ({ ...prev, [name]: [] }));
    setActiveList(name);
    setNewListName("");
  };

  const deleteList = (name) => {
    if (Object.keys(watchlists).length <= 1) return;
    setWatchlists(prev => { const next = { ...prev }; delete next[name]; return next; });
    if (activeList === name) setActiveList(Object.keys(watchlists).filter(k => k !== name)[0]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <SectionHeader label="WATCHLISTS" tag="WL" />

      {/* List tabs */}
      <div style={{ display: "flex", gap: 0, background: "#040c04", borderBottom: "1px solid #0a180a", flexShrink: 0, flexWrap: "wrap" }}>
        {Object.keys(watchlists).map(name => (
          <div key={name} style={{ display: "flex", alignItems: "center" }}>
            <button onClick={() => setActiveList(name)} style={{ fontFamily: MONO, fontSize: 8, padding: "4px 10px", background: activeList === name ? "#070f07" : "transparent", color: activeList === name ? "#8aff8a" : "#2a5a2a", border: "none", borderBottom: `2px solid ${activeList === name ? "#00d26a" : "transparent"}`, cursor: "pointer" }}>{name}</button>
            {Object.keys(watchlists).length > 1 && <button onClick={() => deleteList(name)} style={{ fontFamily: MONO, fontSize: 8, background: "transparent", border: "none", color: "#3a1a1a", cursor: "pointer", padding: "0 4px" }}>✕</button>}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "0 6px", marginLeft: "auto" }}>
          <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="NEW LIST..." style={{ fontFamily: MONO, fontSize: 8, background: "#060e06", border: "1px solid #0f1f0f", color: "#6a9a6a", padding: "2px 5px", width: 80, outline: "none" }} />
          <button onClick={createList} style={{ fontFamily: MONO, fontSize: 8, background: "#001800", border: "1px solid #1a3a1a", color: "#4a8a4a", cursor: "pointer", padding: "2px 6px" }}>+ LIST</button>
        </div>
      </div>

      {/* Add symbol */}
      <div style={{ display: "flex", gap: 6, padding: "4px 8px", background: "#050d05", borderBottom: "1px solid #0a180a", flexShrink: 0, alignItems: "center" }}>
        <input value={newSym} onChange={e => setNewSym(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && addSymbol()} placeholder="ADD SYMBOL..." style={{ fontFamily: MONO, fontSize: 10, background: "#070f07", border: "1px solid #1a2a1a", color: "#8aff8a", padding: "3px 6px", width: 100, outline: "none" }} />
        <button onClick={addSymbol} style={{ fontFamily: MONO, fontSize: 9, background: "#001a00", border: "1px solid #1a4a1a", color: "#4a9a4a", cursor: "pointer", padding: "3px 10px" }}>ADD</button>
        <span style={{ fontFamily: MONO, fontSize: 8, color: "#1a3a1a" }}>{currentList.length} SYMBOLS</span>
      </div>

      {/* Watchlist table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {currentList.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#1a3a1a", fontFamily: MONO, fontSize: 10 }}>ADD SYMBOLS TO WATCH</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "65px 70px 70px 65px 65px 60px 32px", padding: "2px 8px", borderBottom: "1px solid #0a180a", background: "#060e06", position: "sticky", top: 0 }}>
              {["SYMBOL", "PRICE", "CHANGE", "CHG%", "BID", "VOLUME", ""].map(h => <div key={h} style={{ fontFamily: MONO, fontSize: 8, color: "#2a4a2a", padding: "1px 2px" }}>{h}</div>)}
            </div>
            {currentList.map(sym => {
              const s = stocks[sym]; if (!s) return null; const up = s.change >= 0;
              return (
                <div key={sym} onClick={() => onSelectStock(sym)} style={{ display: "grid", gridTemplateColumns: "65px 70px 70px 65px 65px 60px 32px", padding: "4px 8px", borderBottom: "1px solid #070d07", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#091409"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "#8aff8a", fontWeight: 700 }}>{sym}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "#e0e0e0", fontWeight: 600 }}>{s.price.toFixed(2)}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: up ? "#00d26a" : "#ff4444" }}>{up ? "+" : ""}{s.change.toFixed(2)}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: up ? "#00d26a" : "#ff4444" }}>{up ? "+" : ""}{s.changePct.toFixed(2)}%</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "#00a855" }}>{s.bid}</div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: "#3a5a3a" }}>{(s.volume / 1e6).toFixed(1)}M</div>
                  <button onClick={e => { e.stopPropagation(); removeSymbol(sym); }} style={{ fontFamily: MONO, fontSize: 8, background: "transparent", border: "1px solid #2a1a1a", color: "#883333", cursor: "pointer", padding: "0" }}>✕</button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ─── KEYBOARD HELP OVERLAY ────────────────────────────────────────────────────
function KeyboardHelp({ onClose }) {
  const shortcuts = [
    ["TAB 1–6", "Switch between tabs"],
    ["↑ / ↓", "Navigate stock list"],
    ["ENTER", "Select highlighted stock"],
    ["ESC", "Close overlay / clear selection"],
    ["A", "Go to Alerts tab"],
    ["W", "Go to Watchlist tab"],
    ["P", "Go to Portfolio tab"],
    ["O", "Go to Options tab"],
    ["L", "Go to P&L Charts"],
    ["M", "Go to Market Overview"],
    ["/ or `", "Focus command bar"],
    ["F1", "Toggle this help overlay"],
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#060e06", border: "1px solid #1a3a1a", padding: "16px 20px", minWidth: 340 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "#8aff8a", letterSpacing: 2 }}>KEYBOARD SHORTCUTS</span>
          <button onClick={onClose} style={{ fontFamily: MONO, fontSize: 10, background: "transparent", border: "1px solid #2a3a2a", color: "#4a7a4a", cursor: "pointer", padding: "2px 8px" }}>CLOSE</button>
        </div>
        {shortcuts.map(([key, desc]) => (
          <div key={key} style={{ display: "flex", gap: 16, padding: "3px 0", borderBottom: "1px solid #091409" }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: "#00d26a", width: 80, flexShrink: 0 }}>{key}</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: "#3a6a3a" }}>{desc}</span>
          </div>
        ))}
        <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 8, color: "#1a3a1a" }}>COMMAND BAR: AAPL GO · PNL · PORT · OPT · WL · ALT · HELP</div>
      </div>
    </div>
  );
}

// ─── COMMAND BAR ──────────────────────────────────────────────────────────────
function CommandBar({ onCommand, inputRef }) {
  const [val, setVal] = useState("");
  const [history, setHistory] = useState(["AXION TERMINAL v3.0 ONLINE", "F1:HELP · AAPL GO · PNL · PORT · OPT · WL · ALT"]);
  const handle = (e) => {
    if (e.key === "Escape") { setVal(""); inputRef.current?.blur(); return; }
    if (e.key === "Enter" && val.trim()) {
      const cmd = val.trim().toUpperCase();
      setHistory(h => [...h.slice(-5), `> ${cmd}`]);
      onCommand(cmd);
      setVal("");
    }
  };
  return (
    <div style={{ background: "#040c04", borderTop: "1px solid #1a2a1a", padding: "3px 8px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      <div style={{ fontFamily: MONO, fontSize: 8, color: "#2a4a2a", overflow: "hidden", flex: 1, display: "flex", gap: 10 }}>
        {history.slice(-2).map((h, i) => <span key={i} style={{ color: i === 1 ? "#3a7a3a" : "#1a3a1a", overflow: "hidden", whiteSpace: "nowrap" }}>{h}</span>)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: "#00d26a" }}>AXION ▶</span>
        <input ref={inputRef} value={val} onChange={e => setVal(e.target.value)} onKeyDown={handle}
          style={{ background: "transparent", border: "none", outline: "none", fontFamily: MONO, fontSize: 10, color: "#8aff8a", width: 220, caretColor: "#00d26a" }}
          placeholder="ENTER COMMAND..." spellCheck={false} />
      </div>
    </div>
  );
}

// ─── STATUS BAR ───────────────────────────────────────────────────────────────
function StatusBar({ alerts }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  const isOpen = () => { const h = time.getUTCHours() - 5; const m = time.getUTCMinutes(); const mins = h * 60 + m; return mins >= 570 && mins < 960; };
  return (
    <div style={{ display: "flex", alignItems: "center", background: "#030803", borderBottom: "1px solid #182818", padding: "2px 8px", flexShrink: 0 }}>
      <span style={{ fontFamily: MONO, fontSize: 9, color: "#000", background: "#00d26a", padding: "1px 8px", marginRight: 8, fontWeight: 700, letterSpacing: 2 }}>AXION</span>
      <span style={{ fontFamily: MONO, fontSize: 8, color: "#2a4a2a", marginRight: 10 }}>v3.0</span>
      <span style={{ fontFamily: MONO, fontSize: 8, marginRight: 10, color: isOpen() ? "#00d26a" : "#ff8800" }}>● {isOpen() ? "MKT OPEN" : "MKT CLOSED"}</span>
      <span style={{ fontFamily: MONO, fontSize: 8, color: "#1a3a1a", marginRight: 10 }}>NYSE · NASDAQ · CBOE</span>
      {alerts > 0 && <span style={{ fontFamily: MONO, fontSize: 8, color: "#ff8800", marginRight: 10 }}>⚡ {alerts} ALERT{alerts > 1 ? "S" : ""} ACTIVE</span>}
      <span style={{ fontFamily: MONO, fontSize: 8, color: "#0f2a0f", marginLeft: "auto" }}>{time.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      <span style={{ fontFamily: MONO, fontSize: 7, color: "#0a1a0a", marginLeft: 10 }}>YAHOO FIN — SIM</span>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const ws = loadWorkspace();

  const [stocks, setStocks] = useState(() => Object.fromEntries(Object.keys(BASE_PRICES).map(sym => [sym, makeStock(sym)])));
  const [activeTab, setActiveTab] = useState(ws.activeTab || "overview");
  const [selectedSym, setSelectedSym] = useState(ws.selectedSym || "AAPL");
  const [activeAccount, setActiveAccount] = useState(ws.activeAccount || "main");
  const [alerts, setAlerts] = useState(ws.alerts || []);
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const [watchlists, setWatchlists] = useState(ws.watchlists || { TECH: ["AAPL", "MSFT", "NVDA", "GOOGL"], ETFs: ["SPY", "QQQ"], WATCHLIST_1: [] });
  const [showHelp, setShowHelp] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(0);
  const cmdRef = useRef(null);

  // Persist workspace on state changes
  useEffect(() => {
    saveWorkspace({ activeTab, selectedSym, activeAccount, alerts, watchlists });
  }, [activeTab, selectedSym, activeAccount, alerts, watchlists]);

  // Live price simulation
  useEffect(() => {
    const tick = setInterval(() => {
      setStocks(prev => {
        const next = { ...prev };
        const syms = Object.keys(next);
        // Update 2-3 symbols per tick for realistic feel
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          const sym = syms[Math.floor(Math.random() * syms.length)];
          const s = next[sym];
          const drift = (Math.random() - 0.489) * s.price * 0.001;
          const newPrice = Math.max(1, +(s.price + drift).toFixed(2));
          next[sym] = { ...s, price: newPrice, change: +(newPrice - s.prevClose).toFixed(2), changePct: +((newPrice - s.prevClose) / s.prevClose * 100).toFixed(2), bid: +(newPrice - 0.02).toFixed(2), ask: +(newPrice + 0.02).toFixed(2) };
        }
        return next;
      });
    }, 700);
    return () => clearInterval(tick);
  }, []);

  // Alert checker
  useEffect(() => {
    setAlerts(prev => prev.map(alert => {
      const s = stocks[alert.symbol];
      if (!s || !alert.active) return alert;
      const fired = alert.direction === "above" ? s.price >= alert.price : s.price <= alert.price;
      if (fired) {
        const firedAlert = { ...alert, active: false, firedAt: new Date().toLocaleTimeString() };
        setTriggeredAlerts(t => [...t.slice(-9), firedAlert]);
        return firedAlert;
      }
      return alert;
    }));
  }, [stocks]);

  // Keyboard navigation
  useEffect(() => {
    const handle = (e) => {
      if (e.target === cmdRef.current) return;
      const tabMap = { "1": "overview", "2": "portfolio", "3": "pnl", "4": "options", "5": "alerts", "6": "watchlist" };
      if (e.key in tabMap) { setActiveTab(tabMap[e.key]); return; }
      if (e.key === "F1") { e.preventDefault(); setShowHelp(h => !h); return; }
      if (e.key === "m" || e.key === "M") { setActiveTab("overview"); return; }
      if (e.key === "p" || e.key === "P") { setActiveTab("portfolio"); return; }
      if (e.key === "l" || e.key === "L") { setActiveTab("pnl"); return; }
      if (e.key === "o" || e.key === "O") { setActiveTab("options"); return; }
      if (e.key === "a" || e.key === "A") { setActiveTab("alerts"); return; }
      if (e.key === "w" || e.key === "W") { setActiveTab("watchlist"); return; }
      if (e.key === "/" || e.key === "`") { e.preventDefault(); cmdRef.current?.focus(); return; }
      if (e.key === "Escape") { setShowHelp(false); return; }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  const handleCommand = useCallback((cmd) => {
    const sym = cmd.replace(/\s+GO$/, "").trim();
    if (stocks[sym]) { setSelectedSym(sym); setActiveTab("overview"); return; }
    const cmds = { "PNL": "pnl", "P&L": "pnl", "PORT": "portfolio", "OPT": "options", "OPTIONS": "options", "WL": "watchlist", "WATCHLIST": "watchlist", "ALT": "alerts", "ALERTS": "alerts", "MKT": "overview", "MARKET": "overview" };
    if (cmd in cmds) { setActiveTab(cmds[cmd]); return; }
    if (cmd === "HELP") { setShowHelp(true); return; }
    if (cmd === "CLEAR") { setTriggeredAlerts([]); return; }
  }, [stocks]);

  const tabs = [
    { id: "overview", label: "MKT OVERVIEW", key: "1" },
    { id: "portfolio", label: "PORTFOLIO", key: "2" },
    { id: "pnl", label: "P&L CHARTS", key: "3" },
    { id: "options", label: "OPTIONS", key: "4" },
    { id: "alerts", label: `ALERTS${alerts.filter(a => a.active).length > 0 ? ` [${alerts.filter(a => a.active).length}]` : ""}`, key: "5" },
    { id: "watchlist", label: "WATCHLISTS", key: "6" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #030803; height: 100%; overflow: hidden; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: #050d05; }
        ::-webkit-scrollbar-thumb { background: #1a3a1a; border-radius: 1px; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        @keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes alertPulse { 0%, 100% { background: #1a0a00; } 50% { background: #2a1200; } }
        select option { background: #070f07; }
      `}</style>

      {showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}

      <div style={{ width: "100vw", height: "100vh", background: "#030803", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <StatusBar alerts={alerts.filter(a => a.active).length} />
        <TickerStrip stocks={stocks} />

        {/* Tab bar */}
        <div style={{ display: "flex", background: "#040c04", borderBottom: "1px solid #182818", padding: "0 6px", flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              fontFamily: MONO, fontSize: 8, letterSpacing: 0.8, padding: "5px 14px",
              background: activeTab === t.id ? "#070f07" : "transparent",
              color: activeTab === t.id ? "#8aff8a" : "#2a5a2a",
              border: "none", borderBottom: `2px solid ${activeTab === t.id ? "#00d26a" : "transparent"}`,
              cursor: "pointer",
            }}>
              <span style={{ color: "#1a4a1a", marginRight: 4 }}>{t.key}</span>{t.label}
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", fontFamily: MONO, fontSize: 7, color: "#1a3a1a", gap: 10, paddingRight: 8 }}>
            <span style={{ animation: "blink 2s ease infinite", color: "#00a855" }}>● SIM LIVE</span>
            <span>F1:SHORTCUTS · /:CMD</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {activeTab === "overview" && (
            <>
              <div style={{ width: 360, borderRight: "1px solid #0f1f0f", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <MarketOverview stocks={stocks} onSelect={setSelectedSym} selected={selectedSym} />
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <QuoteDetail stock={stocks[selectedSym]} symbol={selectedSym} />
              </div>
            </>
          )}
          {activeTab === "portfolio" && (
            <div style={{ flex: 1, overflow: "hidden" }}>
              <Portfolio stocks={stocks} activeAccount={activeAccount} setActiveAccount={setActiveAccount} />
            </div>
          )}
          {activeTab === "pnl" && (
            <div style={{ flex: 1, overflow: "hidden" }}>
              <PnLCharts stocks={stocks} activeAccount={activeAccount} />
            </div>
          )}
          {activeTab === "options" && (
            <div style={{ flex: 1, overflow: "hidden" }}>
              <OptionsChain stocks={stocks} />
            </div>
          )}
          {activeTab === "alerts" && (
            <div style={{ flex: 1, overflow: "hidden" }}>
              <PriceAlerts stocks={stocks} alerts={alerts} setAlerts={setAlerts} triggered={triggeredAlerts} />
            </div>
          )}
          {activeTab === "watchlist" && (
            <div style={{ flex: 1, overflow: "hidden" }}>
              <Watchlist stocks={stocks} watchlists={watchlists} setWatchlists={setWatchlists} onSelectStock={(sym) => { setSelectedSym(sym); setActiveTab("overview"); }} />
            </div>
          )}
        </div>

        <CommandBar onCommand={handleCommand} inputRef={cmdRef} />
      </div>
    </>
  );
}
