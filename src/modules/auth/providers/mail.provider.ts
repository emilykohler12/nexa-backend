//src/modules/auth/providers/mail.provider.ts

import nodemailer from 'nodemailer'
import { env } from '../../../app/config/env'

const transporter = nodemailer.createTransport({
  host: env.MAIL_HOST,
  port: env.MAIL_PORT,
  secure: env.MAIL_PORT === 465,

  auth: {
    user: env.MAIL_USER,
    pass: env.MAIL_PASS,
  },
})

transporter.verify((error) => {
  if (error) {
    console.error('[mail] ❌ Error de conexión SMTP:')
    console.error(error)
  } else {
    console.log(`[mail] ✅ SMTP listo: ${env.MAIL_USER}`)
  }
})

export const mailProvider = {

  send: async (
    to: string,
    subject: string,
    html: string,
  ) => {

    try {

      const info = await transporter.sendMail({
        from: `"Nexa" <${env.MAIL_FROM}>`,
        to,
        subject,
        html,
      })

      console.log('[mail] ✅ Email enviado')
      console.log('[mail] To:', to)
      console.log('[mail] Message ID:', info.messageId)

      return info

    } catch (error) {

      console.error('[mail] ❌ Error enviando email:')
      console.error(error)

      throw error
    }
  },
}