// scripts/seed-demo.ts
//
// Escenario de demostración para una base recién migrada, con datos inventados:
// - una profesional con horario de lunes a sábado (09:00 a 18:00) y un servicio asignado;
// - una clienta de demo con tres turnos coherentes con las reglas de la AE4:
//   · confirmado, en el próximo día hábil que empiece dentro de 2 días o más, con la seña paga;
//   · no_show_auto («No asistió (automático)»), del día hábil anterior a hoy: sin llegada registrada,
//     con la seña retenida (el job no cambia paymentStatus) y el horario todavía ocupado;
//   · cancelado por la clienta con más de 12 horas de aviso (cancellationHours por defecto): la seña
//     queda marcada como devuelta y el horario libre (slot_locked en false, cancelado antes del inicio);
// - una promoción vigente (activa, desde hoy hasta dentro de 30 días) sobre ese servicio;
// - un WhatsApp de demo del negocio, para poder coordinar la seña sin Mercado Pago.
// Sin esto, una instalación limpia no tiene nada que reservar ni nada que mostrar.
//
// Las fechas se calculan en hora de Argentina a partir de hoy, así que el escenario sirve el día
// que se corra. Idempotente: se puede correr varias veces sin duplicar nada; cada corrida borra y
// vuelve a crear SOLO los turnos de la clienta de demo (para recalcular las fechas).
// Nunca correrlo contra la base de producción.
// Uso: npm run seed:demo

import path from 'node:path'
import { prisma }                 from '../src/app/database/prisma'
import { bcryptProvider }         from '../src/modules/auth/providers/bcrypt.provider'
import { PRIVACY_POLICY_VERSION } from '../src/app/constants/legal'
import { todayArgentinaStr }      from '../src/app/utils/argentinaTime'

export const DEMO = {
  proEmail:       'profesional@nexa.local',
  proPassword:    'Profesional1234!',
  clientEmail:    'clienta@nexa.local',
  clientPassword: 'Clienta1234!',
  serviceName:    'Manicura semipermanente',
  promotionTitle: 'Semipermanente con descuento (demo)',
  whatsapp:       '5493764000000',
} as const

const DEPOSIT = 4500 // 30 % de $15.000

// Suma días a una fecha YYYY-MM-DD sin pasar por la zona horaria del proceso.
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// 0 = domingo en getUTCDay; la fecha se arma a mediodía UTC, así que el día no se corre.
function isSunday(date: string): boolean {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0
}

// Primer día hábil (lunes a sábado) a partir de `date`, avanzando en la dirección de `step`.
function workingDay(date: string, step: 1 | -1): string {
  let d = date
  while (isSunday(d)) d = addDays(d, step)
  return d
}

export async function seedDemo(now: Date = new Date()) {
  const today = todayArgentinaStr(now)

  // ── Profesional, horario y servicio ───────────────────────────────────────────────────────────
  const proUser = await prisma.user.upsert({
    where:  { email: DEMO.proEmail },
    update: {},
    create: {
      name: 'Valeria (demo)', email: DEMO.proEmail, passwordHash: await bcryptProvider.hash(DEMO.proPassword),
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

  const service = await prisma.service.findFirst({ where: { name: DEMO.serviceName } })
    ?? await prisma.service.create({
      data: {
        name: DEMO.serviceName, categoryId: 'unas', description: 'Servicio de demostración',
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

  // ── Clienta de demo ───────────────────────────────────────────────────────────────────────────
  const clientUser = await prisma.user.upsert({
    where:  { email: DEMO.clientEmail },
    update: {},
    create: {
      name: 'Clienta', lastName: 'Demo', email: DEMO.clientEmail, phone: '3764000000',
      passwordHash: await bcryptProvider.hash(DEMO.clientPassword),
      role: 'client', emailVerified: true, active: true, profileComplete: true,
      termsAcceptedAt: now, termsVersion: PRIVACY_POLICY_VERSION,
    },
  })
  await prisma.client.upsert({
    where:  { userId: clientUser.id },
    update: {},
    create: { userId: clientUser.id },
  })

  // ── Turnos: se borran los de la clienta de demo y se vuelven a crear con fechas de hoy ───────
  const previous = await prisma.appointment.findMany({ where: { clientId: clientUser.id }, select: { id: true } })
  const previousIds = previous.map(a => a.id)
  if (previousIds.length > 0) {
    await prisma.review.deleteMany({ where: { appointmentId: { in: previousIds } } })
    await prisma.activityLog.updateMany({ where: { appointmentId: { in: previousIds } }, data: { appointmentId: null } })
    await prisma.appointment.deleteMany({ where: { id: { in: previousIds } } }) // reopened_slots cae en cascada
  }

  const base = {
    clientId: clientUser.id, professionalId: proUser.id, serviceId: service.id,
    duration: service.duration, servicePrice: service.price, depositAmount: DEPOSIT, depositMethod: 'whatsapp',
  }
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)

  const confirmed = await prisma.appointment.create({
    data: {
      ...base, date: workingDay(addDays(today, 2), 1), time: '10:00',
      status: 'confirmed', paymentStatus: 'partial',
    },
  })

  const noShowAuto = await prisma.appointment.create({
    data: {
      ...base, date: workingDay(addDays(today, -1), -1), time: '10:00',
      status: 'no_show_auto', paymentStatus: 'partial', createdAt: daysAgo(5),
    },
  })

  const cancelled = await prisma.appointment.create({
    data: {
      ...base, date: workingDay(addDays(today, 3), 1), time: '15:00',
      status: 'cancelled', paymentStatus: 'refunded', createdAt: daysAgo(2),
      cancelledAt: now, cancelReason: 'user_cancelled', cancelledBy: 'client', slotLocked: false,
    },
  })

  // ── Promoción vigente ─────────────────────────────────────────────────────────────────────────
  const promotionData = {
    type: 'service', kind: 'discount', title: DEMO.promotionTitle,
    description: 'Promoción de demostración sobre la manicura semipermanente.',
    price: 12000, originalPrice: 15000, status: 'active',
    items: [{ id: service.id, name: service.name, price: Number(service.price) }],
    startDate: today, endDate: addDays(today, 30),
  }
  const existingPromotion = await prisma.promotion.findFirst({ where: { title: DEMO.promotionTitle } })
  const promotion = existingPromotion
    ? await prisma.promotion.update({ where: { id: existingPromotion.id }, data: promotionData })
    : await prisma.promotion.create({ data: promotionData })

  // Sin un WhatsApp del negocio, la seña solo se puede pagar con Mercado Pago
  // (que requiere credenciales). Con un número cargado aparece "Coordinar el
  // pago por WhatsApp" y la reserva se completa sin pasarela. No pisa un
  // número que el admin ya haya configurado.
  const business = await prisma.businessSettings.findFirst()
  if (!business) {
    await prisma.businessSettings.create({ data: { whatsapp: DEMO.whatsapp } })
  } else if (!business.whatsapp) {
    await prisma.businessSettings.update({ where: { id: business.id }, data: { whatsapp: DEMO.whatsapp } })
  }

  return { professionalUserId: proUser.id, clientUserId: clientUser.id, serviceId: service.id, confirmed, noShowAuto, cancelled, promotion }
}

async function main(): Promise<void> {
  const seeded = await seedDemo()
  console.log('✅ Datos de demo listos:')
  console.log(`   Servicio:    ${DEMO.serviceName} (60 min, $15.000)`)
  console.log(`   Profesional: Valeria (demo) — lun a sáb 09:00–18:00`)
  console.log(`   Turnos de la clienta: confirmado ${seeded.confirmed.date} ${seeded.confirmed.time}, ` +
    `no asistió (automático) ${seeded.noShowAuto.date} ${seeded.noShowAuto.time}, ` +
    `cancelado ${seeded.cancelled.date} ${seeded.cancelled.time}`)
  console.log(`   Promoción vigente: ${DEMO.promotionTitle} (${seeded.promotion.startDate} a ${seeded.promotion.endDate})`)
  console.log(`   Login profesional: ${DEMO.proEmail} / ${DEMO.proPassword}`)
  console.log(`   Login clienta:     ${DEMO.clientEmail} / ${DEMO.clientPassword}`)
}

// Solo se ejecuta al correrlo como script (npm run seed:demo), no al importarlo desde una prueba.
if (path.basename(process.argv[1] ?? '').startsWith('seed-demo')) {
  main()
    .catch(err => { console.error('❌ seed:demo falló:', err); process.exitCode = 1 })
    .finally(() => prisma.$disconnect())
}
