// src/modules/uploads/upload.routes.ts
import { Router } from 'express'
import multer from 'multer'
import { uploadController } from './upload.controller'
import { authMiddleware } from '../auth/middleware/auth.middleware'

// En memoria (nunca a disco) — el archivo se reenvía tal cual a Supabase
// Storage y no hace falta persistirlo localmente en ningún momento.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB, mismo límite que ya se mostraba en la UI
})

const router = Router()

// Cualquier usuario logueado (cliente, profesional o admin) puede subir una
// imagen — cada pantalla que lo usa (logo del negocio, foto de perfil,
// galería de clienta, diseño de referencia, etc.) ya valida por su cuenta qué
// puede hacer con la URL resultante.
router.post('/image', authMiddleware, upload.single('file'), uploadController.uploadImage)

export { router as uploadRoutes }
