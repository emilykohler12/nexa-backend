// src/app/routes.ts
import { Router }             from 'express'
import { authRoutes }         from '../modules/auth/auth.routes'
import { invitationRoutes }   from '../modules/invitations/invitation.routes'
import professionalsRoutes  from '../modules/professionals/professional.routes'
import { clientRoutes }       from '../modules/clients/client.routes'
import { serviceRoutes }      from '../modules/services/service.routes'
import { settingsRoutes }     from '../modules/settings/settings.routes'
import { businessRoutes }     from '../modules/settings/business.routes'
import { productRoutes }      from '../modules/products/product.routes'
import { adminRoutes }        from '../modules/admin/admin.routes'
import { galleryRoutes }      from '../modules/gallery/gallery.routes'
import { scheduleRoutes }     from '../modules/settings/schedule.routes'
import { contactRoutes }      from '../modules/contact/contact.routes'
import { promotionRoutes }    from '../modules/promotions/promotion.routes'
import { reviewRoutes }       from '../modules/reviews/review.routes'
import { whatsappRoutes }     from '../modules/whatsapp/whatsapp.routes'

const router = Router()

router.use('/auth',         authRoutes)
router.use('/invitations',  invitationRoutes)
router.use('/professional', professionalsRoutes)
router.use('/professionals', professionalsRoutes)
router.use('/client',       clientRoutes)
router.use('/services',     serviceRoutes)
router.use('/settings',     settingsRoutes)
router.use('/business',     businessRoutes)
router.use('/store/products', productRoutes)
router.use('/admin',        adminRoutes)
router.use('/gallery',      galleryRoutes)
router.use('/schedule',     scheduleRoutes)
router.use('/contact',      contactRoutes)
router.use('/promotions',   promotionRoutes)
router.use('/reviews',      reviewRoutes)
router.use('/webhook',      whatsappRoutes)

export { router as apiRoutes }