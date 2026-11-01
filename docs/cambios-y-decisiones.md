# Cambios y decisiones de la AE4

Registro corto de lo que se decidió durante la AE4 y de lo que se verificó en producción. El detalle de cada cambio, con sus alternativas y su evidencia, está en la bitácora (`00-gestion/20261028_BitacoraIndividual_KohlerAE3_v1.md`).

## Consultas previas en producción (31/10/2026)

Se corrieron las consultas de solo lectura de `docs/consultas-previas-produccion.sql` en la base de producción (Supabase) antes de aplicar las migraciones de la AE4. Resultado informado por Emily:

| Consulta | Resultado |
|---|---|
| 4a. Clientas con fecha de nacimiento (`clients.birth_date`) | 0 |
| 4b. Clientas con puntos de fidelización (`clients.loyalty_points`) | 0 |
| 4c. Clientas con la marca del recordatorio de inactividad (`clients.last_inactivity_reminder_at`) | 0 |
| 4d. Campañas automáticas (`auto_promotions`) y envíos registrados | 0 |
| Turnos en la base (`appointments`) | 0 |

Consecuencia: las eliminaciones de la fase 1 y las migraciones de las fases 2, 3 y 3b no tocan datos reales de ninguna clienta, porque todavía no hay turnos ni clientas con esos datos. Sigue valiendo hacer el respaldo antes de migrar.

## Decisiones de la autora

- **Fase 3b, recordatorio de turno por mail (31/10/2026).** La propietaria confirmó la regla pero **no va a firmar una constancia escrita nueva**. Las decisiones las toma Emily como autora del sistema, así que el recordatorio se implementa y entra en la entrega sin la condición «no se despliega sin constancia». Los detalles de la regla están en `CLAUDE.md` («Recordatorio de turno por mail»).

## Límites conocidos de la fase 3b

- **Reprogramación después del envío (decidido por Emily el 31/10/2026).** Reprogramar un turno (la clienta o el personal, cambiando fecha u hora) limpia `reminder_sent_at`, así el nuevo horario recibe su recordatorio si cumple las reglas. Como `createdAt` no cambia, la regla de las 5 horas de anticipación se mide desde la reserva original hasta el nuevo inicio: un turno reservado hace días y movido para dentro de pocas horas recibe el recordatorio en la corrida siguiente.
- **Política de privacidad (decidido por Emily el 31/10/2026).** Se agrega la línea «Te enviamos por correo un recordatorio de tus turnos» y `PRIVACY_POLICY_VERSION` pasa de `2026-09` a `2026-11`. Hay 0 clientas en producción. El sistema no exige volver a aceptar: la versión solo se graba en `users.terms_version` al registrarse y al confirmar una reserva. El texto de la política está en el frontend, que tiene que cambiar su propia constante y la página (ver la entrada 77 de la bitácora).
- **Reprogramación a un horario cercano.** El criterio «reserva hecha con menos de 5 horas de anticipación» mira la fecha de creación del turno, no la de la última reprogramación.
- **Caída del proceso entre la marca y el envío.** Ese recordatorio se pierde (no se reenvía). Se prefirió eso a mandar dos mails.
- **Primer intento tardío.** El tope de 1 hora antes del turno vale también para el primer intento: si el servidor estuvo caído hasta menos de 1 hora antes, no se manda.
- **Combo.** El enlace del mail lleva el id de la primera pata del grupo.
- **Política de privacidad.** Todavía no menciona este mail (pendiente de decisión de Emily).

## Fase 4, tienda (31/10/2026)

- La lista pública de la tienda (`GET /api/store/products`) ya no devuelve productos inactivos, sin stock ni los datos internos `stock`, `minStock` y `status`: devuelve `available: true`. El frontend solo usaba `stock` para esconder productos agotados, no para limitar el carrito (el pedido valida el stock real), así que no hace falta exponer la cantidad.
- La lista completa para el administrador pasó a `GET /api/admin/store/products`.
- Cada pago aprobado de un pedido deja una salida en el libro de inventario, en la misma transacción que descuenta el stock.
- **Límite conocido:** el stock se valida al crear el pedido pero se descuenta recién al pagar, así que entre una cosa y otra otra clienta puede comprar lo mismo; si el pago deja el stock en negativo se registra un aviso de error en la actividad (ya existía). No se reserva stock al crear el pedido para que un checkout abandonado no deje productos bloqueados.
- **Límite conocido:** el movimiento de la venta no está ligado al pedido por una columna (sería una migración nueva); la relación es la nota `Venta — pedido <id>`.
- **Despliegue:** sin migración. Backend y frontend tienen que salir juntos (lista de archivos del frontend en la bitácora, entrada 78).

## Fase 5, datos personales y alergias (01/11/2026)

- **Anonimizar a una clienta** (`POST /api/admin/clients/:id/anonymize`) ahora también borra las fotos de su galería (filas y archivos del almacenamiento), vacía teléfono, dirección y notas de sus pedidos y el texto de sus reseñas (el puntaje queda). Se conservan turnos, pagos, montos de pedidos, alergias, preferencias, observaciones y notas. La ruta y la forma de la respuesta no cambian.
- **Orden de las operaciones:** primero la base en una sola transacción, después los archivos. Si un archivo no se puede borrar, la anonimización sigue y queda una entrada de actividad de nivel `error` con la lista de archivos para quitarlos a mano (las filas ya no existen, así que esa lista es el único rastro).
- **Política del bucket:** el backend usa la clave anónima de Supabase. Si el bucket `images` no permite borrar a esa clave, Supabase no da error: simplemente no borra. El código lo detecta (cuenta como fallido lo que Supabase no confirma) y lo deja en el aviso de error. **Antes de desplegar conviene confirmar en Supabase que el bucket permite borrar con esa clave**, o las fotos se van a quedar en el almacenamiento y siempre van a figurar en ese aviso.
- **RNF-03:** la alergia del perfil en la lista de clientas de la profesional (`GET /api/professional/clients`) se devuelve solo si la profesional tiene al menos un turno `finished` con esa clienta; si no, el campo `allergies` viene vacío (`''`). La alergia de un turno la sigue viendo la profesional asignada a ese turno.
- **Agenda y respuestas de los turnos de la profesional** (`toProfessionalView`: `GET /api/professional/appointments` y las respuestas de crear, editar y registrar llegada): `client.allergies` sigue la misma regla, viene vacío salvo que la profesional tenga un turno `finished` con esa clienta (al finalizar el turno, la respuesta ya la trae). `details.allergies` (la del turno) se muestra siempre a la profesional asignada.
- **Dato:** ningún endpoint escribe `Client.allergies`; solo existe `Appointment.allergies` (la carga la clienta con consentimiento). Con la base actual el campo del perfil solo puede tener un valor cargado a mano en la base.
- **Despliegue:** sin migración. Frontend: la alergia del perfil (`allergies` de la lista de clientas y `client.allergies` de los turnos de la profesional) puede llegar vacía; la del turno (`details.allergies`) no cambia.

## Fase 6, brechas de requisitos (01/11/2026)

- **RF-02, teléfono.** Un solo validador (`src/app/validators/phone.ts`): celular argentino con o sin `+54`, con o sin el 9, el 0 del código de área y el 15, y con espacios, guiones o paréntesis; sin esos prefijos tiene que quedar código de área + número = 10 dígitos. Expresión validada con Emily: `/^(?:\+?54)?9?0?[1-3]\d{1,3}(?:15)?\d{6,8}$/` sobre el valor sin separadores. Se aplica al registro, al perfil de la clienta, a la invitación de profesional, a las ediciones del administrador (clientas y profesionales), al perfil y al onboarding de la profesional y a los turnos manuales. Se guarda tal cual lo escribió la persona (solo `trim`) y no se migran datos viejos: un teléfono anterior con otro formato queda guardado, pero se rechaza si se vuelve a enviar. En el perfil de la clienta y en las ediciones del personal el vacío se acepta; en el registro es obligatorio. De paso arregla un `500` real: `PATCH /api/client/profile` con `phone` como objeto o arreglo llegaba a Prisma (error del 24/10/2026 en Sentry).
- **RF-03 y RF-17, servicio especial.** `createSpecialForClient` creaba el turno con `paymentStatus = 'partial'` sin cobrar nada (el frontend mostraba «Pagar seña» pero solo reservaba). Ahora nace `pending`, como cualquier turno, y el frontend abre el checkout de Mercado Pago y espera la confirmación. Como pasa a depender del job de liberación, **toda cancelación de un turno de servicio especial devuelve su horario** (`appointmentId` y `clientName` del slot vuelven a `null`) en la misma transacción: la liberación por falta de pago (job), la cancelación de la clienta y la del personal. Antes ninguna lo hacía.
- **RF-06, antigüedad.** `professionals.joined_at` (fecha, nullable): la carga el administrador (`PATCH /api/professionals/:id` con `joinedAt`, `null` la borra; no puede ser futura). Sin valor se usa `createdAt`. `resolveProfessionalId` desempata por esa fecha cuando la carga semanal es igual. La respuesta del administrador trae `joinedAt` (siempre una fecha) y `joinedAtIsDefault`.
- **RF-11, categorías.** Un servicio común solo acepta `unas`, `cabello`, `cuerpo` o `rostro`; un servicio simultáneo (`isCombo`) acepta además `combo`. Se revisa al crear y al editar solo si el pedido trae `categoryId` o `isCombo`, para no trabar un servicio viejo con otra categoría. No se tocan filas existentes (consulta 6 de `docs/consultas-previas-produccion.sql`).
- **RF-14 y RNF-05, liberación por seña impaga.** El job deja una entrada de actividad por turno liberado (`Turno liberado por falta de pago`, módulo `appointments`, nivel `warning`, con `appointment_id`). Reemplaza la entrada única con el total.
- **RF-24, avisos.** Se quitaron los tipos que nadie emitía: `new_message`, `payment_confirmed`, `reminder`, `admin_change` y `system` (profesional) y `appointment_reminder` y `system` (clienta). Nada los usaba. El frontend muestra un ícono genérico si una fila vieja trae otro tipo (consulta 5 para ver si hay).
- **RNF-07, Google.** Borrados `social.provider.ts`, `socialLogin.dto.ts`, el mock de `tests/setup.ts`, `GOOGLE_CLIENT_ID` del esquema de entorno y de `.env.test.example`, y el script de Google (`gsi/client`) y el `fb-root` de `index.html` del frontend. **Pendiente de Emily:** quitar `GOOGLE_CLIENT_ID` (y `VITE_GOOGLE_CLIENT_ID`, si existe) del panel de Render y Vercel, y las dos líneas de Google y Facebook de su `.env.test` local. Si quedan, no rompen nada.
- **Sentry y los tests.** Los avisos por mail de Sentry del 1/11/2026 eran de las corridas de `npm test` en la máquina de Emily (`environment: test`, `server_name: EmilyPC`): el DSN del `.env` llegaba a los tests y cada falla provocada a propósito (por ejemplo, borrar filas con `TRUNCATE` entre casos) se mandaba como error real. `initSentry` ya no inicia con `NODE_ENV=test`. En producción, ningún error fue real. **Pendiente de Emily:** en Sentry, filtrar la regla de alerta por `environment:production`.
- **Caída 503 del 31/10/2026 19:59 UTC (UptimeRobot).** Causa no determinada: el código de `/api/health` solo responde 503 si la base no contesta, pero un redespliegue o el arranque en frío del plan gratis de Render también devuelve 503 desde el proxy. Para saberlo hay que mirar los eventos y el log de Render de esa hora.
- **Despliegue:** migración nueva `20261101120000_fecha_ingreso_profesional` (agrega una columna nullable), a aplicar en Supabase ANTES del push. Backend y frontend tienen que salir juntos (el frontend cobra la seña del servicio especial y muestra la fecha de ingreso).

## Fase 7, pruebas faltantes (01/11/2026)

Rama `test/cobertura-completa`. Solo pruebas y documentación: no se tocó `src/`. Decisiones de Emily del 01/11/2026: entra RNF-09 (firma del webhook con una clave de prueba puesta en el test, sin llamar a Mercado Pago) y también la reserva tardía en combos y servicios especiales; RF-24 se prueba con excepciones explícitas; RF-33 se prueba tal como funciona hoy y se reporta.

### RF-24, mails a la clienta

Por un turno, el sistema le escribe a la clienta solo cuando el **personal** lo cancela (`Tu turno fue cancelado`) o lo reprograma (`Tu turno fue reprogramado`). No le escribe al reservar, al pagar la seña ni cuando ella cancela o reprograma. Excepciones explícitas, fuera de esa regla: el **recordatorio del turno** (decisión del 31/10/2026) y los mails de cuenta que pide la propia clienta (**verificación del correo** y **código para recuperar la contraseña**). La prueba `notifications.inbox-and-client-mail.test.ts` revisa además el código: la lista de llamadas a `mailProvider.send` tiene que ser exactamente la permitida, así que un mail nuevo hace fallar la prueba hasta que se decida.

### RF-34, qué mide cada indicador del panel del administrador

`GET /api/admin/dashboard?period=day|week|month|year` (`src/modules/admin/dashboard.service.ts`). El período es el día, la semana (lunes a domingo), el mes o el año en curso en hora de Argentina; sin `period` o con otro valor, el mes. Los turnos entran por su **fecha** (`appointments.date`) dentro del período; las clientas y los productos, por su `createdAt`.

| Indicador | Qué mide |
|---|---|
| `depositRevenueTotal` | Suma de `depositAmount` de los turnos del período con la seña `partial` o `paid`, en cualquier estado (incluye la seña retenida de un cancelado o no asistido). No suma las `refunded` ni las `pending`. |
| `attendedAppointments` | Turnos `finished` del período con fecha hasta hoy. |
| `newClients` | Clientas registradas dentro del período que tienen al menos un turno (de cualquier fecha y estado). |
| `occupancyPercent` | Minutos de turnos del período que no están `cancelled` (los `cancelled_no_show` y `no_show_auto` sí cuentan) sobre los minutos de las franjas activas de las profesionales y administradoras activas en esos días, sin feriados ni vacaciones. Un decimal. |
| `noShowAppointments` | Turnos `cancelled_no_show` (marca del personal) más `no_show_auto` (job). |
| `refundedDeposits` | Cantidad de turnos con la seña marcada `refunded`. Es una cantidad, no un monto. |
| `pendingBalance` | Precio menos seña de los turnos `confirmed` o `finished` con la seña `partial`. No descuenta el saldo cobrado en el local (`balancePaidAt`): **no determinado** si eso es lo buscado. |
| `returningClients` | De las clientas nuevas, las que tienen un segundo turno no `cancelled` a 30 días o menos del primero (`returningWindowDays`, fijo). |
| `topProducts` | Hasta 8 productos de pedidos pagados (`paymentStatus = 'paid'`) creados en el período, por unidades vendidas, con su facturación. |
| `categoryRevenue` | Precio de los turnos atendidos (misma regla que `attendedAppointments`) por categoría del servicio. |
| `heatmap` | Turnos no `cancelled` de lunes a sábado por bloque horario: mañana (antes de las 13:00), siesta (13:00 a 16:59) y tarde (desde las 17:00). El domingo no se muestra. |
| `promotionConversion` | Turnos del período con promoción aplicada (`promotionId`) contra turnos a precio de lista, en cualquier estado. |
| `serviceProfitability` | Hasta 10 servicios por turnos atendidos, con la seña cobrada, la facturación de los atendidos y los `cancelled`. |
| `professionalPerformance` | Por profesional: turnos atendidos, horas trabajadas (duración de los atendidos), facturación de los atendidos y turnos `cancelled`. Ordenado por facturación. |

La prueba de `history-activity-dashboard.test.ts` arma un día con un turno de cada tipo y comprueba los valores de cada indicador de la primera tabla.

### Hallazgos (reportados, sin corregir)

- **RF-33, postulación:** `POST /api/contact/job-interest` no exige ningún campo, no tiene limitador propio (solo el global de 100 por minuto) y un cuerpo inválido no se rechaza: responde `201` y registra «Postulación sin datos cargados». Además, el nombre, el correo y el teléfono quedan en el texto de una entrada de actividad que la anonimización no toca. La prueba describe el comportamiento actual.
- **RF-21, libro de inventario:** borrar una **entrada** cuyo stock ya salió deja el stock en negativo (entrada de 5, salida de 4 y borrar la entrada: stock −4). El alta y la edición sí lo impiden (`INSUFFICIENT_STOCK`). La base no tiene un `CHECK (stock >= 0)`.
- **Ediciones parciales:** `PUT /api/services/:id`, `PUT /api/admin/promotions/:id` y `PUT /api/admin/special-events/:id` validan con `schema.partial()`, y zod completa los campos con valor por defecto que no vienen: un `PUT` con solo `{ title }` vuelve a activar una promoción, un evento o un servicio inactivo y borra la descripción (y en una promoción pasa `kind` a `discount`). **Hoy no pasa desde la interfaz**: el frontend siempre manda el formulario completo y el interruptor de los eventos manda `active` explícito. Además, `active: "false"` como texto se lee como `true` (`z.coerce.boolean`).
- **Id inexistente:** `PUT /api/services/:id`, `DELETE /api/admin/promotions/:id` y `PUT /api/admin/special-events/:id` con un id que no existe responden `500` en vez de `404` (el error de Prisma llega al manejador genérico y, en producción, a Sentry).
- **Validación en el borde (ADR-002):** `PATCH /api/professional/profile`, `PATCH /api/professional/schedule` y `POST /api/professional/onboarding` no tienen esquema zod: no se validan las horas de las franjas (se guardan `20:00` a `08:00` y hasta `"nada"` a `"x"`), y `PATCH /profile` pone en `null` los campos que no vienen (un `PATCH` con solo `specialty` borra la `bio`). `PATCH /api/admin/clients/:id/gallery/:photoId` no valida la categoría (el alta sí), y borrar una foto de la galería no borra el archivo del bucket (la anonimización sí).
