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

- **Reprogramación después del envío.** `reminder_sent_at` no se limpia al reprogramar: si un turno ya recordado se pasa a otro día, la clienta no recibe un segundo recordatorio. Decisión pendiente de Emily (limpiar la marca al reprogramar sería la alternativa).
- **Reprogramación a un horario cercano.** El criterio «reserva hecha con menos de 5 horas de anticipación» mira la fecha de creación del turno, no la de la última reprogramación.
- **Caída del proceso entre la marca y el envío.** Ese recordatorio se pierde (no se reenvía). Se prefirió eso a mandar dos mails.
- **Primer intento tardío.** El tope de 1 hora antes del turno vale también para el primer intento: si el servidor estuvo caído hasta menos de 1 hora antes, no se manda.
- **Combo.** El enlace del mail lleva el id de la primera pata del grupo.
- **Política de privacidad.** Todavía no menciona este mail (pendiente de decisión de Emily).
