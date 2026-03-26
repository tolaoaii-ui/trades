import twilio from 'twilio'
import { log } from '../utils/logger.js'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

const FROM = process.env.TWILIO_FROM || '+15106163508'
const TO   = process.env.ALERT_PHONE  // your personal number

export async function sendAlert(message) {
  if (!TO) {
    log('warn', 'No ALERT_PHONE set — skipping SMS')
    return
  }
  try {
    await client.messages.create({ body: message, from: FROM, to: TO })
    log('info', 'SMS sent', { to: TO })
  } catch (err) {
    log('warn', 'SMS failed — Twilio error', { error: err.message })
    // Non-fatal: don't crash the bot if SMS fails
  }
}
