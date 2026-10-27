// src/modules/auth/types/auth.types.ts
export type UserRole = 'admin' | 'professional' | 'client'

export interface AuthUser {
  id:              string
  name:            string
  lastName?:       string | null
  email:           string
  role:            UserRole
  phone?:          string | null
  photo?:          string | null
  gender?:         string | null
  createdAt?:      string
  profileComplete?: boolean
}

export interface TokenPair {
  accessToken:  string
  refreshToken: string
}

export interface JwtPayload {
  sub:   string
  email: string
  role:  UserRole
  // Id de la sesión (refresh_sessions.id) del dispositivo que inició sesión. Ausente en las
  // sesiones abiertas antes de que existieran las sesiones por dispositivo.
  sid?:  string
  iat?:  number
  exp?:  number
}