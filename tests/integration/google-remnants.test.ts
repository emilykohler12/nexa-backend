import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── RNF-07: sin restos del ingreso con Google ─────────────────────────────────────────────────

describe('RNF-07: no quedan restos del ingreso con Google', () => {
  it('los archivos del proveedor social ya no existen', () => {
    expect(existsSync(resolve('src/modules/auth/providers/social.provider.ts'))).toBe(false)
    expect(existsSync(resolve('src/modules/auth/dto/socialLogin.dto.ts'))).toBe(false)
  })

  it('el entorno ya no define GOOGLE_CLIENT_ID', async () => {
    const { env } = await import('../../src/app/config/env')
    expect(Object.keys(env)).not.toContain('GOOGLE_CLIENT_ID')
  })
})
