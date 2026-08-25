// src/modules/invitations/invitation.routes.ts
import { Router }                from 'express'
import { invitationController }  from './invitation.controller'
import { authenticate }          from '../auth/middleware/auth.middleware'
import { requireRole }           from '../auth/middleware/guest.middleware'

const router = Router()

router.post('/',          authenticate, requireRole('admin'), invitationController.send)
router.get( '/validate',  invitationController.validate)
router.post('/register',  invitationController.register)

export { router as invitationRoutes }