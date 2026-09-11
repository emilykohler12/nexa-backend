// src/modules/products/inventoryMovement.model.ts
//
// Ledger de entradas/salidas de stock. Cada movimiento ajusta Product.stock
// al crearse/editarse/borrarse, siempre dentro de una transacción para que
// el stock y el historial nunca queden desincronizados.
import { prisma } from '../../app/database/prisma'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP }     from '../../app/constants/http'

export type MovementType = 'entry' | 'exit'

export interface MovementInput {
  productId: string
  type:      MovementType
  quantity:  number
  note:      string
  date:      string
}

// entry suma stock, exit lo resta.
function deltaFor(type: MovementType, quantity: number): number {
  return type === 'entry' ? quantity : -quantity
}

export const inventoryMovementModel = {

  findAll: () =>
    prisma.inventoryMovement.findMany({ orderBy: { createdAt: 'desc' } }),

  create: (data: MovementInput) =>
    prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: data.productId } })
      if (!product) throw new AppError(HTTP.BAD_REQUEST, 'Producto no encontrado', 'PRODUCT_NOT_FOUND')

      const newStock = product.stock + deltaFor(data.type, data.quantity)
      if (newStock < 0) {
        throw new AppError(HTTP.BAD_REQUEST, `No hay suficiente stock de ${product.name} para registrar esa salida`, 'INSUFFICIENT_STOCK')
      }

      await tx.product.update({ where: { id: data.productId }, data: { stock: newStock } })
      return tx.inventoryMovement.create({
        data: { ...data, productName: product.name },
      })
    }),

  update: (id: string, data: Partial<MovementInput>) =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryMovement.findUnique({ where: { id } })
      if (!existing) throw new AppError(HTTP.NOT_FOUND, 'Movimiento no encontrado', 'NOT_FOUND')

      // Deshace el efecto del movimiento viejo sobre su producto original.
      const revertDelta = -deltaFor(existing.type as MovementType, existing.quantity)
      await tx.product.update({ where: { id: existing.productId }, data: { stock: { increment: revertDelta } } })

      const merged: MovementInput = {
        productId: data.productId ?? existing.productId,
        type:      (data.type ?? existing.type) as MovementType,
        quantity:  data.quantity ?? existing.quantity,
        note:      data.note ?? existing.note,
        date:      data.date ?? existing.date,
      }

      const targetProduct = await tx.product.findUnique({ where: { id: merged.productId } })
      if (!targetProduct) throw new AppError(HTTP.BAD_REQUEST, 'Producto no encontrado', 'PRODUCT_NOT_FOUND')

      const applyDelta = deltaFor(merged.type, merged.quantity)
      if (targetProduct.stock + applyDelta < 0) {
        throw new AppError(HTTP.BAD_REQUEST, `No hay suficiente stock de ${targetProduct.name} para registrar esa salida`, 'INSUFFICIENT_STOCK')
      }
      await tx.product.update({ where: { id: merged.productId }, data: { stock: { increment: applyDelta } } })

      return tx.inventoryMovement.update({
        where: { id },
        data:  { ...merged, productName: targetProduct.name },
      })
    }),

  delete: (id: string) =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryMovement.findUnique({ where: { id } })
      if (!existing) throw new AppError(HTTP.NOT_FOUND, 'Movimiento no encontrado', 'NOT_FOUND')

      const revertDelta = -deltaFor(existing.type as MovementType, existing.quantity)
      await tx.product.update({ where: { id: existing.productId }, data: { stock: { increment: revertDelta } } })
      await tx.inventoryMovement.delete({ where: { id } })
    }),
}
