import { beforeEach, afterAll, vi } from 'vitest'
import { prisma } from '../src/app/database/prisma'
import { env } from '../src/app/config/env'

// Red de seguridad: si por lo que sea DATABASE_URL no apunta a una base de
// test, ABORTAR antes de truncar nada. Truncar la base real por un .env mal
// cargado sería catastrófico.
if (!/nexa_db_test|test/i.test(env.DATABASE_URL)) {
  throw new Error(
    `[tests] DATABASE_URL no parece ser una base de test: "${env.DATABASE_URL}". ` +
    `Abortando antes de truncar nada — revisá .env.test.`,
  )
}

// Nunca se manda mail de verdad ni se le pega a la API real de Mercado Pago
// durante los tests. Los tests que necesitan verificar el contenido/llamado
// pueden leer estos mocks con vi.mocked(...).
vi.mock('../src/modules/auth/providers/mail.provider', () => ({
  mailProvider: { send: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('../src/modules/payments/payment.service', () => ({
  paymentService: {
    createPreference:       vi.fn().mockResolvedValue({ preferenceId: 'test-pref-id', checkoutUrl: 'https://mp.test/checkout' }),
    getPayment:              vi.fn().mockResolvedValue({}),
    findPaymentByReference:  vi.fn().mockResolvedValue(null),
  },
}))

const TABLES = [
  'users', 'refresh_sessions', 'professionals', 'professional_availability', 'invitations', 'password_resets',
  'clients', 'professional_services', 'services', 'appointments', 'products',
  'reopened_slots', 'inventory_movements', 'orders', 'product_orders',
  'promotions', 'special_events', 'payment_settings', 'business_settings', 'business_schedule_days',
  'business_holidays', 'client_gallery_photos', 'activity_logs', 'reviews',
  'professional_notifications', 'client_notifications',
]

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  )
}

beforeEach(async () => {
  await resetDb()
})

afterAll(async () => {
  await prisma.$disconnect()
})
