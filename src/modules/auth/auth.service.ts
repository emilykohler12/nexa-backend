// src/modules/auth/auth.service.ts
import fs   from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { authRepository }           from './auth.repository'
import { bcryptProvider }           from './providers/bcrypt.provider'
import { jwtProvider }              from './providers/jwt.provider'
import { generateTokens }           from './utils/generateTokens'
import { hashRefreshToken }         from './utils/hashToken'
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
import { PRIVACY_POLICY_VERSION } from '../../app/constants/legal'

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
  lastName?:       string | null
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
    lastName:        user.lastName ?? null,
    email:           user.email,
    role:            user.role as AuthUser['role'],
    phone:           user.phone ?? null,
    photo:           user.photo ?? null,
    gender:          user.gender ?? null,
    profileComplete: user.profileComplete,
    createdAt:       user.createdAt.toISOString(),
  }
}

// Hash de bcrypt de una clave al azar, calculado una sola vez, para el login de un email que no existe.
let dummyPasswordHash: Promise<string> | null = null
function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= bcryptProvider.hash(randomUUID())
  return dummyPasswordHash
}

// Dispositivos con la sesión abierta a la vez; al abrir uno más se cierra el más antiguo.
const MAX_SESSIONS = 10
// Tras renovar, el refresh token anterior se sigue aceptando este tiempo (solo para renovar el
// access token): dos pestañas que renuevan a la vez con la misma cookie no se desloguean entre sí.
const PREVIOUS_TOKEN_GRACE_MS = 30_000

export const authService = {

  // Abre una sesión nueva para un dispositivo: crea la fila en refresh_sessions y firma los dos
  // tokens con su id (sid). Las sesiones de los demás dispositivos no se tocan.
  startSession: async (user: AuthUser): Promise<TokenPair> => {
    const sid    = randomUUID()
    const tokens = generateTokens(user, sid)
    await authRepository.createSession({
      id: sid, userId: user.id, refreshToken: tokens.refreshToken, expiresAt: jwtProvider.expiryOf(tokens.refreshToken),
    })
    await authRepository.pruneSessions(user.id, MAX_SESSIONS)
    return tokens
  },

  register: async (dto: RegisterDto): Promise<{ user: AuthUser; tokens: TokenPair }> => {
    const exists = await authRepository.emailExists(dto.email)
    if (exists) throw new AppError(HTTP.CONFLICT, 'El email ya está registrado', 'EMAIL_TAKEN')

    const passwordHash      = await bcryptProvider.hash(dto.password)
    const verificationToken = generateSecureToken()

    const created = await authRepository.create({
      name: dto.name, lastName: dto.lastName, email: dto.email, passwordHash,
      role: 'client', phone: dto.phone, gender: dto.gender, verificationToken,
      termsAcceptedAt: new Date(),
      termsVersion:    PRIVACY_POLICY_VERSION,
    })

    const html = loadTemplate('verifyEmail', {
      LINK: `${env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
      NAME: dto.name,
    })

    mailProvider.send(dto.email, 'Verificá tu email — Nexa', html).catch(err =>
      console.error('[mail] ❌ Error enviando verificación:', err.message)
    )

    const user   = toAuthUser(created)
    const tokens = await authService.startSession(user)
    return { user, tokens }
  },

  login: async (dto: LoginDto): Promise<{ user: AuthUser; tokens: TokenPair }> => {
    const dbUser      = await authRepository.findByEmail(dto.email)
    const invalidCreds = new AppError(HTTP.UNAUTHORIZED, 'Credenciales inválidas', 'INVALID_CREDENTIALS')
    if (!dbUser) {
      // Se hace igual la comparación de bcrypt (lenta a propósito) contra un hash de relleno:
      // si no, un email inexistente respondería en milisegundos y uno existente en ~200 ms, y
      // por la diferencia de tiempo se podría saber qué emails están registrados.
      await bcryptProvider.compare(dto.password, await getDummyPasswordHash())
      throw invalidCreds
    }
    const match = await bcryptProvider.compare(dto.password, dbUser.passwordHash)
    if (!match) throw invalidCreds

    const user   = toAuthUser(dbUser)
    const tokens = await authService.startSession(user)
    return { user, tokens }
  },

  me: async (userId: string): Promise<AuthUser> => {
    const dbUser = await authRepository.findById(userId)
    if (!dbUser) throw new AppError(HTTP.UNAUTHORIZED, 'Sesión inválida', 'SESSION_INVALID')
    const photo = await authRepository.findPhoto(dbUser.id, dbUser.role)
    return toAuthUser({ ...dbUser, photo })
  },

  // Cierra la sesión de ESTE dispositivo (sid). Un token sin sid ya no corresponde a ninguna sesión:
  // no hay nada que borrar (las cookies las limpia el controller).
  logout: async (_userId: string, sid?: string): Promise<void> => {
    if (sid) await authRepository.deleteSession(sid)
  },

  // Renueva la sesión de un dispositivo. Devuelve siempre un access token nuevo; el refresh token
  // solo viene si se rotó (en el caso del margen de gracia no se rota, ver abajo).
  refresh: async (refreshToken: string): Promise<{ user: AuthUser; tokens: { accessToken: string; refreshToken?: string } }> => {
    const invalid = () => new AppError(HTTP.UNAUTHORIZED, 'Token inválido o expirado', 'INVALID_REFRESH_TOKEN')

    let payload
    try {
      payload = jwtProvider.verifyRefresh(refreshToken)
    } catch {
      throw invalid()
    }

    // Un token sin sid es del formato anterior a las sesiones por dispositivo, que ya no se acepta.
    if (!payload.sid) throw invalid()

    const session = await authRepository.findSession(payload.sid)
    const now = new Date()
    if (!session || session.userId !== payload.sub || session.expiresAt <= now) throw invalid()

    const dbUser = await authRepository.findById(session.userId)
    if (!dbUser) throw invalid()
    const user = toAuthUser(dbUser)

    const presented = hashRefreshToken(refreshToken)

    // Margen de gracia: el token que se acaba de reemplazar sigue sirviendo unos segundos, pero solo
    // para un access token nuevo. No se rota otra vez: la cookie vigente es la que ya entregó la otra pestaña.
    const acceptedAsPrevious = (s: typeof session) =>
      s.previousTokenHash === presented && !!s.previousValidUntil && s.previousValidUntil > new Date()
    const accessOnly = () => ({ user, tokens: { accessToken: generateTokens(user, session.id).accessToken } })

    if (presented !== session.tokenHash) {
      if (acceptedAsPrevious(session)) return accessOnly()
      throw invalid()
    }

    const tokens = generateTokens(user, session.id)
    const rotated = await authRepository.rotateSession({
      id:                 session.id,
      currentHash:        presented,
      newRefreshToken:    tokens.refreshToken,
      previousValidUntil: new Date(now.getTime() + PREVIOUS_TOKEN_GRACE_MS),
      expiresAt:          jwtProvider.expiryOf(tokens.refreshToken),
    })
    if (rotated) return { user, tokens }

    // Otro pedido con esta misma cookie renovó justo antes: se vuelve a leer la sesión y, si este token
    // ahora es el "anterior", se responde como en el margen de gracia.
    const fresh = await authRepository.findSession(session.id)
    if (fresh && acceptedAsPrevious(fresh)) return accessOnly()
    throw invalid()
  },

  verifyEmail: async (token: string): Promise<void> => {
    const dbUser = await authRepository.findByVerificationToken(token)
    if (!dbUser) throw new AppError(HTTP.BAD_REQUEST, 'Token de verificación inválido', 'INVALID_TOKEN')
    await authRepository.verifyEmail(dbUser.id)
  },

  forgotPassword: async (dto: ForgotPasswordDto): Promise<void> => {
    const dbUser = await authRepository.findByEmail(dto.email)
    if (!dbUser) return

    let code        = generateVerificationCode()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    // El código es único en toda la tabla (6 dígitos): si justo otra usuaria tiene el mismo
    // vigente, la base lo rechaza (P2002). Se sortea otro en vez de devolver un 500.
    for (let attempt = 0; ; attempt++) {
      try {
        await authRepository.savePasswordReset(dbUser.id, code, expiresAt)
        break
      } catch (err: any) {
        if (err?.code !== 'P2002' || attempt >= 4) throw err
        code = generateVerificationCode()
      }
    }

    // El mail no se espera (como en el registro): si no, un email registrado tardaría lo que dura
    // el envío y uno inexistente respondería enseguida, y esa diferencia revelaría qué cuentas
    // existen. Tampoco se registra el email en los logs.
    const html = loadTemplate('resetPassword', { CODE: code })
    mailProvider.send(dbUser.email, 'Código para recuperar tu contraseña — Nexa', html)
      .then(() => console.log('[mail] ✅ Código de recuperación enviado'))
      .catch((err: any) => console.error('[mail] ❌ Error enviando código:', err?.message))
  },

  resetPassword: async (dto: ResetPasswordDto): Promise<void> => {
    // Mismo error si el email no existe o si el código no es de esa cuenta: no se revela
    // qué emails están registrados.
    const invalid = new AppError(HTTP.BAD_REQUEST, 'Código inválido o ya utilizado', 'INVALID_TOKEN')

    const dbUser = await authRepository.findByEmail(dto.email)
    if (!dbUser) throw invalid
    const reset = await authRepository.findPasswordReset(dbUser.id, dto.token)
    if (!reset || reset.used) throw invalid
    if (new Date() > new Date(reset.expiresAt)) {
      throw new AppError(HTTP.BAD_REQUEST, 'El código expiró. Solicitá uno nuevo.', 'TOKEN_EXPIRED')
    }
    const passwordHash = await bcryptProvider.hash(dto.password)
    // Se reclama el código ANTES de cambiar la contraseña: solo un pedido puede usarlo.
    if (!(await authRepository.consumePasswordReset(reset.id))) throw invalid
    await authRepository.updatePassword(reset.userId, passwordHash)
  },
}