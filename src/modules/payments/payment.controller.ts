// src/modules/payments/payment.controller.ts
import type { Request, Response } from 'express'
import { paymentService } from './payment.service'
import { appointmentService } from '../appointments/appointment.service'
import { orderService } from '../orders/order.service'

/**
 * POST /api/webhook/mercadopago
 *
 * Mercado Pago llama acá cada vez que cambia el estado de un pago. Igual que
 * con WhatsApp: respondemos 200 de inmediato (Mercado Pago espera una
 * respuesta rápida y reintenta si no la recibe), y el procesamiento real
 * sigue después.
 *
 * Nunca confiamos en datos del pago que vengan sueltos en la notificación —
 * solo usamos el id para volver a preguntarle a la API de Mercado Pago cuál
 * es el estado real (getPayment), y de ahí sacamos external_reference y status.
 */
export async function recibirWebhookMercadoPago(req: Request, res: Response): Promise<void> {
  res.sendStatus(200)

  try {
    const type   = req.query.type as string | undefined
    const dataId = req.query['data.id'] as string | undefined
    if (type !== 'payment' || !dataId) return

    const payment = await paymentService.getPayment(dataId)
    const externalReference = payment.external_reference
    const status             = payment.status // 'approved' | 'rejected' | 'pending' | 'in_process' | ...

    if (!externalReference || !status) {
      console.warn('[mercadopago] Webhook sin external_reference o status, se ignora', dataId)
      return
    }

    const [kind, id] = externalReference.split(':')
    if (kind === 'appointment' && id) {
      await appointmentService.applyPaymentResult(id, dataId, status)
    } else if (kind === 'order' && id) {
      await orderService.applyPaymentResult(id, dataId, status)
    } else {
      console.warn('[mercadopago] external_reference con formato desconocido:', externalReference)
    }
  } catch (error) {
    console.error('[mercadopago] Error procesando webhook:', error)
  }
}
