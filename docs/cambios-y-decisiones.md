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
