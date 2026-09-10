// src/modules/payments/middleware/payment-signature.middleware.ts
import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { env } from '../../../app/config/env'

/**
 * Verifica que la notificación del webhook realmente venga de Mercado Pago,
 * validando la firma del header "x-signature" contra un HMAC-SHA256 calculado
 * con la "Clave secreta" del webhook (distinta del access token).
 *
 * Referencia: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 *
 * Sin esto, cualquiera que descubra la URL del webhook podría mandar avisos
 * falsos de "pago aprobado" y hacer que el sistema marque turnos como pagos
 * sin que haya entrado un peso.
 */
export function verificarFirmaMercadoPago(req: Request, res: Response, next: NextFunction) {
  const secret = env.MERCADOPAGO_WEBHOOK_SECRET

  if (!secret) {
    console.error('[mercadopago] Falta MERCADOPAGO_WEBHOOK_SECRET en las variables de entorno')
    return res.sendStatus(500)
  }

  const signatureHeader = req.header('x-signature')
  const requestId        = req.header('x-request-id')
  const dataId            = req.query['data.id'] as string | undefined

  if (!signatureHeader || !requestId || !dataId) {
    return res.sendStatus(401)
  }

  const parts: Record<string, string> = {}
  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.split('=')
    if (key && value) parts[key.trim()] = value.trim()
  }
  const ts           = parts.ts
  const firmaRecibida = parts.v1
  if (!ts || !firmaRecibida) return res.sendStatus(401)

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const firmaEsperada = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  // Igual que con el webhook de WhatsApp: chequeo la longitud antes de
  // timingSafeEqual, porque si no coincide tira una excepción en vez de
  // devolver false.
  const bufferRecibido = Buffer.from(firmaRecibida)
  const bufferEsperado = Buffer.from(firmaEsperada)

  if (bufferRecibido.length !== bufferEsperado.length) {
    console.warn('[mercadopago] Firma con longitud inválida en webhook recibido')
    return res.sendStatus(401)
  }

  if (!crypto.timingSafeEqual(bufferRecibido, bufferEsperado)) {
    console.warn('[mercadopago] Firma inválida en webhook recibido')
    return res.sendStatus(401)
  }

  next()
}
