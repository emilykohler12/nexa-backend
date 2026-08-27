// src/modules/whatsapp/whatsapp.routes.ts
import { Router } from 'express'
import { verificarWebhook, recibirWebhook } from './whatsapp.controller'
import { verificarFirmaMeta } from './middleware/whatsapp-signature.middleware'

const router = Router()

// GET: handshake de verificación (una sola vez, cuando configurás el webhook en Meta)
router.get('/whatsapp', verificarWebhook)

// POST: acá llegan los mensajes reales. La firma se verifica contra
// req.rawBody, que ya viene capturado por el parser JSON global de
// app.ts (ver capturarRawBody) — esta ruta no necesita su propio parser.
router.post('/whatsapp', verificarFirmaMeta, recibirWebhook)

export { router as whatsappRoutes }
