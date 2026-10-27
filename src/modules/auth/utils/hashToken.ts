// src/modules/auth/utils/hashToken.ts
import { createHash } from 'node:crypto'

// El refresh token se guarda como SHA-256: si se filtra la base (o un backup), los valores guardados
// no sirven para abrir sesión. Se compara por igualdad exacta del hash.
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
