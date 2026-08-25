import { Pool } from 'pg'
import { env } from '../config/env'

export const pool = new Pool({
  connectionString:        env.DATABASE_URL,
  max:                     10,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: 2_000,
})

pool.on('error', (err) => console.error('Pool error:', err))

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return result.rows as T[]
  } finally {
    client.release()
  }
}

export async function queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}