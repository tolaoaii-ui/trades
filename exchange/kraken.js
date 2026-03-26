import crypto from 'crypto'
import { log } from '../utils/logger.js'

const BASE_URL   = 'https://api.kraken.com'
const API_KEY    = process.env.KRAKEN_API_KEY
const API_SECRET = process.env.KRAKEN_API_SECRET

function getSignature(path, data, secret) {
  const nonce = data.nonce
  const message = data.nonce + new URLSearchParams(data).toString()
  const secretBuffer = Buffer.from(secret, 'base64')
  const hash = crypto.createHash('sha256').update(nonce + message).digest('binary')
  const hmac = crypto.createHmac('sha512', secretBuffer)
  hmac.update(path + hash, 'binary')
  return hmac.digest('base64')
}

async function privateRequest(endpoint, params = {}) {
  const path  = `/0/private/${endpoint}`
  const nonce = Date.now().toString()
  const data  = { nonce, ...params }
  const sig   = getSignature(path, data, API_SECRET)
  const res   = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'API-Key': API_KEY, 'API-Sign': sig, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data)
  })
  const json = await res.json()
  if (json.error?.length) throw new Error(json.error.join(', '))
  return json.result
}

async function publicRequest(endpoint, params = {}) {
  const qs  = new URLSearchParams(params).toString()
  const res = await fetch(`${BASE_URL}/0/public/${endpoint}${qs ? '?' + qs : ''}`)
  const json = await res.json()
  if (json.error?.length) throw new Error(json.error.join(', '))
  return json.result
}

export async function getBalance(asset = 'ZUSD') {
  try {
    if (process.env.PAPER_TRADE === 'true') return 1000
    const result = await privateRequest('Balance')
    return parseFloat(result[asset] || result['USD'] || 0)
  } catch (err) {
    log('error', 'Kraken getBalance failed', { error: err.message })
    return 0
  }
}

export async function getPrice(pair = 'XBTUSD') {
  const result = await publicRequest('Ticker', { pair })
  const key    = Object.keys(result)[0]
  return parseFloat(result[key].c[0])
}

export async function placeOrder({ symbol = 'XBTUSD', side, size, stopLoss }) {
  try {
    const price  = await getPrice(symbol)
    log('info', `Kraken ${side} order`, { symbol, size, price, stopLoss })

    if (process.env.PAPER_TRADE === 'true') {
      log('info', 'PAPER TRADE — order not sent')
      return { orderId: 'PAPER-' + Date.now(), price, size }
    }

    const order = await privateRequest('AddOrder', {
      pair:      symbol,
      type:      side,
      ordertype: 'market',
      volume:    size.toString()
    })

    if (stopLoss) {
      await privateRequest('AddOrder', {
        pair:      symbol,
        type:      side === 'buy' ? 'sell' : 'buy',
        ordertype: 'stop-loss',
        price:     stopLoss.toString(),
        volume:    size.toString()
      })
    }

    return { orderId: order.txid?.[0], price, size }
  } catch (err) {
    log('error', 'Kraken placeOrder failed', { error: err.message })
    throw err
  }
}

export async function getOpenOrders() {
  try {
    const result = await privateRequest('OpenOrders')
    return result.open || {}
  } catch (err) {
    log('error', 'Kraken getOpenOrders failed', { error: err.message })
    return {}
  }
}
