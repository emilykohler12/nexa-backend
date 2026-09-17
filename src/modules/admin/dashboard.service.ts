// src/modules/admin/dashboard.service.ts
import { prisma } from '../../app/database/prisma'

export type PeriodFilter = 'day' | 'week' | 'month' | 'year'

const PALETTE = ['#069494', '#d4af37', '#e57373', '#7986cb', '#4db6ac', '#f06292', '#a1887f', '#90a4ae']

// Ventana para "clientes nuevos que volvieron a agendar" — fija por ahora, no
// hay ningún control en el admin para configurarla.
const RETURNING_WINDOW_DAYS = 30

// Bloques horarios del mapa de calor — límites elegidos para un salón típico,
// no vienen de ninguna configuración del negocio.
const TIME_BLOCKS = [
  { key: 'morning',   label: 'Mañana', end: '13:00' },
  { key: 'afternoon', label: 'Siesta', end: '17:00' },
  { key: 'evening',   label: 'Tarde',  end: '24:00' },
] as const

const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function endOfDay(d: Date) { const e = new Date(d); e.setHours(23, 59, 59, 999); return e }
// La disponibilidad usa 0=lunes..6=domingo (ver DAY_KEYS en professional.service.ts),
// distinto del 0=domingo nativo de Date.getDay().
function isoWeekday(d: Date) { return (d.getDay() + 6) % 7 }
function timeBlockOf(time: string): typeof TIME_BLOCKS[number]['key'] {
  return TIME_BLOCKS.find(b => time < b.end)?.key ?? 'evening'
}
function minutesOf(range: { startTime: string; endTime: string }): number {
  const [sh, sm] = range.startTime.split(':').map(Number)
  const [eh, em] = range.endTime.split(':').map(Number)
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
}

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

export const dashboardService = {

  compute: async (period: PeriodFilter) => {
    const { start, end } = getRange(period)
    const startStr = toDateStr(start), endStr = toDateStr(end)
    const todayStr = toDateStr(new Date())

    const [allInRange, newClientUsers, professionals, holidaysInRange] = await Promise.all([
      prisma.appointment.findMany({
        where:   { date: { gte: startStr, lte: endStr } },
        include: { professional: true, service: true },
      }),
      // "Nuevos" = se registraron en el período Y llegaron a reservar al menos
      // un turno (si solo se registró pero nunca reservó, no cuenta acá).
      prisma.user.findMany({
        where:  { role: 'client', createdAt: { gte: start, lte: endOfDay(end) }, appointmentsAsClient: { some: {} } },
        select: { id: true },
      }),
      prisma.professional.findMany({
        where:   { user: { active: true, role: { in: ['professional', 'admin'] } } },
        select:  { vacationFrom: true, vacationTo: true, availability: { where: { active: true }, select: { dayOfWeek: true, startTime: true, endTime: true } } },
      }),
      prisma.businessHoliday.findMany({ where: { date: { gte: startStr, lte: endStr } }, select: { date: true } }),
    ])

    const newClientIds = newClientUsers.map(u => u.id)
    const holidaySet = new Set(holidaysInRange.map(h => h.date))

    // ── Capacidad de agenda (para % de ocupación) ─────────────────────
    let availableMinutes = 0
    const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      const dateStr = toDateStr(d)
      if (holidaySet.has(dateStr)) continue
      const weekday = isoWeekday(d)
      for (const prof of professionals) {
        if (prof.vacationFrom && prof.vacationTo && dateStr >= toDateStr(prof.vacationFrom) && dateStr <= toDateStr(prof.vacationTo)) continue
        for (const range of prof.availability) {
          if (range.dayOfWeek === weekday) availableMinutes += minutesOf(range)
        }
      }
    }

    // ── Agregaciones por turno ─────────────────────────────────────────
    const byProf = new Map<string, {
      name: string; attended: number; hoursWorked: number; revenue: number; cancelled: number
    }>()
    const byService = new Map<string, {
      name: string; categoryId: string; realized: number; depositRevenue: number; totalRevenue: number; cancelled: number
    }>()
    // día ISO (0=lunes..6=domingo) x bloque horario
    const heatmap: Record<number, Record<string, number>> = {}
    for (let d = 0; d < 6; d++) heatmap[d] = { morning: 0, afternoon: 0, evening: 0 }

    let depositRevenueTotal = 0
    let attendedAppointments = 0
    let noShowAppointments = 0
    let refundedDeposits = 0
    let pendingBalance = 0
    let bookedMinutes = 0
    let withPromotion = 0
    let withoutPromotion = 0
    const categoryRevenueMap = new Map<string, number>()

    for (const a of allInRange) {
      const price = Number(a.servicePrice)

      const profBucket = byProf.get(a.professionalId) ?? { name: a.professional.name, attended: 0, hoursWorked: 0, revenue: 0, cancelled: 0 }
      const svcBucket   = byService.get(a.serviceId)   ?? { name: a.service.name, categoryId: a.service.categoryId, realized: 0, depositRevenue: 0, totalRevenue: 0, cancelled: 0 }

      if (a.status === 'cancelled') {
        profBucket.cancelled += 1
        svcBucket.cancelled  += 1
      } else {
        bookedMinutes += a.duration
        // Domingo (weekday 6) queda fuera del mapa de calor: Lunes a Sábado únicamente.
        const weekday = isoWeekday(new Date(`${a.date}T00:00:00`))
        if (weekday < 6) heatmap[weekday][timeBlockOf(a.time)] += 1
      }

      if (a.status === 'no_show') noShowAppointments += 1

      if (a.paymentStatus === 'partial' || a.paymentStatus === 'paid') {
        depositRevenueTotal += Number(a.depositAmount)
        svcBucket.depositRevenue += Number(a.depositAmount)
      }
      if (a.paymentStatus === 'refunded') refundedDeposits += 1
      if (a.paymentStatus === 'partial' && ['confirmed', 'finished'].includes(a.status)) {
        pendingBalance += price - Number(a.depositAmount)
      }

      if (a.promotionId) withPromotion += 1
      else withoutPromotion += 1

      // Ingresos/rendimiento "reales": solo turnos finalizados y nunca con fecha
      // futura a hoy (una fecha futura marcada "finished" sería un dato inconsistente).
      if (a.status === 'finished' && a.date <= todayStr) {
        attendedAppointments += 1
        profBucket.attended += 1
        profBucket.hoursWorked += a.duration / 60
        profBucket.revenue += price
        svcBucket.realized += 1
        svcBucket.totalRevenue += price
        categoryRevenueMap.set(a.service.categoryId, (categoryRevenueMap.get(a.service.categoryId) ?? 0) + price)
      }

      byProf.set(a.professionalId, profBucket)
      byService.set(a.serviceId, svcBucket)
    }

    const occupancyPercent = availableMinutes > 0 ? Math.round((bookedMinutes / availableMinutes) * 1000) / 10 : 0

    // ── Clientes nuevos que volvieron a agendar dentro de la ventana ───
    let returningClients = 0
    if (newClientIds.length > 0) {
      const clientAppointments = await prisma.appointment.findMany({
        where:   { clientId: { in: newClientIds }, status: { not: 'cancelled' } },
        select:  { clientId: true, date: true },
        orderBy: [{ date: 'asc' }],
      })
      const byClient = new Map<string, string[]>()
      for (const a of clientAppointments) {
        const list = byClient.get(a.clientId) ?? []
        list.push(a.date)
        byClient.set(a.clientId, list)
      }
      for (const dates of byClient.values()) {
        if (dates.length < 2) continue
        const first  = new Date(`${dates[0]}T00:00:00`)
        const second = new Date(`${dates[1]}T00:00:00`)
        const diffDays = (second.getTime() - first.getTime()) / 86_400_000
        if (diffDays <= RETURNING_WINDOW_DAYS) returningClients += 1
      }
    }

    // ── Productos más vendidos (pedidos de tienda pagados) ─────────────
    const productOrders = await prisma.productOrder.findMany({
      where:   { createdAt: { gte: start, lte: endOfDay(end) }, order: { paymentStatus: 'paid' } },
      include: { product: { select: { name: true } } },
    })
    const byProduct = new Map<string, { name: string; quantity: number; revenue: number }>()
    for (const po of productOrders) {
      const bucket = byProduct.get(po.productId) ?? { name: po.product.name, quantity: 0, revenue: 0 }
      bucket.quantity += po.quantity
      bucket.revenue  += Number(po.totalPrice)
      byProduct.set(po.productId, bucket)
    }
    const topProducts = Array.from(byProduct.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8)
      .map((p, i) => ({ ...p, color: PALETTE[i % PALETTE.length] }))

    const categoryRevenue = Array.from(categoryRevenueMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([categoryId, revenue], i) => ({ categoryId, revenue, color: PALETTE[i % PALETTE.length] }))

    const heatmapData = Array.from({ length: 6 }, (_, weekday) => ({
      day: WEEKDAY_LABELS[weekday],
      morning:   heatmap[weekday].morning,
      afternoon: heatmap[weekday].afternoon,
      evening:   heatmap[weekday].evening,
    }))

    const promotionConversion = [
      { label: 'Con promoción',    count: withPromotion },
      { label: 'Precio de lista',  count: withoutPromotion },
    ]

    // Top 10 por turnos realizados (asistidos) — no por facturación, que es un
    // ranking de rentabilidad distinto al de popularidad/volumen atendido.
    const serviceProfitability = Array.from(byService.values())
      .map(s => ({
        name: s.name, categoryId: s.categoryId, realized: s.realized,
        depositRevenue: s.depositRevenue, totalRevenue: s.totalRevenue, cancelled: s.cancelled,
      }))
      .sort((a, b) => b.realized - a.realized)
      .slice(0, 10)

    const professionalPerformance = Array.from(byProf.values())
      .map(p => ({
        name: p.name, attended: p.attended,
        hoursWorked: Math.round(p.hoursWorked * 10) / 10,
        revenue: p.revenue, cancelled: p.cancelled,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return {
      // KPIs superiores
      depositRevenueTotal,
      attendedAppointments,
      newClients: newClientIds.length,
      occupancyPercent,

      // Gráficos
      topProducts,
      categoryRevenue,
      heatmap: heatmapData,
      promotionConversion,

      // Tablas
      serviceProfitability,
      professionalPerformance,

      // KPIs inferiores
      noShowAppointments,
      returningClients,
      returningWindowDays: RETURNING_WINDOW_DAYS,
      pendingBalance,
      refundedDeposits,
    }
  },
}
