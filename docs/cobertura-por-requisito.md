# Cobertura por requisito

Para cada requisito del libro de requisitos v7 (`03-requisitos/20261030_CatalogoRequisitos_Kohler_v7.xlsx`, hoja «Catálogo»): las pruebas automatizadas del backend que lo ejercitan (archivo y nombre completo, con el `describe` y el `it`), el resultado de la última corrida y si el criterio de aceptación queda cubierto **completo**, **parcial** o **sin prueba**. Quedan afuera los requisitos eliminados: RF-22 (campañas automáticas), RF-30 (recordatorio de inactividad) y la parte de fidelización de RF-28.

**Última corrida:** `npm test` (Vitest con `--reporter=json`) el 01/11/2026, 15:07 (hora de Argentina) sobre la rama `docs/informes-v8`, igual a `integracion-ae4` en `d04ad34` (pull request 23 mergeado): **57 archivos y 638 pruebas, 638 pasaron y 0 fallaron.**

**Cómo se armó.** El mapa requisito → pruebas se hizo leyendo el criterio de cada requisito y los nombres y el contenido de las pruebas; el resultado de cada prueba sale del reporte JSON de esa corrida. «Completo» quiere decir que cada parte del criterio tiene una prueba que la comprueba; «parcial», que alguna parte no la tiene o que el criterio escrito no coincide con lo que hace el código (se dice cuál); «sin prueba», que no hay ninguna prueba automatizada. Solo se miran las pruebas del backend: las del frontend (`nexa-frontend`) no se revisaron (**no determinado** si cubren algo más). Una prueba puede servir a más de un requisito.

## Resumen

| Requisito | Cobertura |
|---|---|
| RF-01 | Completo |
| RF-02 | Completo |
| RF-03 | Parcial |
| RF-04 | Completo |
| RF-05 | Parcial |
| RF-06 | Completo |
| RF-07 | Completo |
| RF-08 | Completo |
| RF-09 | Completo |
| RF-10 | Completo |
| RF-11 | Completo |
| RF-12 | Completo |
| RF-13 | Completo |
| RF-14 | Completo |
| RF-15 | Parcial |
| RF-16 | Completo |
| RF-17 | Completo |
| RF-18 | Completo |
| RF-19 | Parcial |
| RF-20 | Parcial |
| RF-21 | Completo |
| RF-23 | Completo |
| RF-24 | Parcial |
| RF-25 | Completo |
| RF-26 | Completo |
| RF-27 | Completo |
| RF-28 | Parcial |
| RF-29 | Parcial |
| RF-31 | Completo |
| RF-32 | Completo |
| RF-33 | Parcial |
| RF-34 | Parcial |
| RNF-01 | Sin prueba |
| RNF-02 | Sin prueba |
| RNF-03 | Completo |
| RNF-04 | Completo |
| RNF-05 | Completo |
| RNF-06 | Completo |
| RNF-07 | Parcial |
| RNF-08 | Completo |
| RNF-09 | Completo |
| RNF-10 | Completo |

Total: 42 requisitos; 29 completos, 11 parciales y 2 sin prueba.

**Criterios del libro v7 que no coinciden con el código** (para corregir en el libro, no en el código, salvo que Emily decida otra cosa): RF-05 (inasistencia: más de 30 minutos, `no_show_auto` y horario ocupado), RF-01 y RNF-08 (enunciado), RF-20 (promoción vencida: se rechaza), RF-21 (enunciado: los pedidos pagados sí crean movimiento), RF-28 (visitas: solo finalizados) y RNF-10 (cifras). RF-17 y RNF-09 figuran en el libro «sin prueba» y ya la tienen.

## Detalle por requisito

### RF-01

**Enunciado (libro v7):** El sistema rechaza la confirmación de la reserva de un turno cuando la profesional seleccionada ya tiene otro turno activo (no cancelado ni cancelado por inasistencia) el mismo día y a la misma hora de inicio, y no acepta reservas fuera de las franjas de atención que cada profesional define. Las franjas se arman en bloques que no se pisen: el sistema compara la hora de inicio y no detecta solapamientos por duración (aceptado por la propietaria el 30/10/2026).

**Criterio de aceptación (libro v7):** Dado un turno ya confirmado para la profesional X el día D a las H, cuando otra clienta intenta reservar a la misma profesional X, el mismo día D y la misma hora H, el sistema rechaza la reserva y no la registra en la base, verificable repitiendo la reserva y consultando la tabla de turnos. Además, dada una profesional con una franja de 09:00 a 13:00, cuando una clienta intenta reservarle un turno a las 14:00, el sistema responde error 400 OUT_OF_HOURS y no crea el turno; y ante la misma hora ya ocupada responde 409 PROFESSIONAL_SLOT_TAKEN. Verificable con appointments.booking y appointments.out-of-hours.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › rechaza reservar el mismo horario dos veces con la misma profesional (slot conflict) | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › permite la misma hora con OTRA profesional (el conflicto es por profesional, no global) | pasó |
| `tests/integration/appointments.out-of-hours.test.ts` | horario fuera de la disponibilidad (OUT_OF_HOURS) › rechaza reservar a las 23:00 con disponibilidad de 09:00 a 18:00 | pasó |
| `tests/integration/appointments.out-of-hours.test.ts` | horario fuera de la disponibilidad (OUT_OF_HOURS) › acepta una hora dentro de la franja | pasó |
| `tests/integration/appointments.out-of-hours.test.ts` | horario fuera de la disponibilidad (OUT_OF_HOURS) › rechaza un día sin franja cargada | pasó |
| `tests/integration/appointments.out-of-hours.test.ts` | horario fuera de la disponibilidad (OUT_OF_HOURS) › rechaza un combo con un componente fuera de horario | pasó |
| `tests/integration/appointments.out-of-hours.test.ts` | horario fuera de la disponibilidad (OUT_OF_HOURS) › rechaza reprogramar a una hora fuera de la franja | pasó |
| `tests/integration/appointments.out-of-hours.test.ts` | horario fuera de la disponibilidad (OUT_OF_HOURS) › el turno manual del admin no se valida contra la franja | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el horario ORIGINAL nunca se reabre › lo garantiza el índice de la base: un INSERT directo del mismo inicio falla | pasó |

**Cobertura: Completo.** El enunciado del v7 dice que un turno «cancelado por inasistencia» no cuenta como activo; desde la fase 2 un `cancelled_no_show` mantiene el horario original bloqueado (`slot_locked`) y un `no_show_auto` lo sigue ocupando. El criterio de aceptación (mismo horario 409, fuera de franja 400) no se ve afectado.

### RF-02

**Enunciado (libro v7):** El sistema permite a una visitante reservar un turno mediante un formulario web, dando de alta su propia cuenta con nombre, apellido y teléfono celular.

**Criterio de aceptación (libro v7):** Dado un visitante sin cuenta, cuando completa el formulario con nombre, apellido y teléfono celular (los tres obligatorios y en campos separados) y elige servicio y horario, el sistema crea la cuenta y el turno queda confirmado y se muestra como «Pendiente de seña» (estado derivado de una seña sin pagar) hasta que la seña se pague, verificable en el listado de turnos de la clienta.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/auth.test.ts` | auth › registra una clienta nueva y devuelve cookies de sesión | pasó |
| `tests/integration/auth.test.ts` | auth › rechaza el registro sin apellido | pasó |
| `tests/integration/auth.test.ts` | auth › rechaza el registro sin teléfono | pasó |
| `tests/integration/auth.test.ts` | auth › guarda nombre y apellido en columnas separadas | pasó |
| `tests/integration/phone.validation.test.ts` | teléfono en el registro y el perfil › el registro rechaza un teléfono que no es un celular argentino | pasó |
| `tests/integration/phone.validation.test.ts` | teléfono en el registro y el perfil › el registro acepta un celular argentino y lo guarda como lo escribió | pasó |
| `tests/integration/phone.validation.test.ts` | teléfono en el registro y el perfil › el perfil de la clienta rechaza un teléfono inválido con 400, no con 500 | pasó |
| `tests/integration/phone.validation.test.ts` | teléfono en el registro y el perfil › el perfil de la clienta acepta un celular válido y el vacío | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › un turno con seña sin pagar se expone como pending_deposit; sin seña, como confirmed | pasó |

**Cobertura: Completo.** El alta de la cuenta y la reserva son dos pedidos a la API; las pruebas los cubren por separado.

### RF-03

**Enunciado (libro v7):** El sistema calcula la seña según el valor que la propietaria define en Configuración (un monto fijo en pesos o un porcentaje del servicio; hoy $5.000 ARS) y permite pagarla con Mercado Pago (hoy en modo prueba, con tarjeta de prueba) o coordinarla por WhatsApp; el turno queda confirmado con la seña pendiente hasta que se acredita o la propietaria la marca como pagada. Si la seña no se paga en el plazo definido en RF-14, el turno se libera.

**Criterio de aceptación (libro v7):** Dado un turno de precio P y una seña configurada en $5.000, cuando la clienta confirma la reserva y elige Mercado Pago, el sistema genera el cobro por el monto configurado; el turno queda confirmado con la seña «pendiente» y esta pasa a «pagada» cuando la pasarela acredita el pago. Si elige coordinar por WhatsApp, la seña queda «pendiente» hasta que la propietaria la marca como pagada. Verificable en el estado de pago del turno y en el valor de la seña de Configuración.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/settings.deposit-and-refund.test.ts` | RF-03 y RF-32: cálculo de la seña › computeDeposit en porcentaje redondea al peso; en monto fijo nunca supera el precio | pasó |
| `tests/integration/settings.deposit-and-refund.test.ts` | RF-03 y RF-32: cálculo de la seña › el administrador pasa la seña a porcentaje y la reserva de la clienta toma ese porcentaje del precio | pasó |
| `tests/integration/settings.deposit-and-refund.test.ts` | RF-03 y RF-32: cálculo de la seña › PATCH /settings/payments: valores válidos, inválidos (400 VALIDATION_ERROR) y sin permiso | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › crea un turno confirmado con el precio de catálogo del servicio | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | turno: se valida el monto y la moneda antes de marcar la seña como paga › con el monto exacto en pesos registra la seña | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | turno: se valida el monto y la moneda antes de marcar la seña como paga › con un monto menor NO registra la seña y deja un aviso para revisar | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | turno: se valida el monto y la moneda antes de marcar la seña como paga › con otra moneda NO registra la seña | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | turno: se valida el monto y la moneda antes de marcar la seña como paga › si Mercado Pago no informa el monto, no se puede verificar y NO registra la seña | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | turno: se valida el monto y la moneda antes de marcar la seña como paga › con un monto mayor lo acepta | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | turno: se valida el monto y la moneda antes de marcar la seña como paga › sin datos de pago (seña confirmada a mano por WhatsApp) sigue funcionando | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | turno: se valida el monto y la moneda antes de marcar la seña como paga › un rechazo se registra aunque el monto no coincida (solo se valida lo aprobado) | pasó |
| `tests/integration/whatsapp-payment.test.ts` | seña de turno coordinada por WhatsApp (en vez de Mercado Pago) › el cliente reserva y el turno queda guardado con depositMethod whatsapp, sin pasar por Mercado Pago | pasó |
| `tests/integration/whatsapp-payment.test.ts` | seña de turno coordinada por WhatsApp (en vez de Mercado Pago) › pedir el checkout de Mercado Pago para una seña coordinada por WhatsApp falla | pasó |
| `tests/integration/whatsapp-payment.test.ts` | seña de turno coordinada por WhatsApp (en vez de Mercado Pago) › el admin marca la seña como paga y el turno pasa a partial (y notifica a la profesional) | pasó |
| `tests/integration/whatsapp-payment.test.ts` | seña de turno coordinada por WhatsApp (en vez de Mercado Pago) › es idempotente — marcarla paga dos veces no falla ni duplica notificaciones | pasó |
| `tests/integration/whatsapp-payment.test.ts` | seña de turno coordinada por WhatsApp (en vez de Mercado Pago) › rechaza marcar como paga una seña que en realidad es de Mercado Pago | pasó |
| `tests/integration/whatsapp-payment.test.ts` | seña de turno coordinada por WhatsApp (en vez de Mercado Pago) › en un combo, marcar la seña de UNA pata como paga confirma TODAS las patas | pasó |
| `tests/integration/special-service.payment.test.ts` | servicio especial: la seña no nace paga › el turno nace con paymentStatus pending y con la seña calculada | pasó |

**Cobertura: Parcial.** Ninguna prueba mira el monto de la preferencia que se manda a Mercado Pago (está simulado en `tests/setup.ts`). Sí se prueba el cálculo de la seña, que el turno nace con la seña pendiente, que pasa a paga con el monto correcto y la seña coordinada por WhatsApp.

### RF-04

**Enunciado (libro v7):** El sistema devuelve el 100% de la seña si la clienta cancela con 12 horas o más de anticipación al turno, y retiene el 100% si cancela con menos de 12 horas o no se presenta.

**Criterio de aceptación (libro v7):** Dado un turno con seña pagada, pactado a las 18:00 h del día D, cuando la clienta cancela a las 05:00 h del mismo día D (menos de 12 horas antes), la seña no cambia de estado y queda a favor del estudio (retenida); cuando cancela un día antes a las 17:00 h (más de 12 horas antes), el sistema marca la seña como «devuelta» (estado de pago refunded), verificable en el estado de pago del turno. El sistema solo registra la marca: la devolución del dinero se coordina fuera de él (ver L-08).

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/appointments.cancellation-refund.test.ts` | cancelación de la clienta desde la app › con 13 horas de anticipación y la seña paga: la seña se marca como devuelta | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | cancelación de la clienta desde la app › con 12 horas exactas todavía se devuelve (12 o más) | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | cancelación de la clienta desde la app › con 11 horas la seña queda retenida | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | cancelación de la clienta desde la app › con la seña impaga no se marca nada, aunque falten muchas horas | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | cancelación de la clienta desde la app › con la política "none" la seña queda retenida aunque haya 13 horas | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | cancelación de la clienta desde la app › el corte usa las horas de la configuración (cancellationHours = 24) | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | cancelación de la clienta desde la app › con el turno ya empezado: sin devolución, el original queda bloqueado y se abre el horario reabierto | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | cancelación de la clienta desde la app › cancelando a los 40 minutos exactos se abre el horario reabierto; a los 41 no | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | cancelación de la clienta desde la app › el horario original no se puede reservar después de cancelar un turno ya empezado | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | cancelación de la clienta desde la app › su propia cancelación NO manda mail a la clienta | pasó |
| `tests/integration/appointments.cancel-reschedule.test.ts` | cancelación › reembolsa si se cancela con más margen que el corte (12hs por default, RF-04) | pasó |
| `tests/integration/appointments.cancel-reschedule.test.ts` | cancelación › NO reembolsa si se cancela dentro del corte de 12hs | pasó |
| `tests/integration/appointments.cancel-reschedule.test.ts` | cancelación › reembolsa si se cancela con 18hs de aviso (corte de 12hs) | pasó |
| `tests/integration/appointments.cancel-reschedule.test.ts` | cancelación › NO reembolsa si se cancela con 11hs de aviso (corte de 12hs) | pasó |
| `tests/integration/settings.deposit-and-refund.test.ts` | RF-04: devolución de la seña › límite exacto: con 12 horas justas se devuelve; con 11:59 queda retenida | pasó |
| `tests/integration/settings.deposit-and-refund.test.ts` | RF-04: devolución de la seña › con refundPolicy "none" la seña queda retenida aunque falten días | pasó |
| `tests/integration/settings.deposit-and-refund.test.ts` | RF-04: devolución de la seña › cancelación con la seña impaga: se cancela y no se marca ninguna devolución | pasó |
| `tests/integration/settings.deposit-and-refund.test.ts` | RF-04: devolución de la seña › inasistencia con la seña paga: ni el job ni la marca del personal tocan la seña | pasó |
| `tests/integration/timezone-art.test.ts` | cancelación y reembolso en hora de Argentina (corte de 12 horas) › reembolsa si faltan 12 horas y media reales para el turno | pasó |
| `tests/integration/timezone-art.test.ts` | cancelación y reembolso en hora de Argentina (corte de 12 horas) › no reembolsa si faltan menos de 12 horas reales | pasó |

**Cobertura: Completo.**

### RF-05

**Enunciado (libro v7):** El sistema cancela automáticamente un turno y libera el horario para reasignar si transcurren más de 20 minutos desde la hora pactada sin que se registre su llegada (la clienta o el personal la registran el día del turno).

**Criterio de aceptación (libro v7):** Dado un turno pactado a las 10:00 h, cuando el reloj del sistema marca las 10:21 h sin registro de llegada de la clienta, el turno pasa a estado «cancelado por inasistencia» (cancelled_no_show) y el horario queda disponible para nueva reserva; a las 10:19 h el turno no se modifica. Verificable en el estado del turno y en la grilla de disponibilidad (appointments.arrival-noshow).

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/appointments.arrival-noshow.test.ts` | registro de llegada › la clienta registra su propia llegada en un turno confirmado de hoy | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | registro de llegada › anda también a las 23:57 de Argentina, cuando el servidor (UTC) ya está en el día siguiente | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | registro de llegada › es idempotente — llamarlo dos veces no falla ni pisa el primer arrivedAt | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | registro de llegada › rechaza registrar llegada en un turno no confirmado (pending) | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | registro de llegada › rechaza registrar llegada en un turno que no es de hoy | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | registro de llegada › rechaza registrar la llegada del turno de otra clienta | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | registro de llegada › la profesional puede registrar la llegada por la clienta | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | registro de llegada › el admin puede registrar la llegada de cualquier turno | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | registro de llegada › una profesional no puede registrar la llegada de un turno ajeno | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › a los 29 minutos de la hora de inicio todavía no marca | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › a los 30 minutos exactos todavía no marca (tiene que pasar MÁS de 30) | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › a los 31 minutos pasa a no_show_auto y la seña no cambia | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › NO marca un turno que ya registró la llegada | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › no vuelve a marcar un turno que ya está en no_show_auto (corridas repetidas) | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › deja UNA entrada de actividad por turno, con el id del turno y el cambio de estado | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › no_show_auto ocupa el horario aunque la reserva todavía esté dentro de la tolerancia de 15 minutos | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › tampoco se puede reprogramar otro turno hacia un horario ocupado por un no_show_auto | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › la clienta no puede cancelar un turno no_show_auto, ni uno finalizado ni uno no asistido | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › la clienta no puede reprogramar un turno no_show_auto | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › un no_show_auto no suma a la carga semanal de la asignación "cualquiera" | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › un no_show_auto cuenta como inasistencia en el panel del administrador | pasó |
| `tests/integration/timezone-art.test.ts` | no-show automático en hora de Argentina › no marca ausente a una clienta antes de que pasen 20 minutos de la hora del turno | pasó |
| `tests/integration/timezone-art.test.ts` | no-show automático en hora de Argentina › no marca ausente un turno que todavía no empezó | pasó |
| `tests/integration/timezone-art.test.ts` | no-show automático en hora de Argentina › marca ausente pasados los 30 minutos de la hora del turno, no antes | pasó |
| `tests/integration/timezone-art.test.ts` | no-show automático en hora de Argentina › un turno nocturno se evalúa con la fecha de Argentina (22:30 ART ya es el día siguiente en UTC) | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el personal marca "No asistió" (cancelled_no_show) › a los 32 minutos: se marca, la seña queda retenida y se reabre el horario desde el siguiente múltiplo de 5 | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el personal marca "No asistió" (cancelled_no_show) › a los 40 minutos exactos genera el horario reabierto (primer inicio 16:45) | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el personal marca "No asistió" (cancelled_no_show) › a los 41 minutos se marca igual, la seña queda retenida y NO se genera horario reabierto | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el personal marca "No asistió" (cancelled_no_show) › antes de la hora de inicio se rechaza con 400 NO_SHOW_BEFORE_START | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el personal marca "No asistió" (cancelled_no_show) › se puede marcar un turno que el job ya había pasado a no_show_auto | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el personal marca "No asistió" (cancelled_no_show) › el administrador también puede marcarlo (a las 16:36 el primer inicio es 16:40) | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el personal marca "No asistió" (cancelled_no_show) › no_show_auto no se asigna a mano: lo asigna solo el sistema | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el personal marca "No asistió" (cancelled_no_show) › solo se marca un turno confirmado o no_show_auto: uno finalizado se rechaza | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el personal marca "No asistió" (cancelled_no_show) › el PATCH de la profesional valida el cuerpo (estado inválido, hora inválida) | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el personal marca "No asistió" (cancelled_no_show) › queda en el registro de actividad con el id del turno, quién lo hizo, el cambio de estado y desde cuándo se reabre | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el personal marca "No asistió" (cancelled_no_show) › el listado de actividad del administrador trae el id del turno | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | caso María: turno a las 8:00 que nadie registra › el job lo marca a las 8:35, el horario sigue ocupado y a las 10:00 la profesional lo cierra como finished | pasó |

**Cobertura: Parcial.** **Choca con la regla vigente.** El criterio del v7 dice que a las 10:21 (más de 20 minutos) el turno pasa a `cancelled_no_show` y el horario queda libre. Desde la fase 2 (regla confirmada por la propietaria el 30/10/2026) el job lo pasa a `no_show_auto` recién con MÁS de 30 minutos y el horario original sigue ocupado. Las pruebas verifican la regla vigente; el criterio escrito no se cumple y hay que actualizarlo en el libro. La parte «a las 10:19 no se modifica» sí se cumple.

### RF-06

**Enunciado (libro v7):** Cuando la clienta no indica preferencia por una profesional, el sistema asigna automáticamente el turno a la profesional disponible en ese día y hora, habilitada para el servicio, con menos turnos en la semana; a igual carga, la de mayor antigüedad.

**Criterio de aceptación (libro v7):** Dadas tres profesionales habilitadas para «manicura» y libres a la hora pedida, con 8, 5 y 5 turnos reservados en la semana, cuando una clienta reserva «manicura» sin elegir profesional, el sistema asigna el turno a la de mayor antigüedad entre las dos con 5 turnos, verificable en el campo de profesional asignada del turno creado.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › asignación automática (R-04) › elige a la de menor carga de esa semana | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › asignación automática (R-04) › la carga es solo de la semana pedida (lunes a domingo), no de toda la historia | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › asignación automática (R-04) › los turnos cancelados y cancelled_no_show no suman carga | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › asignación automática (R-04) › a igual carga desempata por antigüedad (Professional.createdAt ascendente) | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › asignación automática (R-04) › descarta a quien no tiene disponibilidad ese día y hora | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › asignación automática (R-04) › descarta a quien ya tiene un turno activo a esa hora de inicio | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › asignación automática (R-04) › si ninguna está libre a esa hora responde 409 con un error claro | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › asignación automática (R-04) › preferred-professional aplica el mismo criterio para el día y hora elegidos, sin login | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › asignación automática (R-04) › preferred-professional exige día y hora | pasó |
| `tests/integration/professional.joined-at.test.ts` | RF-06: fecha de ingreso de la profesional › sin fecha cargada se muestra la del alta de la cuenta y se avisa que es la de por defecto | pasó |
| `tests/integration/professional.joined-at.test.ts` | RF-06: fecha de ingreso de la profesional › el administrador la edita y se guarda como fecha | pasó |
| `tests/integration/professional.joined-at.test.ts` | RF-06: fecha de ingreso de la profesional › con null vuelve a la fecha de alta, y no cambia si el campo no viene | pasó |
| `tests/integration/professional.joined-at.test.ts` | RF-06: fecha de ingreso de la profesional › rechaza una fecha inválida o futura | pasó |
| `tests/integration/professional.joined-at.test.ts` | RF-06: fecha de ingreso de la profesional › a igual carga semanal gana la más antigua según la fecha de ingreso, no según el alta de la cuenta | pasó |
| `tests/integration/professional.joined-at.test.ts` | RF-06: fecha de ingreso de la profesional › la carga semanal sigue mandando por encima de la antigüedad | pasó |

**Cobertura: Completo.**

### RF-07

**Enunciado (libro v7):** El sistema solicita un consentimiento diferenciado y específico antes de guardar cualquier dato de alergias o sensibilidad de piel de la clienta, e impide su guardado si no se otorga.

**Criterio de aceptación (libro v7):** Dado el formulario de detalles de la reserva con el campo «alergias» completado, cuando la clienta no marca la casilla de consentimiento, el sistema no guarda ese valor en la base; cuando sí la marca, el valor se guarda junto con la fecha y hora del consentimiento, verificable en el registro de la reserva. Además, ni la propietaria desde el panel ni la profesional pueden cargar o modificar alergias: solo la clienta, con su consentimiento; un intento de cambiarlas desde el panel de administración responde error de validación, verificable con una llamada a la API de administración.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/allergies.consent-visibility.test.ts` | consentimiento para guardar alergias (RF-07) › sin marcar el consentimiento no guarda la alergia ni registra consentimiento | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | consentimiento para guardar alergias (RF-07) › si el campo de consentimiento ni siquiera viene, tampoco guarda la alergia | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | consentimiento para guardar alergias (RF-07) › con el consentimiento guarda la alergia junto con la fecha y hora del consentimiento | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | el admin y las profesionales no cargan ni editan alergias (RF-07) › el admin no puede cargar alergias en el perfil de una clienta | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | el admin y las profesionales no cargan ni editan alergias (RF-07) › el admin no puede cambiar ni borrar una alergia ya cargada | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | el admin y las profesionales no cargan ni editan alergias (RF-07) › el admin puede guardar el resto del perfil si reenvía las alergias tal cual están | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | el admin y las profesionales no cargan ni editan alergias (RF-07) › el admin tampoco puede crear una clienta con alergias, y no deja la cuenta a medias | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | el admin y las profesionales no cargan ni editan alergias (RF-07) › ni el admin ni la profesional cambian la alergia de un turno desde sus rutas de turnos | pasó |

**Cobertura: Completo.**

### RF-08

**Enunciado (libro v7):** El sistema expone la política de privacidad a la clienta antes de registrar cualquier dato personal, impide continuar el flujo si la rechaza, y registra fecha, hora y versión aceptada.

**Criterio de aceptación (libro v7):** Dado un nuevo registro de clienta, cuando no acepta la política de privacidad, el formulario no avanza al paso siguiente; cuando la acepta, el sistema graba fecha, hora y número de versión de la política en el registro del usuario, verificable en la base.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/terms-version.test.ts` | versión de la política aceptada › el registro graba fecha y versión de la política | pasó |
| `tests/integration/terms-version.test.ts` | versión de la política aceptada › confirmar una reserva vuelve a grabar fecha y versión (cuentas viejas sin versión) | pasó |
| `tests/integration/terms-version.test.ts` | versión de la política aceptada › si no acepta la política no se graba nada | pasó |
| `tests/integration/auth.test.ts` | auth › rechaza el registro sin aceptar términos | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › rechaza reservar sin aceptar términos | pasó |

**Cobertura: Completo.** Cubierto en el backend. Que el formulario «no avance» es del frontend: si lo prueba una prueba del frontend, **no determinado** (no se revisó `nexa-frontend` en esta fase).

### RF-09

**Enunciado (libro v7):** El sistema permite a la propietaria ejecutar la anonimización del nombre, el apellido, el correo y el teléfono de una clienta que lo solicite, desactivar su cuenta y cerrar sus sesiones, preservando los turnos y pagos exigidos por obligaciones contables o fiscales, y deja constancia de auditoría. Los demás datos de la clienta (alergias, observaciones, notas, fecha de nacimiento y fotos) quedan fuera de esta versión (ver L-07).

**Criterio de aceptación (libro v7):** Dada una clienta que solicita la baja de sus datos, cuando la propietaria confirma la anonimización desde el panel, el nombre, el apellido y el contacto de la clienta dejan de ser recuperables en las consultas del sistema, y se genera un registro con fecha, hora, usuario que la ejecutó y clienta afectada en el log de auditoría, verificable en ambas consultas.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/admin.clients.test.ts` | anonimización de datos de una clienta (RF-09) › reemplaza nombre/email/teléfono y desactiva la cuenta, pero conserva los turnos | pasó |
| `tests/integration/admin.clients.test.ts` | anonimización de datos de una clienta (RF-09) › no toca alergias/preferencias/observaciones del perfil clínico | pasó |
| `tests/integration/admin.clients.test.ts` | anonimización de datos de una clienta (RF-09) › la clienta anonimizada ya no puede loguearse | pasó |
| `tests/integration/admin.clients.test.ts` | anonimización de datos de una clienta (RF-09) › deja constancia en el log de actividad, con fecha y sin filtrar los datos viejos | pasó |
| `tests/integration/admin.clients.test.ts` | anonimización de datos de una clienta (RF-09) › una profesional no puede anonimizar clientes | pasó |
| `tests/integration/admin.clients.test.ts` | anonimización de datos de una clienta (RF-09) › devuelve 404 si el cliente no existe | pasó |
| `tests/integration/admin.anonymize-personal-data.test.ts` | anonimización de una clienta: datos personales (Fase 5) › borra las fotos de la galería (filas y archivos) | pasó |
| `tests/integration/admin.anonymize-personal-data.test.ts` | anonimización de una clienta: datos personales (Fase 5) › vacía teléfono, dirección y notas de los pedidos, pero conserva monto, estado y pago | pasó |
| `tests/integration/admin.anonymize-personal-data.test.ts` | anonimización de una clienta: datos personales (Fase 5) › vacía el texto de las reseñas y conserva el puntaje | pasó |
| `tests/integration/admin.anonymize-personal-data.test.ts` | anonimización de una clienta: datos personales (Fase 5) › conserva turnos, alergias, preferencias, observaciones y notas | pasó |
| `tests/integration/admin.anonymize-personal-data.test.ts` | anonimización de una clienta: datos personales (Fase 5) › después de anonimizar no queda ninguna sesión (RefreshSession) de la clienta | pasó |
| `tests/integration/admin.anonymize-personal-data.test.ts` | anonimización de una clienta: datos personales (Fase 5) › el registro de actividad enumera los campos tocados con cantidades y quién la ejecutó | pasó |
| `tests/integration/admin.anonymize-personal-data.test.ts` | anonimización de una clienta: datos personales (Fase 5) › si falla el borrado de un archivo no corta: anonimiza igual y deja un aviso de error con la lista | pasó |
| `tests/integration/admin.anonymize-personal-data.test.ts` | anonimización de una clienta: datos personales (Fase 5) › una clienta sin fotos, pedidos ni reseñas se anonimiza igual y no llama al almacenamiento | pasó |
| `tests/integration/admin.anonymize-personal-data.test.ts` | anonimización de una clienta: datos personales (Fase 5) › no toca las fotos, pedidos ni reseñas de otra clienta | pasó |

**Cobertura: Completo.**

### RF-10

**Enunciado (libro v7):** El sistema permite reservar, dentro de un mismo turno, dos o más servicios a cargo de profesionales distintas de forma coordinada, con una sola seña para todos los servicios y todas las profesionales, sin requerir coordinación manual entre ellas.

**Criterio de aceptación (libro v7):** Dada una clienta que reserva «uñas + cejas» para el mismo horario, cuando confirma la reserva, el sistema crea los turnos vinculados —uno por profesional— con el mismo horario de inicio y cobra una sola seña por el combo, verificable en el campo de agrupación de los turnos y en que la seña se registra una única vez.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/appointments.combo-deposit.test.ts` | combo con dos profesionales y una sola seña (RF-10) › crea dos turnos vinculados, uno por profesional, con el mismo inicio y la seña registrada una sola vez | pasó |
| `tests/integration/appointments.combo.test.ts` | reserva de combos simultáneos › crea una pata por componente, todas con el mismo comboGroupId, fecha y hora | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | combo: la seña es la suma de las patas › pagando solo una pata (3000 de 6000) NO registra la seña | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | combo: la seña es la suma de las patas › pagando el total (6000) registra la seña de todas las patas | pasó |
| `tests/integration/whatsapp-payment.test.ts` | seña de turno coordinada por WhatsApp (en vez de Mercado Pago) › en un combo, marcar la seña de UNA pata como paga confirma TODAS las patas | pasó |

**Cobertura: Completo.**

### RF-11

**Enunciado (libro v7):** El sistema centraliza en un catálogo único los servicios ofrecidos, organizados en las categorías uñas, cabello, cuerpo y rostro, cada uno con su precio y duración.

**Criterio de aceptación (libro v7):** Dado el panel de administración, cuando la propietaria da de alta un servicio con nombre, categoría, precio y duración, el servicio queda disponible para ser elegido por las clientas en el flujo de reserva, verificable en el listado público de servicios.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/services.catalog.test.ts` | RF-11: alta, edición y listado público de servicios › el administrador da de alta un servicio con nombre, categoría, duración y precio | pasó |
| `tests/integration/services.catalog.test.ts` | RF-11: alta, edición y listado público de servicios › el alta valida el cuerpo: nombre corto, duración menor a 5 minutos, precio negativo | pasó |
| `tests/integration/services.catalog.test.ts` | RF-11: alta, edición y listado público de servicios › el administrador edita el servicio enviando el formulario completo | pasó |
| `tests/integration/services.catalog.test.ts` | RF-11: alta, edición y listado público de servicios › el listado público muestra solo los servicios activos y no exige sesión | pasó |
| `tests/integration/services.catalog.test.ts` | RF-11: alta, edición y listado público de servicios › el listado completo, el alta y la edición quedan cerrados para clienta y profesional | pasó |
| `tests/integration/services.category.test.ts` | RF-11: categoría del servicio › acepta la categoría unas | pasó |
| `tests/integration/services.category.test.ts` | RF-11: categoría del servicio › acepta la categoría cabello | pasó |
| `tests/integration/services.category.test.ts` | RF-11: categoría del servicio › acepta la categoría cuerpo | pasó |
| `tests/integration/services.category.test.ts` | RF-11: categoría del servicio › acepta la categoría rostro | pasó |
| `tests/integration/services.category.test.ts` | RF-11: categoría del servicio › rechaza "peluqueria" en un servicio común | pasó |
| `tests/integration/services.category.test.ts` | RF-11: categoría del servicio › rechaza "Uñas" en un servicio común | pasó |
| `tests/integration/services.category.test.ts` | RF-11: categoría del servicio › rechaza "" en un servicio común | pasó |
| `tests/integration/services.category.test.ts` | RF-11: categoría del servicio › rechaza "combo" en un servicio común | pasó |
| `tests/integration/services.category.test.ts` | RF-11: categoría del servicio › rechaza "combos" en un servicio común | pasó |
| `tests/integration/services.category.test.ts` | RF-11: categoría del servicio › un servicio simultáneo puede ir en la categoría combo o en una de las cuatro | pasó |
| `tests/integration/services.category.test.ts` | RF-11: categoría del servicio › al editar solo se revisa la categoría si la edición la toca | pasó |

**Cobertura: Completo.**

### RF-12

**Enunciado (libro v7):** El sistema registra, en la reserva de una clienta menor de 13 años gestionada por la cuenta de su madre, padre o tutor, únicamente la condición de acompañante y su vínculo, sin ningún dato identificatorio de la menor.

**Criterio de aceptación (libro v7):** Dada una reserva gestionada por una cuenta adulta que marca «acompañante: sí» y elige el vínculo «hija/hijo», cuando se guarda el turno, el sistema registra solo la condición de acompañante y el vínculo de una lista cerrada (hija/hijo, pareja, familiar, amiga/o, otra), sin ningún campo de nombre, edad ni documento de la menor, verificable en el esquema de datos del turno y en el formulario resultante.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/appointments.companion.test.ts` | acompañante del turno › guarda hasCompanion y el vínculo de la lista | pasó |
| `tests/integration/appointments.companion.test.ts` | acompañante del turno › ignora un nombre de acompañante si llega en el body (no hay dónde guardarlo) | pasó |
| `tests/integration/appointments.companion.test.ts` | acompañante del turno › rechaza un vínculo fuera de la lista cerrada | pasó |
| `tests/integration/appointments.companion.test.ts` | acompañante del turno › sin acompañante no guarda vínculo | pasó |

**Cobertura: Completo.** La lista cerrada del código es `child`, `partner`, `family`, `friend`, `other` (`src/app/constants/companion.ts`), que corresponde a hija/hijo, pareja, familiar, amiga/o y otra.

### RF-13

**Enunciado (libro v7):** La clienta puede reprogramar un turno propio pendiente o confirmado a otro horario libre de la misma profesional; el sistema revalida la franja y la superposición, rechaza reprogramar un turno de combo y, si reprograma el personal, avisa a la clienta por mail y en pantalla hasta que lo confirma.

**Criterio de aceptación (libro v7):** Dado un turno confirmado de una clienta con la profesional X el lunes a las 10:00, cuando la clienta lo reprograma al lunes a las 11:00 y X no tiene otro turno activo a esa hora, el turno pasa a las 11:00; si X ya tiene un turno activo a las 11:00, el sistema responde 409 y el turno queda a las 10:00; si el turno es parte de un combo, el sistema lo rechaza (COMBO_NOT_RESCHEDULABLE). Verificable con appointments.cancel-reschedule.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/appointments.cancel-reschedule.test.ts` | reprogramación › reprograma un turno confirmado a otra fecha/hora | pasó |
| `tests/integration/appointments.cancel-reschedule.test.ts` | reprogramación › rechaza reprogramar a un horario ocupado de la misma profesional | pasó |
| `tests/integration/appointments.cancel-reschedule.test.ts` | reprogramación › rechaza reprogramar un turno ya finalizado | pasó |
| `tests/integration/appointments.cancel-reschedule.test.ts` | reprogramación › rechaza reprogramar una pata de un combo | pasó |
| `tests/integration/appointments.out-of-hours.test.ts` | horario fuera de la disponibilidad (OUT_OF_HOURS) › rechaza reprogramar a una hora fuera de la franja | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › tampoco se puede reprogramar otro turno hacia un horario ocupado por un no_show_auto | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › la clienta no puede reprogramar un turno no_show_auto | pasó |

**Cobertura: Completo.**

### RF-14

**Enunciado (libro v7):** El sistema cancela y libera el horario de un turno cuya seña no se pagó dentro del plazo de 20 minutos, salvo que la seña se coordine por WhatsApp; si en un combo queda impaga la pata con seña, cancela el grupo entero.

**Criterio de aceptación (libro v7):** Dado un turno con seña por Mercado Pago que sigue sin pagar al vencer el plazo, cuando corre el job de liberación, el turno pasa a cancelado y el horario queda libre para otra reserva; un turno con seña coordinada por WhatsApp no se libera; en un combo con la pata con seña impaga se cancelan todas las patas. Verificable con jobs.release-unpaid.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/jobs.release-unpaid.test.ts` | job de liberación de turnos con seña impaga › cancela un turno con seña impaga hace más de 20 minutos | pasó |
| `tests/integration/jobs.release-unpaid.test.ts` | job de liberación de turnos con seña impaga › NO toca un turno creado hace menos de 20 minutos | pasó |
| `tests/integration/jobs.release-unpaid.test.ts` | job de liberación de turnos con seña impaga › NO toca un turno manual sin seña (depositAmount 0) | pasó |
| `tests/integration/jobs.release-unpaid.test.ts` | job de liberación de turnos con seña impaga › NO toca un pago en efectivo pendiente (ya tiene mpPaymentId) | pasó |
| `tests/integration/jobs.release-unpaid.test.ts` | job de liberación de turnos con seña impaga › NO toca una seña ya pagada | pasó |
| `tests/integration/jobs.release-unpaid.test.ts` | job de liberación de turnos con seña impaga › NO toca una seña coordinada por WhatsApp, aunque esté pendiente hace rato | pasó |
| `tests/integration/jobs.release-unpaid.test.ts` | job de liberación de turnos con seña impaga › si la pata con seña de un combo queda impaga, cancela el grupo entero | pasó |
| `tests/integration/jobs.release-unpaid.test.ts` | job de liberación: actividad por turno › deja una entrada por cada turno liberado, con su appointmentId | pasó |
| `tests/integration/jobs.release-unpaid.test.ts` | job de liberación: actividad por turno › un combo liberado deja una entrada por cada pata | pasó |
| `tests/integration/jobs.release-unpaid.test.ts` | job de liberación: actividad por turno › no deja entradas si no libera nada | pasó |
| `tests/integration/special-service.payment.test.ts` | servicio especial: la seña no nace paga › el job cancela el turno impago, libera el horario y deja una entrada de actividad del turno | pasó |

**Cobertura: Completo.**

### RF-15

**Enunciado (libro v7):** El administrador y la profesional pueden crear un turno manual para una clienta existente o nueva (por ejemplo, la que llega sin reserva previa); el turno nace confirmado, sin seña, respeta el índice de no superposición y no se valida contra las franjas de la profesional.

**Criterio de aceptación (libro v7):** Dado un horario sin turno activo de la profesional X pero fuera de sus franjas, cuando el administrador crea un turno manual a esa hora, el turno se crea confirmado y sin seña; si X ya tiene un turno activo a esa hora de inicio, el sistema responde 409. Verificable con auth.minor-fixes (turno manual con clienta nueva) y la prueba «el turno manual del admin no se valida contra la franja».

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/auth.minor-fixes.test.ts` | emails en minúsculas al crear clientas › turno manual del admin con una clienta nueva: guarda el email en minúsculas y reutiliza la cuenta aunque cambien las mayúsculas | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | emails en minúsculas al crear clientas › turno manual de la profesional: guarda el email en minúsculas y reutiliza la cuenta existente | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | emails en minúsculas al crear clientas › turno manual de la profesional con una clienta nueva: el email queda en minúsculas | pasó |
| `tests/integration/appointments.out-of-hours.test.ts` | horario fuera de la disponibilidad (OUT_OF_HOURS) › el turno manual del admin no se valida contra la franja | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el horario ORIGINAL nunca se reabre › el personal tampoco puede cargar un turno manual en el horario original (lo corrige el administrador) | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el horario ORIGINAL nunca se reabre › un no_show_auto del job también bloquea el horario para el turno manual del personal | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | reserva tardía (hasta 15 minutos después de la hora de inicio) › el personal queda exento: puede cargar un turno manual con la hora ya pasada | pasó |

**Cobertura: Parcial.** Se prueba que el turno manual fuera de franja se crea (201), que reutiliza o crea la clienta y que un horario ocupado lo rechaza. Ninguna prueba comprueba que el turno manual nazca `confirmed` y sin seña.

### RF-16

**Enunciado (libro v7):** El administrador registra el cobro del saldo del turno en el local (efectivo, transferencia, tarjeta u otro medio) y el sistema marca el turno como pagado cuando la seña más el saldo cubren el precio; no se admite sobre turnos cancelados.

**Criterio de aceptación (libro v7):** Dado un turno de $10.000 con seña de $5.000 pagada, cuando el administrador registra un saldo de $5.000 en efectivo, el turno pasa a estado de pago «pagado»; con un saldo de $2.000 no pasa; sobre un turno cancelado el sistema rechaza el cobro. Verificable con appointments.balance-payment.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/appointments.balance-payment.test.ts` | cobro del saldo en el local (solo admin) › el admin registra el cobro en efectivo y queda el detalle completo | pasó |
| `tests/integration/appointments.balance-payment.test.ts` | cobro del saldo en el local (solo admin) › al cubrir el precio total, paymentStatus pasa a "paid" | pasó |
| `tests/integration/appointments.balance-payment.test.ts` | cobro del saldo en el local (solo admin) › un turno sin seña (walk-in) también puede cerrar su cobro completo | pasó |
| `tests/integration/appointments.balance-payment.test.ts` | cobro del saldo en el local (solo admin) › un cobro parcial (menor al precio total) mantiene el turno en "partial" | pasó |
| `tests/integration/appointments.balance-payment.test.ts` | cobro del saldo en el local (solo admin) › deja constancia en el log de actividad | pasó |
| `tests/integration/appointments.balance-payment.test.ts` | cobro del saldo en el local (solo admin) › rechaza un monto negativo o cero | pasó |
| `tests/integration/appointments.balance-payment.test.ts` | cobro del saldo en el local (solo admin) › rechaza un método de pago inválido | pasó |
| `tests/integration/appointments.balance-payment.test.ts` | cobro del saldo en el local (solo admin) › rechaza registrar un cobro sobre un turno cancelado | pasó |
| `tests/integration/appointments.balance-payment.test.ts` | cobro del saldo en el local (solo admin) › una profesional no puede registrar cobros — la ruta es admin-only | pasó |
| `tests/integration/appointments.balance-payment.test.ts` | cobro del saldo en el local (solo admin) › ya no existe ninguna ruta de profesional para registrar cobros | pasó |

**Cobertura: Completo.**

### RF-17

**Enunciado (libro v7):** El sistema permite ofrecer servicios especiales de un solo día, con horarios puntuales por profesional, zonas y paquetes; el precio y la duración los calcula el servidor a partir de lo elegido y un horario ya tomado se rechaza.

**Criterio de aceptación (libro v7):** Dado un servicio especial con un horario ya reservado, cuando otra clienta intenta reservar ese horario, el sistema responde 409 SLOT_TAKEN; el precio del turno es el calculado por el servidor desde las zonas y paquetes elegidos, no el que envía el navegador. Verificable revisando createSpecialForClient (sin prueba automatizada).

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/services.catalog.test.ts` | RF-17: reserva de un servicio especial › el precio y la duración salen de las zonas y paquetes del servidor, no de lo que mande el navegador | pasó |
| `tests/integration/services.catalog.test.ts` | RF-17: reserva de un servicio especial › una zona inactiva o inexistente se rechaza | pasó |
| `tests/integration/services.catalog.test.ts` | RF-17: reserva de un servicio especial › el horario ya tomado responde 409 SLOT_TAKEN y no crea un segundo turno | pasó |
| `tests/integration/services.catalog.test.ts` | RF-17: reserva de un servicio especial › el listado público no expone quién reservó el horario, solo que está tomado | pasó |
| `tests/integration/special-service.payment.test.ts` | servicio especial: la seña no nace paga › el turno nace con paymentStatus pending y con la seña calculada | pasó |
| `tests/integration/special-service.payment.test.ts` | servicio especial: la seña no nace paga › el job cancela el turno impago, libera el horario y deja una entrada de actividad del turno | pasó |
| `tests/integration/special-service.payment.test.ts` | servicio especial: la seña no nace paga › un turno con la seña ya paga no se libera ni suelta el horario | pasó |
| `tests/integration/special-service.payment.test.ts` | servicio especial: la seña no nace paga › si la clienta cancela, el horario del servicio especial queda libre | pasó |
| `tests/integration/special-service.payment.test.ts` | servicio especial: la seña no nace paga › si el personal cancela, el horario del servicio especial queda libre | pasó |
| `tests/integration/client-details-job-interest-late-booking.test.ts` | reserva tardía en combos y servicios especiales › servicio especial: a los 15 minutos exactos de la hora del horario se reserva | pasó |
| `tests/integration/client-details-job-interest-late-booking.test.ts` | reserva tardía en combos y servicios especiales › servicio especial: a los 16 minutos responde 400 START_TIME_PASSED y el horario sigue libre | pasó |

**Cobertura: Completo.** El libro v7 dice «sin prueba automatizada»: desde la fase 7 la tiene.

### RF-18

**Enunciado (libro v7):** El administrador puede bloquear a una clienta; una clienta bloqueada no puede reservar turnos ni comprar productos.

**Criterio de aceptación (libro v7):** Dada una clienta bloqueada, cuando intenta reservar un turno o comprar un producto, el sistema responde 403 CLIENT_BLOCKED. Verificable con la prueba «rechaza reservar si la clienta está bloqueada»; la compra y el endpoint de bloqueo no tienen prueba.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/store.blocking-and-movements.test.ts` | RF-18: clienta bloqueada › una clienta bloqueada no puede comprar (403 CLIENT_BLOCKED) ni reservar; el stock no se toca | pasó |
| `tests/integration/store.blocking-and-movements.test.ts` | RF-18: clienta bloqueada › el administrador la bloquea y la desbloquea; después del desbloqueo puede comprar | pasó |
| `tests/integration/store.blocking-and-movements.test.ts` | RF-18: clienta bloqueada › el endpoint valida el cuerpo, exige una clienta y es solo del administrador | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › rechaza reservar si la clienta está bloqueada | pasó |

**Cobertura: Completo.**

### RF-19

**Enunciado (libro v7):** El sistema ofrece una tienda de productos: catálogo público, carrito y pedido con retiro o envío, con pago por Mercado Pago o coordinado por WhatsApp; el stock se descuenta recién cuando el pago se aprueba con el monto correcto y el administrador gestiona productos y estados de los pedidos.

**Criterio de aceptación (libro v7):** Dado un producto activo con stock 5 y un pedido de 2 unidades pagado por Mercado Pago con el monto correcto, cuando el pago se aprueba, el stock baja a 3 y el pedido queda pagado; con un monto menor o en otra moneda el pago no se registra y queda un aviso de error en la actividad; un pedido por más unidades que el stock se rechaza (INSUFFICIENT_STOCK). Verificable con payments.webhook-amount, payments.webhook-idempotency y whatsapp-payment (pedido).

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/store.availability.test.ts` | GET /api/store/products (pública) › no devuelve productos inactivos, sin stock ni "sin stock" y se ve sin iniciar sesión | pasó |
| `tests/integration/store.availability.test.ts` | GET /api/store/products (pública) › no expone stock ni stock mínimo, solo un indicador de disponibilidad | pasó |
| `tests/integration/store.availability.test.ts` | GET /api/admin/store/products (solo administrador) › devuelve todos los productos con stock y stock mínimo | pasó |
| `tests/integration/store.availability.test.ts` | GET /api/admin/store/products (solo administrador) › una clienta recibe 403 y una visitante 401 | pasó |
| `tests/integration/store.availability.test.ts` | GET /api/admin/store/products (solo administrador) › el alta, la edición y la baja de productos siguen funcionando | pasó |
| `tests/integration/store.availability.test.ts` | GET /api/admin/store/products (solo administrador) › el alta, la edición y la baja siguen cerradas para una clienta | pasó |
| `tests/integration/store.availability.test.ts` | POST /api/client/orders: el pedido valida el producto aunque el navegador lo envíe › rechaza un producto inactivo | pasó |
| `tests/integration/store.availability.test.ts` | POST /api/client/orders: el pedido valida el producto aunque el navegador lo envíe › rechaza un producto marcado "sin stock" aunque tenga unidades | pasó |
| `tests/integration/store.availability.test.ts` | POST /api/client/orders: el pedido valida el producto aunque el navegador lo envíe › rechaza un producto con stock 0 | pasó |
| `tests/integration/store.availability.test.ts` | POST /api/client/orders: el pedido valida el producto aunque el navegador lo envíe › rechaza una cantidad mayor al stock, también sumando varias líneas del mismo producto | pasó |
| `tests/integration/store.availability.test.ts` | POST /api/client/orders: el pedido valida el producto aunque el navegador lo envíe › rechaza el pedido entero si uno solo de los productos no se puede vender | pasó |
| `tests/integration/store.availability.test.ts` | POST /api/client/orders: el pedido valida el producto aunque el navegador lo envíe › un producto que no existe se rechaza | pasó |
| `tests/integration/store.availability.test.ts` | POST /api/client/orders: el pedido valida el producto aunque el navegador lo envíe › un pedido válido se crea sin tocar el stock todavía | pasó |
| `tests/integration/store.availability.test.ts` | pago aprobado: descuenta el stock y registra la salida en el libro › descuenta el stock y crea un movimiento de salida con el nombre, la cantidad y la fecha | pasó |
| `tests/integration/store.availability.test.ts` | pago aprobado: descuenta el stock y registra la salida en el libro › suma las líneas de un mismo producto en un solo movimiento y crea uno por producto | pasó |
| `tests/integration/store.availability.test.ts` | pago aprobado: descuenta el stock y registra la salida en el libro › el aviso repetido de Mercado Pago no descuenta ni registra de nuevo | pasó |
| `tests/integration/store.availability.test.ts` | pago aprobado: descuenta el stock y registra la salida en el libro › un pago rechazado o por menos del total no descuenta ni registra nada | pasó |
| `tests/integration/store.availability.test.ts` | pago aprobado: descuenta el stock y registra la salida en el libro › el pago coordinado por WhatsApp que confirma el administrador también deja la salida | pasó |
| `tests/integration/store.availability.test.ts` | pago aprobado: descuenta el stock y registra la salida en el libro › el movimiento de la venta se ve en el libro del administrador | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | pedido: se valida el total antes de marcarlo pago y descontar stock › con un monto menor NO lo marca pago ni descuenta stock | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | pedido: se valida el total antes de marcarlo pago y descontar stock › con el total exacto lo marca pago y descuenta el stock | pasó |
| `tests/integration/payments.webhook-idempotency.test.ts` | idempotencia al aplicar el resultado de un pago › pedido: avisos simultáneos descuentan el stock una sola vez | pasó |
| `tests/integration/payments.webhook-idempotency.test.ts` | idempotencia al aplicar el resultado de un pago › pedido: repetir el aviso uno detrás de otro no vuelve a descontar stock | pasó |
| `tests/integration/payments.webhook-idempotency.test.ts` | idempotencia al aplicar el resultado de un pago › pedido: un aviso tardío de rechazo no pisa un pedido ya pago | pasó |
| `tests/integration/whatsapp-payment.test.ts` | pago de un pedido de tienda coordinado por WhatsApp › el cliente hace el pedido con paymentMethod whatsapp y queda pendiente sin descontar stock | pasó |
| `tests/integration/whatsapp-payment.test.ts` | pago de un pedido de tienda coordinado por WhatsApp › el admin lo marca pago, descuenta stock y queda idempotente | pasó |
| `tests/integration/whatsapp-payment.test.ts` | pago de un pedido de tienda coordinado por WhatsApp › rechaza marcar como pago un pedido que en realidad es de Mercado Pago | pasó |
| `tests/integration/whatsapp-payment.test.ts` | pago de un pedido de tienda coordinado por WhatsApp › el admin puede listar los pedidos | pasó |

**Cobertura: Parcial.** El pago de un pedido con otra moneda no tiene prueba propia (la moneda se prueba en el turno). El resto del criterio sí: stock 5 → 3 al aprobarse, monto menor sin registrar ni descontar, `INSUFFICIENT_STOCK`.

### RF-20

**Enunciado (libro v7):** El administrador crea promociones de servicio o de producto (descuento, combo o «llevás X, pagás Y») con ventana de vigencia; el servidor recalcula el precio al reservar o comprar y se avisa a las clientas al activarlas.

**Criterio de aceptación (libro v7):** Dada una promoción vigente de $4.000 sobre un servicio de $5.000, cuando la clienta reserva ese servicio, el turno se crea a $4.000 aunque el navegador envíe otro precio; con la promoción vencida se cobra $5.000. Verificable con appointments.booking › promociones (4 casos); el alta y la edición de promociones no tienen prueba.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/promotions-and-special-events.test.ts` | RF-20: promociones › el administrador da de alta, edita y da de baja una promoción | pasó |
| `tests/integration/promotions-and-special-events.test.ts` | RF-20: promociones › el alta valida el cuerpo: sin ítems, combo con un solo ítem, precio negativo | pasó |
| `tests/integration/promotions-and-special-events.test.ts` | RF-20: promociones › la gestión de promociones es solo del administrador | pasó |
| `tests/integration/promotions-and-special-events.test.ts` | RF-20: promociones › GET /promotions/public lista solo las activas y vigentes hoy, sin sesión | pasó |
| `tests/integration/promotions-and-special-events.test.ts` | RF-20: promociones › promociones en pedidos › el pedido cobra el precio de la promoción, no el de lista ni el que mande el navegador | pasó |
| `tests/integration/promotions-and-special-events.test.ts` | RF-20: promociones › promociones en pedidos › una promoción inactiva o vencida se rechaza con PROMOTION_NOT_AVAILABLE | pasó |
| `tests/integration/promotions-and-special-events.test.ts` | RF-20: promociones › promociones en pedidos › un producto que no es el de la promoción se rechaza con PROMOTION_MISMATCH | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › promociones › aplica el precio de la promoción, no el de catálogo (el bug real que se arregló) | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › promociones › nunca confía en un precio mandado por el cliente — ignora cualquier price/deposit del body | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › promociones › rechaza una promoción vencida | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › promociones › rechaza una promoción que no corresponde a ese servicio | pasó |

**Cobertura: Parcial.** **Choca con el código.** El criterio dice que con la promoción vencida «se cobra $5.000»; el código rechaza la reserva con una promoción vencida (prueba «rechaza una promoción vencida»). El precio de la promoción vigente sí está cubierto.

### RF-21

**Enunciado (libro v7):** El administrador registra entradas y salidas de stock de un producto; el sistema ajusta el stock en una transacción y rechaza dejarlo negativo. Los pedidos pagados descuentan stock directamente, sin crear un movimiento.

**Criterio de aceptación (libro v7):** Dado un producto con stock 3, cuando el administrador registra una salida de 5, el sistema responde INSUFFICIENT_STOCK y el stock queda en 3; una entrada de 10 lo lleva a 13. Verificable con una llamada a POST /store/movements (sin prueba automatizada).

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/store.blocking-and-movements.test.ts` | RF-21: libro de inventario › una entrada suma stock y una salida lo resta; ambas quedan en el libro con el nombre del producto | pasó |
| `tests/integration/store.blocking-and-movements.test.ts` | RF-21: libro de inventario › una salida mayor al stock se rechaza (400 INSUFFICIENT_STOCK) y el stock no queda negativo | pasó |
| `tests/integration/store.blocking-and-movements.test.ts` | RF-21: libro de inventario › valida el cuerpo: tipo, cantidad, fecha y producto | pasó |
| `tests/integration/store.blocking-and-movements.test.ts` | RF-21: libro de inventario › editar un movimiento deshace el efecto anterior y aplica el nuevo (también al cambiar de producto) | pasó |
| `tests/integration/store.blocking-and-movements.test.ts` | RF-21: libro de inventario › borrar un movimiento devuelve el stock y lo saca del libro | pasó |
| `tests/integration/store.blocking-and-movements.test.ts` | RF-21: libro de inventario › el libro es solo del administrador | pasó |
| `tests/integration/store.availability.test.ts` | pago aprobado: descuenta el stock y registra la salida en el libro › descuenta el stock y crea un movimiento de salida con el nombre, la cantidad y la fecha | pasó |
| `tests/integration/store.availability.test.ts` | pago aprobado: descuenta el stock y registra la salida en el libro › suma las líneas de un mismo producto en un solo movimiento y crea uno por producto | pasó |
| `tests/integration/store.availability.test.ts` | pago aprobado: descuenta el stock y registra la salida en el libro › el aviso repetido de Mercado Pago no descuenta ni registra de nuevo | pasó |
| `tests/integration/store.availability.test.ts` | pago aprobado: descuenta el stock y registra la salida en el libro › un pago rechazado o por menos del total no descuenta ni registra nada | pasó |
| `tests/integration/store.availability.test.ts` | pago aprobado: descuenta el stock y registra la salida en el libro › el pago coordinado por WhatsApp que confirma el administrador también deja la salida | pasó |
| `tests/integration/store.availability.test.ts` | pago aprobado: descuenta el stock y registra la salida en el libro › el movimiento de la venta se ve en el libro del administrador | pasó |

**Cobertura: Completo.** El criterio (salida de 5 con stock 3) está cubierto. Dos diferencias con el enunciado: desde la fase 4 los pedidos pagados SÍ crean un movimiento de salida, y borrar una entrada ya vendida deja el stock negativo (hallazgo de la fase 7, sin corregir).

### RF-23

**Enunciado (libro v7):** El administrador publica en el home un evento especial (servicio, profesional y fecha) que se oculta solo cuando pasa la fecha; la clienta lo reserva por el flujo normal.

**Criterio de aceptación (libro v7):** Dado un evento activo con fecha de hoy, cuando son las 22:30 hora de Argentina, el evento sigue publicado; al día siguiente deja de mostrarse. Verificable con timezone-art › «un evento especial de hoy sigue publicado a las 22:30»; el alta y la edición no tienen prueba.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/promotions-and-special-events.test.ts` | RF-23: eventos especiales › el administrador da de alta, edita y da de baja un evento especial | pasó |
| `tests/integration/promotions-and-special-events.test.ts` | RF-23: eventos especiales › el alta valida el servicio, la profesional y la fecha | pasó |
| `tests/integration/promotions-and-special-events.test.ts` | RF-23: eventos especiales › el listado público muestra solo los activos desde hoy, ordenados por fecha; la gestión es del administrador | pasó |
| `tests/integration/timezone-art.test.ts` | "hoy" en hora de Argentina › un evento especial de hoy sigue publicado a las 22:30 | pasó |

**Cobertura: Completo.**

### RF-24

**Enunciado (libro v7):** El sistema avisa a profesionales y clientas dentro de la aplicación y por mail de los hechos que les corresponden (turno nuevo, cancelado o reprogramado, servicio, producto o promoción nuevos); la profesional recibe el aviso de un turno nuevo recién cuando la seña está paga. No se envía ninguna notificación por WhatsApp.

**Criterio de aceptación (libro v7):** Dado un turno con seña por Mercado Pago, cuando el pago se aprueba, la profesional recibe un aviso «turno nuevo» y un mail, y no antes; en un combo recibe un solo aviso por grupo. Verificable con notifications.investigation (3 casos) y mail.provider.test; la lectura de las bandejas no tiene prueba.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/notifications.inbox-and-client-mail.test.ts` | RF-24: bandeja de avisos de la profesional › lee sus avisos (los más nuevos primero), marca uno y marca todos como leídos | pasó |
| `tests/integration/notifications.inbox-and-client-mail.test.ts` | RF-24: bandeja de avisos de la profesional › no ve ni marca los avisos de otra profesional | pasó |
| `tests/integration/notifications.inbox-and-client-mail.test.ts` | RF-24: bandeja de avisos de la profesional › recibe el aviso cuando la clienta cancela su turno | pasó |
| `tests/integration/notifications.inbox-and-client-mail.test.ts` | RF-24: bandeja de avisos de la profesional › la bandeja es solo de la profesional | pasó |
| `tests/integration/notifications.inbox-and-client-mail.test.ts` | RF-24: bandeja de avisos de la clienta › una promoción nueva le llega como aviso; lo lee y lo marca como leído | pasó |
| `tests/integration/notifications.inbox-and-client-mail.test.ts` | RF-24: bandeja de avisos de la clienta › marca todos como leídos y no toca los de otra clienta | pasó |
| `tests/integration/notifications.inbox-and-client-mail.test.ts` | RF-24: mails a la clienta por un turno › reservar, pagar la seña, cancelar o reprogramar ella misma: ningún mail a la clienta | pasó |
| `tests/integration/notifications.inbox-and-client-mail.test.ts` | RF-24: mails a la clienta por un turno › cuando el personal cancela, la clienta recibe el mail | pasó |
| `tests/integration/notifications.inbox-and-client-mail.test.ts` | RF-24: mails a la clienta por un turno › cuando el personal reprograma, la clienta recibe el mail; si el cambio no mueve fecha ni hora, no | pasó |
| `tests/integration/notifications.inbox-and-client-mail.test.ts` | RF-24: mails a la clienta por un turno › en el código, los únicos envíos de mail son los permitidos (personal, recordatorio, cuenta e invitación) | pasó |
| `tests/integration/notifications.investigation.test.ts` | investigación: notificaciones al confirmarse el pago › turno SOLO: la profesional recibe la notificación de nuevo turno al aprobarse el pago | pasó |
| `tests/integration/notifications.investigation.test.ts` | investigación: notificaciones al confirmarse el pago › combo/simultáneo: AMBAS profesionales reciben la notificación al aprobarse el pago | pasó |
| `tests/integration/notifications.investigation.test.ts` | investigación: notificaciones al confirmarse el pago › combo/simultáneo: en Actividad del admin queda UN solo registro de "nuevo turno", no uno por servicio | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | cancelación de la clienta desde la app › su propia cancelación NO manda mail a la clienta | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | cancelación del personal con hora de aviso › el mail a la clienta se envía cuando cancela el personal, en los dos casos | pasó |

**Cobertura: Parcial.** El aviso «turno nuevo» a la profesional al aprobarse el pago (y uno solo por combo) está probado. El **mail** a la profesional (`Nuevo turno agendado — Nexa`) solo aparece en la revisión de la lista de envíos del código, no en una prueba que apruebe un pago y mire el mail.

### RF-25

**Enunciado (libro v7):** La clienta califica de 1 a 5 un turno finalizado propio y puede dejar un comentario; el puntaje cuenta al instante y el comentario espera la aprobación del administrador antes de mostrarse; se admite una reseña por turno.

**Criterio de aceptación (libro v7):** Dado un turno finalizado, cuando la clienta envía 5 estrellas con comentario, el puntaje suma al promedio público y el comentario queda «pendiente» hasta que el administrador lo aprueba; un segundo envío para el mismo turno responde 409 ALREADY_REVIEWED. Verificable con llamadas a la API (sin prueba automatizada).

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/reviews.test.ts` | RF-25: reseñas › la clienta reseña un turno finalizado propio; con comentario nace pendiente, sin comentario aprobada | pasó |
| `tests/integration/reviews.test.ts` | RF-25: reseñas › una sola reseña por turno: la segunda responde 409 ALREADY_REVIEWED | pasó |
| `tests/integration/reviews.test.ts` | RF-25: reseñas › solo turnos finalizados y propios: uno confirmado da 400 y uno ajeno 404 | pasó |
| `tests/integration/reviews.test.ts` | RF-25: reseñas › valida el puntaje entre 1 y 5 | pasó |
| `tests/integration/reviews.test.ts` | RF-25: reseñas › el comentario se publica recién cuando el administrador lo aprueba; uno rechazado no aparece | pasó |
| `tests/integration/reviews.test.ts` | RF-25: reseñas › el promedio público cuenta todos los puntajes, también los de comentarios pendientes o rechazados | pasó |
| `tests/integration/reviews.test.ts` | RF-25: reseñas › el promedio por profesional sale en el listado público de profesionales | pasó |

**Cobertura: Completo.**

### RF-26

**Enunciado (libro v7):** El administrador consulta el historial de turnos finalizados, cancelados y cancelados por inasistencia de cada clienta, con el motivo de la cancelación; la profesional consulta las clientas que atendió y sus visitas; el administrador consulta los turnos finalizados de cada profesional.

**Criterio de aceptación (libro v7):** Dada una clienta con un turno finalizado y otro cancelado con motivo, cuando el administrador abre su historial, ve ambos turnos con su estado y el motivo del segundo; cuando una profesional que la atendió abre «Clientas», la ve en su lista. Verificable con GET /admin/clients/:id/history y GET /professional/clients (este último con allergies.consent-visibility); el contenido del historial no tiene prueba.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/history-activity-dashboard.test.ts` | RF-26: historial › historial de la clienta (administrador): turnos finalizados, cancelados y no asistidos, del más nuevo al más viejo | pasó |
| `tests/integration/history-activity-dashboard.test.ts` | RF-26: historial › la clienta ve todos sus turnos (también los próximos) y ninguno ajeno | pasó |
| `tests/integration/history-activity-dashboard.test.ts` | RF-26: historial › historial de la profesional (administrador): solo sus turnos finalizados, con la clienta y el precio | pasó |
| `tests/integration/history-activity-dashboard.test.ts` | RF-26: historial › los historiales del administrador no los ve una clienta ni una profesional | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › con un turno finalizado con la clienta, la profesional ve la alergia del perfil | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › con un turno cancelled no la ve | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › con un turno cancelled_no_show no la ve | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › con un turno no_show_auto no la ve | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › con un turno confirmado a futuro no la ve | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › con un turno pendiente tampoco la ve | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › un turno finalizado con OTRA profesional no alcanza | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › la profesional asignada a un turno propio ve la alergia de ese turno, aunque no vea la del perfil | pasó |

**Cobertura: Completo.**

### RF-27

**Enunciado (libro v7):** El administrador consulta un registro de actividad con fecha y hora, usuario, módulo, nivel y detalle de lo que ocurre en el sistema (turnos, pagos, clientas, tienda, jobs y reseñas); registrar un evento nunca interrumpe la operación.

**Criterio de aceptación (libro v7):** Dado un cambio de estado de un turno hecho por la profesional, cuando el administrador abre el registro de actividad, ve una entrada con la fecha, el usuario y el nuevo estado. Verificable con appointments.status-log; la pantalla GET /admin/activity no tiene prueba.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/history-activity-dashboard.test.ts` | RF-27: GET /admin/activity › devuelve las entradas de la más nueva a la más vieja, con módulo, nivel, detalle y turno | pasó |
| `tests/integration/history-activity-dashboard.test.ts` | RF-27: GET /admin/activity › una entrada de reseña trae el estado vigente del comentario | pasó |
| `tests/integration/history-activity-dashboard.test.ts` | RF-27: GET /admin/activity › es solo del administrador | pasó |
| `tests/integration/appointments.status-log.test.ts` | auditoría de cambios de estado de un turno › la profesional marca "no asistió" y queda registrado en el log de actividad | pasó |
| `tests/integration/appointments.status-log.test.ts` | auditoría de cambios de estado de un turno › el admin marca "finalizado" y queda registrado con su identidad | pasó |
| `tests/integration/appointments.status-log.test.ts` | auditoría de cambios de estado de un turno › no duplica el log si se guarda sin cambiar el estado | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el personal marca "No asistió" (cancelled_no_show) › queda en el registro de actividad con el id del turno, quién lo hizo, el cambio de estado y desde cuándo se reabre | pasó |
| `tests/integration/appointments.reopened-slots.test.ts` | el personal marca "No asistió" (cancelled_no_show) › el listado de actividad del administrador trae el id del turno | pasó |

**Cobertura: Completo.**

### RF-28

**Enunciado (libro v7):** El administrador administra una galería de fotos antes y después por clienta, con opción de mostrarlas en el home, y el sistema cuenta las visitas de cada clienta; los puntos de fidelización los ajusta el administrador a mano.

**Criterio de aceptación (libro v7):** Dada una clienta con 3 turnos no cancelados, cuando el administrador abre su ficha, ve 3 visitas; los puntos de fidelización solo cambian si el administrador los edita. Verificable en la ficha de la clienta (sin prueba automatizada).

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/gallery-and-professional-profile.test.ts` | RF-28: galería › el administrador agrega, edita y borra fotos de una clienta | pasó |
| `tests/integration/gallery-and-professional-profile.test.ts` | RF-28: galería › el alta valida la URL y la categoría, y la foto tiene que ser de esa clienta | pasó |
| `tests/integration/gallery-and-professional-profile.test.ts` | RF-28: galería › las fotos públicas son solo las marcadas para la home, en pares antes/después y sin datos de la clienta | pasó |
| `tests/integration/gallery-and-professional-profile.test.ts` | RF-28: galería › la gestión de la galería es solo del administrador | pasó |
| `tests/integration/admin.clients.visits.test.ts` | ficha de la clienta sin fidelización ni fecha de nacimiento › las visitas cuentan solo los turnos finalizados | pasó |
| `tests/integration/admin.clients.visits.test.ts` | ficha de la clienta sin fidelización ni fecha de nacimiento › la respuesta ya no trae puntos, promociones disponibles ni fecha de nacimiento | pasó |
| `tests/integration/admin.clients.visits.test.ts` | ficha de la clienta sin fidelización ni fecha de nacimiento › al editar la ficha se ignoran la fecha de nacimiento y los puntos que mande un cliente viejo | pasó |
| `tests/integration/admin.clients.visits.test.ts` | ficha de la clienta sin fidelización ni fecha de nacimiento › crear una clienta desde el panel no guarda fecha de nacimiento | pasó |

**Cobertura: Parcial.** Sin la parte de fidelización (eliminada). **Choca con el código:** el criterio cuenta como visitas los turnos «no cancelados»; desde la fase 1 (decisión de Emily) se cuentan solo los `finished`. La galería está cubierta.

### RF-29

**Enunciado (libro v7):** El administrador da de alta profesionales por invitación (enlace de un solo uso que vence a los 7 días), las activa o desactiva (al desactivar se cierran sus sesiones) y cambia su rol entre profesional y administradora; cada profesional completa su perfil, los servicios que ofrece con precio y duración propios, sus franjas semanales y sus vacaciones.

**Criterio de aceptación (libro v7):** Dada una invitación ya usada o vencida, cuando alguien intenta registrarse con ese enlace, el sistema lo rechaza; con una invitación vigente crea la cuenta y la invitación queda usada; una profesional desactivada no puede renovar su sesión. Verificable con auth.minor-fixes (7 casos de invitación y 7 de cambio de rol) y auth.sessions; el perfil, los servicios y las franjas no tienen prueba.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/gallery-and-professional-profile.test.ts` | RF-29: autogestión de la profesional › lee y actualiza su perfil | pasó |
| `tests/integration/gallery-and-professional-profile.test.ts` | RF-29: autogestión de la profesional › un teléfono que no es un celular argentino se rechaza y no cambia nada | pasó |
| `tests/integration/gallery-and-professional-profile.test.ts` | RF-29: autogestión de la profesional › elige los servicios que hace: activa, pausa y quita | pasó |
| `tests/integration/gallery-and-professional-profile.test.ts` | RF-29: autogestión de la profesional › carga sus franjas (más de una por día) y un día sin franja queda sin atención | pasó |
| `tests/integration/gallery-and-professional-profile.test.ts` | RF-29: autogestión de la profesional › completa el onboarding: guarda perfil, franjas y servicios, y queda marcado como completo | pasó |
| `tests/integration/gallery-and-professional-profile.test.ts` | RF-29: autogestión de la profesional › perfil, servicios, franjas y onboarding son solo de la profesional | pasó |
| `tests/integration/gallery-and-professional-profile.test.ts` | RF-29: envío de la invitación › el administrador invita por mail: se guarda la invitación y sale el mail con el link de registro | pasó |
| `tests/integration/gallery-and-professional-profile.test.ts` | RF-29: envío de la invitación › valida el email y es solo del administrador | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | PATCH /api/professional/:id/toggle-role › sobre una clienta responde 400 INVALID_ROLE_CHANGE y el rol no cambia | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | PATCH /api/professional/:id/toggle-role › una profesional pasa a admin | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | PATCH /api/professional/:id/toggle-role › otra admin pasa a professional | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | PATCH /api/professional/:id/toggle-role › sobre uno mismo responde 403 SELF_ROLE_CHANGE | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | PATCH /api/professional/:id/toggle-role › una profesional (no admin) recibe 403 y nada cambia | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | PATCH /api/professional/:id/toggle-role › sin sesión responde 401 | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | PATCH /api/professional/:id/toggle-role › una usuaria inexistente responde 404 | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | POST /api/invitations/register › si el email pertenece a una cuenta admin responde 409 ADMIN_ACCOUNT, no toca la cuenta y no gasta la invitación | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | POST /api/invitations/register › si el email pertenece a una cuenta inactiva responde 409 ACCOUNT_INACTIVE | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | POST /api/invitations/register › si el email se ocupa justo antes de crear la cuenta responde 409 EMAIL_TAKEN y no gasta la invitación | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | POST /api/invitations/register › dos registros simultáneos con el mismo token: uno 201, el otro 400 TOKEN_USED y una sola cuenta | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | POST /api/invitations/register › un registro exitoso devuelve el usuario, no el accessToken en el cuerpo, y setea las dos cookies | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | POST /api/invitations/register › el access_token de la cookie sirve para entrar a una ruta protegida | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | POST /api/invitations/register › una clienta existente invitada pasa a professional con la contraseña nueva | pasó |
| `tests/integration/auth.sessions.test.ts` | varios dispositivos a la vez › una usuaria desactivada no puede renovar ninguna sesión | pasó |

**Cobertura: Parcial.** Falta una prueba de la invitación **vencida** (7 días); la usada, la vigente y la profesional desactivada sí están.

### RF-31

**Enunciado (libro v7):** La clienta completa después de reservar los detalles del servicio de su turno (por ejemplo diseño de uñas, largo de cabello o tipo de piel) y el administrador registra el retiro de esmalte como dato informativo con sus reglas de precio.

**Criterio de aceptación (libro v7):** Dado un turno de uñas con retiro de esmalte registrado por el administrador, cuando se abre el turno, se ve la etiqueta y el precio del retiro según las reglas de Configuración; el dato es informativo. Verificable con polish-removal (5 casos); la carga de los detalles por la clienta no tiene prueba propia.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/client-details-job-interest-late-booking.test.ts` | RF-31: detalles del servicio cargados por la clienta › guarda los detalles en el turno, deja constancia del consentimiento y los devuelve en la vista | pasó |
| `tests/integration/client-details-job-interest-late-booking.test.ts` | RF-31: detalles del servicio cargados por la clienta › sin consentimiento no guarda nada (400) y los valores fuera de rango se rechazan | pasó |
| `tests/integration/client-details-job-interest-late-booking.test.ts` | RF-31: detalles del servicio cargados por la clienta › una clienta no puede cargar detalles en el turno de otra | pasó |
| `tests/integration/polish-removal.test.ts` | reglas de retiro de esmalte (configuración) › el admin puede guardar y leer la lista de reglas | pasó |
| `tests/integration/polish-removal.test.ts` | reglas de retiro de esmalte (configuración) › una profesional no puede tocar las reglas | pasó |
| `tests/integration/polish-removal.test.ts` | registro del retiro de esmalte en un turno (solo control, no suma a nada) › el admin lo registra y queda visible en la vista admin del turno | pasó |
| `tests/integration/polish-removal.test.ts` | registro del retiro de esmalte en un turno (solo control, no suma a nada) › deja constancia en el log de actividad | pasó |
| `tests/integration/polish-removal.test.ts` | registro del retiro de esmalte en un turno (solo control, no suma a nada) › no afecta el KPI de saldo pendiente del dashboard | pasó |

**Cobertura: Completo.**

### RF-32

**Enunciado (libro v7):** El administrador configura los datos del negocio (nombre, logo, contacto y políticas), el horario semanal, los feriados y la seña (monto fijo o porcentaje, horas de cancelación y política de devolución).

**Criterio de aceptación (libro v7):** Dada una seña configurada en $5.000, cuando el administrador la cambia a $3.000, el siguiente turno reservado calcula una seña de $3.000. Verificable con appointments.booking (seña de $2.000 y seña 0); el modo porcentaje y PATCH /settings/payments no tienen prueba.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/settings.deposit-and-refund.test.ts` | RF-03 y RF-32: cálculo de la seña › computeDeposit en porcentaje redondea al peso; en monto fijo nunca supera el precio | pasó |
| `tests/integration/settings.deposit-and-refund.test.ts` | RF-03 y RF-32: cálculo de la seña › el administrador pasa la seña a porcentaje y la reserva de la clienta toma ese porcentaje del precio | pasó |
| `tests/integration/settings.deposit-and-refund.test.ts` | RF-03 y RF-32: cálculo de la seña › PATCH /settings/payments: valores válidos, inválidos (400 VALIDATION_ERROR) y sin permiso | pasó |
| `tests/integration/appointments.booking.test.ts` | reserva de turnos › crea un turno confirmado con el precio de catálogo del servicio | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | cancelación de la clienta desde la app › el corte usa las horas de la configuración (cancellationHours = 24) | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | política de devolución: solo "full" o "none" › acepta "full" y "none" | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | política de devolución: solo "full" o "none" › rechaza "partial" y cualquier otro valor con 400 | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | política de devolución: solo "full" o "none" › valida el resto del cuerpo: horas, monto y porcentaje | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | política de devolución: solo "full" o "none" › no la puede cambiar una clienta ni una profesional (403) ni un visitante (401) | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | política de devolución: solo "full" o "none" › la migración pasa los "partial" que había a "full" (y deja "none" como estaba) | pasó |
| `tests/integration/appointments.cancellation-refund.test.ts` | política de devolución: solo "full" o "none" › un "partial" viejo que siga en la base se lee como "full" | pasó |

**Cobertura: Completo.** El cambio a porcentaje pasa por `PATCH /settings/payments`; el monto fijo de la prueba de reserva se carga directo en la base.

### RF-33

**Enunciado (libro v7):** El sitio permite a una visitante enviar su interés por trabajar en el estudio; el sistema deja una entrada «Nueva postulación» en el registro de actividad.

**Criterio de aceptación (libro v7):** Dado el formulario de postulación del sitio, cuando una visitante lo envía, aparece en el registro de actividad una entrada del módulo «jobs» con la acción «Nueva postulación»; no se guarda ningún otro dato. Sin prueba automatizada.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/client-details-job-interest-late-booking.test.ts` | RF-33: postulación › una postulación con datos responde 201 y queda en la actividad del administrador (módulo jobs) | pasó |
| `tests/integration/client-details-job-interest-late-booking.test.ts` | RF-33: postulación › comportamiento actual: un cuerpo vacío o inválido igual responde 201 y deja "Postulación sin datos cargados" | pasó |

**Cobertura: Parcial.** La entrada «Nueva postulación» del módulo `jobs` está probada. Que «no se guarde ningún otro dato» no lo prueba nada; además, el nombre, el correo y el teléfono quedan dentro del detalle de esa entrada y un cuerpo inválido igual se acepta (hallazgo de la fase 7).

### RF-34

**Enunciado (libro v7):** El administrador ve un panel con indicadores del negocio calculados por el sistema y cada profesional ve su panel y sus estadísticas.

**Criterio de aceptación (libro v7):** Dado un período con turnos finalizados, cuando el administrador abre el panel, los indicadores de turnos coinciden con el listado de turnos del mismo período. Verificable comparando el panel con GET /admin/appointments (sin prueba automatizada).

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/history-activity-dashboard.test.ts` | RF-34: indicadores del panel del administrador (período "day") › calcula seña cobrada, atendidos, inasistencias, señas devueltas, saldo pendiente, ocupación y clientas nuevas | pasó |
| `tests/integration/admin.dashboard.test.ts` | dashboard del admin — KPIs (period=day) › cuenta turnos finalizados hoy como "atendidos" y con precio real | pasó |
| `tests/integration/admin.dashboard.test.ts` | dashboard del admin — KPIs (period=day) › cuenta los cancelled_no_show de hoy | pasó |
| `tests/integration/admin.dashboard.test.ts` | dashboard del admin — KPIs (period=day) › limita el ranking de servicios más rentables a 10, ordenado por turnos realizados | pasó |
| `tests/integration/admin.dashboard.test.ts` | dashboard del admin — KPIs (period=day) › una clienta no puede ver el dashboard del admin | pasó |
| `tests/integration/timezone-art.test.ts` | dashboards en hora de Argentina › el dashboard del admin cuenta como de "hoy" un turno de las 22:00 a las 22:30 | pasó |
| `tests/integration/timezone-art.test.ts` | dashboards en hora de Argentina › el dashboard de la profesional cuenta lo de "hoy" a las 22:30 | pasó |
| `tests/integration/timezone-art.test.ts` | dashboards en hora de Argentina › las estadísticas de la profesional incluyen el turno de "hoy" a las 22:30 | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | job de inasistencia automática (no_show_auto) › un no_show_auto cuenta como inasistencia en el panel del administrador | pasó |

**Cobertura: Parcial.** Los indicadores se comparan con los turnos que arma la prueba, no con `GET /admin/appointments` como dice el criterio. El panel de la profesional solo tiene las pruebas de hora de Argentina.

### RNF-01

**Enunciado (libro v7):** El flujo de reserva web (selección de servicio, horario y confirmación) responde en dispositivos móviles con conexión 4G en 5 segundos o menos entre la selección del horario y la confirmación de la reserva, sin esperar la respuesta manual del estudio.

**Criterio de aceptación (libro v7):** En una prueba de reserva de punta a punta desde un dispositivo móvil con conexión 4G, el tiempo entre la selección del horario y la confirmación de la reserva (previo a la redirección a la pasarela de pago) es menor o igual a 5 segundos, medido en tres repeticiones consecutivas.

**Pruebas:** ninguna.

**Cobertura: Sin prueba.** No hay prueba automatizada. Evidencia manual en `05-entregas/evidencia-RNF-01/` (28/10/2026): recorrido en la base de pruebas con 4G simulado, mediana 0,80 s; falta repetirlo contra producción desde un celular real.

### RNF-02

**Enunciado (libro v7):** El sistema debe operar íntegramente desde el navegador web, sin exigir a la clienta la descarga de una aplicación nativa para reservar un turno.

**Criterio de aceptación (libro v7):** Un usuario sin ninguna aplicación instalada además del navegador completa el flujo completo de reserva y pago de seña únicamente accediendo a la URL del sistema, verificable repitiendo la prueba en un dispositivo sin instalaciones adicionales.

**Pruebas:** ninguna.

**Cobertura: Sin prueba.** No hay prueba automatizada: es una condición de la arquitectura (aplicación web, sin app nativa).

### RNF-03

**Enunciado (libro v7):** El sistema muestra la alergia o sensibilidad de piel declarada en un turno solo a la profesional asignada a ese turno, a la propia clienta y a la propietaria; la alergia guardada en el perfil de la clienta la ven además las profesionales que ya la atendieron. Una profesional que nunca atendió a la clienta no ve ninguna. El dato se trata como advertencia operativa, no como historia clínica.

**Criterio de aceptación (libro v7):** Dada una clienta con una alergia registrada en un turno y en su perfil, cuando consulta el sistema la profesional asignada al turno, ve ambas; cuando consulta una profesional que atendió antes a la clienta pero no está asignada a ese turno, ve solo la del perfil y recibe error 404 al abrir el turno; cuando consulta una profesional que nunca la atendió, no ve ninguna. Verificable con las pruebas automatizadas de visibilidad y revisando las consultas de cada rol.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la profesional asignada ve la alergia del turno, y la del perfil solo si ya atendió a la clienta | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la respuesta al editar un turno propio tampoco trae la alergia del perfil si no la atendió | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › al finalizar el turno, la respuesta ya trae la alergia del perfil | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › una profesional que nunca atendió a la clienta no ve ni el turno ni ninguna de las dos alergias | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › el admin y la propia clienta ven las alergias | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › una profesional que atendió antes a la clienta ve la alergia del perfil, pero no la del turno ajeno | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › con un turno finalizado con la clienta, la profesional ve la alergia del perfil | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › con un turno cancelled no la ve | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › con un turno cancelled_no_show no la ve | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › con un turno no_show_auto no la ve | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › con un turno confirmado a futuro no la ve | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › con un turno pendiente tampoco la ve | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › un turno finalizado con OTRA profesional no alcanza | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › la alergia del perfil en la lista de clientas de la profesional › la profesional asignada a un turno propio ve la alergia de ese turno, aunque no vea la del perfil | pasó |
| `tests/integration/allergies.consent-visibility.test.ts` | visibilidad de las alergias (RNF-03) › otra profesional tampoco puede abrir el turno ajeno por su id | pasó |

**Cobertura: Completo.**

### RNF-04

**Enunciado (libro v7):** El sistema delega en una pasarela de pagos certificada toda captura de medios de pago y conserva únicamente el identificador de confirmación (token) que ella devuelve; no almacena datos de tarjetas ni de cuentas bancarias.

**Criterio de aceptación (libro v7):** Una revisión del esquema de la base de datos del sistema no encuentra ninguna columna que almacene número de tarjeta, código de seguridad o dato bancario de la clienta; el único dato de pago retenido es el identificador de confirmación (token) devuelto por la pasarela, verificable por inspección del esquema.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/schema.no-card-data.test.ts` | el esquema no guarda datos de tarjeta ni bancarios (RNF-04) › schema.prisma no tiene ningún campo de número de tarjeta, código de seguridad o dato bancario | pasó |
| `tests/integration/schema.no-card-data.test.ts` | el esquema no guarda datos de tarjeta ni bancarios (RNF-04) › la base migrada tampoco tiene columnas de ese tipo | pasó |
| `tests/integration/schema.no-card-data.test.ts` | el esquema no guarda datos de tarjeta ni bancarios (RNF-04) › el único dato de pago externo que se conserva es el identificador del pago de Mercado Pago | pasó |
| `tests/integration/schema.no-card-data.test.ts` | el esquema no guarda datos de tarjeta ni bancarios (RNF-04) › la revisión sí detecta columnas prohibidas (la prueba no es una tautología) | pasó |

**Cobertura: Completo.**

### RNF-05

**Enunciado (libro v7):** El sistema registra, con fecha y hora, los cambios de estado de un turno y toda anonimización de datos personales; no elimina datos físicamente.

**Criterio de aceptación (libro v7):** Dada la anonimización de los datos de una clienta ejecutada por la propietaria, cuando se consulta el registro de auditoría, aparece una entrada con fecha, hora, usuario que la ejecutó y clienta afectada, verificable en dicho registro.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/admin.clients.test.ts` | anonimización de datos de una clienta (RF-09) › deja constancia en el log de actividad, con fecha y sin filtrar los datos viejos | pasó |
| `tests/integration/admin.anonymize-personal-data.test.ts` | anonimización de una clienta: datos personales (Fase 5) › el registro de actividad enumera los campos tocados con cantidades y quién la ejecutó | pasó |
| `tests/integration/appointments.status-log.test.ts` | auditoría de cambios de estado de un turno › la profesional marca "no asistió" y queda registrado en el log de actividad | pasó |
| `tests/integration/appointments.status-log.test.ts` | auditoría de cambios de estado de un turno › el admin marca "finalizado" y queda registrado con su identidad | pasó |
| `tests/integration/appointments.status-log.test.ts` | auditoría de cambios de estado de un turno › no duplica el log si se guarda sin cambiar el estado | pasó |

**Cobertura: Completo.**

### RNF-06

**Enunciado (libro v7):** El sistema no envía datos personales, de contacto ni de salud al servicio de monitoreo de errores (Sentry): borra cookies, cuerpo, query string, cabeceras sensibles, correo e IP del usuario, los correos dentro de los mensajes, el texto de las consultas de Prisma, los breadcrumbs, los campos extra, los contextos ajenos al SDK y las variables locales de los stack frames. Quedan fuera del alcance las trazas de rendimiento y los console.error o throw propios con datos clínicos en texto libre.

**Criterio de aceptación (libro v7):** Dado un error de Prisma cuya consulta contiene allergies: «penicilina y látex», cuando Sentry lo recibe, el evento enviado no contiene ese texto ni ningún correo electrónico. Verificable con sentry.scrub.test.ts.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/sentry.scrub.test.ts` | limpieza de datos sensibles antes de enviar a Sentry › borra cookies y cuerpo del pedido | pasó |
| `tests/integration/sentry.scrub.test.ts` | limpieza de datos sensibles antes de enviar a Sentry › filtra las cabeceras sensibles y deja las demás | pasó |
| `tests/integration/sentry.scrub.test.ts` | limpieza de datos sensibles antes de enviar a Sentry › saca el query string de la URL y del evento | pasó |
| `tests/integration/sentry.scrub.test.ts` | limpieza de datos sensibles antes de enviar a Sentry › conserva solo el id del usuario | pasó |
| `tests/integration/sentry.scrub.test.ts` | limpieza de datos sensibles antes de enviar a Sentry › el mensaje de un error de Prisma no deja pasar los valores de la consulta (una alergia) | pasó |
| `tests/integration/sentry.scrub.test.ts` | limpieza de datos sensibles antes de enviar a Sentry › tapa los emails en el mensaje del evento y de la excepción, y deja el resto del texto | pasó |
| `tests/integration/sentry.scrub.test.ts` | limpieza de datos sensibles antes de enviar a Sentry › en los breadcrumbs tapa los emails y deja solo método, estado y URL sin query | pasó |
| `tests/integration/sentry.scrub.test.ts` | limpieza de datos sensibles antes de enviar a Sentry › borra los campos extra y los contextos que no son del SDK, y deja los del SDK | pasó |
| `tests/integration/sentry.scrub.test.ts` | limpieza de datos sensibles antes de enviar a Sentry › saca las variables locales de los frames del stack | pasó |
| `tests/integration/sentry.scrub.test.ts` | limpieza de datos sensibles antes de enviar a Sentry › no rompe con un evento sin request ni usuario | pasó |
| `tests/integration/sentry.init.test.ts` | Sentry no se inicia en los tests › con un DSN en el entorno, NODE_ENV=test no llama a Sentry.init | pasó |
| `tests/integration/sentry.init.test.ts` | Sentry no se inicia en los tests › en producción con DSN sí lo inicia | pasó |
| `tests/integration/mail.provider.test.ts` | mailProvider con Brevo (BREVO_API_KEY configurada) › no escribe el email del destinatario completo en los logs | pasó |
| `tests/integration/mask-email.test.ts` | maskEmail › deja la primera letra y el dominio | pasó |
| `tests/integration/mask-email.test.ts` | maskEmail › no rompe con valores que no son un email | pasó |
| `tests/integration/mask-email.test.ts` | maskEmail › no deja pasar la parte local completa | pasó |

**Cobertura: Completo.**

### RNF-07

**Enunciado (libro v7):** El sistema autentica con cookies httpOnly (el token no queda accesible a JavaScript), renueva las sesiones con rotación, admite hasta 10 sesiones por usuaria, limita los intentos de ingreso, rechaza pedidos de origen no confiable (CSRF) y cierra todas las sesiones de una usuaria al desactivarla o anonimizarla.

**Criterio de aceptación (libro v7):** Dado un navegador con sesión activa, cuando una página ejecuta JavaScript que lee las cookies, no encuentra el token de acceso; una usuaria desactivada no puede renovar ninguna sesión; una profesional que pide una ruta de administración es rechazada. Verificable con auth.security, auth.sessions, auth.test y hardening (ADR-003).

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/auth.security.test.ts` | CSRF: pedidos que cambian datos y vienen de otro sitio › un formulario de otro sitio no puede cambiar la contraseña de una clienta logueada | pasó |
| `tests/integration/auth.security.test.ts` | CSRF: pedidos que cambian datos y vienen de otro sitio › un formulario de otro sitio no puede invitar a un profesional en nombre de una admin | pasó |
| `tests/integration/auth.security.test.ts` | CSRF: pedidos que cambian datos y vienen de otro sitio › un origen "null" (página sandbox o redirección) también se rechaza | pasó |
| `tests/integration/auth.security.test.ts` | CSRF: pedidos que cambian datos y vienen de otro sitio › el frontend (su origen exacto) sigue pudiendo cambiar la contraseña | pasó |
| `tests/integration/auth.security.test.ts` | CSRF: pedidos que cambian datos y vienen de otro sitio › un pedido sin cabecera Origin (webhook, curl, servidor a servidor) no se bloquea | pasó |
| `tests/integration/auth.security.test.ts` | CSRF: pedidos que cambian datos y vienen de otro sitio › las lecturas (GET) no se bloquean: de eso se encarga CORS | pasó |
| `tests/integration/auth.security.test.ts` | CSRF: pedidos que cambian datos y vienen de otro sitio › la API ya no interpreta formularios (application/x-www-form-urlencoded) | pasó |
| `tests/integration/auth.security.test.ts` | cerrar sesión › cierra la sesión aunque el access token ya haya vencido | pasó |
| `tests/integration/auth.security.test.ts` | cerrar sesión › cerrar sesión sin ninguna cookie responde 200 y deja las cookies limpias | pasó |
| `tests/integration/auth.security.test.ts` | cerrar sesión › con el access token vigente también cierra la sesión | pasó |
| `tests/integration/auth.security.test.ts` | cerrar sesión › una cookie falsificada no cierra la sesión de nadie | pasó |
| `tests/integration/auth.security.test.ts` | refresh token › se guarda como hash (SHA-256) y no como el token que recibe el navegador | pasó |
| `tests/integration/auth.security.test.ts` | refresh token › renueva la sesión con la cookie y rota el token | pasó |
| `tests/integration/auth.security.test.ts` | refresh token › un refresh token ya usado deja de servir (pasado el margen de gracia de 30 segundos) | pasó |
| `tests/integration/auth.security.test.ts` | refresh token › un token sin sid (formato anterior a las sesiones por dispositivo) ya no se acepta | pasó |
| `tests/integration/auth.security.test.ts` | refresh token › un token distinto del guardado se rechaza | pasó |
| `tests/integration/auth.sessions.test.ts` | varios dispositivos a la vez › iniciar sesión en un segundo dispositivo no cierra la renovación del primero | pasó |
| `tests/integration/auth.sessions.test.ts` | varios dispositivos a la vez › renovar en un dispositivo no afecta al otro, y cada uno puede seguir renovando | pasó |
| `tests/integration/auth.sessions.test.ts` | varios dispositivos a la vez › cerrar sesión en un dispositivo no cierra el otro | pasó |
| `tests/integration/auth.sessions.test.ts` | varios dispositivos a la vez › cerrar sesión con el access token vencido cierra solo ese dispositivo | pasó |
| `tests/integration/auth.sessions.test.ts` | varios dispositivos a la vez › cambiar la contraseña cierra la sesión de todos los dispositivos | pasó |
| `tests/integration/auth.sessions.test.ts` | varios dispositivos a la vez › recuperar la contraseña con el código cierra la sesión de todos los dispositivos | pasó |
| `tests/integration/auth.sessions.test.ts` | varios dispositivos a la vez › una usuaria desactivada no puede renovar ninguna sesión | pasó |
| `tests/integration/auth.sessions.test.ts` | varios dispositivos a la vez › hasta 10 dispositivos: al abrir el undécimo se cierra el más antiguo | pasó |
| `tests/integration/auth.sessions.test.ts` | cómo se guarda y se renueva cada sesión › se guarda el hash (SHA-256) del refresh token, nunca el token | pasó |
| `tests/integration/auth.sessions.test.ts` | cómo se guarda y se renueva cada sesión › el refresh token viejo deja de servir pasado el margen, y eso no cierra la sesión actual | pasó |
| `tests/integration/auth.sessions.test.ts` | cómo se guarda y se renueva cada sesión › dos pestañas que renuevan a la vez con la misma cookie no se desloguean entre sí | pasó |
| `tests/integration/auth.sessions.test.ts` | cómo se guarda y se renueva cada sesión › una sesión vencida en la base se rechaza | pasó |
| `tests/integration/auth.sessions.test.ts` | cómo se guarda y se renueva cada sesión › un token con una sesión que no existe se rechaza | pasó |
| `tests/integration/auth.sessions.test.ts` | token del formato anterior (sin sid) › ya no se acepta y no crea ninguna sesión | pasó |
| `tests/integration/auth.test.ts` | auth › /me devuelve 401 sin cookie | pasó |
| `tests/integration/auth.test.ts` | auth › /me devuelve el usuario autenticado con una cookie válida | pasó |
| `tests/integration/auth.test.ts` | auth › /me devuelve 401 con un token inválido | pasó |
| `tests/integration/auth.test.ts` | auth › una clienta no puede entrar a rutas de admin | pasó |
| `tests/integration/auth.test.ts` | auth › una profesional no puede entrar a rutas de admin | pasó |
| `tests/integration/auth.test.ts` | auth › un usuario inactivo no puede loguearse | pasó |
| `tests/integration/hardening.test.ts` | límite de intentos fallidos de login por cuenta › bloquea con 429 después de 10 contraseñas incorrectas, aunque la correcta ya no entre | pasó |
| `tests/integration/hardening.test.ts` | límite de intentos fallidos de login por cuenta › no afecta a otra cuenta | pasó |
| `tests/integration/hardening.test.ts` | límite de intentos fallidos de login por cuenta › los logins exitosos no cuentan | pasó |
| `tests/integration/auth.minor-fixes.test.ts` | POST /api/invitations/register › un registro exitoso devuelve el usuario, no el accessToken en el cuerpo, y setea las dos cookies | pasó |
| `tests/integration/google-remnants.test.ts` | RNF-07: no quedan restos del ingreso con Google › los archivos del proveedor social ya no existen | pasó |
| `tests/integration/google-remnants.test.ts` | RNF-07: no quedan restos del ingreso con Google › el entorno ya no define GOOGLE_CLIENT_ID | pasó |

**Cobertura: Parcial.** Que el token no lo pueda leer JavaScript se apoya en la marca `HttpOnly`, y la única prueba que la mira es la de la cookie `refresh_token` en el alta por invitación; ninguna mira la cookie `access_token`. La usuaria desactivada y la profesional en una ruta de administración sí están.

### RNF-08

**Enunciado (libro v7):** Toda decisión que depende de la hora (tolerancia de 20 minutos, corte de 12 horas, jobs diarios, vigencia de eventos y promociones, «hoy») se calcula en la hora de Argentina (America/Argentina/Buenos_Aires) y no en la del servidor.

**Criterio de aceptación (libro v7):** Dado un turno a las 18:00, cuando faltan 12 horas y media reales, la cancelación devuelve la seña; con menos de 12 horas reales no la devuelve; un evento especial de hoy sigue publicado a las 22:30. Verificable con timezone-art.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/timezone-art.test.ts` | no-show automático en hora de Argentina › no marca ausente a una clienta antes de que pasen 20 minutos de la hora del turno | pasó |
| `tests/integration/timezone-art.test.ts` | no-show automático en hora de Argentina › no marca ausente un turno que todavía no empezó | pasó |
| `tests/integration/timezone-art.test.ts` | no-show automático en hora de Argentina › marca ausente pasados los 30 minutos de la hora del turno, no antes | pasó |
| `tests/integration/timezone-art.test.ts` | no-show automático en hora de Argentina › un turno nocturno se evalúa con la fecha de Argentina (22:30 ART ya es el día siguiente en UTC) | pasó |
| `tests/integration/timezone-art.test.ts` | cancelación y reembolso en hora de Argentina (corte de 12 horas) › reembolsa si faltan 12 horas y media reales para el turno | pasó |
| `tests/integration/timezone-art.test.ts` | cancelación y reembolso en hora de Argentina (corte de 12 horas) › no reembolsa si faltan menos de 12 horas reales | pasó |
| `tests/integration/timezone-art.test.ts` | "hoy" en hora de Argentina › la clienta puede registrar su llegada a un turno de las 22:00 a las 22:30 (ya es el día siguiente en UTC) | pasó |
| `tests/integration/timezone-art.test.ts` | "hoy" en hora de Argentina › un evento especial de hoy sigue publicado a las 22:30 | pasó |
| `tests/integration/timezone-art.test.ts` | cron en hora de Argentina › todos los jobs programados usan la zona America/Argentina/Buenos_Aires | pasó |
| `tests/integration/timezone-art.test.ts` | dashboards en hora de Argentina › el dashboard del admin cuenta como de "hoy" un turno de las 22:00 a las 22:30 | pasó |
| `tests/integration/timezone-art.test.ts` | dashboards en hora de Argentina › el dashboard de la profesional cuenta lo de "hoy" a las 22:30 | pasó |
| `tests/integration/timezone-art.test.ts` | dashboards en hora de Argentina › las estadísticas de la profesional incluyen el turno de "hoy" a las 22:30 | pasó |
| `tests/integration/appointments.arrival-noshow.test.ts` | registro de llegada › anda también a las 23:57 de Argentina, cuando el servidor (UTC) ya está en el día siguiente | pasó |
| `tests/integration/appointments.reminder.test.ts` | recordatorio de turno por mail: cuándo se manda › manda un turno de madrugada cuando la ventana de 5 horas cruza la medianoche de Argentina | pasó |

**Cobertura: Completo.** El enunciado todavía nombra «tolerancia de 20 minutos»; la regla vigente es más de 30 (ver RF-05).

### RNF-09

**Enunciado (libro v7):** El sistema acepta los avisos de Mercado Pago solo con firma válida (HMAC-SHA256), los procesa una sola vez aunque lleguen repetidos y solo registra el pago si el monto y la moneda son los esperados; un pago con monto menor o en otra moneda no se registra y deja un aviso de error.

**Criterio de aceptación (libro v7):** Dado un pago aprobado por un monto menor al de la seña, cuando llega el aviso, el turno sigue sin seña pagada y aparece un aviso de nivel error en la actividad; dos avisos simultáneos del mismo pago generan una sola notificación. Verificable con payments.webhook-amount y payments.webhook-idempotency; la verificación de la firma no tiene prueba.

| Archivo | Prueba | Resultado |
|---|---|---|
| `tests/integration/payments.webhook-signature.test.ts` | RNF-09: firma del webhook de Mercado Pago › con la firma válida procesa el aviso (consulta el pago a Mercado Pago) y responde 200 | pasó |
| `tests/integration/payments.webhook-signature.test.ts` | RNF-09: firma del webhook de Mercado Pago › con una firma inválida responde 401 y no procesa nada | pasó |
| `tests/integration/payments.webhook-signature.test.ts` | RNF-09: firma del webhook de Mercado Pago › sin la cabecera x-signature (o sin x-request-id) responde 401 y no procesa nada | pasó |
| `tests/integration/payments.webhook-signature.test.ts` | RNF-09: firma del webhook de Mercado Pago › si falta la clave secreta en el servidor responde 500 y no procesa nada | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | turno: se valida el monto y la moneda antes de marcar la seña como paga › con el monto exacto en pesos registra la seña | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | turno: se valida el monto y la moneda antes de marcar la seña como paga › con un monto menor NO registra la seña y deja un aviso para revisar | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | turno: se valida el monto y la moneda antes de marcar la seña como paga › con otra moneda NO registra la seña | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | turno: se valida el monto y la moneda antes de marcar la seña como paga › si Mercado Pago no informa el monto, no se puede verificar y NO registra la seña | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | turno: se valida el monto y la moneda antes de marcar la seña como paga › con un monto mayor lo acepta | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | turno: se valida el monto y la moneda antes de marcar la seña como paga › sin datos de pago (seña confirmada a mano por WhatsApp) sigue funcionando | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | turno: se valida el monto y la moneda antes de marcar la seña como paga › un rechazo se registra aunque el monto no coincida (solo se valida lo aprobado) | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | combo: la seña es la suma de las patas › pagando solo una pata (3000 de 6000) NO registra la seña | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | combo: la seña es la suma de las patas › pagando el total (6000) registra la seña de todas las patas | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | pedido: se valida el total antes de marcarlo pago y descontar stock › con un monto menor NO lo marca pago ni descuenta stock | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | pedido: se valida el total antes de marcarlo pago y descontar stock › con el total exacto lo marca pago y descuenta el stock | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | verificación a demanda (polling): usa el monto que informa Mercado Pago › un pago aprobado por menos de la seña no la registra | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | verificación a demanda (polling): usa el monto que informa Mercado Pago › un pago aprobado por la seña completa la registra | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | webhook de Mercado Pago: respuesta según el resultado › registra la seña con el monto informado por Mercado Pago y responde 200 | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | webhook de Mercado Pago: respuesta según el resultado › con un monto menor responde 200 (reintentar no cambiaría nada) pero no registra la seña | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | webhook de Mercado Pago: respuesta según el resultado › si Mercado Pago no responde responde 500 para que reintente | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | webhook de Mercado Pago: respuesta según el resultado › si falla la base de datos al aplicar el pago responde 500 para que reintente | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | webhook de Mercado Pago: respuesta según el resultado › no vuelca el objeto de error completo en los logs | pasó |
| `tests/integration/payments.webhook-amount.test.ts` | webhook de Mercado Pago: respuesta según el resultado › un aviso de otro tipo, o sin id, o con una referencia desconocida responde 200 sin hacer nada | pasó |
| `tests/integration/payments.webhook-idempotency.test.ts` | idempotencia al aplicar el resultado de un pago › turno: avisos simultáneos del mismo pago notifican y registran una sola vez | pasó |
| `tests/integration/payments.webhook-idempotency.test.ts` | idempotencia al aplicar el resultado de un pago › turno: aplicar el mismo aviso uno detrás de otro tampoco duplica nada | pasó |
| `tests/integration/payments.webhook-idempotency.test.ts` | idempotencia al aplicar el resultado de un pago › turno: un aviso tardío de rechazo no pisa una seña ya paga | pasó |
| `tests/integration/payments.webhook-idempotency.test.ts` | idempotencia al aplicar el resultado de un pago › combo: avisos simultáneos avisan una sola vez al grupo | pasó |
| `tests/integration/payments.webhook-idempotency.test.ts` | idempotencia al aplicar el resultado de un pago › pedido: avisos simultáneos descuentan el stock una sola vez | pasó |
| `tests/integration/payments.webhook-idempotency.test.ts` | idempotencia al aplicar el resultado de un pago › pedido: repetir el aviso uno detrás de otro no vuelve a descontar stock | pasó |
| `tests/integration/payments.webhook-idempotency.test.ts` | idempotencia al aplicar el resultado de un pago › pedido: un aviso tardío de rechazo no pisa un pedido ya pago | pasó |

**Cobertura: Completo.** El libro v7 dice que la firma no tiene prueba: desde la fase 7 la tiene.

### RNF-10

**Enunciado (libro v7):** El código se verifica con pruebas automatizadas y chequeo de tipos que corren en cada propuesta de cambio mediante el canal de integración continua.

**Criterio de aceptación (libro v7):** Dado el repositorio al 30/10/2026, cuando se ejecuta npm test en el backend, pasan 32 archivos y 310 tests y en el frontend 80 tests; el canal de GitHub Actions corre en cada cambio. Verificable en la última corrida del canal.

**Pruebas:** toda la suite del backend: 57 archivos y 638 pruebas, 638 pasaron y 0 fallaron. El canal de GitHub Actions (`.github/workflows/ci.yml`) corre `typecheck:all` y `npm test` en cada cambio. El frontend no se corrió en esta fase.

**Cobertura: Completo.** Las cifras del criterio (32 archivos y 310 pruebas en el backend, 80 en el frontend) son las del 30/10/2026 y hay que actualizarlas en el libro.
