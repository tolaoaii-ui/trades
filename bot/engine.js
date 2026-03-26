import WebSocket from 'ws'
import { getSignalScore } from './signals.js'
import { checkRisk, calcPositionSize } from './risk.js'
import { placeOrder, getBalance } from '../exchange/binance.js'
import { saveTrade } from '../db/trades.js'
import { sendAlert } from '../notifications/twilio.js'
import { log } from '../utils/logger.js'

const SYMBOL = process.env.TRADE_SYMBOL || 'BTCUSDT'
const WS_URL = `wss://stream.binance.com:9443/ws/${SYMBOL.toLowerCase()}@kline_1m`

let candles = []
let position = null
let dailyPnl = 0
let ws = null

export async function startBot() {
  log('info', `Starting bot on ${SYMBOL}`)
  connectWebSocket()
}

function connectWebSocket() {
  ws = new WebSocket(WS_URL)

  ws.on('open', () => log('info', 'WebSocket connected'))

  ws.on('message', async (data) => {
    const msg = JSON.parse(data)
    const candle = msg.k

    if (!candle.x) return // only process closed candles

    candles.push({
      open:   parseFloat(candle.o),
      high:   parseFloat(candle.h),
      low:    parseFloat(candle.l),
      close:  parseFloat(candle.c),
      volume: parseFloat(candle.v),
      time:   candle.t
    })

    if (candles.length > 200) candles = candles.slice(-200)
    if (candles.length < 50)  return // need enough history

    await evaluate()
  })

  ws.on('close', () => {
    log('warn', 'WebSocket closed — reconnecting in 5s')
    setTimeout(connectWebSocket, 5000)
  })

  ws.on('error', (err) => {
    log('error', 'WebSocket error', { error: err.message })
    ws.terminate()
  })
}

async function evaluate() {
  // Hard daily loss limit — stop trading if down 3%
  if (dailyPnl < -3) {
    log('warn', 'Daily loss limit hit — bot paused for today')
    return
  }

  const score = await getSignalScore(candles)
  log('info', 'Signal score', { score, symbol: SYMBOL })

  // Entry: score > 0.7 = strong buy, no current position
  if (!position && score.value >= 0.7) {
    const balance = await getBalance('USDT')
    const size = calcPositionSize(balance, score.value)
    const price = candles.at(-1).close

    const order = await placeOrder({
      symbol: SYMBOL,
      side: 'BUY',
      size,
      stopLoss:   price * 0.9925,  // 0.75% stop
      takeProfit: price * 1.004,   // 0.4% target
    })

    if (order) {
      position = { ...order, entryPrice: price, size, score: score.value }
      await saveTrade({ ...position, status: 'open', signals: score.signals })
      await sendAlert(`🟢 BUY ${SYMBOL} @ $${price.toFixed(2)} | Score: ${score.value.toFixed(2)} | Size: $${size.toFixed(2)}`)
      log('info', 'Position opened', position)
    }
  }

  // Exit: score drops below 0.3 or stop/target hit (handled by exchange)
  if (position && score.value <= 0.3) {
    const price = candles.at(-1).close
    const pnl = ((price - position.entryPrice) / position.entryPrice) * 100

    await placeOrder({ symbol: SYMBOL, side: 'SELL', size: position.size })
    dailyPnl += pnl

    await saveTrade({ ...position, exitPrice: price, pnl, status: 'closed' })
    await sendAlert(`🔴 SELL ${SYMBOL} @ $${price.toFixed(2)} | PnL: ${pnl.toFixed(2)}%`)
    log('info', 'Position closed', { pnl })
    position = null
  }
}

// Reset daily PnL at midnight UTC
setInterval(() => {
  const now = new Date()
  if (now.getUTCHours() === 0 && now.getUTCMinutes() === 0) {
    log('info', `Daily PnL reset. Was: ${dailyPnl.toFixed(2)}%`)
    dailyPnl = 0
  }
}, 60000)
