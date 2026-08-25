// src/modules/admin/admin.routes.ts
import { Router } from 'express'
import { adminController } from './admin.controller'
import { appointmentController } from '../appointments/appointment.controller'
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

router.get('/appointments',      appointmentController.listForAdmin)
router.patch('/appointments/:id', appointmentController.updateForAdmin)

router.get('/activity',  adminController.getActivity)
router.get('/dashboard', adminController.getDashboard)

export { router as adminRoutes }
