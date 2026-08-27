// src/modules/whatsapp/whatsapp.service.ts
//
// Funciones para MANDAR mensajes hacia el cliente vía la Graph API
// de Meta. El controller (whatsapp.controller.ts) se encarga de
// RECIBIR; este archivo se encarga de RESPONDER.
import { env } from '../../app/config/env'

const GRAPH_API_VERSION = 'v21.0' // revisar en developers.facebook.com cuál es la vigente al momento de desplegar

function urlMensajes(): string {
  if (!env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error('Falta WHATSAPP_PHONE_NUMBER_ID en las variables de entorno')
  }
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`
}

function headersAutenticados(): Record<string, string> {
  if (!env.WHATSAPP_ACCESS_TOKEN) {
    throw new Error('Falta WHATSAPP_ACCESS_TOKEN en las variables de entorno')
  }
  return {
    Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Manda un mensaje de texto simple. Sirve para el "ack" inicial
 * mientras no está armado el árbol conversacional completo.
 */
export async function enviarMensajeTexto(telefonoDestino: string, texto: string): Promise<void> {
  const respuesta = await fetch(urlMensajes(), {
    method: 'POST',
    headers: headersAutenticados(),
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: telefonoDestino,
      type: 'text',
      text: { body: texto },
    }),
  })

  if (!respuesta.ok) {
    const detalle = await respuesta.text()
    console.error('[whatsapp] Error al enviar mensaje:', respuesta.status, detalle)
    throw new Error(`Fallo al enviar mensaje de WhatsApp: ${respuesta.status}`)
  }
}

/**
 * Manda un mensaje con botones (hasta 3), que es el formato que se
 * va a usar para el menú principal y las decisiones sí/no del árbol.
 */
export async function enviarMensajeConBotones(
  telefonoDestino: string,
  texto: string,
  botones: { id: string; titulo: string }[],
): Promise<void> {
  if (botones.length > 3) {
    throw new Error('WhatsApp permite máximo 3 botones por mensaje (usar listas para más opciones)')
  }

  const respuesta = await fetch(urlMensajes(), {
    method: 'POST',
    headers: headersAutenticados(),
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: telefonoDestino,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: texto },
        action: {
          buttons: botones.map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.titulo },
          })),
        },
      },
    }),
  })

  if (!respuesta.ok) {
    const detalle = await respuesta.text()
    console.error('[whatsapp] Error al enviar botones:', respuesta.status, detalle)
    throw new Error(`Fallo al enviar mensaje con botones: ${respuesta.status}`)
  }
}
