// src/jobs/inactivityReminder.job.ts
//
// Corre una vez por día (ver scheduler.ts): busca clientes cuyo turno más
// reciente (de cualquier estado) tiene 60+ días, o que nunca reservaron y se
// registraron hace 60+ días, y les manda un mail de "te extrañamos". No se
// re-envía todos los días mientras el cliente sigue inactivo — se respeta un
// cooldown de 60 días desde el último recordatorio (Client.lastInactivityReminderAt).
import fs   from 'fs'
import path from 'path'
import { prisma }   from '../app/database/prisma'
import { mailProvider }    from '../modules/auth/providers/mail.provider'
import { activityService } from '../modules/activity/activity.service'

const INACTIVITY_DAYS = 60
const COOLDOWN_DAYS   = 60

function loadTemplate(name: string, replacements: Record<string, string>): string {
  const candidates = [
    path.join(__dirname, 'templates', `${name}.html`),
    path.join(process.cwd(), 'src', 'jobs', 'templates', `${name}.html`),
    path.join(process.cwd(), 'dist', 'jobs', 'templates', `${name}.html`),
  ]

  let html: string | null = null
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      html = fs.readFileSync(filePath, 'utf8')
      break
    }
  }
  if (!html) {
    throw new Error(`No se encontró el template "${name}.html". Rutas buscadas:\n${candidates.join('\n')}`)
  }

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(`{{${key}}}`, value)
  }
  return html
}

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

export async function runInactivityReminderJob(): Promise<{ eligible: number; sent: number; failed: number }> {
  const cutoffDateStr   = toDateStr(daysAgo(INACTIVITY_DAYS)) // turnos con date < esto = "60+ días"
  const cutoffCreatedAt = daysAgo(INACTIVITY_DAYS)            // sin ningún turno, pero registrado antes de esto
  const cooldownSince   = daysAgo(COOLDOWN_DAYS)

  const clients = await prisma.user.findMany({
    where:   { role: 'client', active: true },
    include: { client: true },
  })
  if (clients.length === 0) return { eligible: 0, sent: 0, failed: 0 }

  // Último turno (por fecha) de cada cliente, en un solo query en vez de N+1.
  const maxDates = await prisma.appointment.groupBy({
    by:     ['clientId'],
    where:  { clientId: { in: clients.map(c => c.id) } },
    _max:   { date: true },
  })
  const lastAppointmentDateByClient = new Map(maxDates.map(m => [m.clientId, m._max.date]))

  let sent = 0
  let failed = 0
  const eligibleClients = clients.filter(user => {
    if (user.client?.blocked) return false

    const lastReminder = user.client?.lastInactivityReminderAt ?? null
    if (lastReminder && lastReminder >= cooldownSince) return false

    const lastAppointmentDate = lastAppointmentDateByClient.get(user.id)
    if (lastAppointmentDate) return lastAppointmentDate < cutoffDateStr
    return user.createdAt < cutoffCreatedAt
  })

  for (const user of eligibleClients) {
    try {
      await mailProvider.send(
        user.email,
        'Te extrañamos — Nexa',
        loadTemplate('inactivityReminder', { CLIENT_NAME: user.name }),
      )
      await prisma.client.upsert({
        where:  { userId: user.id },
        create: { userId: user.id, lastInactivityReminderAt: new Date() },
        update: { lastInactivityReminderAt: new Date() },
      })
      sent++
    } catch (err: any) {
      failed++
      console.error(`[inactivity-reminder] error mandando mail a ${user.email}:`, err?.message ?? err)
    }
  }

  if (sent > 0 || failed > 0) {
    await activityService.log({
      action: `Recordatorio de inactividad: ${sent} enviado${sent !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} con error` : ''}`,
      module: 'system',
      detail: `${eligibleClients.length} cliente${eligibleClients.length !== 1 ? 's' : ''} elegible${eligibleClients.length !== 1 ? 's' : ''} (60+ días sin reservar, fuera del cooldown de ${COOLDOWN_DAYS} días).`,
    })
  }

  return { eligible: eligibleClients.length, sent, failed }
}
