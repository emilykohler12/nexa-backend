// src/modules/products/product.model.ts
import { prisma } from '../../app/database/prisma'

export type ProductStatus = 'active' | 'inactive' | 'out_of_stock'

export interface ProductData {
  name:     string
  brand:    string
  category: string
  imageUrl: string | null
  price:    number
  stock:    number
  minStock: number
  status:   ProductStatus
}

export const productModel = {

  findAll: () =>
    prisma.product.findMany({ orderBy: { createdAt: 'desc' } }),

  findById: (id: string) =>
    prisma.product.findUnique({ where: { id } }),

  create: (data: ProductData) =>
    prisma.product.create({ data }),

  update: (id: string, data: Partial<ProductData>) =>
    prisma.product.update({ where: { id }, data }),

  delete: (id: string) =>
    prisma.product.delete({ where: { id } }),
}
