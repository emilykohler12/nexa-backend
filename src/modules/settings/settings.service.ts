// src/modules/settings/settings.service.ts
import { prisma } from '../../app/database/prisma'

const DAY_KEYS  = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABEL: Record<string, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves',
  friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
}
const DAY_ABBR: Record<string, string> = {
  monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié', thursday: 'Jue',
  friday: 'Vie', saturday: 'Sáb', sunday: 'Dom',
}

// Arma un texto tipo "Lun - Vie: 9:00 - 20:00 | Sáb: 9:00 - 18:00"
// agrupando días consecutivos con el mismo horario.
function formatScheduleText(rows: { day: string; isOpen: boolean; openTime: string; closeTime: string }[]): string {
  const byDay = new Map(rows.map(r => [r.day, r]))
  const groups: { days: string[]; open: string; close: string }[] = []

  for (const day of DAY_KEYS) {
    const row = byDay.get(day)
    if (!row?.isOpen) continue
    const last = groups[groups.length - 1]
    if (last && last.open === row.openTime && last.close === row.closeTime) {
      last.days.push(day)
    } else {
      groups.push({ days: [day], open: row.openTime, close: row.closeTime })
    }
  }

  return groups
    .map(g => {
      const label = g.days.length > 1
        ? `${DAY_ABBR[g.days[0]]} - ${DAY_ABBR[g.days[g.days.length - 1]]}`
        : DAY_ABBR[g.days[0]]
      return `${label}: ${g.open} - ${g.close}`
    })
    .join(' | ')
}

function mapBusinessSettings(row: {
  name: string; logo: string | null; description: string; address: string
  phone: string; email: string
  instagram: string | null; facebook: string | null; tiktok: string | null; twitter: string | null; whatsapp: string | null
  policies: string[]
}) {
  return {
    name:        row.name,
    logo:        row.logo,
    description: row.description,
    address:     row.address,
    phone:       row.phone,
    email:       row.email,
    socials: {
      instagram: row.instagram,
      facebook:  row.facebook,
      tiktok:    row.tiktok,
      twitter:   row.twitter,
      whatsapp:  row.whatsapp,
    },
    policies: row.policies,
  }
}

function nonEmpty(v: string): string | undefined {
  return v && v.trim() ? v : undefined
}

// Para la home: solo manda lo que el admin cargó de verdad. Un campo en blanco
// se omite (no se envía como "") para que el frontend conserve su valor
// estático por defecto en vez de pisarlo con vacío.
function mapPublicBusinessOverride(row: {
  name: string; logo: string | null; description: string; address: string
  phone: string; email: string
  instagram: string | null; facebook: string | null; tiktok: string | null; twitter: string | null; whatsapp: string | null
  policies: string[]
}, scheduleText: string | undefined) {
  return {
    name:        nonEmpty(row.name),
    logo:        row.logo,
    description: nonEmpty(row.description),
    address:     nonEmpty(row.address),
    phone:       nonEmpty(row.phone),
    email:       nonEmpty(row.email),
    socials: {
      instagram: row.instagram,
      facebook:  row.facebook,
      tiktok:    row.tiktok,
      twitter:   row.twitter,
      whatsapp:  row.whatsapp,
    },
    policies: row.policies.length ? row.policies : undefined,
    schedule: scheduleText,
  }
}

async function getOrCreateBusinessSettings() {
  const existing = await prisma.businessSettings.findFirst()
  if (existing) return existing
  return prisma.businessSettings.create({ data: {} })
}

export const settingsService = {

  getBusinessSettings: async () => {
    const row = await getOrCreateBusinessSettings()
    return mapBusinessSettings(row)
  },

  updateBusinessSettings: async (data: any) => {
    const current = await getOrCreateBusinessSettings()
    const updated = await prisma.businessSettings.update({
      where: { id: current.id },
      data: {
        ...(data.name        !== undefined ? { name: data.name }               : {}),
        ...(data.logo        !== undefined ? { logo: data.logo }               : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.address     !== undefined ? { address: data.address }         : {}),
        ...(data.phone       !== undefined ? { phone: data.phone }             : {}),
        ...(data.email       !== undefined ? { email: data.email }             : {}),
        ...(data.socials?.instagram !== undefined ? { instagram: data.socials.instagram } : {}),
        ...(data.socials?.facebook  !== undefined ? { facebook:  data.socials.facebook  } : {}),
        ...(data.socials?.tiktok    !== undefined ? { tiktok:    data.socials.tiktok    } : {}),
        ...(data.socials?.twitter   !== undefined ? { twitter:   data.socials.twitter   } : {}),
        ...(data.socials?.whatsapp  !== undefined ? { whatsapp:  data.socials.whatsapp  } : {}),
        ...(data.policies    !== undefined ? { policies: data.policies }       : {}),
      },
    })
    return mapBusinessSettings(updated)
  },

  getPublicBusiness: async () => {
    const row = await getOrCreateBusinessSettings()
    const scheduleRows = await prisma.businessScheduleDay.findMany()
    const scheduleText = nonEmpty(formatScheduleText(scheduleRows))
    return mapPublicBusinessOverride(row, scheduleText)
  },

  getSchedule: async () => {
    await Promise.all(DAY_KEYS.map(day =>
      prisma.businessScheduleDay.upsert({
        where:  { day },
        create: { day },
        update: {},
      })
    ))

    const rows = await prisma.businessScheduleDay.findMany()
    const byDay = new Map(rows.map(r => [r.day, r]))

    const schedule = DAY_KEYS.map(day => {
      const row = byDay.get(day)!
      return {
        day,
        label:  DAY_LABEL[day],
        isOpen: row.isOpen,
        open:   row.openTime,
        close:  row.closeTime,
      }
    })

    const holidays = await prisma.businessHoliday.findMany({ orderBy: { date: 'asc' } })

    return { schedule, holidays }
  },

  updateSchedule: async (
    schedule: { day: string; isOpen: boolean; open: string; close: string }[],
    holidays: { date: string; description: string }[],
  ) => {
    for (const d of schedule) {
      if (!DAY_KEYS.includes(d.day as any)) continue
      await prisma.businessScheduleDay.upsert({
        where:  { day: d.day },
        create: { day: d.day, isOpen: d.isOpen, openTime: d.open, closeTime: d.close },
        update: { isOpen: d.isOpen, openTime: d.open, closeTime: d.close },
      })
    }

    await prisma.businessHoliday.deleteMany({})
    if (holidays.length > 0) {
      await prisma.businessHoliday.createMany({
        data: holidays.map(h => ({ date: h.date, description: h.description })),
      })
    }

    return settingsService.getSchedule()
  },

  // ── Seña, cancelaciones y reembolsos ────────────────────────────────

  getPaymentSettings: async () => {
    const row = await getOrCreatePaymentSettings()
    return mapPaymentSettings(row)
  },

  updatePaymentSettings: async (data: any) => {
    const current = await getOrCreatePaymentSettings()
    const updated = await prisma.paymentSettings.update({
      where: { id: current.id },
      data: {
        ...(data.depositAmount     !== undefined ? { depositAmount: data.depositAmount }         : {}),
        ...(data.depositPercent    !== undefined ? { depositPercent: data.depositPercent }        : {}),
        ...(data.cancellationHours !== undefined ? { cancellationHours: data.cancellationHours }  : {}),
        ...(data.refundPolicy      !== undefined ? { refundPolicy: data.refundPolicy }            : {}),
      },
    })
    return mapPaymentSettings(updated)
  },

  getPublicPaymentSettings: async () => {
    const row = await getOrCreatePaymentSettings()
    return mapPaymentSettings(row)
  },
}

async function getOrCreatePaymentSettings() {
  const existing = await prisma.paymentSettings.findFirst()
  if (existing) return existing
  return prisma.paymentSettings.create({ data: {} })
}

function mapPaymentSettings(row: {
  depositAmount: { toString(): string }; depositPercent: boolean
  cancellationHours: number; refundPolicy: string
}) {
  return {
    depositAmount:     Number(row.depositAmount),
    depositPercent:    row.depositPercent,
    cancellationHours: row.cancellationHours,
    refundPolicy:      row.refundPolicy as 'full' | 'partial' | 'none',
  }
}

export function computeDeposit(servicePrice: number, settings: { depositAmount: number; depositPercent: boolean }): number {
  if (settings.depositPercent) {
    return Math.round((servicePrice * settings.depositAmount) / 100)
  }
  return Math.min(settings.depositAmount, servicePrice)
}
