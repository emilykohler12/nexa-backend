// src/modules/orders/order.service.ts
import { prisma }   from '../../app/database/prisma'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP }     from '../../app/constants/http'
import { activityService } from '../activity/activity.service'

type OrderItemInput = { productId: string; quantity: number; promotionId?: string | null }
type PromotionItem  = { id: string; name: string; price: number }
type ResolvedLine    = { productId: string; quantity: number; unitPrice?: number }

function pad(n: number) { return String(n).padStart(2, '0') }
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isPromoLive(promo: { status: string; startDate: string | null; endDate: string | null }): boolean {
  if (promo.status !== 'active') return false
  const today = todayStr()
  if (promo.startDate && promo.startDate > today) return false
  if (promo.endDate && promo.endDate < today) return false
  return true
}

// Valida un grupo de líneas del carrito que comparten un mismo promotionId contra
// la promo real, y devuelve las líneas ya repriceadas con el precio de la promo
// (nunca el que mande el cliente) — así el total cobrado coincide con lo anunciado
// sin confiar en nada que venga del front.
async function resolvePromotionGroup(promotionId: string, lines: OrderItemInput[]): Promise<ResolvedLine[]> {
  const promo = await prisma.promotion.findUnique({ where: { id: promotionId } })
  if (!promo || !isPromoLive(promo)) {
    throw new AppError(HTTP.BAD_REQUEST, 'Una de las promociones de tu carrito ya no está disponible. Actualizá el carrito e intentá de nuevo.', 'PROMOTION_NOT_AVAILABLE')
  }

  const promoItems = (promo.items as unknown as PromotionItem[] | null) ?? []
  const promoItemIds = new Set(promoItems.map(i => i.id))
  const lineProductIds = new Set(lines.map(l => l.productId))
  const sameSet = promoItemIds.size === lineProductIds.size && [...promoItemIds].every(id => lineProductIds.has(id))
  if (!sameSet || promoItems.length === 0) {
    throw new AppError(HTTP.BAD_REQUEST, 'El carrito no coincide con los productos de la promoción. Actualizá el carrito e intentá de nuevo.', 'PROMOTION_MISMATCH')
  }

  if (promo.kind === 'bundle') {
    const quantities = new Set(lines.map(l => l.quantity))
    if (quantities.size !== 1 || lines[0].quantity < 1) {
      throw new AppError(HTTP.BAD_REQUEST, 'Todos los productos del combo deben tener la misma cantidad', 'PROMOTION_MISMATCH')
    }
    const n = lines[0].quantity
    const realTotal = promoItems.reduce((s, i) => s + i.price, 0) || 1
    return promoItems.map(item => ({
      productId: item.id,
      quantity:  n,
      unitPrice: Math.round(item.price * (Number(promo.price) / realTotal)),
    }))
  }

  if (promo.kind === 'buy_x_pay_y') {
    if (!promo.buyQty || !promo.payQty) {
      throw new AppError(HTTP.BAD_REQUEST, 'Esta promoción no está bien configurada', 'PROMOTION_MISMATCH')
    }
    const line = lines[0]
    if (lines.length !== 1 || line.quantity < promo.buyQty || line.quantity % promo.buyQty !== 0) {
      throw new AppError(HTTP.BAD_REQUEST, `La cantidad debe ser múltiplo de ${promo.buyQty} para esta oferta`, 'PROMOTION_MISMATCH')
    }
    return [{
      productId: line.productId,
      quantity:  line.quantity,
      unitPrice: Math.round((Number(promo.price) * promo.payQty) / promo.buyQty),
    }]
  }

  // discount
  const line = lines[0]
  if (lines.length !== 1) {
    throw new AppError(HTTP.BAD_REQUEST, 'Esta promoción no está bien configurada', 'PROMOTION_MISMATCH')
  }
  return [{ productId: line.productId, quantity: line.quantity, unitPrice: Number(promo.price) }]
}

export const orderService = {

  createForClient: async (clientId: string, data: {
    items: OrderItemInput[]
    delivery: { type: 'pickup' | 'delivery'; address?: string | null }
    phone?: string | null
    notes?: string | null
    paymentMethod?: 'qr' | 'link' | 'card' | null
  }) => {
    const client = await prisma.user.findUnique({ where: { id: clientId } })
    if (!client) throw new AppError(HTTP.NOT_FOUND, 'Usuario no encontrado', 'NOT_FOUND')

    const clientProfile = await prisma.client.findUnique({ where: { userId: clientId } })
    if (clientProfile?.blocked) {
      throw new AppError(HTTP.FORBIDDEN, 'Tu cuenta está bloqueada y no puede realizar compras. Contactanos para más información.', 'CLIENT_BLOCKED')
    }

    // Separa líneas con promo (se repricean contra la promo real) de líneas de
    // catálogo normal — cada grupo de promo se valida como unidad.
    const promoGroups = new Map<string, OrderItemInput[]>()
    const resolved: ResolvedLine[] = []
    for (const item of data.items) {
      if (item.promotionId) {
        const group = promoGroups.get(item.promotionId) ?? []
        group.push(item)
        promoGroups.set(item.promotionId, group)
      } else {
        resolved.push({ productId: item.productId, quantity: item.quantity })
      }
    }
    for (const [promotionId, lines] of promoGroups) {
      resolved.push(...await resolvePromotionGroup(promotionId, lines))
    }

    // Stock: se valida por la cantidad TOTAL pedida de cada producto, sumando
    // todas las líneas que lo mencionen (catálogo + una o más promos).
    const totalQtyByProduct = new Map<string, number>()
    for (const r of resolved) {
      totalQtyByProduct.set(r.productId, (totalQtyByProduct.get(r.productId) ?? 0) + r.quantity)
    }

    const products = await prisma.product.findMany({ where: { id: { in: [...totalQtyByProduct.keys()] } } })
    const productById = new Map(products.map(p => [p.id, p]))

    for (const [productId, qty] of totalQtyByProduct) {
      const product = productById.get(productId)
      if (!product || product.status !== 'active') {
        throw new AppError(HTTP.BAD_REQUEST, 'Uno de los productos no está disponible', 'PRODUCT_NOT_FOUND')
      }
      if (product.stock < qty) {
        throw new AppError(HTTP.BAD_REQUEST, `No hay suficiente stock de ${product.name}`, 'INSUFFICIENT_STOCK')
      }
    }

    // Línea final por cada entrada resuelta — no se fusionan entre sí aunque sea el
    // mismo producto, porque una línea de promo y una de catálogo tienen precios
    // distintos y deben quedar registradas por separado.
    const lineItems = resolved.map(r => {
      const product = productById.get(r.productId)!
      const unitPrice = r.unitPrice ?? Number(product.price)
      return { productId: r.productId, productName: product.name, quantity: r.quantity, unitPrice, totalPrice: unitPrice * r.quantity }
    })
    const totalPrice = lineItems.reduce((s, li) => s + li.totalPrice, 0)

    const deliveryType    = data.delivery.type
    const deliveryAddress = deliveryType === 'delivery' ? (data.delivery.address ?? null) : null

    const order = await prisma.$transaction(async (tx) => {
      for (const [productId, qty] of totalQtyByProduct) {
        await tx.product.update({ where: { id: productId }, data: { stock: { decrement: qty } } })
      }
      return tx.order.create({
        data: {
          clientId,
          deliveryType,
          deliveryAddress,
          phone: data.phone ?? null,
          notes: data.notes ?? null,
          paymentMethod: data.paymentMethod ?? null,
          totalPrice,
          items: {
            create: lineItems.map(li => ({
              clientId,
              productId:  li.productId,
              quantity:   li.quantity,
              unitPrice:  li.unitPrice,
              totalPrice: li.totalPrice,
            })),
          },
        },
        include: { items: true },
      })
    })

    const paymentLabels: Record<string, string> = { qr: 'QR', link: 'Link de pago', card: 'Tarjeta' }
    const paymentLabel = data.paymentMethod ? paymentLabels[data.paymentMethod] ?? null : null

    await activityService.log({
      action: 'Compra de producto', module: 'store',
      detail: `${client.name} compró ${lineItems.map(li => `${li.quantity}x ${li.productName}`).join(', ')} — $${totalPrice.toLocaleString('es-AR')}`
        + (paymentLabel ? ` (pago: ${paymentLabel})` : ''),
    })

    return {
      id: order.id,
      items: lineItems.map(li => ({
        productId:   li.productId,
        productName: li.productName,
        quantity:    li.quantity,
        unitPrice:   li.unitPrice,
        totalPrice:  li.totalPrice,
      })),
      delivery:      { type: deliveryType, address: deliveryAddress },
      phone:         order.phone,
      notes:         order.notes,
      paymentMethod: order.paymentMethod,
      totalPrice:    Number(order.totalPrice),
      createdAt:     order.createdAt.toISOString(),
    }
  },

  listForClient: async (clientId: string) => {
    const orders = await prisma.order.findMany({
      where:   { clientId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return orders.map(o => ({
      id: o.id,
      items: o.items.map(li => ({
        productId: li.productId,
        name:      li.product.name,
        quantity:  li.quantity,
        price:     Number(li.unitPrice),
        image:     li.product.imageUrl,
      })),
      total:    Number(o.totalPrice),
      delivery: { type: o.deliveryType as 'pickup' | 'delivery', address: o.deliveryAddress },
      phone:         o.phone,
      notes:         o.notes,
      paymentMethod: o.paymentMethod,
      status:        o.status as 'pending' | 'confirmed' | 'ready' | 'delivered' | 'cancelled',
      createdAt:     o.createdAt.toISOString(),
    }))
  },
}
