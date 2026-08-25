// src/modules/admin/dashboard.service.ts
import { prisma } from '../../app/database/prisma'

export type PeriodFilter = 'day' | 'week' | 'month' | 'year'

const PALETTE = ['#069494', '#d4af37', '#e57373', '#7986cb', '#4db6ac', '#f06292', '#a1887f', '#90a4ae']
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', finished: 'Finalizado', cancelled: 'Cancelado', no_show: 'No asistió',
}
const STATUS_COLOR: Record<string, string> = {
  pending: '#d4af37', confirmed: '#069494', finished: '#4caf50', cancelled: '#e53935', no_show: '#888888',
}
const PAYMENT_LABEL: Record<string, string> = {
  pending: 'Pendiente', partial: 'Seña pagada', paid: 'Pagado completo', refunded: 'Reembolsado',
}
const PAYMENT_COLOR: Record<string, string> = {
  pending: '#d4af37', partial: '#069494', paid: '#4caf50', refunded: '#e53935',
}

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function endOfDay(d: Date) { const e = new Date(d); e.setHours(23, 59, 59, 999); return e }

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

function getPrevRange(period: PeriodFilter, start: Date, end: Date): { start: Date; end: Date } {
  if (period === 'month') {
    const prevStart = new Date(start)
    prevStart.setMonth(prevStart.getMonth() - 1)
    const prevEnd = new Date(prevStart.getFullYear(), prevStart.getMonth() + 1, 0)
    return { start: prevStart, end: prevEnd }
  }
  if (period === 'year') {
    return { start: new Date(start.getFullYear() - 1, 0, 1), end: new Date(start.getFullYear() - 1, 11, 31) }
  }
  const lengthMs = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000)
  const prevStart = new Date(prevEnd.getTime() - lengthMs)
  return { start: prevStart, end: prevEnd }
}

export const dashboardService = {

  compute: async (period: PeriodFilter) => {
    const { start, end } = getRange(period)
    const { start: prevStart, end: prevEnd } = getPrevRange(period, start, end)
    const startStr = toDateStr(start), endStr = toDateStr(end)
    const prevStartStr = toDateStr(prevStart), prevEndStr = toDateStr(prevEnd)

    const [allInRange, prevFinished, newClients, prevNewClients] = await Promise.all([
      prisma.appointment.findMany({
        where:   { date: { gte: startStr, lte: endStr } },
        include: { professional: true, service: true },
      }),
      prisma.appointment.findMany({
        where: { status: 'finished', date: { gte: prevStartStr, lte: prevEndStr } },
      }),
      prisma.user.count({ where: { role: 'client', createdAt: { gte: start, lte: endOfDay(end) } } }),
      prisma.user.count({ where: { role: 'client', createdAt: { gte: prevStart, lte: endOfDay(prevEnd) } } }),
    ])

    const byProf    = new Map<string, { name: string; appointments: number; revenue: number; cancellations: number }>()
    const byService = new Map<string, { name: string; count: number; revenue: number }>()
    const byDate    = new Map<string, { revenue: number; appointments: number }>()
    const byPayment = new Map<string, number>()
    const statusCounts = new Map<string, number>()

    const todayStr = toDateStr(new Date())

    let totalRevenue = 0
    let totalAppointments = 0

    for (const a of allInRange) {
      statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1)

      const profBucket = byProf.get(a.professionalId) ?? { name: a.professional.name, appointments: 0, revenue: 0, cancellations: 0 }
      if (a.status === 'cancelled') profBucket.cancellations += 1
      byProf.set(a.professionalId, profBucket)

      // Popularidad de servicios: se cuenta toda reserva del período, no solo las concretadas
      // (si no, un servicio recién reservado y aún no finalizado nunca aparecería en el ranking).
      const svcBucket = byService.get(a.serviceId) ?? { name: a.service.name, count: 0, revenue: 0 }
      svcBucket.count += 1
      byService.set(a.serviceId, svcBucket)

      // Distribución por estado de pago: la seña se cobra al reservar, no al finalizar el turno,
      // así que esto también se calcula sobre todo el período (no solo turnos finalizados).
      const paymentAmount =
        a.paymentStatus === 'paid'    ? Number(a.servicePrice) :
        a.paymentStatus === 'partial' ? Number(a.depositAmount) :
        a.paymentStatus === 'refunded' ? Number(a.depositAmount) : 0
      byPayment.set(a.paymentStatus, (byPayment.get(a.paymentStatus) ?? 0) + paymentAmount)

      // Ingresos realizados: solo turnos finalizados, y nunca con fecha futura a hoy
      // (una fecha futura marcada "finished" sería un dato inconsistente, no ingreso real).
      if (a.status !== 'finished' || a.date > todayStr) continue
      const price = Number(a.servicePrice)
      totalRevenue += price
      totalAppointments += 1
      profBucket.appointments += 1
      profBucket.revenue += price
      svcBucket.revenue += price

      const dateBucket = byDate.get(a.date) ?? { revenue: 0, appointments: 0 }
      dateBucket.revenue += price
      dateBucket.appointments += 1
      byDate.set(a.date, dateBucket)
    }

    const prevRevenue      = prevFinished.reduce((s, a) => s + Number(a.servicePrice), 0)
    const prevAppointments = prevFinished.length
    const avgTicket        = totalAppointments ? totalRevenue / totalAppointments : 0
    const prevAvgTicket    = prevAppointments ? prevRevenue / prevAppointments : 0

    const revenueChart = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        label: new Date(`${date}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
        revenue: v.revenue, appointments: v.appointments,
      }))

    const serviceStats = Array.from(byService.values())
      .map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }))

    const professionalStats = Array.from(byProf.values())
      .map((p, i) => ({ ...p, color: PALETTE[i % PALETTE.length] }))

    const appointmentStatus = Array.from(statusCounts.entries())
      .map(([status, count]) => ({ status, label: STATUS_LABEL[status] ?? status, count, color: STATUS_COLOR[status] ?? '#999' }))

    const paymentStats = Array.from(byPayment.entries())
      .map(([k, amount]) => ({ label: PAYMENT_LABEL[k] ?? k, amount, color: PAYMENT_COLOR[k] ?? '#999' }))

    return {
      totalRevenue, prevRevenue, totalAppointments, prevAppointments,
      newClients, prevNewClients, avgTicket, prevAvgTicket,
      revenueChart, serviceStats, professionalStats, appointmentStatus, paymentStats,
    }
  },
}
