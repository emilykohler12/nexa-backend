// src/modules/settings/schedule.routes.ts
import { Router } from 'express'
import { settingsController } from './settings.controller'

const router = Router()

// Pública — sin auth, mismo dato que GET /api/settings/schedule
router.get('/public', settingsController.getPublicSchedule)

export { router as scheduleRoutes }
