//src/modules/auth/providers/mail.provider.ts
//
// TODOS los mails de la app salen por acá (verificación de email, código de recuperación, turnos,
// invitaciones, campañas y recordatorios): ningún otro módulo habla con un servidor de correo.
//
// Producción (Render): con BREVO_API_KEY se envía por la API HTTPS de Brevo. No se puede usar SMTP
// porque Render bloquea los puertos 25, 465 y 587 en los servicios gratuitos (los mails fallaban con
// ETIMEDOUT / ENETUNREACH). Sin BREVO_API_KEY (desarrollo local) se usa SMTP con nodemailer.
//
// El remitente es siempre MAIL_FROM (kologic6@gmail.com por defecto) y debe estar verificado como
// remitente en Brevo.

import nodemailer from 'nodemailer'
import { env } from '../../../app/config/env'
import { maskEmail } from '../../../app/utils/maskEmail'

const FROM_NAME = 'Nexa'
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const BREVO_TIMEOUT_MS = 15_000

type Transporter = ReturnType<typeof nodemailer.createTransport>
let smtpTransporter: Transporter | null = null

// El transporte SMTP se crea recién la primera vez que hace falta: con Brevo no se abre ninguna
// conexión SMTP ni se registran errores de conexión en el arranque.
function getSmtpTransporter(): Transporter {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: env.MAIL_PORT === 465,
      auth: { user: env.MAIL_USER, pass: env.MAIL_PASS },
    })
    smtpTransporter.verify((error) => {
      if (error) {
        console.error('[mail] ❌ Error de conexión SMTP:')
        console.error(error)
      } else {
        console.log(`[mail] ✅ SMTP listo: ${env.MAIL_USER}`)
      }
    })
  }
  return smtpTransporter
}

async function sendWithBrevo(to: string, subject: string, html: string): Promise<{ messageId?: string }> {
  const res = await fetch(BREVO_URL, {
    method:  'POST',
    headers: { 'api-key': env.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
    body:    JSON.stringify({
      sender:      { name: FROM_NAME, email: env.MAIL_FROM },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
  })

  if (!res.ok) {
    // Solo el código y el mensaje que devuelve Brevo; nunca la clave ni el cuerpo del mail.
    const detail = await res.json().catch(() => null) as { code?: string; message?: string } | null
    throw new Error(`Brevo respondió ${res.status}${detail?.code ? ` (${detail.code})` : ''}: ${detail?.message ?? 'sin detalle'}`)
  }

  const body = await res.json().catch(() => null) as { messageId?: string } | null
  return { messageId: body?.messageId }
}

export const mailProvider = {

  send: async (
    to: string,
    subject: string,
    html: string,
  ) => {

    try {

      const info = env.BREVO_API_KEY
        ? await sendWithBrevo(to, subject, html)
        : await getSmtpTransporter().sendMail({
            from: `"${FROM_NAME}" <${env.MAIL_FROM}>`,
            to,
            subject,
            html,
          })

      console.log('[mail] ✅ Email enviado')
      console.log('[mail] To:', maskEmail(to))
      console.log('[mail] Message ID:', info.messageId)

      return info

    } catch (error) {

      console.error('[mail] ❌ Error enviando email:')
      console.error(error)

      throw error
    }
  },
}
