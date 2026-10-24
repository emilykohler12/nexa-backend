// src/modules/payments/paidAmount.ts
//
// Mercado Pago confirma "approved" por el monto que realmente se cobró. Antes de marcar una
// seña o un pedido como pagos hay que comprobar que ese monto y esa moneda coinciden con lo
// que se esperaba (el monto de la preferencia se fija en el servidor, pero puede cambiar entre
// que se crea el checkout y que llega el pago: otra seña, otro precio, otra moneda).
import { activityService } from '../activity/activity.service'

// Misma moneda con la que se crea la preferencia (payment.service.ts).
export const PAYMENT_CURRENCY = 'ARS'

export interface PaidInfo {
  amount?:   number | null
  currency?: string | null
}

// Acepta el monto esperado o uno mayor (centavos de tolerancia); rechaza otra moneda o un
// monto que falta, porque no se puede verificar.
export function isExpectedPayment(expected: number, paid: PaidInfo): boolean {
  return paid.currency === PAYMENT_CURRENCY
    && typeof paid.amount === 'number'
    && Number.isFinite(paid.amount)
    && paid.amount + 0.005 >= expected
}

// Devuelve true si se puede aplicar el resultado del pago. Solo valida los pagos aprobados que
// traen datos de Mercado Pago; un rechazo, un pendiente o una seña confirmada a mano por
// WhatsApp (sin `paid`) pasan sin comprobar el monto. Si no coincide, lo deja registrado en la
// actividad con nivel de error para que se revise a mano.
export async function isPaymentAcceptable(opts: {
  kind:        string
  id:          string
  mpPaymentId: string
  status:      string
  expected:    number
  paid?:       PaidInfo
}): Promise<boolean> {
  if (opts.status !== 'approved' || !opts.paid) return true
  if (isExpectedPayment(opts.expected, opts.paid)) return true

  await activityService.log({
    action: 'Pago con monto distinto al esperado',
    module: 'payments',
    level:  'error',
    detail: `${opts.kind} ${opts.id}: Mercado Pago informó ${opts.paid.amount ?? 'sin monto'} ${opts.paid.currency ?? 'sin moneda'} `
          + `y se esperaba ${opts.expected} ${PAYMENT_CURRENCY} (pago ${opts.mpPaymentId}). `
          + 'No se registró el pago: revisalo a mano en Mercado Pago.',
  })
  return false
}
