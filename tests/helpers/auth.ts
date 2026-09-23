import { jwtProvider } from '../../src/modules/auth/providers/jwt.provider'
import type { UserRole } from '../../src/modules/auth/types/auth.types'

// Firma un access_token válido directamente (sin pasar por /api/auth/login)
// para no pagar el costo de bcrypt ni el rate limit del login en cada test
// que solo necesita "estar logueado como X". auth.test.ts sí prueba el login
// real de punta a punta.
export function cookieFor(user: { id: string; email: string; role: string }): string {
  const token = jwtProvider.signAccess({ sub: user.id, email: user.email, role: user.role as UserRole })
  return `access_token=${token}`
}
