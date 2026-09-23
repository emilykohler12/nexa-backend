// src/modules/admin/admin.routes.ts
import { Router } from 'express'
import { adminController } from './admin.controller'
import { appointmentController } from '../appointments/appointment.controller'
import { promotionController }   from '../promotions/promotion.controller'
import { autoPromotionController } from '../promotions/autoPromotion.controller'
import { specialEventController } from '../specialEvents/specialEvent.controller'
import { reviewController }      from '../reviews/review.controller'
import { authMiddleware } from '../auth/middleware/auth.middleware'
import { requireRole }    from '../auth/middleware/guest.middleware'

const router = Router()

router.use(authMiddleware, requireRole('admin'))

router.get ('/clients',             adminController.getClients)
router.post('/clients',             adminController.createClient)
router.get ('/clients/:id/history', adminController.getClientHistory)
router.get ('/clients/:id/gallery',              adminController.getClientGallery)
router.post('/clients/:id/gallery',              adminController.addClientGalleryPhoto)
router.patch('/clients/:id/gallery/:photoId',    adminController.updateClientGalleryPhoto)
router.delete('/clients/:id/gallery/:photoId',   adminController.deleteClientGalleryPhoto)
router.put ('/clients/:id',         adminController.updateClient)
router.patch('/clients/:id/block',  adminController.setClientBlocked)
// RF-06.03 — supresión de datos personales a pedido del cliente. No borra la
// fila (mantiene turnos e historial contable), solo anonimiza nombre/email/teléfono.
router.post('/clients/:id/anonymize', adminController.anonymizeClient)
router.get ('/clients/:id/reviews', reviewController.getForClient)
router.get ('/clients/:id/auto-promotions', autoPromotionController.getForClient)

router.get('/appointments',      appointmentController.listForAdmin)
router.post('/appointments',      appointmentController.createForAdmin)
router.patch('/appointments/:id', appointmentController.updateForAdmin)
router.patch('/appointments/:id/arrival', appointmentController.markArrivalForAdmin)

router.get('/activity',  adminController.getActivity)
router.get('/dashboard', adminController.getDashboard)

router.get   ('/promotions',     promotionController.getAll)
router.post  ('/promotions',     promotionController.create)
router.put   ('/promotions/:id', promotionController.update)
router.delete('/promotions/:id', promotionController.delete)

// Campañas automáticas (cumpleaños, turno N, etc.) — nunca se muestran en el
// home, son reglas que evalúa un job diario (ver src/jobs/autoPromotions.job.ts).
router.get   ('/auto-promotions',     autoPromotionController.getAll)
router.post  ('/auto-promotions',     autoPromotionController.create)
router.put   ('/auto-promotions/:id', autoPromotionController.update)
router.delete('/auto-promotions/:id', autoPromotionController.delete)

// Eventos especiales destacados en el home (ej: jornada de Depilación
// definitiva con una profesional puntual) — sí se muestran en el home.
router.get   ('/special-events',     specialEventController.getAll)
router.post  ('/special-events',     specialEventController.create)
router.put   ('/special-events/:id', specialEventController.update)
router.delete('/special-events/:id', specialEventController.delete)

router.patch('/reviews/:id/approve', reviewController.approve)
router.patch('/reviews/:id/reject',  reviewController.reject)

export { router as adminRoutes }
