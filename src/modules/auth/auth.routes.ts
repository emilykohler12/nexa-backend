// src/modules/auth/auth.routes.ts
import { Router }    from 'express'
import rateLimit     from 'express-rate-limit'
import { authController } from './auth.controller'
import { authenticate }   from './middleware/auth.middleware'

const strictLimiter = rateLimit({
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
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message:        { error: 'Demasiados intentos. Intentá de nuevo en 5 minutos.' },
  standardHeaders: true,
  legacyHeaders:   false,
})

const router = Router()

router.post('/register',        strictLimiter, authController.register)
router.post('/login',           loginLimiter,  authController.login)
router.post('/forgot-password', strictLimiter, authController.forgotPassword)
router.post('/reset-password',  strictLimiter, authController.resetPassword)
router.post('/change-password', authenticate, authController.changePassword)
router.post('/logout',          authenticate,  authController.logout)
router.get( '/me',              authenticate,  authController.me)
router.post('/refresh',                        authController.refresh)
router.get( '/verify-email',                   authController.verifyEmail)

export { router as authRoutes }