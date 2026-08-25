// src/modules/services/service.routes.ts
import { Router }            from 'express'
import { serviceController } from './service.controller'
import { authenticate }      from '../auth/middleware/auth.middleware'
import { requireRole }       from '../auth/middleware/guest.middleware'

const router = Router()

// Pública — la página home la usa para mostrar servicios
router.get('/', serviceController.getActive)

// Admin — requiere autenticación y rol admin
router.get(    '/all',        authenticate, requireRole('admin'), serviceController.getAll)
router.post(   '/',           authenticate, requireRole('admin'), serviceController.create)
router.put(    '/:id',        authenticate, requireRole('admin'), serviceController.update)
router.patch(  '/:id/status', authenticate, requireRole('admin'), serviceController.toggleStatus)
router.delete( '/:id',        authenticate, requireRole('admin'), serviceController.delete)

export { router as serviceRoutes }