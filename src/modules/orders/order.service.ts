// src/modules/orders/order.service.ts
import { prisma }   from '../../app/database/prisma'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP }     from '../../app/constants/http'
import { activityService } from '../activity/activity.service'
import { paymentService }  from '../payments/payment.service'

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
    // El último ítem se lleva el resto en vez de redondearse como los demás,
    // así la suma de unitPrice da EXACTO promo.price (redondear cada uno por
    // separado puede perder o ganar $1 en la suma total del combo).
    let assignedSoFar = 0
    return promoItems.map((item, idx) => {
      const isLast = idx === promoItems.length - 1
      const unitPrice = isLast
        ? Number(promo.price) - assignedSoFar
        : Math.round(item.price * (Number(promo.price) / realTotal))
      assignedSoFar += unitPrice
      return { productId: item.id, quantity: n, unitPrice }
    })
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
    paymentMethod?: 'mercadopago' | 'whatsapp' | null
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

    // Stock: se valida acá (por la cantidad TOTAL pedida de cada producto,
    // sumando todas las líneas que lo mencionen) para avisarle al cliente antes
    // de mandarlo a pagar, pero NO se descuenta todavía — el stock se descuenta
    // recién cuando Mercado Pago confirma el pago (ver applyPaymentResult). Así
    // un checkout abandonado no deja productos "reservados" para siempre.
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

    const order = await prisma.order.create({
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

    const paymentLabels: Record<string, string> = { mercadopago: 'Mercado Pago', whatsapp: 'Coordinado por WhatsApp' }
    const paymentLabel = data.paymentMethod ? paymentLabels[data.paymentMethod] ?? null : null

    await activityService.log({
      action: 'Compra de producto', module: 'store', level: 'success',
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
      paymentStatus: order.paymentStatus,
      totalPrice:    Number(order.totalPrice),
      createdAt:     order.createdAt.toISOString(),
    }
  },

  // Genera el checkout de Mercado Pago para pagar un pedido ya creado.
  createPaymentPreference: async (clientId: string, id: string) => {
    const order = await prisma.order.findUnique({ where: { id }, include: { client: true } })
    if (!order || order.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Pedido no encontrado', 'NOT_FOUND')
    }
    if (order.paymentStatus === 'paid') {
      throw new AppError(HTTP.BAD_REQUEST, 'Este pedido ya está pago', 'ALREADY_PAID')
    }
    if (order.paymentMethod === 'whatsapp') {
      throw new AppError(HTTP.BAD_REQUEST, 'Este pedido se coordina por WhatsApp, no por Mercado Pago', 'WHATSAPP_PAYMENT')
    }

    const { checkoutUrl } = await paymentService.createPreference({
      title:             `Pedido — ${order.client.name}`,
      amount:            Number(order.totalPrice),
      externalReference: `order:${order.id}`,
      payerEmail:        order.client.email,
    })

    return { checkoutUrl }
  },

  // Verificación "a demanda" del pago de un pedido — no depende del webhook.
  // Le pregunta a Mercado Pago si hay un pago contra "order:<id>" y, si lo hay,
  // aplica el resultado igual que lo haría el webhook. La usa el polling del
  // front y el botón "ya pagué, verificar".
  verifyPayment: async (clientId: string, id: string): Promise<{ paymentStatus: string }> => {
    const order = await prisma.order.findUnique({ where: { id } })
    if (!order || order.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Pedido no encontrado', 'NOT_FOUND')
    }
    if (order.paymentStatus === 'paid') return { paymentStatus: 'paid' }

    const found = await paymentService.findPaymentByReference(`order:${id}`)
    if (found) {
      await orderService.applyPaymentResult(id, found.id, found.status)
    }

    const fresh = await prisma.order.findUnique({ where: { id }, select: { paymentStatus: true } })
    return { paymentStatus: fresh?.paymentStatus ?? order.paymentStatus }
  },

  // Llamado desde el webhook de Mercado Pago — el estado ya viene verificado
  // contra la API de Mercado Pago, no confiado del webhook en crudo.
  applyPaymentResult: async (id: string, mpPaymentId: string, status: string) => {
    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } })
    if (!order) {
      console.warn(`[mercadopago] Webhook para pedido inexistente: ${id}`)
      return
    }

    // Idempotencia — Mercado Pago puede mandar el mismo webhook más de una vez.
    // Si el pedido ya está pago, no volvemos a descontar stock.
    if (order.paymentStatus === 'paid') return

    const paymentStatus = status === 'approved' ? 'paid' : status

    if (status === 'approved') {
      // Recién ahora, con el pago confirmado, se descuenta el stock. Se suma la
      // cantidad total por producto (una línea de catálogo + una de promo del
      // mismo producto cuentan juntas).
      const qtyByProduct = new Map<string, number>()
      for (const li of order.items) {
        qtyByProduct.set(li.productId, (qtyByProduct.get(li.productId) ?? 0) + li.quantity)
      }

      await prisma.$transaction(async (tx) => {
        for (const [productId, qty] of qtyByProduct) {
          await tx.product.update({ where: { id: productId }, data: { stock: { decrement: qty } } })
        }
        await tx.order.update({ where: { id }, data: { paymentStatus, mpPaymentId } })
      })

      // No es fatal, pero si algún producto quedó en negativo el admin tiene que
      // saberlo (se vendió más de lo que había entre que se creó el pedido y se
      // pagó).
      const oversold = await prisma.product.findMany({
        where: { id: { in: [...qtyByProduct.keys()] }, stock: { lt: 0 } },
        select: { name: true, stock: true },
      })
      if (oversold.length > 0) {
        await activityService.log({
          action: 'Stock negativo tras pago', module: 'store', level: 'error',
          detail: `Pedido ${id}: ${oversold.map(p => `${p.name} (${p.stock})`).join(', ')} — revisá el stock.`,
        })
      }
    } else {
      // rechazado / cancelado / pendiente — nunca se descontó stock, solo se
      // deja registrado el estado.
      await prisma.order.update({ where: { id }, data: { paymentStatus, mpPaymentId } })
    }

    const viaWhatsapp = mpPaymentId.startsWith('whatsapp-manual-')
    await activityService.log({
      action: viaWhatsapp ? 'Pago de pedido confirmado por WhatsApp' : 'Pago de pedido recibido', module: 'payments',
      level: ['approved', 'paid'].includes(paymentStatus) ? 'success' : 'warning',
      detail: viaWhatsapp
        ? `Pedido ${id} — el admin confirmó el pago coordinado por WhatsApp`
        : `Pedido ${id} — Mercado Pago informó estado "${status}"`,
    })
  },

  listForAdmin: async () => {
    const orders = await prisma.order.findMany({
      include: { items: { include: { product: true } }, client: true },
      orderBy: { createdAt: 'desc' },
    })
    return orders.map(o => ({
      id: o.id,
      clientName:  o.client.name,
      clientPhone: o.client.phone ?? '',
      items: o.items.map(li => ({
        productName: li.product.name,
        quantity:    li.quantity,
        unitPrice:   Number(li.unitPrice),
      })),
      total:         Number(o.totalPrice),
      delivery:      { type: o.deliveryType as 'pickup' | 'delivery', address: o.deliveryAddress },
      phone:         o.phone,
      notes:         o.notes,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      status:        o.status as 'pending' | 'confirmed' | 'ready' | 'delivered' | 'cancelled',
      createdAt:     o.createdAt.toISOString(),
    }))
  },

  // Control manual del admin sobre un pedido: el estado de entrega (para
  // marcarlo "retirado"/"entregado") y el estado de pago (para completar a
  // mano lo que el medio de pago no confirma solo — WhatsApp, o corregir un
  // estado de Mercado Pago). Pasar a paymentStatus 'paid' reusa
  // applyPaymentResult (mismo descuento de stock, misma idempotencia) con un
  // id sintético; cualquier otro valor solo actualiza el campo.
  updateForAdmin: async (id: string, data: { status?: string; paymentStatus?: string }) => {
    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) throw new AppError(HTTP.NOT_FOUND, 'Pedido no encontrado', 'NOT_FOUND')

    if (data.paymentStatus && data.paymentStatus !== order.paymentStatus) {
      if (data.paymentStatus === 'paid') {
        if (order.paymentMethod !== 'whatsapp') {
          throw new AppError(HTTP.BAD_REQUEST, 'Solo se pueden marcar como pagos los pedidos coordinados por WhatsApp', 'NOT_WHATSAPP_PAYMENT')
        }
        await orderService.applyPaymentResult(id, `whatsapp-manual-${Date.now()}`, 'approved')
      } else {
        await prisma.order.update({ where: { id }, data: { paymentStatus: data.paymentStatus } })
        await activityService.log({
          action: 'Estado de pago del pedido actualizado', module: 'payments', level: 'warning',
          detail: `Pedido ${id}: ${order.paymentStatus} → ${data.paymentStatus}`,
        })
      }
    }

    if (data.status && data.status !== order.status) {
      await prisma.order.update({ where: { id }, data: { status: data.status } })
      await activityService.log({
        action: 'Estado del pedido actualizado', module: 'store', level: 'warning',
        detail: `Pedido ${id} (${order.deliveryType === 'pickup' ? 'retiro en local' : 'envío'}): ${order.status} → ${data.status}`,
      })
    }

    const fresh = await prisma.order.findUnique({ where: { id } })
    return { status: fresh!.status, paymentStatus: fresh!.paymentStatus }
  },

  listForClient: async (clientId: string) => {
    const orders = await prisma.order.findMany({
      where: {
        clientId,
        // Un pedido de Mercado Pago que nunca se confirmó (el cliente abrió el
        // checkout y no llegó a pagar, o ni lo abrió) no es una compra — no
        // tiene sentido que aparezca en "Historial de tus compras" como si lo
        // fuera. Uno coordinado por WhatsApp SÍ se muestra pendiente: ese
        // quedó reservado de verdad, solo falta que el admin confirme el pago.
        NOT: { paymentMethod: 'mercadopago', paymentStatus: 'pending' },
      },
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
      paymentStatus: o.paymentStatus,
      status:        o.status as 'pending' | 'confirmed' | 'ready' | 'delivered' | 'cancelled',
      createdAt:     o.createdAt.toISOString(),
    }))
  },
}
