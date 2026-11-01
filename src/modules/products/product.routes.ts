// src/modules/products/product.routes.ts
import { Router }            from 'express'
import { productController } from './product.controller'
import { authenticate }      from '../auth/middleware/auth.middleware'
import { requireRole }       from '../auth/middleware/guest.middleware'

const router = Router()

// Pública — solo productos activos con stock (la lista completa del admin es GET /api/admin/store/products)
router.get('/', productController.getAll)

// Admin — requiere autenticación y rol admin
router.post(  '/',    authenticate, requireRole('admin'), productController.create)
router.put(  '/:id',  authenticate, requireRole('admin'), productController.update)
router.delete('/:id', authenticate, requireRole('admin'), productController.delete)

export { router as productRoutes }
