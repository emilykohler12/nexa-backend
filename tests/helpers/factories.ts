import { randomUUID } from 'crypto'
import { prisma } from '../../src/app/database/prisma'
import { bcryptProvider } from '../../src/modules/auth/providers/bcrypt.provider'

export const TEST_PASSWORD = 'Test1234!'

// bcrypt con 12 rounds tarda ~200ms — se hashea UNA sola vez por corrida y se
// reusa en todos los usuarios de test, así la suite no se hace lenta por esto.
let cachedHash: string | null = null
async function testPasswordHash(): Promise<string> {
  if (!cachedHash) cachedHash = await bcryptProvider.hash(TEST_PASSWORD)
  return cachedHash
}

function uniqueEmail(prefix: string): string {
  return `${prefix}.${randomUUID().slice(0, 8)}@test.local`
}

export async function createClientUser(overrides: Partial<{
  name: string; email: string; phone: string; active: boolean; blocked: boolean
}> = {}) {
  const user = await prisma.user.create({
    data: {
      name:          overrides.name  ?? 'Clienta Test',
      email:         overrides.email ?? uniqueEmail('client'),
      phone:         overrides.phone ?? '3764000000',
      passwordHash:  await testPasswordHash(),
      role:          'client',
      emailVerified: true,
      active:        overrides.active ?? true,
    },
  })
  await prisma.client.create({
    data: { userId: user.id, blocked: overrides.blocked ?? false },
  })
  return user
}

export async function createProfessionalUser(overrides: Partial<{
  name: string; email: string; active: boolean
}> = {}) {
  const user = await prisma.user.create({
    data: {
      name:          overrides.name  ?? 'Profesional Test',
      email:         overrides.email ?? uniqueEmail('pro'),
      passwordHash:  await testPasswordHash(),
      role:          'professional',
      emailVerified: true,
      active:        overrides.active ?? true,
    },
  })
  await prisma.professional.create({ data: { userId: user.id } })
  return user
}

export async function createAdminUser(overrides: Partial<{ name: string; email: string }> = {}) {
  return prisma.user.create({
    data: {
      name:          overrides.name  ?? 'Admin Test',
      email:         overrides.email ?? uniqueEmail('admin'),
      passwordHash:  await testPasswordHash(),
      role:          'admin',
      emailVerified: true,
      active:        true,
    },
  })
}

export async function createService(overrides: Partial<{
  name: string; price: number; duration: number; status: string; categoryId: string
}> = {}) {
  return prisma.service.create({
    data: {
      name:        overrides.name ?? 'Manicura Test',
      categoryId:  overrides.categoryId ?? 'unas',
      description: 'Servicio de test',
      duration:    overrides.duration ?? 60,
      price:       overrides.price ?? 10000,
      status:      overrides.status ?? 'active',
    },
  })
}

// Franjas horarias de una profesional (professional_availability): por defecto
// los 7 días (0 = lunes … 6 = domingo) de 09:00 a 18:00.
export async function setAvailability(
  professionalUserId: string,
  ranges: { dayOfWeek: number; startTime: string; endTime: string }[] =
    [0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => ({ dayOfWeek, startTime: '09:00', endTime: '18:00' })),
) {
  const professional = await prisma.professional.findUniqueOrThrow({ where: { userId: professionalUserId } })
  await prisma.professionalAvailability.deleteMany({ where: { professionalId: professional.id } })
  await prisma.professionalAvailability.createMany({
    data: ranges.map(r => ({ professionalId: professional.id, ...r })),
  })
}

// Un lunes al menos una semana adelante (YYYY-MM-DD) + N días — para armar
// turnos dentro de una misma semana (R-04 mide la carga de lunes a domingo).
export function futureWeekDay(daysAfterMonday = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + 7 + ((8 - d.getDay()) % 7) + daysAfterMonday)
  return localDateStr(d)
}

// Habilita a una profesional a hacer un servicio — necesario para que la
// resolución "any profesional" (ANY_PROFESSIONAL_SENTINEL) la encuentre.
export async function linkProfessionalService(
  professionalUserId: string, serviceId: string,
  overrides: Partial<{ ownPrice: number; ownDuration: number }> = {},
) {
  const professional = await prisma.professional.findUnique({ where: { userId: professionalUserId } })
  if (!professional) throw new Error('linkProfessionalService: el usuario no tiene fila Professional')
  const service = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } })
  return prisma.professionalService.create({
    data: {
      professionalId: professional.id,
      serviceId,
      active:      true,
      ownPrice:    overrides.ownPrice    ?? service.price,
      ownDuration: overrides.ownDuration ?? service.duration,
    },
  })
}

export async function createPromotion(overrides: Partial<{
  title: string; price: number; originalPrice: number; status: string
  startDate: string | null; endDate: string | null
  items: { id: string; name: string; price: number }[]
}> = {}) {
  return prisma.promotion.create({
    data: {
      type:          'service',
      kind:          'discount',
      title:         overrides.title ?? 'Promo Test',
      price:         overrides.price ?? 5000,
      originalPrice: overrides.originalPrice ?? 10000,
      status:        overrides.status ?? 'active',
      startDate:     overrides.startDate ?? null,
      endDate:       overrides.endDate ?? null,
      items:         (overrides.items ?? []) as any,
    },
  })
}

// Nunca usar toISOString() para armar estas fechas — convierte a UTC y puede
// correr el día para atrás/adelante según la zona horaria (mismo motivo que
// en el resto del código real, ver Agenda.tsx del frontend).
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Fecha de mañana (o N días adelante) en formato YYYY-MM-DD — evita turnos de
// test en el pasado por accidente.
export function tomorrowStr(daysAhead = 1): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return localDateStr(d)
}

export function todayStr(): string {
  return localDateStr(new Date())
}

// Fecha/hora de HOY menos N minutos, como {date, time} — para simular turnos
// que ya deberían haber empezado (tests del job de no-show automático).
export function minutesAgo(minutes: number): { date: string; time: string } {
  const d = new Date(Date.now() - minutes * 60 * 1000)
  return { date: localDateStr(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
}

// Fecha/hora dentro de N horas, como {date, time} — para armar turnos "lejos"
// o "cerca" del corte de cancelación (12hs por default, RF-04).
export function hoursFromNow(hours: number): { date: string; time: string } {
  const d = new Date(Date.now() + hours * 60 * 60 * 1000)
  return { date: localDateStr(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
}

// Crea un turno directo en la base (sin pasar por el endpoint de reserva) —
// para tests que necesitan controlar exactamente fecha/hora/estado/pago.
export async function createAppointmentDirect(overrides: {
  clientId: string; professionalId: string; serviceId: string
  date: string; time: string
  status?: string; paymentStatus?: string; depositAmount?: number; servicePrice?: number
  duration?: number; comboGroupId?: string | null; arrivedAt?: Date | null
  depositMethod?: string | null
}) {
  const service = await prisma.service.findUniqueOrThrow({ where: { id: overrides.serviceId } })
  return prisma.appointment.create({
    data: {
      clientId:       overrides.clientId,
      professionalId: overrides.professionalId,
      serviceId:      overrides.serviceId,
      date:           overrides.date,
      time:           overrides.time,
      duration:       overrides.duration ?? service.duration,
      servicePrice:   overrides.servicePrice ?? service.price,
      depositAmount:  overrides.depositAmount ?? 0,
      depositMethod:  overrides.depositMethod ?? null,
      status:         overrides.status ?? 'confirmed',
      paymentStatus:  overrides.paymentStatus ?? 'pending',
      comboGroupId:   overrides.comboGroupId ?? null,
      arrivedAt:      overrides.arrivedAt ?? null,
    },
    include: { client: true, professional: true, service: true },
  })
}
