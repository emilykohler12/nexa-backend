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

// Stock actualizado del/los producto(s) afectados por el movimiento — para que
// el admin pueda actualizar el número en pantalla sin recargar la página.
export interface AffectedProduct {
  id:    string
  stock: number
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
      const movement = await tx.inventoryMovement.create({
        data: { ...data, productName: product.name },
      })
      const affectedProducts: AffectedProduct[] = [{ id: product.id, stock: newStock }]
      return { movement, affectedProducts }
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
      const updatedTarget = await tx.product.update({ where: { id: merged.productId }, data: { stock: { increment: applyDelta } } })

      const movement = await tx.inventoryMovement.update({
        where: { id },
        data:  { ...merged, productName: targetProduct.name },
      })
      // Si el movimiento pasó a otro producto, el original también cambió (se
      // le devolvió el stock) — hay que avisarle al frontend de los dos.
      const affectedProducts: AffectedProduct[] = [{ id: updatedTarget.id, stock: updatedTarget.stock }]
      if (existing.productId !== merged.productId) {
        const revertedOriginal = await tx.product.findUnique({ where: { id: existing.productId } })
        if (revertedOriginal) affectedProducts.push({ id: revertedOriginal.id, stock: revertedOriginal.stock })
      }
      return { movement, affectedProducts }
    }),

  delete: (id: string) =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryMovement.findUnique({ where: { id } })
      if (!existing) throw new AppError(HTTP.NOT_FOUND, 'Movimiento no encontrado', 'NOT_FOUND')

      const revertDelta = -deltaFor(existing.type as MovementType, existing.quantity)
      const reverted = await tx.product.update({ where: { id: existing.productId }, data: { stock: { increment: revertDelta } } })
      await tx.inventoryMovement.delete({ where: { id } })
      const affectedProducts: AffectedProduct[] = [{ id: reverted.id, stock: reverted.stock }]
      return { affectedProducts }
    }),
}
