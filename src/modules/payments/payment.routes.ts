// src/modules/payments/payment.routes.ts
import { Router } from 'express'
import { recibirWebhookMercadoPago } from './payment.controller'
import { verificarFirmaMercadoPago } from './middleware/payment-signature.middleware'

const router = Router()

// Mercado Pago no firma sobre el cuerpo crudo (a diferencia de WhatsApp) —
// la firma se calcula sobre el id de la notificación + headers, así que no
// hace falta ningún parser especial acá, el express.json() global alcanza.
router.post('/mercadopago', verificarFirmaMercadoPago, recibirWebhookMercadoPago)

export { router as paymentRoutes }
