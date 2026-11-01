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

// El `mimetype` lo declara el cliente, así que no alcanza: se comprueba que los primeros bytes
// sean los de una imagen de ese formato (firma del archivo).
function matchesSignature(buffer: Buffer, mimetype: string): boolean {
  switch (mimetype) {
    case 'image/png':
      return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    case 'image/jpeg':
      return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    case 'image/webp':
      return buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
    case 'image/svg+xml':
      return isSafeSvg(buffer)
    default:
      return false
  }
}

// Un SVG es XML y puede llevar JavaScript: abierto directo desde el bucket público se ejecutaría
// en ese dominio. Por eso solo lo sube el admin (ver upload.controller) y además se rechaza el que
// trae scripts, manejadores de eventos, enlaces javascript: o contenido embebido.
function isSafeSvg(buffer: Buffer): boolean {
  if (buffer.length > 512 * 1024) return false
  const text = buffer.toString('utf8')
  if (!/^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return false
  return !/<script|<foreignObject|<iframe|<embed|<object|<!ENTITY|<!DOCTYPE|\son[a-z]+\s*=|javascript:|data:text\/html/i.test(text)
}

export const uploadProvider = {
  uploadImage: async (buffer: Buffer, mimetype: string, folder = 'general'): Promise<string> => {
    const ext = EXT_BY_MIME[mimetype]
    if (!ext) {
      throw new AppError(HTTP.BAD_REQUEST, 'Formato de imagen no soportado (usá PNG, JPG, WEBP o SVG)', 'UNSUPPORTED_IMAGE_TYPE')
    }
    if (!matchesSignature(buffer, mimetype)) {
      throw new AppError(HTTP.BAD_REQUEST, 'El archivo no es una imagen válida', 'INVALID_IMAGE_CONTENT')
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw new AppError(HTTP.INTERNAL_SERVER_ERROR, 'El almacenamiento de imágenes no está configurado en el servidor', 'STORAGE_NOT_CONFIGURED')
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

  // Borra del bucket los archivos de las URL públicas que le pasen. Nunca lanza: devuelve las URL que
  // no se pudieron borrar para que quien llama decida qué hacer (la anonimización las deja en el registro).
  // Supabase no da error cuando una política del bucket impide borrar: `remove` devuelve en `data` solo los
  // archivos que de verdad borró, así que lo que falte ahí cuenta como fallido.
  deleteImages: async (urls: string[]): Promise<{ deleted: string[]; failed: string[] }> => {
    if (urls.length === 0) return { deleted: [], failed: [] }
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return { deleted: [], failed: [...urls] }

    const prefix = `${env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/`
    const pathByUrl = new Map<string, string>()
    const failed: string[] = []
    for (const url of urls) {
      if (url.startsWith(prefix) && url.length > prefix.length) {
        try { pathByUrl.set(url, decodeURIComponent(url.slice(prefix.length).split('?')[0])) }
        catch { failed.push(url) }
      } else {
        // No es un archivo de nuestro bucket (por ejemplo una URL externa): no hay nada que borrar acá.
        failed.push(url)
      }
    }
    if (pathByUrl.size === 0) return { deleted: [], failed }

    try {
      const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
      const { data, error } = await client.storage.from(BUCKET).remove([...new Set(pathByUrl.values())])
      const removed = new Set(error ? [] : (data ?? []).map(f => f.name))
      const deleted: string[] = []
      for (const [url, path] of pathByUrl) (removed.has(path) ? deleted : failed).push(url)
      return { deleted, failed }
    } catch {
      return { deleted: [], failed: [...failed, ...pathByUrl.keys()] }
    }
  },
}
