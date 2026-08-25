//src/modules/auth/providers/jwt.provider.ts

import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import { env } from '../../../app/config/env'
import type { JwtPayload } from '../types/auth.types'

export const jwtProvider = {
  signAccess:    (p: Omit<JwtPayload, 'iat' | 'exp'>) =>
    jwt.sign(p, env.JWT_SECRET,        { expiresIn: env.JWT_EXPIRES_IN } as SignOptions),
  signRefresh:   (p: Omit<JwtPayload, 'iat' | 'exp'>) =>
    jwt.sign(p, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as SignOptions),
  verifyAccess:  (token: string) => jwt.verify(token, env.JWT_SECRET)          as JwtPayload,
  verifyRefresh: (token: string) => jwt.verify(token, env.JWT_REFRESH_SECRET)   as JwtPayload,
}