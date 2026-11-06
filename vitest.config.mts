import { defineConfig } from 'vitest/config'

// El servidor de producción (Render) corre en UTC mientras los turnos están en hora
// de Argentina. Los tests corren en UTC también, para reproducir esa diferencia en
// cualquier máquina (la de Emily está en hora de Argentina) y en el CI.
process.env.TZ = 'UTC'

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
    // CI (GitHub Actions): el 06/11/2026 el TRUNCATE del beforeEach superó los 15 s una sola vez (mismo código, pasó en la
    // corrida siguiente). Más margen para runners lentos; una prueba que de verdad se cuelga igual falla.
    testTimeout: 30000,
    hookTimeout: 60000,
  },
})
