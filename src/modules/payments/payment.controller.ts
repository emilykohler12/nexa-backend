// src/modules/payments/payment.controller.ts
import type { Request, Response } from 'express'
import * as Sentry from '@sentry/node'
import { paymentService } from './payment.service'
import { appointmentService } from '../appointments/appointment.service'
import { orderService } from '../orders/order.service'

// Solo datos para diagnosticar: el error del SDK de Mercado Pago puede traer cabeceras o el
// cuerpo de la respuesta HTTP (credenciales incluidas), y eso no debe llegar a los logs.
function describeError(error: unknown) {
  const e = error as { name?: string; message?: string; status?: number; statusCode?: number }
  return { name: e?.name, message: e?.message, status: e?.status ?? e?.statusCode }
}

/**
 * POST /api/webhook/mercadopago
 *
 * Mercado Pago llama acá cada vez que cambia el estado de un pago. Espera un 200 o 201 dentro
 * de 22 segundos; si no lo recibe, reintenta (cada 15 minutos y cada vez más espaciado, hasta
 * que lo reciba). Por eso se responde DESPUÉS de procesar: 200 si se procesó (o si el aviso no
 * requiere hacer nada, o si reintentar no cambiaría el resultado, como un monto distinto) y
 * 500 si falló algo transitorio (Mercado Pago o la base de datos), para que reintente. Es
 * seguro reintentar porque aplicar el mismo pago dos veces no duplica nada (ver
 * applyPaymentResult).
 *
 * Nunca confiamos en datos del pago que vengan sueltos en la notificación —
 * solo usamos el id para volver a preguntarle a la API de Mercado Pago cuál
 * es el estado real (getPayment), y de ahí sacamos external_reference, status, monto y moneda.
 */
export async function recibirWebhookMercadoPago(req: Request, res: Response): Promise<void> {
  try {
    const type   = req.query.type as string | undefined
    const dataId = req.query['data.id'] as string | undefined
    if (type !== 'payment' || typeof dataId !== 'string' || !dataId) {
      res.sendStatus(200)
      return
    }

    const payment = await paymentService.getPayment(dataId)
    const externalReference = payment.external_reference
    const status             = payment.status // 'approved' | 'rejected' | 'pending' | 'in_process' | ...

    if (!externalReference || !status) {
      console.warn('[mercadopago] Webhook sin external_reference o status, se ignora', dataId)
      res.sendStatus(200)
      return
    }

    // Lo que Mercado Pago realmente cobró: se compara con la seña o el total esperado.
    const paid = { amount: payment.transaction_amount, currency: payment.currency_id }

    const [kind, id] = externalReference.split(':')
    if (kind === 'appointment' && id) {
      await appointmentService.applyPaymentResult(id, dataId, status, paid)
    } else if (kind === 'group' && id) {
      await appointmentService.applyGroupPaymentResult(id, dataId, status, paid)
    } else if (kind === 'order' && id) {
      await orderService.applyPaymentResult(id, dataId, status, paid)
    } else {
      console.warn('[mercadopago] external_reference con formato desconocido:', externalReference)
    }
    res.sendStatus(200)
  } catch (error) {
    console.error('[mercadopago] Error procesando webhook:', describeError(error))
    Sentry.captureException(error)
    res.sendStatus(500)
  }
}
