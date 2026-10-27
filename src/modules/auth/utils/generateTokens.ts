//src/modules/auth/utils/generateTokens.ts

import { jwtProvider } from '../providers/jwt.provider'
import type { AuthUser, TokenPair } from '../types/auth.types'

// `sid` identifica la sesión del dispositivo (refresh_sessions.id) y viaja en los dos tokens.
export function generateTokens(user: AuthUser, sid?: string): TokenPair {
  const payload = { sub: user.id, email: user.email, role: user.role, ...(sid ? { sid } : {}) }
  return {
    accessToken:  jwtProvider.signAccess(payload),
    refreshToken: jwtProvider.signRefresh(payload),
  }
}
