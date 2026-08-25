// src/modules/professionals/professional.routes.ts
import { Router } from 'express'
import { professionalsController } from './professional.controller'
import { appointmentController }    from '../appointments/appointment.controller'
import { authMiddleware }           from '../auth/middleware/auth.middleware'
import { requireRole }              from '../auth/middleware/guest.middleware'

const router = Router()

// ── Público — usadas por la home y el flujo de reserva, sin login ──
router.get('/public',            professionalsController.getAllPublic)
router.get('/:id/availability',  professionalsController.getPublicAvailability)

// ── Self-service — profesional autenticado ──────────────────────────
// IMPORTANTE: todas las rutas de un solo segmento (ej. "/statistics") deben
// registrarse ACÁ, antes del bloque admin — si no, quedan tapadas por la
// ruta admin "/:id" (Express matchea por orden de registro, no por
// especificidad, así que "/statistics" caería en :id = "statistics").
router.get('/profile',           authMiddleware, requireRole('professional'), professionalsController.getMyProfile)
router.patch('/profile',         authMiddleware, requireRole('professional'), professionalsController.updateMyProfile)
router.get('/services',          authMiddleware, requireRole('professional'), professionalsController.getMyServices)
router.patch('/services',        authMiddleware, requireRole('professional'), professionalsController.updateMyServices)
router.patch('/schedule',        authMiddleware, requireRole('professional'), professionalsController.updateMySchedule)
router.post('/onboarding',       authMiddleware, requireRole('professional'), professionalsController.submitOnboarding)
router.get('/onboarding/status', authMiddleware, requireRole('professional'), professionalsController.onboardingStatus)
router.get('/appointments',      authMiddleware, requireRole('professional'), appointmentController.listForProfessional)
router.patch('/appointments/:id',authMiddleware, requireRole('professional'), appointmentController.updateForProfessional)
router.get('/clients',           authMiddleware, requireRole('professional'), appointmentController.listClientsForProfessional)
router.get('/statistics',        authMiddleware, requireRole('professional'), professionalsController.getMyStatistics)
router.get('/notifications',              authMiddleware, requireRole('professional'), professionalsController.getMyNotifications)
router.patch('/notifications/read-all',   authMiddleware, requireRole('professional'), professionalsController.markAllNotificationsRead)
router.patch('/notifications/:id/read',   authMiddleware, requireRole('professional'), professionalsController.markNotificationRead)

// ── Admin ────────────────────────────────────────────────────────────
router.get('/',                    authMiddleware, requireRole('admin'), professionalsController.getAll)
router.get('/:id/history',         authMiddleware, requireRole('admin'), appointmentController.getHistoryForProfessional)
router.get('/:id',                 authMiddleware, requireRole('admin'), professionalsController.getById)
router.patch('/:id',               authMiddleware, requireRole('admin'), professionalsController.updateById)
router.patch('/:id/toggle-active', authMiddleware, requireRole('admin'), professionalsController.toggleActive)
router.patch('/:id/toggle-role',   authMiddleware, requireRole('admin'), professionalsController.toggleRole)

export default router
