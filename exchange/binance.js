import Binance from 'node-binance-api'
import { log } from '../utils/logger.js'

const client = new Binance().options({
  APIKEY:    process.env.BINANCE_API_KEY,
  APISECRET: process.env.BINANCE_SECRET_KEY,
  useServerTime: true,
  recvWindow: 10000,
})

export async function getBalance(asset = 'USDT') {
  try {
    const balances = await client.balance()
    return parseFloat(balances[asset]?.available || 0)
  } catch (err) {
    log('error', 'Failed to get balance', { error: err.message })
    return 0
  }
}

export async function placeOrder({ symbol, side, size, stopLoss, takeProfit }) {
  try {
    // Paper trading mode — log only, don't execute
    if (process.env.PAPER_TRADE === 'true') {
      log('info', `[PAPER] ${side} ${symbol} size=${size}`)
      return { orderId: `paper_${Date.now()}`, symbol, side, size, status: 'PAPER' }
    }

    const price = await getPrice(symbol)
    const qty   = (size / price).toFixed(5)

    const order = await client.marketBuy(symbol, qty)

    // Set OCO (stop + take profit) after entry
    if (side === 'BUY' && stopLoss && takeProfit) {
      await client.sell(symbol, qty, takeProfit.toFixed(2), {
        stopPrice:      stopLoss.toFixed(2),
        stopLimitPrice: (stopLoss * 0.999).toFixed(2),
        type:           'OCO'
      })
    }

    log('info', 'Order placed', { orderId: order.orderId, side, symbol, qty })
    return order
  } catch (err) {
    log('error', 'Order failed', { error: err.message, symbol, side })
    return null
  }
}

export async function getPrice(symbol) {
  const ticker = await client.prices(symbol)
  return parseFloat(ticker[symbol])
}
