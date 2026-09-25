// src/modules/uploads/upload.provider.ts
//
// Sube imágenes a Supabase Storage (bucket público "images"). Se usa la
// ANON_KEY del proyecto pero SOLO desde acá (el backend) — nunca se expone al
// navegador, así que no importa que la key en sí no sea secreta: lo que
// protege el upload es que solo un usuario ya autenticado en Nexa (JWT propio,
// ver auth.middleware) puede llegar a este código.
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { env } from '../../app/config/env'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP } from '../../app/constants/http'

const BUCKET = 'images'

const EXT_BY_MIME: Record<string, string> = {
  'image/png':  'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export const uploadProvider = {
  uploadImage: async (buffer: Buffer, mimetype: string, folder = 'general'): Promise<string> => {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw new AppError(HTTP.INTERNAL_SERVER_ERROR, 'El almacenamiento de imágenes no está configurado en el servidor', 'STORAGE_NOT_CONFIGURED')
    }
    const ext = EXT_BY_MIME[mimetype]
    if (!ext) {
      throw new AppError(HTTP.BAD_REQUEST, 'Formato de imagen no soportado (usá PNG, JPG, WEBP o SVG)', 'UNSUPPORTED_IMAGE_TYPE')
    }

    const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const path = `${folder}/${randomUUID()}.${ext}`

    const { error } = await client.storage.from(BUCKET).upload(path, buffer, {
      contentType: mimetype,
      upsert: false,
    })
    if (error) {
      throw new AppError(HTTP.INTERNAL_SERVER_ERROR, 'No se pudo subir la imagen', 'UPLOAD_FAILED')
    }

    const { data } = client.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  },
}
