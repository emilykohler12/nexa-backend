// src/modules/contact/contact.service.ts
import { z } from 'zod'
import { prisma } from '../../app/database/prisma'
import { env } from '../../app/config/env'
import { mailProvider } from '../auth/providers/mail.provider'

export interface JobInterestData {
  name?:    string | null
  email?:   string | null
  phone?:   string | null
  message?: string | null
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

// Correo del estudio: el que la dueña carga en Configuración > Negocio (BusinessSettings.email) y,
// si todavía está vacío o no es válido, ADMIN_EMAIL (variable que ya existe y es obligatoria).
export async function resolveStudioEmail(): Promise<string> {
  const settings = await prisma.businessSettings.findFirst({ select: { email: true } })
  const fromSettings = settings?.email?.trim() ?? ''
  if (fromSettings && z.string().email().safeParse(fromSettings).success) return fromSettings
  return env.ADMIN_EMAIL
}

function buildHtml(data: JobInterestData): string {
  const row = (label: string, value?: string | null) => `
    <tr>
      <td style="padding:6px 12px 6px 0;color:#666;font-size:14px;vertical-align:top;white-space:nowrap;">${label}</td>
      <td style="padding:6px 0;color:#1a1a1a;font-size:15px;white-space:pre-wrap;">${value ? escapeHtml(value) : '<em style="color:#999;">No indicado</em>'}</td>
    </tr>`
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 16px;color:#1a1a1a;">Nueva postulación — Trabajá con nosotras</h2>
      <table style="border-collapse:collapse;width:100%;">
        ${row('Nombre', data.name)}
        ${row('Correo', data.email)}
        ${row('Teléfono', data.phone)}
        ${row('Mensaje', data.message)}
      </table>
    </div>`
}

export const contactService = {
  // Lanza si el envío falla: el controller no responde 201 en ese caso.
  sendJobInterest: async (data: JobInterestData): Promise<void> => {
    const to = await resolveStudioEmail()
    await mailProvider.send(to, 'Nueva postulación — Trabajá con nosotras', buildHtml(data))
  },
}
