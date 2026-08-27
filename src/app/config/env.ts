//src/app/config/env.ts

import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const schema = z.object({
  NODE_ENV:               z.enum(['development', 'production', 'test']).default('development'),
  PORT:                   z.string().default('4000').transform(Number),
  DATABASE_URL:           z.string().min(1),
  JWT_SECRET:             z.string().min(32),
  JWT_EXPIRES_IN:         z.string().default('15m'),
  JWT_REFRESH_SECRET:     z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL:           z.string().url(),
  ADMIN_EMAIL:            z.string().email(),
  ADMIN_PASSWORD:         z.string().min(8),
  ADMIN_NAME:             z.string().min(2),
  MAIL_HOST:              z.string().default('smtp.gmail.com'),
  MAIL_PORT: z.string().default('587').transform(Number),
  MAIL_USER:              z.string().default(''),
  MAIL_PASS:              z.string().default(''),
  MAIL_FROM:              z.string().default('noreply@app.com'),

  // Opcionales: el resto de la app arranca sin ellas. Solo hacen falta
  // cuando efectivamente se usa el webhook de WhatsApp (whatsapp.service.ts
  // valida su presencia recién al momento de mandar un mensaje).
  WHATSAPP_VERIFY_TOKEN:    z.string().optional(),
  WHATSAPP_APP_SECRET:      z.string().optional(),
  WHATSAPP_ACCESS_TOKEN:    z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:')
  parsed.error.issues.forEach(i => console.error(`  ${i.path.join('.')}: ${i.message}`))
  process.exit(1)
}

export const env = parsed.data