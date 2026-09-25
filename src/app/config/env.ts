//src/app/config/env.ts

import { z } from 'zod'
import dotenv from 'dotenv'

// Los tests corren con NODE_ENV=test (lo fija vitest.config.ts) y usan su
// propia base de datos — .env.test, nunca el .env real, así un test corrido
// por error jamás toca datos de verdad.
// override: true porque Vitest ya carga .env solo (vía Vite) antes de que
// esto corra — sin esto, DATABASE_URL de .env "gana" por estar seteada
// primero y dotenv no pisa variables existentes por default.
dotenv.config(
  process.env.NODE_ENV === 'test' ? { path: '.env.test', quiet: true, override: true } : {},
)

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

  // Mercado Pago — opcionales, la app arranca sin ellas. payment.service.ts
  // valida su presencia recién al momento de crear un pago real.
  MERCADOPAGO_ACCESS_TOKEN:   z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),

  // Login social — opcionales, la app arranca sin ellas. social.provider.ts
  // valida su presencia recién al momento de verificar un login real.
  // GOOGLE_CLIENT_ID es el mismo valor público que VITE_GOOGLE_CLIENT_ID del
  // frontend (los client_id de OAuth para apps web no son secretos, se
  // exponen en el JS del navegador) — se usa acá para confirmar que el
  // access_token que llega fue emitido para ESTA app y no para otra.
  GOOGLE_CLIENT_ID:  z.string().optional(),
  // URL pública (túnel de VS Code / ngrok) a la que Mercado Pago manda los
  // webhooks en desarrollo. Sin esto, el webhook nunca llega — los pagos se
  // pueden crear igual, pero nunca se confirman solos. Un valor vacío en el
  // .env se trata como "no configurado" en lugar de romper el arranque.
  BACKEND_PUBLIC_URL: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().url().optional(),
  ),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:')
  parsed.error.issues.forEach(i => console.error(`  ${i.path.join('.')}: ${i.message}`))
  process.exit(1)
}

export const env = parsed.data