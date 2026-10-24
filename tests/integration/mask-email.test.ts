import { describe, it, expect } from 'vitest'
import { maskEmail } from '../../src/app/utils/maskEmail'

// Los logs de Render no deben guardar el email completo de una clienta.
describe('maskEmail', () => {
  it('deja la primera letra y el dominio', () => {
    expect(maskEmail('clienta@gmail.com')).toBe('c***@gmail.com')
  })

  it('no rompe con valores que no son un email', () => {
    expect(maskEmail(undefined)).toBe('[email]')
    expect(maskEmail('sin-arroba')).toBe('[email]')
    expect(maskEmail(42)).toBe('[email]')
  })

  it('no deja pasar la parte local completa', () => {
    expect(maskEmail('nombre.largo@test.local')).not.toContain('nombre.largo')
  })
})
