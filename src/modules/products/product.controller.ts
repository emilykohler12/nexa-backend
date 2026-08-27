// src/modules/products/product.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { productModel } from './product.model'
import { AppError }     from '../../app/middlewares/errorHandler'
import { HTTP }         from '../../app/constants/http'
import { z }            from 'zod'

const productSchema = z.object({
  name:     z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(150),
  brand:    z.string().trim().max(100).optional().default(''),
  category: z.string().trim().max(50).optional().default(''),
  description: z.string().trim().max(2000).optional().default(''),
  imageUrl: z.string().url('URL de imagen inválida').nullable().optional(),
  price:    z.coerce.number().min(0, 'El precio no puede ser negativo').max(999999),
  stock:    z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(0),
  status:   z.enum(['active', 'inactive', 'out_of_stock']).default('active'),
})

function getId(req: Request): string {
  const { id } = req.params
  if (!id || typeof id !== 'string' || id.length > 100) {
    throw new AppError(HTTP.BAD_REQUEST, 'ID inválido')
  }
  return id
}

export const productController = {

  getAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const products = await productModel.findAll()
      res.json({ products })
    } catch (err) { next(err) }
  },

  create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = productSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      const product = await productModel.create({
        ...parsed.data,
        imageUrl: parsed.data.imageUrl ?? null,
      })
      res.status(HTTP.CREATED).json({ product })
    } catch (err) { next(err) }
  },

  update: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id     = getId(req)
      const parsed = productSchema.partial().safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      const product = await productModel.update(id, parsed.data)
      res.json({ product })
    } catch (err) { next(err) }
  },

  delete: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getId(req)
      const result = await productModel.delete(id)
      res.json({
        success:     true,
        deactivated: !result.deleted,
        message:     result.deleted
          ? undefined
          : 'El producto tiene compras registradas, así que se desactivó en vez de eliminarse para no perder el historial de ventas.',
      })
    } catch (err) { next(err) }
  },
}
