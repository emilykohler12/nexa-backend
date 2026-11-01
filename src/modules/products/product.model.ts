// src/modules/products/product.model.ts
import { prisma } from '../../app/database/prisma'

export type ProductStatus = 'active' | 'inactive' | 'out_of_stock'

export interface ProductData {
  name:        string
  brand:       string
  category:    string
  description: string
  imageUrl:    string | null
  price:       number
  stock:       number
  minStock:    number
  status:      ProductStatus
}

export const productModel = {

  // Todos los productos, con stock y stock mínimo: solo para el administrador.
  findAll: () =>
    prisma.product.findMany({ orderBy: { createdAt: 'desc' } }),

  // Lo que ve el público: solo activos con stock. Se arma con `select` para que
  // `stock` y `minStock` (datos internos) no salgan nunca por esta ruta.
  findAvailable: () =>
    prisma.product.findMany({
      where:   { status: 'active', stock: { gt: 0 } },
      select:  { id: true, name: true, brand: true, category: true, description: true, imageUrl: true, price: true },
      orderBy: { createdAt: 'desc' },
    }),

  findById: (id: string) =>
    prisma.product.findUnique({ where: { id } }),

  create: (data: ProductData) =>
    prisma.product.create({ data }),

  update: (id: string, data: Partial<ProductData>) =>
    prisma.product.update({ where: { id }, data }),

  delete: async (id: string): Promise<{ deleted: boolean }> => {
    try {
      await prisma.product.delete({ where: { id } })
      return { deleted: true }
    } catch (err: any) {
      // El producto tiene compras registradas (ProductOrder lo referencia con RESTRICT) —
      // no se puede borrar sin perder el historial de ventas, así que se desactiva en su lugar.
      // Postgres devuelve esto como PrismaClientUnknownRequestError (sin err.code), así que
      // se detecta por el mensaje en vez de por un código estructurado.
      const isForeignKeyRestrict = err?.code === 'P2003' || String(err?.message ?? '').includes('foreign key constraint')
      if (isForeignKeyRestrict) {
        await prisma.product.update({ where: { id }, data: { status: 'inactive' } })
        return { deleted: false }
      }
      throw err
    }
  },
}
