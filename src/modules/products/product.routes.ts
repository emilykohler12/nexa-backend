// src/modules/products/product.routes.ts
import { Router }            from 'express'
import { productController } from './product.controller'
import { authenticate }      from '../auth/middleware/auth.middleware'
import { requireRole }       from '../auth/middleware/guest.middleware'

const router = Router()

// Pública — el admin la usa para gestionar (ve todo) y la home para mostrar la tienda (filtra activos)
router.get('/', productController.getAll)

// Admin — requiere autenticación y rol admin
router.post(  '/',    authenticate, requireRole('admin'), productController.create)
router.put(  '/:id',  authenticate, requireRole('admin'), productController.update)
router.delete('/:id', authenticate, requireRole('admin'), productController.delete)

export { router as productRoutes }
