import type { UserRole } from '../modules/auth/types/auth.types'

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: UserRole }
    }
  }
}