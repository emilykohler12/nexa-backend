import { pool } from './db'

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS users (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(100) NOT NULL,
    email            VARCHAR(255) NOT NULL UNIQUE,
    password_hash    VARCHAR(255) NOT NULL,
    role             VARCHAR(20)  NOT NULL DEFAULT 'client'
                     CHECK (role IN ('admin', 'professional', 'client')),
    phone            VARCHAR(20),
    gender           VARCHAR(30),
    email_verified   BOOLEAN      NOT NULL DEFAULT FALSE,
    verification_token VARCHAR(255),
    active           BOOLEAN      NOT NULL DEFAULT TRUE,
    refresh_token    TEXT,
    profile_complete BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS password_resets (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS invitations (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email      VARCHAR(255) NOT NULL,
    token      VARCHAR(255) NOT NULL UNIQUE,
    used       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
  )`,
]

export async function runMigrations(): Promise<void> {
  console.log('⏳ Ejecutando migraciones...')
  for (const sql of MIGRATIONS) {
    await pool.query(sql)
  }
  console.log('✅ Migraciones completadas')
}