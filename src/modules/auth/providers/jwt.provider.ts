//src/modules/auth/providers/jwt.provider.ts

import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import { env } from '../../../app/config/env'
import type { JwtPayload } from '../types/auth.types'

// jwtid (jti): sin él, dos tokens emitidos en el mismo segundo para la misma usuaria salen
// idénticos, y un refresh token "rotado" podía seguir siendo el mismo que el anterior.
export const jwtProvider = {
  signAccess:    (p: Omit<JwtPayload, 'iat' | 'exp'>) =>
    jwt.sign(p, env.JWT_SECRET,        { expiresIn: env.JWT_EXPIRES_IN, jwtid: randomUUID() } as SignOptions),
  signRefresh:   (p: Omit<JwtPayload, 'iat' | 'exp'>) =>
    jwt.sign(p, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN, jwtid: randomUUID() } as SignOptions),
  verifyAccess:  (token: string) => jwt.verify(token, env.JWT_SECRET)          as JwtPayload,
  // Solo para cerrar sesión: valida la firma pero no el vencimiento, para saber de quién es
  // la sesión aunque el access token (15 min) ya haya vencido. Nunca para autorizar nada.
  verifyAccessEvenIfExpired: (token: string) =>
    jwt.verify(token, env.JWT_SECRET, { ignoreExpiration: true }) as JwtPayload,
  verifyRefresh: (token: string) => jwt.verify(token, env.JWT_REFRESH_SECRET)   as JwtPayload,
  // Cuándo vence un token que acabamos de firmar (para guardarlo en la sesión).
  expiryOf: (token: string): Date => {
    const exp = (jwt.decode(token) as { exp?: number } | null)?.exp
    if (!exp) throw new Error('El token no trae fecha de vencimiento')
    return new Date(exp * 1000)
  },
}
