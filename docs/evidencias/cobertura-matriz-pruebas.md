# Cobertura de la matriz de pruebas (M-01 a M-58)

Fuente de los casos: planilla `matriz_pruebas_nexa` (Drive), hoja «Matriz». Fecha de este cruce: 15/11/2026, rama `test/cierre-pruebas-ae4`. El cruce se hizo leyendo los títulos y el contenido de las pruebas; «Sí» quiere decir que hay una prueba automatizada que ejercita el caso, no que su título lleve el código M-xx (solo lo llevan las escritas en esta rama: M-04, M-10 y M-37).

Resultado: **Sí** 50 · **Parcial** 6 (M-08, M-09, M-13, M-14, M-15, M-42) · **No** 1 (M-05, brecha aceptada) · **Manual** 1 (M-57). Total 58.

| M | Prueba automatizada (archivo › nombre) | Cobertura |
|---|---|---|
| M-01 | `appointments.booking` › crea un turno confirmado con el precio de catálogo del servicio | Sí |
| M-02 | `appointments.booking` › rechaza reservar el mismo horario dos veces con la misma profesional (slot conflict) | Sí |
| M-03 | `appointments.concurrency-http` › R-01 dos clientas reservan a la vez la misma profesional, fecha y hora: 20 rondas… (nueva; PostgreSQL 16, ver `ensayo-concurrencia-http.md`) | Sí |
| M-04 | `appointments.limits-m04-m10` › M-04 martes 08:00, 10:00 y 12:00 con servicios de 120 minutos: se aceptan los tres (nueva) | Sí |
| M-05 | Ninguna: es una brecha aceptada y declarada; ninguna prueba fija que el inicio intermedio se acepte | No |
| M-06 | `appointments.reopened-slots` › una cancelación de la clienta con el turno ya empezado bloquea el original; antes de empezar lo libera | Sí |
| M-07 | `appointments.reopened-slots` › después de la marca, la clienta no puede reservar el horario original…; lo garantiza el índice de la base | Sí |
| M-08 | `appointments.cancel-reschedule` › rechaza reprogramar a un horario ocupado de la misma profesional (verifica el 409; no el código ni que el turno conserve fecha y hora) | Parcial |
| M-09 | `appointments.cancel-reschedule` › reprograma un turno confirmado a otra fecha/hora. **Discrepancia:** la matriz espera `previousDate`/`previousTime` guardados, pero `rescheduleForClient` los deja en `null` (solo los guarda la reprogramación del personal) | Parcial |
| M-10 | `appointments.limits-m04-m10` › M-10 reprogramar el mismo turno 3 veces seguidas: las 3 se aceptan (nueva) | Sí |
| M-11 | `appointments.cancel-reschedule` › la clienta no puede cambiar de profesional al reprogramar: 400 y el turno queda igual | Sí |
| M-12 | `appointments.cancel-reschedule` › rechaza reprogramar una pata de un combo (la matriz decía «probado a mano»: ya hay automatizada) | Sí |
| M-13 | `appointments.out-of-hours` › rechaza reservar a las 23:00 con disponibilidad de 09:00 a 18:00 (no prueba el borde 08:00 contra una franja de 09:00) | Parcial |
| M-14 | Ninguna para la reserva de la clienta (bloque que termina después de la franja); `appointments.reopened-slots` › el servicio tiene que terminar dentro de la franja cubre solo los horarios reabiertos | Parcial |
| M-15 | `appointments.out-of-hours` › rechaza un día sin franja cargada (un día sin franja, no el domingo en concreto) | Parcial |
| M-16 | `ajustes-13-11` › reservar en vacaciones dice que está de vacaciones (y no «fuera de la disponibilidad») | Sí |
| M-17 | `appointments.cancellation-refund` › con 13 horas de anticipación y la seña paga: la seña se marca como devuelta | Sí |
| M-18 | `appointments.cancellation-refund` › con 12 horas exactas todavía se devuelve (12 o más) | Sí |
| M-19 | `settings.deposit-and-refund` › límite exacto: con 12 horas justas se devuelve; con 11:59 queda retenida | Sí |
| M-20 | `appointments.cancellation-refund` › con el turno ya empezado: sin devolución, el original queda bloqueado y se abre el horario reabierto | Sí |
| M-21 | `appointments.cancellation-refund` › cancelación del estudio con solo 2 horas de anticipación: la seña paga se marca devuelta | Sí |
| M-22 | `appointments.cancellation-refund` › con la seña impaga no se marca nada, aunque falten muchas horas | Sí |
| M-23 | `appointments.cancellation-refund` › la clienta cancela una pata: no se evalúa nada; cancela la última con 13 horas…; `appointments.combo` › cancelar una sola pata deja las demás en pie | Sí |
| M-24 | `appointments.combo` › el admin cancelando UNA pata desde su panel cancela el grupo entero | Sí |
| M-25 | `appointments.arrival-noshow` › a los 30 minutos exactos todavía no marca (tiene que pasar MÁS de 30) | Sí |
| M-26 | `appointments.arrival-noshow` › a los 31 minutos pasa a no_show_auto y la seña no cambia; no_show_auto ocupa el horario… | Sí |
| M-27 | `appointments.reopened-slots` › a los 32 minutos: se marca, la seña queda retenida y se reabre el horario… | Sí |
| M-28 | `appointments.reopened-slots` › el servidor ofrece inicios cada 5 minutos desde el 16:35 hasta las 17:00; a los 40 minutos exactos genera el horario reabierto | Sí |
| M-29 | `jobs.release-unpaid` › cancela un turno con seña impaga hace más de 20 minutos (`unpaid_expired`) | Sí |
| M-30 | `whatsapp-payment` › el cliente reserva y el turno queda guardado con depositMethod whatsapp…; `jobs.release-unpaid` › NO toca una seña coordinada por WhatsApp | Sí |
| M-31 | `whatsapp-payment` › el admin marca la seña como paga y el turno pasa a partial (y notifica a la profesional); en un combo, marcar UNA pata confirma TODAS | Sí |
| M-32 | `whatsapp-payment` › rechaza marcar como paga una seña que en realidad es de Mercado Pago (`NOT_WHATSAPP_DEPOSIT`) | Sí |
| M-33 | `settings.deposit-and-refund` › computeDeposit…; `appointments.combo-deposit` › crea dos turnos vinculados… con la seña registrada una sola vez | Sí |
| M-34 | `payments.webhook-amount` › con un monto menor NO registra la seña y deja un aviso para revisar; con otra moneda NO registra la seña | Sí |
| M-35 | `payments.webhook-idempotency` › turno: avisos simultáneos del mismo pago notifican y registran una sola vez | Sí |
| M-36 | `appointments.combo` › crea una pata por componente, todas con el mismo comboGroupId, fecha y hora; `appointments.combo-deposit` | Sí |
| M-37 | `appointments.combo-all-or-nothing` › M-37 combo con profesional ocupada no crea ningún turno (nueva; 3 pruebas) | Sí |
| M-38 | `appointments.combo` › rechaza dos servicios simultáneos con la misma profesional (`SAME_PROFESSIONAL_SIMULTANEOUS`). La matriz decía «a escribir», pero ya existía | Sí |
| M-39 | `appointments.booking` › elige a la de menor carga de esa semana | Sí |
| M-40 | `appointments.booking` › a igual carga desempata por antigüedad; `professional.joined-at` › a igual carga semanal gana la más antigua según la fecha de ingreso | Sí |
| M-41 | `appointments.booking` › si ninguna está libre a esa hora responde 409 con un error claro | Sí |
| M-42 | `appointments.cancel-reschedule` › rechaza cancelar el turno de otra clienta. «Ver» el turno de otra: la clienta solo tiene listado propio, sin prueba que lo fije | Parcial |
| M-43 | `auth` › una profesional no puede entrar a rutas de admin | Sí |
| M-44 | `allergies.consent-visibility` › sin marcar el consentimiento no guarda la alergia ni registra consentimiento | Sí |
| M-45 | `allergies.consent-visibility` › con el consentimiento guarda la alergia junto con la fecha y hora del consentimiento | Sí |
| M-46 | `allergies.consent-visibility` › ni el admin ni la profesional cambian la alergia de un turno desde sus rutas de turnos | Sí |
| M-47 | `allergies.consent-visibility` › una profesional que nunca atendió a la clienta no ve ni el turno ni ninguna de las dos alergias | Sí |
| M-48 | `terms-version` › el registro graba fecha y versión de la política; si no acepta la política no se graba nada | Sí |
| M-49 | `admin.anonymize-personal-data` › conserva turnos, alergias, preferencias, observaciones y notas; el registro de actividad enumera los campos tocados | Sí |
| M-50 | `appointments.companion` › guarda hasCompanion y el vínculo de la lista | Sí |
| M-51 | `phone.validation` › el registro rechaza un teléfono que no es un celular argentino (usa `123456`, no `12345`); `auth` › rechaza el registro sin apellido | Sí |
| M-52 | `store.blocking-and-movements` › una clienta bloqueada no puede comprar ni reservar y el error no delata el bloqueo | Sí |
| M-53 | `appointments.reminder` › manda a las 5 horas exactas, marca reminder_sent_at y deja una entrada de actividad con el turno | Sí |
| M-54 | `appointments.reminder` › manda a las 5 horas exactas; 1 hora antes todavía manda; con menos de 1 hora ya no | Sí |
| M-55 | `appointments.reminder` › no manda si la reserva se creó con menos de 5 horas…; si la clienta está bloqueada; si la cuenta está desactivada; pendiente de seña | Sí |
| M-56 | `notifications.inbox-and-client-mail` › cuando el personal cancela, la clienta recibe el mail; cuando el personal reprograma…; reservar… ningún mail a la clienta; `ajustes-13-11` › al agendar avisa a la profesional | Sí |
| M-57 | No se automatiza: es una medición manual con 4G. Evidencia parcial en `05-entregas/evidencia-RNF-01` | Manual |
| M-58 | `schema.no-card-data` › schema.prisma no tiene ningún campo de número de tarjeta, código de seguridad o dato bancario | Sí |
