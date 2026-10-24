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
    testTimeout: 15000,
    hookTimeout: 15000,
  },
})
