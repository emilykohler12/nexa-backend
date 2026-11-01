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
  // Remitente de TODOS los mails de la app. Con Brevo tiene que estar verificado como remitente allá.
  // Se sacan espacios y comillas: pegar "kologic6@gmail.com" con comillas en el panel de Render las deja
  // dentro del valor y el remitente deja de ser un email válido.
  MAIL_FROM: z.preprocess(
    v => (typeof v === 'string' ? v.trim().replace(/^["']+|["']+$/g, '').trim() : v),
    z.string().min(1).default('kologic6@gmail.com'),
  ),
  // Envío por la API HTTPS de Brevo (en Render el SMTP está bloqueado). Un valor vacío se trata como
  // "no configurado" y se usa SMTP, que sirve para desarrollo local.
  BREVO_API_KEY: z.preprocess(
    v => {
      if (typeof v !== 'string') return v
      const clean = v.trim().replace(/^["']+|["']+$/g, '').trim()
      return clean === '' ? undefined : clean
    },
    z.string().optional(),
  ),

  // Mercado Pago — opcionales, la app arranca sin ellas. payment.service.ts
  // valida su presencia recién al momento de crear un pago real.
  MERCADOPAGO_ACCESS_TOKEN:   z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),

  // Supabase Storage — donde se guardan las imágenes que suben los admins/
  // profesionales/clientes (logo, fotos de perfil, galería, promos, etc.).
  // Opcionales: la app arranca sin ellas, upload.service.ts valida su
  // presencia recién al momento de subir una imagen real. La ANON_KEY no es
  // secreta (Supabase la expone igual en cualquier cliente), pero acá se usa
  // solo desde el backend — nunca llega al navegador.
  SUPABASE_URL:      z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),

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