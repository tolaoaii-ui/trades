import { MongoClient } from 'mongodb'
import { log } from '../utils/logger.js'

let db = null

export async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  db = client.db('trading')
  log('info', 'MongoDB connected — database: trading')
}

export function getDB() {
  if (!db) throw new Error('DB not connected')
  return db
}
