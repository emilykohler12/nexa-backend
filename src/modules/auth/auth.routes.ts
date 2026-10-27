// src/modules/auth/auth.routes.ts
import { Router }    from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { authController } from './auth.controller'
import { authenticate }   from './middleware/auth.middleware'
import { env }            from '../../app/config/env'
import { maskEmail }      from '../../app/utils/maskEmail'

// En test no hay límite — ver el mismo motivo en app.ts.
const noopLimiter = (_req: any, _res: any, next: any) => next()

const strictLimiter = env.NODE_ENV === 'test' ? noopLimiter : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message:        { error: 'Demasiados intentos. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders:   false,
})

// El login tiene su propio límite, más corto y permisivo que registro/reset de
// contraseña — esos son intentos puntuales, pero el login se reintenta seguido
// (contraseña tipeada mal, varias cuentas de prueba, etc.) y 15 min/10 intentos
// resultaba en bloqueos molestos para uso legítimo.
const loginLimiter = env.NODE_ENV === 'test' ? noopLimiter : rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message:        { error: 'Demasiados intentos. Intentá de nuevo en 5 minutos.' },
  standardHeaders: true,
  legacyHeaders:   false,
})

// El código de recuperación tiene 6 dígitos: se limitan los intentos FALLIDOS por email (los
// exitosos no cuentan), así que adivinarlo para una cuenta es inviable aunque se roten IPs.
// A diferencia de los de arriba, este límite NO se apaga en test: se prueba en
// auth.password.test.ts (la clave es el email, y cada test usa uno distinto).
// Contrapartida: quien envíe 5 códigos erróneos con el email de otra persona la deja 15
// minutos sin poder recuperar la contraseña.
const resetAttemptsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: req => {
    const email = req.body?.email
    return typeof email === 'string' && email.trim()
      ? `reset:${email.trim().toLowerCase()}`
      : ipKeyGenerator(req.ip ?? '')
  },
  message: { error: 'Demasiados intentos con este email. Probá de nuevo en 15 minutos.', code: 'TOO_MANY_ATTEMPTS' },
  standardHeaders: true,
  legacyHeaders:   false,
})

// El límite de arriba es por IP: quien rota IPs puede probar contraseñas contra UNA cuenta (por ejemplo
// la del admin). Este cuenta los intentos FALLIDOS por email, así que no depende de la IP.
// Contrapartida: quien falle 10 veces con el email de otra persona la deja 15 minutos sin poder entrar.
// Se usa 401 sin cuerpo nuevo para el caso normal; el 429 lo maneja el frontend como cualquier límite.
const loginAttemptsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: req => {
    const email = req.body?.email
    return typeof email === 'string' && email.trim()
      ? `login:${email.trim().toLowerCase()}`
      : ipKeyGenerator(req.ip ?? '')
  },
  handler: (req, res) => {
    const email = req.body?.email
    console.warn('[auth] demasiados intentos fallidos de login para', typeof email === 'string' ? maskEmail(email) : 'email desconocido')
    res.status(429).json({ error: 'Demasiados intentos con este email. Probá de nuevo en 15 minutos.', code: 'TOO_MANY_ATTEMPTS' })
  },
  standardHeaders: true,
  legacyHeaders:   false,
})

const router = Router()

router.post('/register',        strictLimiter, authController.register)
router.post('/login',           loginLimiter,  loginAttemptsLimiter, authController.login)
router.post('/forgot-password', strictLimiter, authController.forgotPassword)
router.post('/reset-password',  strictLimiter, resetAttemptsLimiter, authController.resetPassword)
router.post('/change-password', strictLimiter, authenticate, authController.changePassword)
// Sin authenticate a propósito: tiene que poder cerrar la sesión con el access token vencido.
router.post('/logout',          authController.logout)
router.get( '/me',              authenticate,  authController.me)
router.post('/refresh',                        authController.refresh)
router.get( '/verify-email',                   authController.verifyEmail)

export { router as authRoutes }