import { log } from '../utils/logger.js'

const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://127.0.0.1:18789'

// Key crypto influencer accounts to monitor (public timeline scraping)
const ACCOUNTS = ['APompliano', 'CryptoCobain', 'PeterLBrandt', 'woonomic', 'WClementeIII']

export async function getXSentimentScore() {
  try {
    // Fetch recent posts from X public search API
    const query    = encodeURIComponent('(bitcoin OR BTC OR crypto) lang:en -is:retweet')
    const xRes     = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=20&tweet.fields=text`,
      { headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` } }
    )

    if (!xRes.ok) {
      log('warn', 'X API unavailable — using neutral sentiment')
      return 0.5
    }

    const xData = await xRes.json()
    const texts = xData.data?.map(t => t.text).join('\n') || ''

    if (!texts) return 0.5

    // Use Claude via OpenClaw to score sentiment
    const claudeRes = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: `You are a crypto trading sentiment analyzer. Read these recent tweets and return ONLY a decimal number between 0.0 and 1.0 representing overall bullish sentiment (0=very bearish, 0.5=neutral, 1=very bullish). Return only the number, nothing else.\n\nTweets:\n${texts.slice(0, 2000)}`
        }]
      })
    })

    const claudeData = await claudeRes.json()
    const raw  = claudeData.choices?.[0]?.message?.content?.trim()
    const score = parseFloat(raw)

    if (isNaN(score) || score < 0 || score > 1) return 0.5

    log('info', 'X sentiment score', { score })
    return score
  } catch (err) {
    log('warn', 'X sentiment failed — using neutral', { error: err.message })
    return 0.5
  }
}
