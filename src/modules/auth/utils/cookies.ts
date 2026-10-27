// src/modules/auth/utils/cookies.ts
//
// Cookies de sesión: las usan el login/registro/refresh (auth.controller.ts) y el alta de una
// profesional por invitación (invitation.controller.ts), con los mismos atributos.
import type { Response } from 'express'
import { env } from '../../../app/config/env'

// En producción, frontend (Vercel) y backend (Render) viven en dominios
// distintos — la cookie es "cross-site" y el navegador solo la manda en ese
// caso con SameSite=None (que además exige Secure=true, por eso van atados).
// En desarrollo (mismo origen, sin HTTPS) 'lax' + sin secure es lo correcto.
const COOKIE_BASE = {
  httpOnly: true,
  secure:   env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
}

// Si no viene refreshToken (renovación dentro del margen de gracia, sin rotar) solo se actualiza el
// access token y la cookie de refresh que el navegador ya tiene queda como está.
export function setTokenCookies(res: Response, tokens: { accessToken: string; refreshToken?: string }): void {
  res.cookie('access_token',  tokens.accessToken,  { ...COOKIE_BASE, maxAge: 15 * 60 * 1000 })
  if (!tokens.refreshToken) return
  res.cookie('refresh_token', tokens.refreshToken, {
    ...COOKIE_BASE,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path:   '/api/auth/refresh',
  })
}

export function clearTokenCookies(res: Response): void {
  res.clearCookie('access_token',  { ...COOKIE_BASE })
  res.clearCookie('refresh_token', { ...COOKIE_BASE, path: '/api/auth/refresh' })
}
