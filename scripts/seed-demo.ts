// scripts/seed-demo.ts
//
// Datos mínimos para probar el caso de uso vertical (reserva de turno) en una
// base recién migrada: una profesional con horario de lunes a sábado y un
// servicio asignado, más un WhatsApp de demo del negocio. Sin esto, una instalación limpia no tiene nada que
// reservar — los servicios y profesionales normalmente los carga el admin.
//
// Idempotente: se puede correr varias veces sin duplicar nada.
// Uso: npm run seed:demo

import { prisma }         from '../src/app/database/prisma'
import { bcryptProvider } from '../src/modules/auth/providers/bcrypt.provider'

const PRO_EMAIL    = 'profesional@nexa.local'
const PRO_PASSWORD = 'Profesional1234!'
const SERVICE_NAME = 'Manicura semipermanente'
const DEMO_WHATSAPP = '5493764000000'

async function main(): Promise<void> {
  const passwordHash = await bcryptProvider.hash(PRO_PASSWORD)

  const proUser = await prisma.user.upsert({
    where:  { email: PRO_EMAIL },
    update: {},
    create: {
      name: 'Loren (demo)', email: PRO_EMAIL, passwordHash,
      role: 'professional', emailVerified: true, active: true,
    },
  })
  const professional = await prisma.professional.upsert({
    where:  { userId: proUser.id },
    update: {},
    create: { userId: proUser.id, specialty: 'Uñas' },
  })

  // dayOfWeek: 0 = lunes … 6 = domingo (mismo DAY_MAP que professional.service.ts)
  await prisma.professionalAvailability.deleteMany({ where: { professionalId: professional.id } })
  await prisma.professionalAvailability.createMany({
    data: [0, 1, 2, 3, 4, 5].map(dayOfWeek => ({
      professionalId: professional.id, dayOfWeek, startTime: '09:00', endTime: '18:00',
    })),
  })

  const service = await prisma.service.findFirst({ where: { name: SERVICE_NAME } })
    ?? await prisma.service.create({
      data: {
        name: SERVICE_NAME, categoryId: 'unas', description: 'Servicio de demostración',
        duration: 60, price: 15000, status: 'active',
      },
    })

  await prisma.professionalService.upsert({
    where:  { professionalId_serviceId: { professionalId: professional.id, serviceId: service.id } },
    update: { active: true },
    create: {
      professionalId: professional.id, serviceId: service.id, active: true,
      ownPrice: service.price, ownDuration: service.duration,
    },
  })

  // Sin un WhatsApp del negocio, la seña solo se puede pagar con Mercado Pago
  // (que requiere credenciales). Con un número cargado aparece "Coordinar el
  // pago por WhatsApp" y la reserva se completa sin pasarela. No pisa un
  // número que el admin ya haya configurado.
  const business = await prisma.businessSettings.findFirst()
  if (!business) {
    await prisma.businessSettings.create({ data: { whatsapp: DEMO_WHATSAPP } })
  } else if (!business.whatsapp) {
    await prisma.businessSettings.update({ where: { id: business.id }, data: { whatsapp: DEMO_WHATSAPP } })
  }

  console.log('✅ Datos de demo listos:')
  console.log(`   Servicio:    ${SERVICE_NAME} (60 min, $15.000)`)
  console.log(`   Profesional: Loren (demo) — lun a sáb 09:00–18:00`)
  console.log(`   Login profesional: ${PRO_EMAIL} / ${PRO_PASSWORD}`)
}

main()
  .catch(err => { console.error('❌ seed:demo falló:', err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
