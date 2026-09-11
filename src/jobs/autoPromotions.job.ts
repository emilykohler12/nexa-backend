// src/jobs/autoPromotions.job.ts
//
// Corre una vez por día (ver scheduler.ts): evalúa las campañas automáticas
// activas (AutoPromotion — cumpleaños, "turno número N", etc.) y le manda un
// mail con el descuento a cada cliente que corresponda, sin repetir el mismo
// envío (AutoPromotionSend). Nunca toca el home — esto es 100% interno.
import fs   from 'fs'
import path from 'path'
import { prisma }          from '../app/database/prisma'
import { mailProvider }    from '../modules/auth/providers/mail.provider'
import { activityService } from '../modules/activity/activity.service'
import { autoPromotionModel } from '../modules/promotions/autoPromotion.model'

type ClientRow = { id: string; name: string; email: string; birthDate: Date | null }

function loadTemplate(name: string, replacements: Record<string, string>): string {
  const candidates = [
    path.join(__dirname, 'templates', `${name}.html`),
    path.join(process.cwd(), 'src', 'jobs', 'templates', `${name}.html`),
    path.join(process.cwd(), 'dist', 'jobs', 'templates', `${name}.html`),
  ]
  let html: string | null = null
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) { html = fs.readFileSync(filePath, 'utf8'); break }
  }
  if (!html) throw new Error(`No se encontró el template "${name}.html". Rutas buscadas:\n${candidates.join('\n')}`)
  for (const [key, value] of Object.entries(replacements)) html = html.replaceAll(`{{${key}}}`, value)
  return html
}

function pad(n: number) { return String(n).padStart(2, '0') }
function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function discountText(discountType: string, discountValue: number): string {
  return discountType === 'percent'
    ? `${discountValue}% de descuento`
    : `$${discountValue.toLocaleString('es-AR')} de descuento`
}

// Pool de clientes al que le puede tocar esta campaña, según audienceType —
// todavía sin filtrar por el trigger (cumpleaños / turno N).
async function resolveAudience(rule: { audienceType: string; audienceClientIds: string[]; audienceCategoryId: string | null }): Promise<ClientRow[]> {
  if (rule.audienceType === 'manual') {
    if (rule.audienceClientIds.length === 0) return []
    const users = await prisma.user.findMany({
      where:   { id: { in: rule.audienceClientIds }, role: 'client' },
      include: { client: true },
    })
    return users.map(u => ({ id: u.id, name: u.name, email: u.email, birthDate: u.client?.birthDate ?? null }))
  }

  if (rule.audienceType === 'category') {
    if (!rule.audienceCategoryId) return []
    const rows = await prisma.appointment.findMany({
      where:    { service: { categoryId: rule.audienceCategoryId } },
      select:   { clientId: true },
      distinct: ['clientId'],
    })
    const ids = rows.map(r => r.clientId)
    if (ids.length === 0) return []
    const users = await prisma.user.findMany({
      where:   { id: { in: ids }, role: 'client', active: true },
      include: { client: true },
    })
    return users.map(u => ({ id: u.id, name: u.name, email: u.email, birthDate: u.client?.birthDate ?? null }))
  }

  // 'all'
  const users = await prisma.user.findMany({
    where:   { role: 'client', active: true },
    include: { client: true },
  })
  return users.map(u => ({ id: u.id, name: u.name, email: u.email, birthDate: u.client?.birthDate ?? null }))
}

// Filtra el pool según el trigger y devuelve, para cada cliente que corresponde
// hoy, la "periodKey" que evita reenviar (año para cumpleaños, "once" para hito).
async function matchTrigger(
  rule: { trigger: string; triggerConfig: Record<string, number> },
  pool: ClientRow[],
): Promise<{ client: ClientRow; periodKey: string }[]> {
  if (rule.trigger === 'birthday') {
    const daysBefore = rule.triggerConfig.daysBefore ?? 0
    const target = addDays(new Date(), daysBefore)
    const targetMonth = target.getMonth()
    const targetDate  = target.getDate()
    const year = String(new Date().getFullYear())
    return pool
      .filter(c => c.birthDate && c.birthDate.getUTCMonth() === targetMonth && c.birthDate.getUTCDate() === targetDate)
      .map(c => ({ client: c, periodKey: year }))
  }

  if (rule.trigger === 'appointment_milestone') {
    const count = rule.triggerConfig.count
    if (!count || pool.length === 0) return []
    const counts = await prisma.appointment.groupBy({
      by:     ['clientId'],
      where:  { clientId: { in: pool.map(c => c.id) }, status: { not: 'cancelled' } },
      _count: { id: true },
    })
    const countByClient = new Map(counts.map(c => [c.clientId, c._count.id]))
    return pool
      .filter(c => countByClient.get(c.id) === count)
      .map(c => ({ client: c, periodKey: 'once' }))
  }

  return []
}

export async function runAutoPromotionsJob(): Promise<{ rules: number; sent: number; failed: number }> {
  const rules = await autoPromotionModel.findActive()
  if (rules.length === 0) return { rules: 0, sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  for (const rule of rules) {
    const pool    = await resolveAudience(rule)
    const matches = await matchTrigger({ trigger: rule.trigger, triggerConfig: (rule.triggerConfig ?? {}) as Record<string, number> }, pool)

    for (const { client, periodKey } of matches) {
      try {
        // findUnique con la clave compuesta evita reenviar (cumpleaños ya
        // mandado este año / hito ya mandado alguna vez).
        const already = await prisma.autoPromotionSend.findUnique({
          where: { autoPromotionId_clientId_periodKey: { autoPromotionId: rule.id, clientId: client.id, periodKey } },
        })
        if (already) continue

        const discount = discountText(rule.discountType, Number(rule.discountValue))
        await mailProvider.send(
          client.email,
          rule.trigger === 'birthday' ? '¡Feliz cumpleaños! — Nexa' : 'Tenés un descuento esperándote — Nexa',
          loadTemplate('autoPromotion', {
            TITLE:          rule.trigger === 'birthday' ? 'Feliz cumpleaños' : '¡Gracias por elegirnos',
            CLIENT_NAME:    client.name,
            INTRO:          rule.trigger === 'birthday'
              ? 'Para celebrar tu cumpleaños, te dejamos un descuento especial.'
              : 'Como agradecimiento por tu confianza, te dejamos un descuento especial.',
            DISCOUNT_TEXT:  discount,
            MESSAGE_BLOCK:  rule.message
              ? `<p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px;">${rule.message}</p>`
              : '',
          }),
        )
        await prisma.autoPromotionSend.create({ data: { autoPromotionId: rule.id, clientId: client.id, periodKey } })
        sent++
      } catch (err: any) {
        failed++
        console.error(`[auto-promotions] error mandando "${rule.name}" a ${client.email}:`, err?.message ?? err)
      }
    }
  }

  if (sent > 0 || failed > 0) {
    await activityService.log({
      action: `Campañas automáticas: ${sent} enviada${sent !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} con error` : ''}`,
      module: 'system',
      detail: `${rules.length} campaña${rules.length !== 1 ? 's' : ''} activa${rules.length !== 1 ? 's' : ''} evaluada${rules.length !== 1 ? 's' : ''}.`,
    })
  }

  return { rules: rules.length, sent, failed }
}
