# 🦞 Tolao Trading Bot

Crypto scalping bot for BTC/USDT on Binance. Signals: RSI + EMA crossover + volume spike + Polymarket odds + X sentiment scored by Claude via OpenClaw.

## Stack
- **Runtime**: Node.js 20+ (pure ESM)
- **Exchange**: Binance API via `node-binance-api`
- **Database**: MongoDB Atlas — `trading` database in your existing cluster
- **Notifications**: Twilio SMS
- **AI scoring**: Claude Sonnet via OpenClaw local agent
- **Hosting**: Railway (new service alongside vettx-bot)

## Project structure
```
tolao-trading-bot/
├── index.js                  # Entry point
├── bot/
│   ├── engine.js             # WebSocket feed + trade loop
│   ├── signals.js            # RSI, EMA, vol + external scores
│   └── risk.js               # Position sizing + daily loss limit
├── exchange/
│   └── binance.js            # Order placement
├── sources/
│   ├── polymarket.js         # Prediction market signal
│   └── xsentiment.js        # X/Twitter sentiment via Claude
├── db/
│   ├── mongo.js              # Connection
│   └── trades.js             # Trade persistence
├── notifications/
│   └── twilio.js             # SMS alerts
└── utils/
    └── logger.js             # Structured JSON logging
```

## Setup

### 1. Get Binance API keys
- Go to binance.com → Account → API Management
- Create key with "Enable Spot & Margin Trading" checked
- Add Railway's IP to the allowlist (or set to unrestricted for now)

### 2. Configure environment
Copy `.env.example` to `.env` and fill in your values.
Keep `PAPER_TRADE=true` until you've verified signals look good.

### 3. Install and run locally
```bash
npm install
node index.js
```

### 4. Deploy to Railway
```bash
# In Railway dashboard:
# 1. New Service → GitHub repo (tolaoaii-ui/tolao-app or new repo)
# 2. Copy all env vars from .env into Railway environment
# 3. Set start command: node index.js
# 4. Deploy
```

## Signal scoring
| Signal | Weight | Trigger |
|---|---|---|
| RSI | 24% | < 35 = oversold (buy signal) |
| EMA crossover | 24% | 9-EMA > 21-EMA |
| Volume spike | 12% | Current vol > 2x 20-candle avg |
| Polymarket | 20% | BTC market bullish odds |
| X sentiment | 20% | Claude scores tweet tone 0-1 |

**Entry**: composite score ≥ 0.70
**Exit**: composite score ≤ 0.30 OR stop-loss/take-profit hit on exchange

## Risk defaults
- 2% of balance per trade
- Max $100 per position
- 0.75% stop-loss, 0.4% take-profit
- Bot pauses if daily PnL < -3%

## Going live checklist
- [ ] Run paper trade for at least 1 week
- [ ] Verify signals fire at expected times in logs
- [ ] Confirm Twilio SMS working (new campaign approved)
- [ ] Set `PAPER_TRADE=false` in Railway env
- [ ] Start with small balance ($50-100)
