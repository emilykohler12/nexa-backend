//src/modules/auth/utils/generateTokens.ts

import { jwtProvider } from '../providers/jwt.provider'
import type { AuthUser, TokenPair } from '../types/auth.types'

export function generateTokens(user: AuthUser): TokenPair {
  const payload = { sub: user.id, email: user.email, role: user.role }
  return {
    accessToken:  jwtProvider.signAccess(payload),
    refreshToken: jwtProvider.signRefresh(payload),
  }
}