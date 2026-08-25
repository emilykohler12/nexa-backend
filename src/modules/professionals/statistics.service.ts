// src/modules/professionals/statistics.service.ts
import { prisma } from '../../app/database/prisma'

export type PeriodFilter = 'day' | 'week' | 'month' | 'year'

const PALETTE = ['#069494', '#d4af37', '#e57373', '#7986cb', '#4db6ac', '#f06292']

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

function getRange(period: PeriodFilter, ref = new Date()): { start: Date; end: Date } {
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const end = new Date(start)
  switch (period) {
    case 'day':
      break
    case 'week': {
      const day = start.getDay()
      const diff = day === 0 ? -6 : 1 - day
      start.setDate(start.getDate() + diff)
      end.setTime(start.getTime())
      end.setDate(start.getDate() + 6)
      break
    }
    case 'month':
      start.setDate(1)
      end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0)
      break
    case 'year':
      start.setMonth(0, 1)
      end.setFullYear(start.getFullYear(), 11, 31)
      break
  }
  return { start, end }
}

export const statisticsService = {

  getForProfessional: async (professionalId: string, period: PeriodFilter = 'month') => {
    const now = new Date()
    const todayStr = toDateStr(now)
    const { start, end } = getRange(period, now)
    const startStr = toDateStr(start)
    const endStr   = toDateStr(end)

    const allFinished = await prisma.appointment.findMany({
      where:   { professionalId, status: 'finished' },
      include: { service: true },
    })

    // Nunca contar como "realizado" un turno con fecha futura a hoy (dato inconsistente).
    const inPeriod = allFinished.filter(a => a.date >= startStr && a.date <= endStr && a.date <= todayStr)

    const periodRevenue  = inPeriod.reduce((s, a) => s + Number(a.servicePrice), 0)
    const periodServices = inPeriod.length
    const hoursWorked    = inPeriod.reduce((s, a) => s + a.duration, 0) / 60
    const totalClients   = new Set(inPeriod.map(a => a.clientId)).size

    // No hay sistema de reseñas todavía — sin dato real para promediar.
    const avgRating = 0

    const professional = await prisma.professional.findUnique({
      where:   { userId: professionalId },
      include: { availability: true },
    })
    const weeklyHours = (professional?.availability ?? [])
      .filter(a => a.active)
      .reduce((s, a) => {
        const [sh, sm] = a.startTime.split(':').map(Number)
        const [eh, em] = a.endTime.split(':').map(Number)
        return s + ((eh * 60 + em) - (sh * 60 + sm)) / 60
      }, 0)
    const daysInRange = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    const availableHoursInPeriod = weeklyHours * (daysInRange / 7)
    const occupancyPercent = availableHoursInPeriod > 0
      ? Math.min(100, Math.round((hoursWorked / availableHoursInPeriod) * 100))
      : 0

    const monthlyRevenue = []
    if (period === 'day') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
        const dStr = toDateStr(d)
        const bucket = allFinished.filter(a => a.date === dStr)
        monthlyRevenue.push({
          label:    d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
          revenue:  bucket.reduce((s, a) => s + Number(a.servicePrice), 0),
          services: bucket.length,
        })
      }
    } else if (period === 'week') {
      for (let i = 5; i >= 0; i--) {
        const ref = new Date(now)
        ref.setDate(ref.getDate() - i * 7)
        const { start: wStart, end: wEnd } = getRange('week', ref)
        const wStartStr = toDateStr(wStart), wEndStr = toDateStr(wEnd)
        const bucket = allFinished.filter(a => a.date >= wStartStr && a.date <= wEndStr)
        monthlyRevenue.push({
          label:    `${wStart.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`,
          revenue:  bucket.reduce((s, a) => s + Number(a.servicePrice), 0),
          services: bucket.length,
        })
      }
    } else if (period === 'year') {
      for (let i = 4; i >= 0; i--) {
        const year = now.getFullYear() - i
        const yStartStr = `${year}-01-01`
        const yEndStr   = `${year}-12-31`
        const bucket = allFinished.filter(a => a.date >= yStartStr && a.date <= yEndStr)
        monthlyRevenue.push({
          label:    String(year),
          revenue:  bucket.reduce((s, a) => s + Number(a.servicePrice), 0),
          services: bucket.length,
        })
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const dStartStr = toDateStr(d)
        const dEndStr   = toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0))
        const bucket = allFinished.filter(a => a.date >= dStartStr && a.date <= dEndStr)
        monthlyRevenue.push({
          label:    d.toLocaleDateString('es-AR', { month: 'short' }),
          revenue:  bucket.reduce((s, a) => s + Number(a.servicePrice), 0),
          services: bucket.length,
        })
      }
    }

    const byService = new Map<string, { name: string; count: number; revenue: number }>()
    for (const a of inPeriod) {
      const b = byService.get(a.serviceId) ?? { name: a.service.name, count: 0, revenue: 0 }
      b.count += 1
      b.revenue += Number(a.servicePrice)
      byService.set(a.serviceId, b)
    }
    const topServices = Array.from(byService.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }))

    const byHour = new Map<string, number>()
    for (const a of inPeriod) {
      const hour = `${a.time.split(':')[0]}:00`
      byHour.set(hour, (byHour.get(hour) ?? 0) + 1)
    }
    const peakHours = Array.from(byHour.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, count]) => ({ hour, count }))

    return {
      monthRevenue: periodRevenue, monthServices: periodServices, totalClients, avgRating,
      hoursWorked, occupancyPercent, monthlyRevenue, topServices, peakHours,
    }
  },
}
