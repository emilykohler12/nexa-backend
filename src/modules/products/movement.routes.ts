// src/modules/products/movement.routes.ts
import { Router } from 'express'
import { inventoryMovementController } from './inventoryMovement.controller'
import { authenticate } from '../auth/middleware/auth.middleware'
import { requireRole }  from '../auth/middleware/guest.middleware'

const router = Router()

router.use(authenticate, requireRole('admin'))

router.get   ('/',     inventoryMovementController.getAll)
router.post  ('/',     inventoryMovementController.create)
router.put   ('/:id',  inventoryMovementController.update)
router.delete('/:id',  inventoryMovementController.delete)

export { router as movementRoutes }
