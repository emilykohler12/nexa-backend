// src/modules/clients/client.routes.ts
import { Router }       from 'express'
import { clientController } from './client.controller'
import { appointmentController } from '../appointments/appointment.controller'
import { orderController } from '../orders/order.controller'
import { authenticate }  from '../auth/middleware/auth.middleware'
import { authorize }     from '../auth/middleware/auth.middleware'

const router = Router()

router.get( '/profile',  authenticate, authorize('client'), clientController.getProfile)
router.patch('/profile', authenticate, authorize('client'), clientController.updateProfile)

router.post ('/appointments',            authenticate, authorize('client'), appointmentController.create)
router.get  ('/appointments',            authenticate, authorize('client'), appointmentController.listMine)
router.patch('/appointments/:id/cancel',      authenticate, authorize('client'), appointmentController.cancelMine)
router.patch('/appointments/:id/reschedule',  authenticate, authorize('client'), appointmentController.rescheduleMine)
router.patch('/appointments/:id/details',     authenticate, authorize('client'), appointmentController.updateDetailsMine)

router.post('/orders', authenticate, authorize('client'), orderController.create)

export { router as clientRoutes }