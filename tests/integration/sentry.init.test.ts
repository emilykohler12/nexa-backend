import { describe, it, expect, vi, afterEach } from 'vitest'

// ─── Sentry: nada de los tests llega a Sentry ──────────────────────────────────────────────────

describe('Sentry no se inicia en los tests', () => {
  afterEach(() => { vi.resetModules(); vi.doUnmock('@sentry/node'); vi.doUnmock('@sentry/profiling-node'); vi.unstubAllEnvs() })

  it('con un DSN en el entorno, NODE_ENV=test no llama a Sentry.init', async () => {
    const init = vi.fn()
    vi.resetModules()
    vi.doMock('@sentry/node', () => ({ init, expressErrorHandler: vi.fn() }))
    vi.doMock('@sentry/profiling-node', () => ({ nodeProfilingIntegration: vi.fn() }))
    vi.stubEnv('SENTRY_DSN', 'https://clave@o0.ingest.sentry.io/1')
    vi.stubEnv('NODE_ENV', 'test')
    const { initSentry } = await import('../../src/sentry')
    initSentry()
    expect(init).not.toHaveBeenCalled()
  })

  it('en producción con DSN sí lo inicia', async () => {
    const init = vi.fn()
    vi.resetModules()
    vi.doMock('@sentry/node', () => ({ init, expressErrorHandler: vi.fn() }))
    vi.doMock('@sentry/profiling-node', () => ({ nodeProfilingIntegration: vi.fn() }))
    vi.stubEnv('SENTRY_DSN', 'https://clave@o0.ingest.sentry.io/1')
    vi.stubEnv('NODE_ENV', 'production')
    const { initSentry } = await import('../../src/sentry')
    initSentry()
    expect(init).toHaveBeenCalledOnce()
    expect(init.mock.calls[0][0].environment).toBe('production')
  })
})
