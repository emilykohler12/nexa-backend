// src/modules/professionals/dashboard.service.ts
import { prisma } from '../../app/database/prisma'

export type PeriodFilter = 'day' | 'week' | 'month' | 'year'

// Bloques horarios del mapa de calor — mismos límites que el heatmap del admin
// (ver admin/dashboard.service.ts), para que ambos lean igual.
const TIME_BLOCKS = [
  { key: 'morning',   end: '13:00' },
  { key: 'afternoon', end: '17:00' },
  { key: 'evening',   end: '24:00' },
] as const

const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
// 0=lunes..6=domingo (igual que ProfessionalAvailability.dayOfWeek), distinto
// del 0=domingo nativo de Date.getDay().
function isoWeekday(d: Date) { return (d.getDay() + 6) % 7 }
function timeBlockOf(time: string): typeof TIME_BLOCKS[number]['key'] {
  return TIME_BLOCKS.find(b => time < b.end)?.key ?? 'evening'
}
function minutesOf(range: { startTime: string; endTime: string }): number {
  const [sh, sm] = range.startTime.split(':').map(Number)
  const [eh, em] = range.endTime.split(':').map(Number)
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
}

// Mismo cálculo de rango que admin/dashboard.service.ts y statistics.service.ts —
// se duplica a propósito (cada módulo ya lo hacía así) en vez de compartir un
// helper cruzado entre módulos.
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

export const professionalDashboardService = {

  compute: async (professionalId: string, period: PeriodFilter = 'month') => {
    const { start, end } = getRange(period)
    const startStr = toDateStr(start), endStr = toDateStr(end)
    const todayStr = toDateStr(new Date())

    const [inRange, professional, reviews, holidaysInRange] = await Promise.all([
      prisma.appointment.findMany({
        where:   { professionalId, date: { gte: startStr, lte: endStr } },
        include: { service: true },
      }),
      prisma.professional.findUnique({
        where:   { userId: professionalId },
        include: { availability: { where: { active: true } } },
      }),
      // Promedio de TODAS las reseñas, sin filtro de período — igual que en el
      // resto del sistema (Rendimiento del admin, ficha pública, estadísticas viejas).
      prisma.review.findMany({ where: { appointment: { professionalId } }, select: { rating: true } }),
      prisma.businessHoliday.findMany({ where: { date: { gte: startStr, lte: endStr } }, select: { date: true } }),
    ])

    let futureConfirmedAppointments = 0
    let hoursWorked = 0
    let totalRevenue = 0
    let bookedMinutes = 0

    const byService = new Map<string, { name: string; attended: number; revenue: number; cancelled: number }>()
    const heatmap: Record<number, Record<string, number>> = {}
    for (let d = 0; d < 6; d++) heatmap[d] = { morning: 0, afternoon: 0, evening: 0 }

    for (const a of inRange) {
      const svcBucket = byService.get(a.serviceId) ?? { name: a.service.name, attended: 0, revenue: 0, cancelled: 0 }

      if (a.status === 'cancelled') {
        svcBucket.cancelled += 1
      } else {
        bookedMinutes += a.duration
        const weekday = isoWeekday(new Date(`${a.date}T00:00:00`))
        if (weekday < 6) heatmap[weekday][timeBlockOf(a.time)] += 1
      }

      if (a.status === 'confirmed' && ['partial', 'paid'].includes(a.paymentStatus) && a.date >= todayStr) {
        futureConfirmedAppointments += 1
      }

      // "Realizado" = finalizado y nunca con fecha futura a hoy (dato inconsistente si lo fuera).
      if (a.status === 'finished' && a.date <= todayStr) {
        hoursWorked += a.duration / 60
        totalRevenue += Number(a.servicePrice)
        svcBucket.attended += 1
        svcBucket.revenue += Number(a.servicePrice)
      }

      byService.set(a.serviceId, svcBucket)
    }

    // ── Ocupación de agenda del profesional en el período elegido ──────
    const holidaySet = new Set(holidaysInRange.map(h => h.date))
    const availability = professional?.availability ?? []
    const vacationFrom = professional?.vacationFrom ? toDateStr(professional.vacationFrom) : null
    const vacationTo   = professional?.vacationTo   ? toDateStr(professional.vacationTo)   : null

    let availableMinutes = 0
    const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      const dateStr = toDateStr(d)
      if (holidaySet.has(dateStr)) continue
      if (vacationFrom && vacationTo && dateStr >= vacationFrom && dateStr <= vacationTo) continue
      const weekday = isoWeekday(d)
      for (const range of availability) {
        if (range.dayOfWeek === weekday) availableMinutes += minutesOf(range)
      }
    }
    const occupancyPercent = availableMinutes > 0
      ? Math.round((bookedMinutes / availableMinutes) * 1000) / 10
      : 0

    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : 0

    const serviceStats = Array.from(byService.values())
      .sort((a, b) => b.attended - a.attended)

    const heatmapData = Array.from({ length: 6 }, (_, weekday) => ({
      day: WEEKDAY_LABELS[weekday],
      morning:   heatmap[weekday].morning,
      afternoon: heatmap[weekday].afternoon,
      evening:   heatmap[weekday].evening,
    }))

    return {
      futureConfirmedAppointments,
      hoursWorked: Math.round(hoursWorked * 10) / 10,
      occupancyPercent,
      totalRevenue,
      avgRating,
      serviceStats,
      heatmap: heatmapData,
    }
  },
}
