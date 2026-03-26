import { getDB } from './mongo.js'
import { log } from '../utils/logger.js'

export async function saveTrade(trade) {
  try {
    const db  = getDB()
    const doc = { ...trade, timestamp: new Date() }
    await db.collection('trades').insertOne(doc)
    log('info', 'Trade saved', { status: trade.status, symbol: trade.symbol })
  } catch (err) {
    log('error', 'Failed to save trade', { error: err.message })
  }
}

export async function getDailyPnl() {
  const db    = getDB()
  const start = new Date(); start.setUTCHours(0, 0, 0, 0)
  const trades = await db.collection('trades')
    .find({ status: 'closed', timestamp: { $gte: start } })
    .toArray()
  return trades.reduce((sum, t) => sum + (t.pnl || 0), 0)
}

export async function getTradeHistory(limit = 50) {
  const db = getDB()
  return db.collection('trades')
    .find({ status: 'closed' })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray()
}
