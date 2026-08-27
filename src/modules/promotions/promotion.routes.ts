// src/modules/promotions/promotion.routes.ts
import { Router } from 'express'
import { promotionController } from './promotion.controller'

const router = Router()

router.get('/public', promotionController.getActive)

export { router as promotionRoutes }
