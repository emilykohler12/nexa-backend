// src/modules/specialEvents/specialEvent.routes.ts
import { Router } from 'express'
import { specialEventController } from './specialEvent.controller'

const router = Router()

router.get('/public', specialEventController.getActive)

export { router as specialEventRoutes }
