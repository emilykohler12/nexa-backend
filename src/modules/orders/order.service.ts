// src/modules/orders/order.service.ts
import { prisma }   from '../../app/database/prisma'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP }     from '../../app/constants/http'
import { activityService } from '../activity/activity.service'

export const orderService = {

  createForClient: async (clientId: string, data: { productId: string; quantity: number }) => {
    const client = await prisma.user.findUnique({ where: { id: clientId } })
    if (!client) throw new AppError(HTTP.NOT_FOUND, 'Usuario no encontrado', 'NOT_FOUND')

    const product = await prisma.product.findUnique({ where: { id: data.productId } })
    if (!product || product.status !== 'active') {
      throw new AppError(HTTP.BAD_REQUEST, 'Producto no disponible', 'PRODUCT_NOT_FOUND')
    }
    if (product.stock < data.quantity) {
      throw new AppError(HTTP.BAD_REQUEST, 'No hay suficiente stock', 'INSUFFICIENT_STOCK')
    }

    const unitPrice  = Number(product.price)
    const totalPrice = unitPrice * data.quantity

    const [, order] = await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data:  { stock: { decrement: data.quantity } },
      }),
      prisma.productOrder.create({
        data: {
          clientId,
          productId:  product.id,
          quantity:   data.quantity,
          unitPrice,
          totalPrice,
        },
      }),
    ])

    await activityService.log({
      action: 'Compra de producto', module: 'store',
      detail: `${client.name} compró ${data.quantity}x ${product.name} — $${totalPrice.toLocaleString('es-AR')}`,
    })

    return {
      id:         order.id,
      productId:  product.id,
      productName: product.name,
      quantity:   order.quantity,
      unitPrice:  Number(order.unitPrice),
      totalPrice: Number(order.totalPrice),
      createdAt:  order.createdAt.toISOString(),
    }
  },
}
