import { startBot } from './bot/engine.js'
import { connectDB } from './db/mongo.js'
import { log } from './utils/logger.js'

process.on('uncaughtException', (err) => {
  log('error', 'Uncaught exception', { error: err.message })
  setTimeout(() => process.exit(1), 1000)
})

process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled rejection', { reason })
})

async function main() {
  log('info', '🦞 Tolao Trading Bot starting...')
  await connectDB()
  await startBot()
}

main()
