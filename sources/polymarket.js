import { log } from '../utils/logger.js'

const GAMMA_API = 'https://gamma-api.polymarket.com'

// Fetch BTC-related markets and return a 0-1 bullish score
export async function getPolymarketScore() {
  try {
    const res  = await fetch(`${GAMMA_API}/markets?tag=crypto&limit=20&active=true`)
    const data = await res.json()

    const btcMarkets = data.filter(m =>
      m.question?.toLowerCase().includes('bitcoin') ||
      m.question?.toLowerCase().includes('btc')
    )

    if (!btcMarkets.length) return 0.5 // neutral if no markets found

    let bullishScore = 0
    let count = 0

    for (const market of btcMarkets.slice(0, 5)) {
      const question = market.question?.toLowerCase()
      const prob     = parseFloat(market.outcomePrices?.[0] || 0.5)

      // Questions framed as "BTC above X" or "BTC hits X" = bullish if high prob
      if (question?.includes('above') || question?.includes('hit') || question?.includes('reach')) {
        bullishScore += prob
        count++
      }
      // Questions framed as "BTC below X" = bearish if high prob
      if (question?.includes('below') || question?.includes('drop') || question?.includes('fall')) {
        bullishScore += (1 - prob)
        count++
      }
    }

    const score = count > 0 ? bullishScore / count : 0.5
    log('info', 'Polymarket score', { score: score.toFixed(2), marketsChecked: count })
    return score
  } catch (err) {
    log('warn', 'Polymarket fetch failed — using neutral', { error: err.message })
    return 0.5
  }
}
