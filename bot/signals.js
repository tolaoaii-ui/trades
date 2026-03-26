import { getPolymarketScore } from '../sources/polymarket.js'
import { getXSentimentScore } from '../sources/xsentiment.js'
import { log } from '../utils/logger.js'

// ── Technical indicators ──────────────────────────────────────────────────────

function calcEMA(values, period) {
  const k = 2 / (period + 1)
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k)
  }
  return ema
}

function calcRSI(closes, period = 14) {
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period
  }
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function calcVolumeSpike(candles) {
  const vols = candles.slice(-20).map(c => c.volume)
  const avg = vols.slice(0, -1).reduce((a, b) => a + b, 0) / (vols.length - 1)
  return vols.at(-1) / avg // ratio: 2.0 = 2x average volume
}

// ── Main signal scorer ────────────────────────────────────────────────────────

export async function getSignalScore(candles) {
  const closes  = candles.map(c => c.close)
  const rsi     = calcRSI(closes)
  const ema9    = calcEMA(closes, 9)
  const ema21   = calcEMA(closes, 21)
  const volSpike = calcVolumeSpike(candles)

  // Technical score (0-1)
  const rsiScore    = rsi < 35 ? 1 : rsi < 45 ? 0.6 : rsi > 65 ? 0 : 0.3
  const emaScore    = ema9 > ema21 ? 1 : ema9 > ema21 * 0.999 ? 0.5 : 0
  const volScore    = volSpike > 2 ? 1 : volSpike > 1.5 ? 0.6 : volSpike > 1.2 ? 0.3 : 0
  const techScore   = (rsiScore * 0.4) + (emaScore * 0.4) + (volScore * 0.2)

  // External signals (run in parallel for speed)
  const [polyScore, sentimentScore] = await Promise.allSettled([
    getPolymarketScore(),
    getXSentimentScore()
  ])

  const poly      = polyScore.status      === 'fulfilled' ? polyScore.value      : 0.5
  const sentiment = sentimentScore.status === 'fulfilled' ? sentimentScore.value : 0.5

  // Weighted composite score
  // Tech = 60%, Polymarket = 20%, X sentiment = 20%
  const value = (techScore * 0.6) + (poly * 0.2) + (sentiment * 0.2)

  const signals = {
    rsi:       rsi.toFixed(2),
    ema9:      ema9.toFixed(2),
    ema21:     ema21.toFixed(2),
    volSpike:  volSpike.toFixed(2),
    techScore: techScore.toFixed(2),
    poly:      poly.toFixed(2),
    sentiment: sentiment.toFixed(2),
  }

  log('info', 'Signals computed', signals)
  return { value, signals }
}
