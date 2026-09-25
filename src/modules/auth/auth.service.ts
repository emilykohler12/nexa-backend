// src/modules/auth/auth.service.ts
import fs   from 'fs'
import path from 'path'
import { authRepository }           from './auth.repository'
import { bcryptProvider }           from './providers/bcrypt.provider'
import { jwtProvider }              from './providers/jwt.provider'
import { generateTokens }           from './utils/generateTokens'
import { generateSecureToken, generateVerificationCode } from './utils/generateCode'
import { mailProvider }             from './providers/mail.provider'
import { AppError }                 from '../../app/middlewares/errorHandler'
import { HTTP }                     from '../../app/constants/http'
import { env }                      from '../../app/config/env'
import type { RegisterDto }         from './dto/register.dto'
import type { LoginDto }            from './dto/login.dto'
import type { ForgotPasswordDto }   from './dto/forgotPassword.dto'
import type { ResetPasswordDto }    from './dto/resetPassword.dto'
import type { AuthUser, TokenPair } from './types/auth.types'

function loadTemplate(name: string, replacements: Record<string, string>): string {
  const candidates = [
    path.join(__dirname, 'templates', `${name}.html`),
    path.join(process.cwd(), 'src', 'modules', 'auth', 'templates', `${name}.html`),
    path.join(process.cwd(), 'dist', 'modules', 'auth', 'templates', `${name}.html`),
  ]

  let html: string | null = null
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      html = fs.readFileSync(filePath, 'utf8')
      break
    }
  }

  if (!html) {
    throw new Error(`No se encontró el template "${name}.html". Rutas buscadas:\n${candidates.join('\n')}`)
  }

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(`{{${key}}}`, value)
  }
  return html
}

function toAuthUser(user: {
  id:              string
  name:            string
  email:           string
  role:            string
  phone?:          string | null
  photo?:          string | null
  gender?:         string | null
  profileComplete: boolean
  createdAt:       Date
}): AuthUser {
  return {
    id:              user.id,
    name:            user.name,
    email:           user.email,
    role:            user.role as AuthUser['role'],
    phone:           user.phone ?? null,
    photo:           user.photo ?? null,
    gender:          user.gender ?? null,
    profileComplete: user.profileComplete,
    createdAt:       user.createdAt.toISOString(),
  }
}

export const authService = {

  register: async (dto: RegisterDto): Promise<{ user: AuthUser; tokens: TokenPair }> => {
    const exists = await authRepository.emailExists(dto.email)
    if (exists) throw new AppError(HTTP.CONFLICT, 'El email ya está registrado', 'EMAIL_TAKEN')

    const passwordHash      = await bcryptProvider.hash(dto.password)
    const verificationToken = generateSecureToken()

    const created = await authRepository.create({
      name: dto.name, email: dto.email, passwordHash,
      role: 'client', phone: dto.phone, gender: dto.gender, verificationToken,
      termsAcceptedAt: new Date(),
    })

    const html = loadTemplate('verifyEmail', {
      LINK: `${env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
      NAME: dto.name,
    })

    mailProvider.send(dto.email, 'Verificá tu email — Nexa', html).catch(err =>
      console.error('[mail] ❌ Error enviando verificación:', err.message)
    )

    const user   = toAuthUser(created)
    const tokens = generateTokens(user)
    await authRepository.saveRefreshToken(user.id, tokens.refreshToken)
    return { user, tokens }
  },

  login: async (dto: LoginDto): Promise<{ user: AuthUser; tokens: TokenPair }> => {
    const dbUser      = await authRepository.findByEmail(dto.email)
    const invalidCreds = new AppError(HTTP.UNAUTHORIZED, 'Credenciales inválidas', 'INVALID_CREDENTIALS')
    if (!dbUser) throw invalidCreds
    const match = await bcryptProvider.compare(dto.password, dbUser.passwordHash)
    if (!match) throw invalidCreds

    const user   = toAuthUser(dbUser)
    const tokens = generateTokens(user)
    await authRepository.saveRefreshToken(user.id, tokens.refreshToken)
    return { user, tokens }
  },

  me: async (userId: string): Promise<AuthUser> => {
    const dbUser = await authRepository.findById(userId)
    if (!dbUser) throw new AppError(HTTP.UNAUTHORIZED, 'Sesión inválida', 'SESSION_INVALID')
    const photo = await authRepository.findPhoto(dbUser.id, dbUser.role)
    return toAuthUser({ ...dbUser, photo })
  },

  logout: async (userId: string): Promise<void> => {
    await authRepository.clearRefreshToken(userId)
  },

  refresh: async (refreshToken: string): Promise<{ user: AuthUser; tokens: TokenPair }> => {
    const dbUser = await authRepository.findByRefreshToken(refreshToken)
    if (!dbUser) throw new AppError(HTTP.UNAUTHORIZED, 'Token inválido', 'INVALID_REFRESH_TOKEN')

    try {
      jwtProvider.verifyRefresh(refreshToken)
    } catch {
      await authRepository.clearRefreshToken(dbUser.id)
      throw new AppError(HTTP.UNAUTHORIZED, 'Token expirado', 'INVALID_REFRESH_TOKEN')
    }

    const user   = toAuthUser(dbUser)
    const tokens = generateTokens(user)
    await authRepository.saveRefreshToken(user.id, tokens.refreshToken)
    return { user, tokens }
  },

  verifyEmail: async (token: string): Promise<void> => {
    const dbUser = await authRepository.findByVerificationToken(token)
    if (!dbUser) throw new AppError(HTTP.BAD_REQUEST, 'Token de verificación inválido', 'INVALID_TOKEN')
    await authRepository.verifyEmail(dbUser.id)
  },

  forgotPassword: async (dto: ForgotPasswordDto): Promise<void> => {
    const dbUser = await authRepository.findByEmail(dto.email)
    if (!dbUser) return

    const code      = generateVerificationCode()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    await authRepository.savePasswordReset(dbUser.id, code, expiresAt)

    const html = loadTemplate('resetPassword', { CODE: code })
    try {
      await mailProvider.send(dbUser.email, 'Código para recuperar tu contraseña — Nexa', html)
      console.log(`[mail] ✅ Código enviado a ${dbUser.email}`)
    } catch (err: any) {
      console.error('[mail] ❌ Error enviando código:', err.message)
    }
  },

  resetPassword: async (dto: ResetPasswordDto): Promise<void> => {
    const reset = await authRepository.findPasswordReset(dto.token)
    if (!reset || reset.used) {
      throw new AppError(HTTP.BAD_REQUEST, 'Código inválido o ya utilizado', 'INVALID_TOKEN')
    }
    if (new Date() > new Date(reset.expiresAt)) {
      throw new AppError(HTTP.BAD_REQUEST, 'El código expiró. Solicitá uno nuevo.', 'TOKEN_EXPIRED')
    }
    const passwordHash = await bcryptProvider.hash(dto.password)
    await authRepository.updatePassword(reset.userId, passwordHash)
    await authRepository.markPasswordResetUsed(dto.token)
  },
}