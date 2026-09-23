import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: { NODE_ENV: 'test' },
    setupFiles: ['./tests/setup.ts'],
    // Todos los tests de integración comparten una única base de datos de test
    // (se trunca antes de cada test, ver tests/setup.ts) — correr archivos en
    // paralelo pisaría los datos entre sí, así que van secuenciales.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
})
