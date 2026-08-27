// src/modules/contact/contact.routes.ts
import { Router } from 'express'
import { contactController } from './contact.controller'

const router = Router()

router.post('/job-interest', contactController.jobInterest)

export { router as contactRoutes }
