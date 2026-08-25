// src/modules/auth/utils/generateCode.ts
import crypto from 'crypto'

// Token hexadecimal largo — para verificación de email e invitaciones
export const generateSecureToken = (): string =>
  crypto.randomBytes(32).toString('hex')

// Código numérico de 6 dígitos — para recuperación de contraseña
export const generateVerificationCode = (): string =>
  crypto.randomInt(100000, 1000000).toString()