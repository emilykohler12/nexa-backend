// src/modules/whatsapp/whatsapp.controller.ts
import type { Request, Response } from 'express'
import { prisma } from '../../app/database/prisma'
import { env } from '../../app/config/env'
import { enviarMensajeTexto } from './whatsapp.service'
import type { WhatsappWebhookPayload, WhatsappMessage } from './whatsapp.types'

/**
 * GET /api/webhook/whatsapp
 *
 * Meta llama a este endpoint UNA sola vez, cuando apretás
 * "Verificar y guardar" en el panel. Es un simple "handshake":
 * Meta manda un token y un challenge, y si el token coincide con
 * el que configuraste, le devolvés el challenge tal cual.
 */
export function verificarWebhook(req: Request, res: Response) {
  const modo = req.query['hub.mode']
  const tokenRecibido = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (modo === 'subscribe' && tokenRecibido === env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[whatsapp] Webhook verificado correctamente por Meta')
    return res.status(200).send(challenge)
  }

  console.warn('[whatsapp] Intento de verificación de webhook fallido')
  return res.sendStatus(403)
}

/**
 * POST /api/webhook/whatsapp
 *
 * Acá llegan los mensajes reales de los clientes, cada vez que
 * escriben algo. Meta espera una respuesta 200 rápida (unos
 * segundos); si no la recibe, reintenta el envío del mismo webhook
 * más tarde — por eso la idempotencia es obligatoria, no opcional.
 */
export async function recibirWebhook(req: Request, res: Response) {
  // Respondemos 200 de inmediato. El procesamiento real sigue
  // después, pero Meta no necesita esperarlo.
  res.sendStatus(200)

  const payload = req.body as WhatsappWebhookPayload

  try {
    const mensajes = extraerMensajes(payload)

    for (const mensaje of mensajes) {
      await procesarMensaje(mensaje)
    }
  } catch (error) {
    // No devolvemos error a Meta (ya respondimos 200), pero
    // logueamos para poder auditar qué pasó.
    console.error('[whatsapp] Error procesando webhook:', error)
  }
}

function extraerMensajes(payload: WhatsappWebhookPayload): WhatsappMessage[] {
  const mensajes: WhatsappMessage[] = []

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === 'messages' && change.value.messages) {
        mensajes.push(...change.value.messages)
      }
      // change.value.statuses son confirmaciones de entrega/lectura,
      // no mensajes nuevos del cliente — no se procesan como turno.
    }
  }

  return mensajes
}

async function procesarMensaje(mensaje: WhatsappMessage) {
  // ── Idempotencia (RNF-10) ──────────────────────────────────
  // Si ya procesamos este wamid antes, no lo procesamos de nuevo.
  const yaProcesado = await prisma.mensajeWhatsappProcesado.findUnique({
    where: { wamid: mensaje.id },
  })

  if (yaProcesado) {
    console.log(`[whatsapp] Mensaje ${mensaje.id} ya procesado, se ignora`)
    return
  }

  // Reservamos el wamid ANTES de procesar, para que una entrega
  // duplicada de Meta que llegue en paralelo no se procese dos veces.
  await prisma.mensajeWhatsappProcesado.create({ data: { wamid: mensaje.id } })

  // ── Estado de la conversación ──────────────────────────────
  const telefono = mensaje.from

  const conversacion = await prisma.conversacionWhatsapp.upsert({
    where: { telefono },
    update: {},
    create: { telefono, estadoActual: 'inicio', contexto: {} },
  })

  try {
    // ── Placeholder: acá va a enganchar la máquina de estados ──
    // del árbol conversacional completo (punto 5 del plan). Por
    // ahora, un acuse de recibo simple para confirmar que todo el
    // circuito funciona de punta a punta: Meta → webhook → Prisma → respuesta.
    const textoRecibido = mensaje.text?.body ?? '[mensaje interactivo]'

    console.log(
      `[whatsapp] Mensaje de ${telefono} (estado: ${conversacion.estadoActual}): "${textoRecibido}"`,
    )

    await enviarMensajeTexto(
      telefono,
      '¡Hola! Recibimos tu mensaje. El árbol de reservas todavía se está armando — pronto vas a poder reservar tu turno directo desde acá 💅',
    )
  } catch (error) {
    // Si falló el envío de la respuesta, liberamos el wamid para que
    // un reintento pueda procesar este mensaje de nuevo. Si no
    // hiciéramos esto, un fallo transitorio (WhatsApp caído, token
    // vencido) haría que el mensaje del cliente se pierda en
    // silencio para siempre, porque ya estaría marcado "procesado"
    // sin que el cliente haya recibido ninguna respuesta.
    await prisma.mensajeWhatsappProcesado
      .delete({ where: { wamid: mensaje.id } })
      .catch(() => {})
    throw error
  }
}
