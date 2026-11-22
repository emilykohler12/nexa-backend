// src/modules/payments/paidAmount.ts
//
// Mercado Pago confirma "approved" por el monto que realmente se cobró. Antes de marcar una
// seña o un pedido como pagos hay que comprobar que ese monto y esa moneda coinciden con lo
// que se esperaba (el monto de la preferencia se fija en el servidor, pero puede cambiar entre
// que se crea el checkout y que llega el pago: otra seña, otro precio, otra moneda).
// Qué se hace con cada resultado (registrar el pago, avisar, guardar el motivo) está en paymentRecord.ts.

// Misma moneda con la que se crea la preferencia (payment.service.ts).
export const PAYMENT_CURRENCY = 'ARS'

export interface PaidInfo {
  amount?:   number | null
  currency?: string | null
  // `status_detail` de Mercado Pago (por qué rechazó el pago); solo sirve para explicarle el motivo a la clienta.
  statusDetail?: string | null
}

// Acepta el monto esperado o uno mayor (centavos de tolerancia); rechaza otra moneda o un
// monto que falta, porque no se puede verificar.
export function isExpectedPayment(expected: number, paid: PaidInfo): boolean {
  return paid.currency === PAYMENT_CURRENCY
    && typeof paid.amount === 'number'
    && Number.isFinite(paid.amount)
    && paid.amount + 0.005 >= expected
}
