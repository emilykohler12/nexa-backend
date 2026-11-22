// src/modules/payments/paymentReasons.ts
//
// Mercado Pago explica por qué rechazó un pago en `status_detail` (códigos en inglés). Acá se convierten en una frase corta
// en español, pensada para que la clienta la lea en el detalle del turno sin tanto texto.

const REJECTION_REASONS: Record<string, string> = {
  cc_rejected_insufficient_amount:        'fondos insuficientes',
  cc_rejected_bad_filled_card_number:     'datos de la tarjeta incorrectos',
  cc_rejected_bad_filled_date:            'datos de la tarjeta incorrectos',
  cc_rejected_bad_filled_security_code:   'datos de la tarjeta incorrectos',
  cc_rejected_bad_filled_other:           'datos de la tarjeta incorrectos',
  cc_rejected_call_for_authorize:         'tu banco tiene que autorizarlo',
  cc_rejected_card_disabled:              'tarjeta inhabilitada',
  cc_rejected_blacklist:                  'rechazado por seguridad',
  cc_rejected_high_risk:                  'rechazado por seguridad',
  cc_rejected_max_attempts:               'demasiados intentos',
  cc_rejected_duplicated_payment:         'pago duplicado',
  cc_rejected_invalid_installments:       'cuotas no disponibles',
  cc_rejected_card_type_not_allowed:      'tipo de tarjeta no admitido',
  cc_rejected_other_reason:               'tu banco no lo aprobó',
}

// «Pago rechazado: fondos insuficientes». Sin código reconocido, una frase genérica.
export function rejectionNote(status: string, statusDetail?: string | null): string {
  if (status === 'cancelled') return 'Pago cancelado'
  const reason = statusDetail ? REJECTION_REASONS[statusDetail] : undefined
  return reason ? `Pago rechazado: ${reason}` : 'Pago rechazado'
}
