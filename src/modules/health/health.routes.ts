// src/modules/health/health.routes.ts
//
// Lo usa el health check de Render (y cualquier monitor externo) para saber
// si el servicio está vivo y si puede hablar con la base de datos. Sin auth
// a propósito — un balanceador/monitor no tiene sesión.
import { Router } from 'express'
import { prisma } from '../../app/database/prisma'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.status(200).json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() })
  } catch {
    // 503: el proceso está vivo (respondió) pero no puede atender pedidos reales
    // sin base de datos — Render debe tratarlo como "no saludable".
    res.status(503).json({ status: 'error', database: 'down', timestamp: new Date().toISOString() })
  }
})

export { router as healthRoutes }
