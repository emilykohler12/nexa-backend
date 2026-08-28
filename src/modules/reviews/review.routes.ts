// src/modules/reviews/review.routes.ts
import { Router } from 'express'
import { reviewController } from './review.controller'

const router = Router()

router.get('/public/summary', reviewController.getPublicSummary)
router.get('/public',         reviewController.getPublicList)

export { router as reviewRoutes }
