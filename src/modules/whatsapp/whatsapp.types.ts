// src/modules/whatsapp/whatsapp.types.ts
//
// Tipado mínimo del payload que manda Meta al webhook.
// No es el tipado completo de la API (tiene muchos más campos
// opcionales), solo lo que necesitamos para el flujo del chatbot.
// Referencia oficial: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components

export interface WhatsappWebhookPayload {
  object: string // siempre "whatsapp_business_account"
  entry: WhatsappEntry[]
}

interface WhatsappEntry {
  id: string // WABA ID
  changes: WhatsappChange[]
}

interface WhatsappChange {
  field: string // "messages" es lo que nos interesa
  value: {
    messaging_product: 'whatsapp'
    metadata: {
      display_phone_number: string
      phone_number_id: string
    }
    contacts?: WhatsappContact[]
    messages?: WhatsappMessage[]
    statuses?: WhatsappStatus[] // confirmaciones de entrega/lectura, no son mensajes nuevos
  }
}

interface WhatsappContact {
  profile: { name: string }
  wa_id: string // el teléfono del cliente, sin "+"
}

export interface WhatsappMessage {
  from: string // teléfono del cliente
  id: string // wamid - identificador único del mensaje (clave para idempotencia)
  timestamp: string
  type: 'text' | 'interactive' | 'button' | 'image' | string
  text?: { body: string }
  interactive?: {
    type: 'button_reply' | 'list_reply'
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
}

interface WhatsappStatus {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
}
