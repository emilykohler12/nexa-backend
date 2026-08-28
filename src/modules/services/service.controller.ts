// src/modules/services/service.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { serviceModel } from './service.model'
import { AppError }     from '../../app/middlewares/errorHandler'
import { HTTP }         from '../../app/constants/http'
import { z }            from 'zod'
import { dateSchema, timeSchema } from '../../app/validators/datetime'

const specialSlotSchema = z.object({
  id:               z.string().optional(),
  time:             timeSchema,
  professionalId:   z.string().uuid('ID de profesional inválido'),
  professionalName: z.string().optional(),
  active:           z.boolean(),
  clientName:       z.string().nullable().optional(),
  appointmentId:    z.string().nullable().optional(),
})

const serviceZoneSchema = z.object({
  id:       z.string().min(1),
  name:     z.string().trim().min(1, 'La zona necesita un nombre').max(150),
  duration: z.coerce.number().int().min(0).max(480),
  price:    z.coerce.number().min(0).max(999999),
  active:   z.boolean(),
})

const servicePackageSchema = z.object({
  id:       z.string().min(1),
  name:     z.string().trim().min(1, 'El paquete necesita un nombre').max(150),
  zoneIds:  z.array(z.string()),
  duration: z.coerce.number().int().min(0).max(480),
  price:    z.coerce.number().min(0).max(999999),
  active:   z.boolean(),
})

const serviceSchema = z.object({
  name:        z.string().trim().min(2,  'El nombre debe tener al menos 2 caracteres').max(150),
  categoryId:  z.string().trim().min(1,  'Seleccioná una categoría'),
  description: z.string().trim().min(5,  'Agregá una descripción breve').max(1000),
  // Para servicios especiales, duration/price de acá no se usan (van 0) —
  // el mínimo real de 5 min se valida aparte, solo cuando no es especial.
  duration:    z.coerce.number().int().min(0).max(480),
  price:       z.coerce.number().min(0).max(999999),
  image:       z.string().url('URL de imagen inválida').nullable().optional(),
  status:      z.enum(['active', 'inactive']).default('active'),
  isCombo:     z.coerce.boolean().default(false),
  comboServiceIds: z.array(z.string().uuid()).default([]),
  simultaneous:    z.coerce.boolean().default(false),
  isSpecial:    z.coerce.boolean().default(false),
  specialDate:  dateSchema.nullable().optional(),
  specialSlots: z.array(specialSlotSchema).default([]),
  zones:        z.array(serviceZoneSchema).default([]),
  packages:     z.array(servicePackageSchema).default([]),
})

// Reglas cruzadas que dependen de más de un campo — no se pueden expresar
// solo con Zod si vamos a reutilizar el mismo schema (con .partial()) para el
// update. El admin siempre manda el objeto completo, así que esto corre igual
// en create y en update.
function assertServiceRules(data: {
  isSpecial?: boolean; specialDate?: string | null; duration?: number
  packages?: { zoneIds: string[] }[]; zones?: { id: string }[]
}) {
  if (data.isSpecial) {
    if (!data.specialDate) {
      throw new AppError(HTTP.BAD_REQUEST, 'Un servicio especial necesita una fecha', 'VALIDATION_ERROR')
    }
  } else if (data.duration !== undefined && data.duration < 5) {
    throw new AppError(HTTP.BAD_REQUEST, 'Mínimo 5 minutos', 'VALIDATION_ERROR')
  }

  if (data.zones && data.packages) {
    const zoneIds = new Set(data.zones.map(z => z.id))
    for (const pack of data.packages) {
      if (pack.zoneIds.some(zid => !zoneIds.has(zid))) {
        throw new AppError(HTTP.BAD_REQUEST, 'Un paquete hace referencia a una zona que no existe', 'VALIDATION_ERROR')
      }
    }
  }
}

// Los horarios nuevos llegan sin id (el form del admin no los genera) — se les
// asigna uno acá para que tengan una identidad estable una vez guardados.
function withSlotIds<T extends { id?: string }>(items: T[]): (T & { id: string })[] {
  return items.map(item => ({ ...item, id: item.id ?? randomUUID() }))
}

function getId(req: Request): string {
  const { id } = req.params
  if (!id || typeof id !== 'string' || id.length > 100) {
    throw new AppError(HTTP.BAD_REQUEST, 'ID inválido')
  }
  return id
}

export const serviceController = {

  getAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const services = await serviceModel.findAll()
      res.json({ services })
    } catch (err) { next(err) }
  },

  getActive: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const services = await serviceModel.findActive()
      res.json({ services })
    } catch (err) { next(err) }
  },

  create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = serviceSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      assertServiceRules(parsed.data)

      const service = await serviceModel.create({
        ...parsed.data,
        image:       parsed.data.image ?? null,
        specialDate: parsed.data.specialDate ?? null,
        specialSlots: withSlotIds(parsed.data.specialSlots),
      })
      res.status(HTTP.CREATED).json({ service })
    } catch (err) { next(err) }
  },

  update: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id     = getId(req)
      const parsed = serviceSchema.partial().safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      assertServiceRules(parsed.data)

      const service = await serviceModel.update(id, {
        ...parsed.data,
        ...(parsed.data.specialSlots !== undefined ? { specialSlots: withSlotIds(parsed.data.specialSlots) } : {}),
      })
      res.json({ service })
    } catch (err) { next(err) }
  },

  toggleStatus: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id      = getId(req)
      const service = await serviceModel.toggleStatus(id)
      if (!service) throw new AppError(HTTP.NOT_FOUND, 'Servicio no encontrado')
      res.json({ service })
    } catch (err) { next(err) }
  },

  delete: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getId(req)
      const result = await serviceModel.delete(id)
      res.json({
        success:     true,
        deactivated: !result.deleted,
        message:     result.deleted
          ? undefined
          : 'El servicio tiene turnos registrados, así que se desactivó en vez de eliminarse para no perder el historial.',
      })
    } catch (err) { next(err) }
  },
}
