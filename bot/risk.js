import { log } from '../utils/logger.js'

const MAX_RISK_PCT   = parseFloat(process.env.MAX_RISK_PCT   || '2')    // 2% of balance per trade
const MAX_POSITION   = parseFloat(process.env.MAX_POSITION   || '100')  // max $100 per trade
const DAILY_LOSS_PCT = parseFloat(process.env.DAILY_LOSS_PCT || '3')    // stop bot if -3% day

export function calcPositionSize(balanceUSDT, signalStrength) {
  // Scale position by signal confidence (0.7-1.0 → 50%-100% of max risk)
  const confidence = Math.min((signalStrength - 0.7) / 0.3, 1)
  const riskAmount = (balanceUSDT * MAX_RISK_PCT) / 100
  const size = Math.min(riskAmount * (0.5 + confidence * 0.5), MAX_POSITION)

  log('info', 'Position size calculated', {
    balance: balanceUSDT,
    signalStrength,
    confidence: confidence.toFixed(2),
    size: size.toFixed(2)
  })

  return parseFloat(size.toFixed(2))
}

export function checkRisk(dailyPnl) {
  if (dailyPnl <= -DAILY_LOSS_PCT) {
    log('warn', `Daily loss limit reached: ${dailyPnl.toFixed(2)}%`)
    return false
  }
  return true
}
