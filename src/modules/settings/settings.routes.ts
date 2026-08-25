// src/modules/settings/settings.routes.ts
import { Router } from 'express'
import { settingsController } from './settings.controller'
import { authMiddleware }     from '../auth/middleware/auth.middleware'
import { requireRole }        from '../auth/middleware/guest.middleware'

const router = Router()

router.use(authMiddleware, requireRole('admin'))

router.get('/business',   settingsController.getBusiness)
router.patch('/business', settingsController.updateBusiness)
router.get('/schedule',   settingsController.getSchedule)
router.patch('/schedule', settingsController.updateSchedule)
router.get('/payments',   settingsController.getPayments)
router.patch('/payments', settingsController.updatePayments)

export { router as settingsRoutes }
