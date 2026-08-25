// src/modules/gallery/gallery.routes.ts
import { Router } from 'express'
import { prisma } from '../../app/database/prisma'

const router = Router()

// Pública — sin datos identificatorios del cliente, para la home.
// Empareja la foto "antes" con la "después" del mismo cliente (en orden
// cronológico) para el efecto hover antes/después. Una foto sin su par
// todavía se muestra, pero sin el hover (el otro lado queda null).
router.get('/public', async (_req, res, next) => {
  try {
    const rows = await prisma.clientGalleryPhoto.findMany({
      where:   { showOnHome: true },
      orderBy: { createdAt: 'asc' },
      select:  { id: true, url: true, category: true, clientId: true },
    })

    const byClient = new Map<string, { before: typeof rows; after: typeof rows }>()
    for (const r of rows) {
      const bucket = byClient.get(r.clientId) ?? { before: [], after: [] }
      if (r.category === 'before') bucket.before.push(r)
      else if (r.category === 'after') bucket.after.push(r)
      byClient.set(r.clientId, bucket)
    }

    const pairs: { id: string; before: string | null; after: string | null }[] = []
    for (const { before, after } of byClient.values()) {
      const pairCount = Math.min(before.length, after.length)
      for (let i = 0; i < pairCount; i++) {
        pairs.push({ id: before[i].id, before: before[i].url, after: after[i].url })
      }
      for (let i = pairCount; i < before.length; i++) {
        pairs.push({ id: before[i].id, before: before[i].url, after: null })
      }
      for (let i = pairCount; i < after.length; i++) {
        pairs.push({ id: after[i].id, before: null, after: after[i].url })
      }
    }

    res.json({ pairs })
  } catch (err) { next(err) }
})

export { router as galleryRoutes }
