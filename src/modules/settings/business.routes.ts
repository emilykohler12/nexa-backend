// src/modules/settings/business.routes.ts
import { Router } from 'express'
import { settingsController } from './settings.controller'

const router = Router()

// Pública — sin auth, para que la home consuma los datos del negocio
router.get('/public', settingsController.getPublicBusiness)
router.get('/payments/public', settingsController.getPublicPayments)
router.get('/stats/public', settingsController.getPublicStats)

export { router as businessRoutes }
