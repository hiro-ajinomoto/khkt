import { MongoClient } from 'mongodb'
import { config } from './config.js'

let client = null
let db = null

export async function connectDB() {
  if (client) {
    return db
  }

  try {
    client = new MongoClient(config.mongodb.uri)
    await client.connect()
    db = client.db(config.mongodb.dbName)
    console.log('✅ Connected to MongoDB')
    return db
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    throw error
  }
}

export function getDB() {
  if (!db) {
    throw new Error('Database not connected. Call connectDB() first.')
  }
  return db
}

export async function closeDB() {
  if (client) {
    await client.close()
    client = null
    db = null
    console.log('✅ MongoDB connection closed')
  }
}
