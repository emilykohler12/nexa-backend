// src/modules/payments/payment.service.ts
//
// Todo lo genérico de Mercado Pago vive acá — crear una preferencia de pago
// (Checkout Pro) y consultar el estado real de un pago. Lo específico de
// turnos/pedidos (qué hacer con el resultado) vive en cada módulo dueño de
// ese dato (appointment.service.ts / order.service.ts).
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import { env } from '../../app/config/env'

function requireClient(): MercadoPagoConfig {
  if (!env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error('Falta MERCADOPAGO_ACCESS_TOKEN en las variables de entorno')
  }
  return new MercadoPagoConfig({ accessToken: env.MERCADOPAGO_ACCESS_TOKEN })
}

export const paymentService = {

  /**
   * Crea una preferencia de Checkout Pro por un monto fijo. `externalReference`
   * es la única forma de saber, cuando llegue el webhook, a qué turno o pedido
   * corresponde el pago — se arma como "appointment:<id>" o "order:<id>".
   */
  createPreference: async (opts: {
    title: string
    amount: number
    externalReference: string
    payerEmail?: string
  }): Promise<{ preferenceId: string; checkoutUrl: string }> => {
    const preference = new Preference(requireClient())

    // Mercado Pago valida `auto_return` contra sus propios servidores y rechaza
    // la preferencia entera ("auto_return invalid. back_url.success must be
    // defined") si back_urls.success no es una URL pública HTTPS. En local el
    // front corre en http://localhost, así que ahí NO mandamos auto_return: el
    // pago igual funciona, solo que Mercado Pago muestra un botón "Volver al
    // sitio" en vez de redirigir solo. En producción (FRONTEND_URL https) sí va.
    const frontendIsPublic = env.FRONTEND_URL.startsWith('https://')

    const result = await preference.create({
      body: {
        items: [{
          id:          opts.externalReference,
          title:       opts.title,
          quantity:    1,
          unit_price:  opts.amount,
          currency_id: 'ARS',
        }],
        external_reference: opts.externalReference,
        payer: opts.payerEmail ? { email: opts.payerEmail } : undefined,
        back_urls: {
          success: `${env.FRONTEND_URL}/pago/resultado?estado=exito`,
          failure: `${env.FRONTEND_URL}/pago/resultado?estado=error`,
          pending: `${env.FRONTEND_URL}/pago/resultado?estado=pendiente`,
        },
        ...(frontendIsPublic ? { auto_return: 'approved' } : {}),
        // Sin esta URL, Mercado Pago nunca nos avisa que el pago se completó
        // — necesita ser pública (el túnel de desarrollo mientras probamos local).
        notification_url: env.BACKEND_PUBLIC_URL
          ? `${env.BACKEND_PUBLIC_URL}/api/webhook/mercadopago`
          : undefined,
      },
    })

    if (!result.id) throw new Error('Mercado Pago no devolvió un id de preferencia')

    // En modo prueba (credenciales TEST-...) el checkout real está en
    // sandbox_init_point, no en init_point — usar el que corresponda.
    const checkoutUrl = env.NODE_ENV === 'production'
      ? result.init_point
      : (result.sandbox_init_point ?? result.init_point)

    if (!checkoutUrl) throw new Error('Mercado Pago no devolvió una URL de checkout')

    return { preferenceId: result.id, checkoutUrl }
  },

  /**
   * Nunca confiamos en el "status" que venga suelto en la URL o en el cuerpo
   * del webhook — siempre se vuelve a preguntar el estado real a la API de
   * Mercado Pago con el id del pago, que es la única fuente de verdad.
   */
  getPayment: async (paymentId: string) => {
    const payment = new Payment(requireClient())
    return payment.get({ id: paymentId })
  },
}
