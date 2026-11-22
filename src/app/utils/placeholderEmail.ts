// Los turnos manuales de una clienta sin correo necesitan igual una cuenta, y el correo es obligatorio y único en la base:
// se le asigna una dirección INTERNA (walkin-<uuid>@nexa.local). Nunca es un correo real: no se muestra en ninguna pantalla
// (queda en blanco), no se manda ningún mail a esa dirección y no se ofrece como cuenta de la clienta en las búsquedas.
import { randomUUID } from 'node:crypto'

const PLACEHOLDER = /^walkin-[0-9a-f-]+@nexa\.local$/i

export function makePlaceholderEmail(): string {
  return `walkin-${randomUUID()}@nexa.local`
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && PLACEHOLDER.test(email.trim())
}

// El correo tal como se muestra: en blanco si es la dirección interna.
export function visibleEmail(email: string | null | undefined): string {
  return !email || isPlaceholderEmail(email) ? '' : email
}
