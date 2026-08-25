//src/app/server.ts

import { app }       from './app'
import { env }       from './config/env'
import { prisma }    from './database/prisma'
import { seedAdmin } from './database/seed'

async function start(): Promise<void> {
  try {
    await prisma.$connect()
    console.log('✅ Conectado a PostgreSQL')

    await seedAdmin()

    app.listen(env.PORT, () => {
      console.log(`🚀 Servidor en http://localhost:${env.PORT} (${env.NODE_ENV})`)
    })
  } catch (err) {
    console.error('❌ Error al iniciar:', err)
    await prisma.$disconnect()
    process.exit(1)
  }
}

start()