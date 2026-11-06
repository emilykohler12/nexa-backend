-- docs/consultas-previas-produccion.sql
--
-- Consultas de SOLO LECTURA para correr en el SQL Editor de Supabase ANTES de aplicar las
-- migraciones de la AE4. Ninguna modifica datos. Se pegan de a una (o todas juntas: cada
-- una devuelve su propio resultado) y se guarda la salida como evidencia en la bitácora.
-- Hacer el respaldo de la base antes de aplicar cualquier migración.
--
-- Nombres de tablas y columnas verificados contra prisma/schema.prisma (rama integracion-ae4).

-- ── 1. Valor actual de refund_policy (Fase 3: solo se admite 'full' o 'none') ──────────────
-- payment_settings tiene una sola fila: el resultado es 0 o 1 fila con 'partial'.
SELECT refund_policy, cancellation_hours, deposit_percent, deposit_amount
FROM payment_settings;

-- ── 2. Cantidad de turnos por estado ───────────────────────────────────────────────────────
SELECT status, count(*) AS turnos
FROM appointments
GROUP BY status
ORDER BY status;

-- ── 3. Posibles duplicados para el índice nuevo (Fase 2) ──────────────────────────────────
-- 3a. Entre los turnos que HOY ocupan el horario: tiene que dar 0 filas, lo garantiza el índice vigente.
SELECT professional_id, date, time, count(*) AS turnos
FROM appointments
WHERE status NOT IN ('cancelled', 'cancelled_no_show')
GROUP BY professional_id, date, time
HAVING count(*) > 1;

-- 3b. Si los cancelled_no_show viejos también ocuparan el horario: cada fila es un conflicto que
--     impediría extender el índice a ese estado. Informativa: el diseño usa una columna nueva
--     (slot_locked, por defecto false) para no afectar a estas filas.
SELECT professional_id, date, time, count(*) AS turnos,
       string_agg(status, ', ' ORDER BY status) AS estados
FROM appointments
WHERE status <> 'cancelled'
GROUP BY professional_id, date, time
HAVING count(*) > 1;

-- ── 4. Datos que se pierden al borrar columnas y tablas (Fase 1) ──────────────────────────
-- 4a. Clientas con fecha de nacimiento cargada (clients.birth_date).
SELECT count(*) AS clientas_con_fecha_de_nacimiento
FROM clients
WHERE birth_date IS NOT NULL;

-- 4b. Clientas con puntos de fidelización distintos de cero (clients.loyalty_points).
SELECT count(*) AS clientas_con_puntos, coalesce(sum(loyalty_points), 0) AS puntos_totales
FROM clients
WHERE loyalty_points <> 0;

-- 4c. Clientas con la marca del recordatorio de inactividad (clients.last_inactivity_reminder_at).
SELECT count(*) AS clientas_con_recordatorio
FROM clients
WHERE last_inactivity_reminder_at IS NOT NULL;

-- 4d. Campañas automáticas y envíos registrados (tablas que se eliminan).
SELECT (SELECT count(*) FROM auto_promotions)      AS campanias,
       (SELECT count(*) FROM auto_promotion_sends) AS envios_registrados;

-- ── 5. Tipos de aviso existentes en las notificaciones (Fase 6) ───────────────────────────
SELECT 'profesionales' AS tabla, type, count(*) AS avisos
FROM professional_notifications
GROUP BY type
UNION ALL
SELECT 'clientas' AS tabla, type, count(*) AS avisos
FROM client_notifications
GROUP BY type
ORDER BY tabla, type;

-- ── 6. Categorías de servicio en uso (Fase 6, RF-11) ──────────────────────────────────────
SELECT category_id, status, count(*) AS servicios
FROM services
GROUP BY category_id, status
ORDER BY category_id, status;

-- ── 7. Datos personales que toca la anonimización (Fase 5) ────────────────────────────────
-- 7a. Fotos de galería de clientas (filas; los archivos viven en Supabase Storage).
SELECT count(*) AS fotos_de_galeria, count(DISTINCT client_id) AS clientas_con_fotos
FROM client_gallery_photos;

-- 7b. Pedidos con teléfono o dirección de entrega cargados.
SELECT count(*) FILTER (WHERE phone IS NOT NULL AND phone <> '')                      AS pedidos_con_telefono,
       count(*) FILTER (WHERE delivery_address IS NOT NULL AND delivery_address <> '') AS pedidos_con_direccion,
       count(*) FILTER (WHERE notes IS NOT NULL AND notes <> '')                       AS pedidos_con_notas,
       count(*)                                                                        AS pedidos_totales
FROM orders;

-- ── 8. Turnos de servicio especial con la seña marcada como paga sin pago (Fase 6, RF-03/RF-17) ──
-- Hasta la fase 6 el servicio especial nacía con payment_status = 'partial' sin cobrar nada.
-- Cada fila es un turno viejo cuya seña figura paga pero no tiene pago de Mercado Pago ni cobro
-- registrado: hay que revisarlo a mano con la clienta (el backend nuevo no los toca).
SELECT a.id, a.date, a.time, a.payment_status, a.deposit_amount, a.mp_payment_id, a.deposit_method
FROM appointments a
JOIN services s ON s.id = a.service_id
WHERE s.is_special
  AND a.payment_status = 'partial'
  AND a.mp_payment_id IS NULL
  AND a.status NOT IN ('cancelled', 'cancelled_no_show')
ORDER BY a.date, a.time;

-- ── 9. Fase 10: datos que el código nuevo trata distinto (solo lectura) ───────────────────
-- 9a. Entradas de stock que, de borrarse, dejarían el stock en negativo (ahora se rechaza el borrado).
--     Cada fila es una entrada ya vendida en parte: el stock actual es menor que la cantidad de la entrada.
SELECT m.id, m.product_name, m.quantity AS cantidad_entrada, p.stock AS stock_actual
FROM inventory_movements m
JOIN products p ON p.id = m.product_id
WHERE m.type = 'entry' AND p.stock < m.quantity
ORDER BY m.created_at;

-- 9b. Franjas invertidas o con horas que no son HH:mm (ahora el perfil las rechaza; las que ya están cargadas siguen).
SELECT id, professional_id, day_of_week, start_time, end_time
FROM professional_availability
WHERE start_time >= end_time
   OR start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   OR end_time   !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

-- 9c. Fotos de galería con una categoría distinta de before/after (ahora se rechazan al crear y al editar).
SELECT category, count(*) AS fotos
FROM client_gallery_photos
WHERE category NOT IN ('before', 'after')
GROUP BY category;

-- 9d. Saldo cobrado en el local (lo que pendingBalance ahora descuenta).
SELECT count(*) AS turnos_con_saldo_cobrado, coalesce(sum(balance_paid_amount), 0) AS total_cobrado_en_el_local
FROM appointments
WHERE balance_paid_amount IS NOT NULL;
