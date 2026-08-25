// src/modules/auth/types/auth.types.ts
export type UserRole = 'admin' | 'professional' | 'client'

export interface AuthUser {
  id:              string
  name:            string
  email:           string
  role:            UserRole
  phone?:          string | null
  photo?:          string | null
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
  iat?:  number
  exp?:  number
}