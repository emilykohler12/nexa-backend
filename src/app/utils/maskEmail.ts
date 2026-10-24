// src/app/utils/maskEmail.ts
//
// Para los logs: deja ver el dominio y la primera letra ("c***@gmail.com"), suficiente para
// diagnosticar un envío fallido sin guardar el email completo de una clienta en los logs de Render.
export function maskEmail(email: unknown): string {
  if (typeof email !== 'string' || !email.includes('@')) return '[email]'
  const [local, ...rest] = email.split('@')
  const domain = rest.join('@')
  return `${local.slice(0, 1)}***@${domain}`
}
