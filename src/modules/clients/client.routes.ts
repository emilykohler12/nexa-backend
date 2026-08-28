// src/modules/clients/client.routes.ts
import { Router }       from 'express'
import { clientController } from './client.controller'
import { appointmentController } from '../appointments/appointment.controller'
import { orderController } from '../orders/order.controller'
import { reviewController } from '../reviews/review.controller'
import { authenticate }  from '../auth/middleware/auth.middleware'
import { authorize }     from '../auth/middleware/auth.middleware'

const router = Router()

router.get( '/profile',  authenticate, authorize('client'), clientController.getProfile)
router.patch('/profile', authenticate, authorize('client'), clientController.updateProfile)

router.post ('/appointments',            authenticate, authorize('client'), appointmentController.create)
router.post ('/appointments/combo',      authenticate, authorize('client'), appointmentController.createCombo)
router.post ('/appointments/special',    authenticate, authorize('client'), appointmentController.createSpecial)
router.get  ('/appointments',            authenticate, authorize('client'), appointmentController.listMine)
router.patch('/appointments/:id/cancel',      authenticate, authorize('client'), appointmentController.cancelMine)
router.patch('/appointments/:id/reschedule',  authenticate, authorize('client'), appointmentController.rescheduleMine)
router.patch('/appointments/:id/details',     authenticate, authorize('client'), appointmentController.updateDetailsMine)
router.patch('/appointments/:id/acknowledge-reschedule', authenticate, authorize('client'), appointmentController.acknowledgeReschedule)

router.post('/orders', authenticate, authorize('client'), orderController.create)
router.get ('/orders', authenticate, authorize('client'), orderController.listMine)

router.get  ('/notifications',            authenticate, authorize('client'), clientController.getMyNotifications)
router.patch('/notifications/read-all',   authenticate, authorize('client'), clientController.markAllNotificationsRead)
router.patch('/notifications/:id/read',   authenticate, authorize('client'), clientController.markNotificationRead)

router.get ('/reviews/pending', authenticate, authorize('client'), reviewController.getPendingMine)
router.post('/reviews/dismiss', authenticate, authorize('client'), reviewController.dismiss)
router.post('/reviews',         authenticate, authorize('client'), reviewController.create)
router.get ('/reviews',         authenticate, authorize('client'), reviewController.getMine)

export { router as clientRoutes }