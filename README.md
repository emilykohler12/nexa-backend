# Nexa — Sistema de Gestión de Turnos para Estudio de Belleza

Creado por: Emily Noralí Kohler

El sistema está dividido en dos repositorios que se clonan uno al lado del otro:

- **nexa-backend** (este repo): API REST en Node.js + Express + Prisma + PostgreSQL
- **nexa-frontend**: interfaz en React + Vite — https://github.com/emilykohler12/nexa-frontend

---

**Este archivo es el manual de despliegue de la entrega** (el mismo archivo va como PDF). Correspondencia con las 11 secciones de la guía de despliegue:

| Sección de la guía | Dónde está en este manual |
|---|---|
| 1. Propósito y versión (etiqueta) | 1.1 |
| 2. Requisitos previos con versiones exactas | 1.2 y 3 |
| 3. Clonado y checkout de la etiqueta | 4.1 |
| 4. Configuración (`.env.example` con todas las variables) | 4.4 |
| 5. Base de datos: crear, migrar y cargar datos de prueba | 4.3 y 4.5 |
| 6. Ejecución: comando, puerto y cómo detenerla | 5 |
| 7. Usuario de demostración | 4.6 |
| 8. Verificación: prueba de humo y recorrido de los casos de uso Must | 6 |
| 9. Pruebas automatizadas y resultado esperado | 7 |
| 10. Problemas frecuentes | 11 |
| 11. Terceros e IA, coincidente con las bitácoras | 8 |

---

## 1. Identificación del proyecto y qué hace el sistema

### 1.1 Identificación

| Campo | Dato |
|---|---|
| Proyecto | Nexa — Sistema de Gestión de Turnos para Estudio de Belleza (cliente real: Loren Estudio de Belleza) |
| Autora | Kohler, Emily Noralí — DNI 45.555.841 |
| Comisión | A |
| Instancia | Proyecto Final de Grado — AE4 |
| Docente | PosDr. Darío Ezequiel Díaz |
| Versión | **v2.0**, la versión congelada de la AE4 (13/11/2026): etiqueta anotada `v2.0` en los dos repositorios (se baja con `git checkout v2.0`, ver 4.1). Las etiquetas anteriores (`v1`, `v1.1`, `v1.2` y `v1.3`, de la AE3) se conservan, pero no son la que vale. Si apareciera un defecto después de la etiqueta, se crearía una etiqueta nueva (por ejemplo `v2.0.1`) y la entrega declararía cuál vale. El commit exacto lo muestra `git show v2.0` |
| En producción | Frontend: https://lorenestudiodebelleza.vercel.app (Vercel). Backend en Render y base de datos en Supabase |

### 1.2 Versiones exactas del entorno

| Herramienta | Versión |
|---|---|
| Node.js | 24.x (probado con 24.17.0; el CI usa `node-version: 24` y Render la versión de `.node-version`, 24.22.1) |
| npm | 11.13.0 |
| PostgreSQL | 16 (versión de referencia: el CI corre con `postgres:16`). Producción en Supabase 17.x; también probado en local con 18.4 |

### 1.3 Caso de uso vertical: reserva de turno con validación de disponibilidad

Una clienta se registra, elige un servicio, una profesional, una fecha y un horario libre, y confirma la reserva. El recorrido atraviesa las cuatro capas:

| Estación | Dónde vive |
|---|---|
| Interfaz | `nexa-frontend/src/features/client/booking/BookingWizard.tsx` (+ `steps/DateTimeStep.tsx` y, en la misma carpeta que él, `PaymentStep.tsx`) |
| Lógica (regla R-01) | `nexa-backend/src/modules/appointments/appointment.service.ts` → `createForClient` |
| Persistencia | `nexa-backend/prisma/schema.prisma` (modelo `Appointment`, tabla `appointments`) |
| Retorno a la interfaz | `nexa-frontend/src/pages/client/AppointmentsPage.tsx` ("Mis turnos") |

**Requisito:** RF-01 — **Regla de negocio:** R-01 (no se puede confirmar un turno si la profesional ya tiene otro turno activo en ese horario).

### 1.4 Decisión arquitectónica probada y reglas vigentes

La disponibilidad se garantiza en el **backend**, no solo en la interfaz:

- El frontend no ofrece los horarios ya ocupados (`GET /api/professional/:id/availability`).
- La fuente de verdad es un **índice único parcial** en PostgreSQL sobre `(professional_id, date, time)` que excluye los turnos `cancelled` y `cancelled_no_show`, salvo los que tienen el horario original bloqueado (`slot_locked`: marcados como no asistidos o cancelados ya empezados). Un turno `no_show_auto` sigue ocupando el horario. Es atómico: aunque dos reservas lleguen a la vez o alguien salte la interfaz, solo una se guarda y la otra recibe **HTTP 409** (`PROFESSIONAL_SLOT_TAKEN`). No hay consulta previa.
- La reserva de la clienta (simple, combo y reprogramación) además exige que la hora caiga dentro de las franjas que definió la profesional: si no, **HTTP 400** (`OUT_OF_HOURS`). Los turnos manuales del admin no se validan contra la franja.
- **Inasistencia, horario reabierto y reserva tardía** (reglas confirmadas por la propietaria el 30/10/2026; ver el ADR-002, revisión del 31/10/2026): el job pasa a `no_show_auto` («No asistió (automático)») un turno confirmado sin llegada registrada a los **más de 30 minutos** de su hora de inicio (cada 5 minutos); la seña no cambia. El personal puede marcar «No asistió» desde la hora de inicio: hasta 40 minutos después se reabre el horario en inicios de 5 minutos hasta 60 minutos después de la hora original, siempre que el servicio entre. El horario original nunca se vuelve a reservar. La clienta puede reservar o reprogramar hasta 15 minutos después de la hora de inicio (`START_TIME_PASSED` después). El personal corrige el estado a «Finalizado» siempre o a «Confirmado» si no se superpone.
- **Cancelación y devolución de la seña** (fase 3): el sistema solo **marca** la seña como devuelta, no hace ninguna devolución en Mercado Pago. Si la clienta cancela con 12 horas o más de anticipación (`cancellationHours`) y la seña estaba paga, queda como devuelta; con menos, retenida. Cuando cancela el personal indica si cancela la clienta (con la hora en que avisó, el medio y una nota) o el estudio (devuelve siempre). La política de devolución admite solo `full` o `none`.
- **Recordatorio de turno por mail** (fase 3b, RF-35, decisión de la autora): un mail por turno entre 5 horas y 1 hora antes del inicio, con enlaces a «Mis turnos» que no ejecutan nada por sí solos. Es el único mail que el sistema manda por iniciativa propia; no hay campañas automáticas, puntos de fidelización ni recordatorio de inactividad (se quitaron en la fase 1).
- **Cambios de reglas del 06/11/2026:** el personal puede pasar un servicio de un combo a otra profesional; la clienta no cambia de profesional al reprogramar; el administrador y la profesional registran el cobro en el local con la forma de pago; una clienta bloqueada recibe un error genérico; la profesional carga sus vacaciones. Detalle en `docs/cambios-y-decisiones.md`.
- Pruebas automatizadas: `tests/integration/appointments.booking.test.ts`, `tests/integration/appointments.out-of-hours.test.ts`, `tests/integration/appointments.arrival-noshow.test.ts`, `tests/integration/appointments.reopened-slots.test.ts`, `tests/integration/appointments.cancellation-refund.test.ts`, `tests/integration/settings.deposit-and-refund.test.ts` (seña en porcentaje y límites de la devolución) y `tests/integration/client-details-job-interest-late-booking.test.ts` (reserva tardía en combos y servicios especiales).
- Alternativas evaluadas y motivo de la elección: `04-diseno/adr-002-validacion-antes-persistencia.md`.

> **Limitación conocida:** el bloqueo compara la **hora de inicio**. Dos turnos de la misma profesional que empiezan a horas distintas pero se pisan por duración (ej. 16:00 de 90 min y 16:30) todavía no se detectan, salvo en los inicios de un horario reabierto, donde sí se verifica la duración. Está registrada como una iteración nueva a planificar.

### 1.5 Dónde está la documentación

Vive en el repositorio **nexa-backend**:

| Documento | Ubicación |
|---|---|
| Catálogo de requisitos | `03-requisitos/20261113_CatalogoRequisitos_Kohler_v10.xlsx` es la versión vigente (13/11/2026). También están la v5, la v6 y la v7 como historial; las versiones v8 y v9 no están en el repositorio: la v10 las reemplaza y la hoja «Cambios v10» lista lo que cambió desde la v9 |
| Relevamiento (entrevistas e instrumentos) | `01-relevamiento/` |
| Cobertura de cada requisito con pruebas automatizadas | `docs/cobertura-por-requisito.md` |
| Cambios y decisiones de la AE4, por fase | `docs/cambios-y-decisiones.md` |
| Plan de despliegue de la AE4 e instalación desde una base vacía | `docs/plan-de-despliegue.md` |
| Consultas de solo lectura para verificar producción | `docs/consultas-previas-produccion.sql` |
| Estimación de horas de desarrollo (cifra única: 424 horas, de 394 a 454 al 95 %; método de tres valores, no por commits) | `docs/estimacion-horas.md` |
| ADR-001: estrategia de multi-tenancy | `04-diseno/adr-001-multi-tenancy.md` |
| ADR-002: integridad de la reserva (índice único parcial y `OUT_OF_HOURS`) | `04-diseno/adr-002-validacion-antes-persistencia.md` |
| ADR-003: JWT para autenticación | `04-diseno/adr-003-jwt-auth.md` |
| Bitácora de decisiones, AE1 (hasta el 03/09/2026) | `00-gestion/BITACORA.md` |
| Bitácora de decisiones, AE2 (10/09 al 06/10/2026; continúa la anterior) | `00-gestion/20261006_BitacoraIndividual_KohlerAE2_v5.docx` |
| Bitácora de decisiones, AE3 y AE4 (desde el 23/10/2026 hasta hoy; continúa la anterior; incluye los cambios del frontend y las sesiones de Claude en el chat; entradas 1 a 162) | `00-gestion/20261028_BitacoraIndividual_KohlerAE3_v1.md` |
| Backup y restauración, RUNBOOK, SOP y texto de la política de privacidad | `00-gestion/` |
| Evidencia de la medición de RNF-01 | `05-entregas/evidencia-RNF-01/` |

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | 24.x (probado con 24.17.0) |
| API | Express | 5.2.1 |
| ORM | Prisma | 6.19.3 |
| Base de datos | PostgreSQL | 16 |
| Validación | Zod | 4.6.7 |
| Tests backend | Vitest + Supertest | 5.0.5 / 7.3.0 |
| Tareas programadas | node-cron (tres tareas, cada 5 minutos) | 4.6.x |
| Autenticación | JWT en cookies httpOnly | — |
| Frontend | React + Vite + TypeScript | 19.2.7 / 8.1.0 / 6.0.3 |
| Rutas del frontend | React Router | 7.18.4 |
| Estilos | Tailwind CSS | 4.3.1 |
| Tests frontend | Vitest + Testing Library (jsdom) | 5.0.1 |
| Despliegue | Render (backend), Supabase (PostgreSQL y archivos) y Vercel (frontend) | — |
| CI | GitHub Actions | — |

---

## 3. Requisitos previos

Funciona en Windows, macOS y Linux. Necesitás tener instalado:

| Programa | Versión | Cómo verificar |
|---|---|---|
| Git | 2.x | `git --version` |
| Node.js | 24.x (probado con 24.17.0) | `node --version` |
| npm | 11.13.0 | `npm --version` |
| PostgreSQL | 16, corriendo en tu máquina (el CI usa 16; producción usa 17.x; también probado con 18.4) | `psql --version` |

Además, un usuario y contraseña de PostgreSQL con permiso para crear bases (en una instalación por defecto, el usuario `postgres`).

> No hace falta ninguna cuenta externa (Mercado Pago, Supabase, Sentry, mail) para correr el caso de uso vertical.

---

## 4. Instalación paso a paso

Todos los comandos se escriben en una terminal. En Windows sirve Git Bash o PowerShell.

### 4.1 Clonar los dos repositorios

Crear una carpeta vacía, entrar y clonar ambos repos **uno al lado del otro**:

```bash
mkdir nexa && cd nexa

git clone https://github.com/emilykohler12/nexa-backend.git
git clone https://github.com/emilykohler12/nexa-frontend.git
```

Queda así:

```
nexa/
├── nexa-backend/
└── nexa-frontend/
```

Pasar los dos repositorios a la etiqueta de la entrega, `v2.0` (la versión congelada que describe este manual):

```bash
cd nexa-backend  && git checkout v2.0 && git describe --tags && cd ..
cd nexa-frontend && git checkout v2.0 && git describe --tags && cd ..
```

Cada `git describe --tags` tiene que imprimir `v2.0`. Git avisa que quedó en «detached HEAD» (cabeza separada): es lo esperado al pararse en una etiqueta y no hay que hacer nada. `git show v2.0` muestra el commit exacto sobre el que se puso la etiqueta. No usar `v1.3`: es la de la AE3 y trae un código anterior (54 migraciones y otros datos de demo), que no coincide con las salidas esperadas de abajo.

### 4.2 Instalar dependencias

```bash
cd nexa-backend
npm ci
cd ../nexa-frontend
npm ci
cd ..
```

`npm ci` instala exactamente las versiones de `package-lock.json`. Puede mostrar avisos de `npm audit`; no impiden seguir.

### 4.3 Crear la base de datos

Crear una base vacía llamada `nexa_dev` (cambiar `postgres` por tu usuario si es otro):

```bash
psql -U postgres -c "CREATE DATABASE nexa_dev"
```

### 4.4 Configurar variables de entorno

**Backend** — copiar el archivo de ejemplo:

```bash
cd nexa-backend
cp .env.example .env
```

Abrir `.env` y editar **solo** la línea `DATABASE_URL` con tu usuario y contraseña de PostgreSQL:

```
DATABASE_URL="postgresql://USUARIO:CONTRASEÑA@localhost:5432/nexa_dev"
```

El resto de los valores ya sirven para desarrollo local. El archivo lista todas las variables que lee el backend (las de `src/app/config/env.ts` más `SENTRY_DSN`); las de Mercado Pago (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `BACKEND_PUBLIC_URL`), Sentry, Supabase y Brevo pueden quedar vacías. No definir `TZ`: el backend tiene que correr en UTC.

**Frontend** — copiar el archivo de ejemplo (no hace falta editarlo):

```bash
cd ../nexa-frontend
cp .env.example .env.local
cd ..
```

Contiene `VITE_API_URL="http://localhost:4000"`, que es el puerto donde escucha el backend, y el resto de las variables `VITE_` con valores que sirven para desarrollo (`VITE_SENTRY_DSN` puede quedar vacía).

> En PowerShell, si `cp` no funciona, usar `Copy-Item .env.example .env`.

### 4.5 Crear el esquema y cargar datos de demo

```bash
cd nexa-backend
npx prisma migrate deploy
npx prisma generate
npm run seed:demo
```

**Esperado:**

```
63 migrations found in prisma/migrations
Applying migration `20260720211431_init`
Applying migration `20260813212326_init`
...
Applying migration `20261113120000_sena_pagada_en`

All migrations have been successfully applied.
...
✔ Generated Prisma Client
...
✅ Datos de demo listos:
   Servicio:    Manicura semipermanente (60 min, $15.000)
   Profesional: Valeria (demo) — lun a sáb 09:00–18:00
   Turnos de la clienta: confirmado AAAA-MM-DD 10:00, no asistió (automático) AAAA-MM-DD 10:00, cancelado AAAA-MM-DD 15:00
   Promoción vigente: Semipermanente con descuento (demo) (AAAA-MM-DD a AAAA-MM-DD)
   Login profesional: profesional@nexa.local / Profesional1234!
   Login clienta:     clienta@nexa.local / Clienta1234!
```

`seed:demo` carga un escenario de demostración con datos inventados, coherente con las reglas de la AE4: una profesional con horario de lunes a sábado, un servicio, una clienta de demo con un turno **confirmado** (a 2 días o más, en día hábil, con la seña paga), uno **`no_show_auto`** («No asistió (automático)», del día hábil anterior, con la seña retenida y el horario todavía ocupado) y uno **cancelado** por la clienta con más de 12 horas de aviso (seña marcada como devuelta y horario libre), una **promoción vigente** (desde hoy por 30 días) y un WhatsApp de demo del negocio. Las fechas se calculan en hora de Argentina el día que se corre. Se puede correr más de una vez sin duplicar nada: cada corrida vuelve a crear solo los turnos de la clienta de demo. Lo verifica `tests/integration/seed-demo.test.ts`. Solo para desarrollo: nunca correrlo contra la base de producción.

> Usar `migrate deploy`, **no** `migrate dev`: `migrate dev` puede quedarse esperando que escribas el nombre de una migración nueva.

El esquema se prueba desde cero en cada corrida del canal de construcción (sección 9), que aplica las 63 migraciones sobre un PostgreSQL 16 vacío. Las migraciones son archivos versionados en `prisma/migrations/`; el índice único parcial de la regla R-01 está creado en SQL dentro de la migración, no en `schema.prisma`.

### 4.6 Usuarios de demostración

Todos son datos inventados. Nunca cargarlos en la base de producción.

| Rol | Usuario | Contraseña de prueba | Cómo se crea |
|---|---|---|---|
| Administradora | `admin@nexa.local` | `Admin1234!` | La crea el servidor al arrancar por primera vez, con `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME` del `.env` (los valores de arriba son los de `.env.example`) |
| Profesional | `profesional@nexa.local` | `Profesional1234!` | `npm run seed:demo` |
| Clienta | `clienta@nexa.local` | `Clienta1234!` | `npm run seed:demo` |

**Datos de la presentación (opcional, más completos).** Además de `seed:demo`, el repositorio trae un seed grande con 7 agendas, 13 servicios (dos de ellos simultáneos), clientas de casos y los 14 casos de prueba de la semana de la presentación (`scripts/seed-presentacion/README.md`). Hace falta definir en el `.env` `SEED_PASSWORD` (contraseña de todas las cuentas), `SEED_PRO_EMAIL` y `SEED_CLIENT_EMAIL` (correos que elijas para la profesional y la clienta de demostración), y después:

```bash
npm run seed:presentacion:demo   # reducido: 7 profesionales, servicios con 2 simultáneos y los 14 casos de la semana
npm run seed:presentacion        # completo: lo mismo más 450 turnos del mes y los datos del negocio
npm run demo:turnos-ahora        # 3 turnos contados desde este momento, para probar cancelación con menos y más de 12 horas y el recordatorio
```

Los dos primeros son idempotentes y se niegan a correr si la base no es local o si ya tiene cuentas reales (el resto de las cuentas son `@example.com`, sin buzón). Se pueden verificar sin base con `npm run seed:presentacion:verificar`. La administradora de ese escenario es la de `ADMIN_EMAIL`.

---

## 5. Ejecutar la aplicación

Hacen falta **dos terminales** abiertas al mismo tiempo.

**Terminal 1 — backend:**

```bash
cd nexa-backend
npm run dev
```

**Esperado:**

```
✅ Conectado a PostgreSQL
👤 Admin inicial creado: admin@nexa.local
[jobs] scheduler iniciado (hora de Argentina) — release-unpaid (cada 5 min) + auto-no-show (cada 5 min) + appointment-reminder (cada 5 min)
🚀 Servidor en http://localhost:4000 (development)
```

(El mensaje del admin aparece solo la primera vez.) Para comprobar que responde, abrir http://localhost:4000/api/health → `{"status":"ok","database":"up",...}`

**Terminal 2 — frontend:**

```bash
cd nexa-frontend
npm run dev
```

**Esperado:**

```
VITE v8.1.0  ready in ... ms
➜  Local:   http://localhost:5173/
```

Abrir **http://localhost:5173** en el navegador.

---

## 6. Prueba del caso de uso vertical (punta a punta)

### 6.0 Prueba de humo

Con el backend y el frontend corriendo (sección 5) y los datos de demo cargados (4.5):

```bash
curl http://localhost:4000/api/health
curl -i -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"email":"clienta@nexa.local","password":"Clienta1234!"}'
```

**Esperado:** el primero devuelve `{"status":"ok","database":"up",...}`; el segundo, `HTTP/1.1 200` con dos cabeceras `Set-Cookie` (`access_token` y `refresh_token`). En el navegador, http://localhost:5173 muestra la página de inicio con los servicios y se puede ingresar con `clienta@nexa.local`. Si algo de esto falla, ir a la sección 11.

### 6.1 Crear una cuenta de clienta

1. En http://localhost:5173 ir a **Ingresar** → pestaña **Registro**.
2. Completar nombre, apellido, teléfono celular (los tres obligatorios, RF-02), email (ej. `maria@test.local`), contraseña (ej. `Maria1234!`) y aceptar los términos. Se guarda la fecha y la versión de la política aceptada (RF-08).
3. Registrarse. No hace falta verificar el email para reservar. El teléfono tiene que ser un celular argentino válido (por ejemplo `3764123456`).

También se puede entrar con la clienta de demo que crea `seed:demo` (`clienta@nexa.local` / `Clienta1234!`), que ya tiene tres turnos cargados.

### 6.2 Reservar un turno

1. Ir a **Mis turnos** → **+ Reservar nuevo turno**.
2. **Servicio:** elegir *Manicura semipermanente* → **Siguiente**.
3. **Profesional:** elegir *Valeria (demo)* → **Siguiente**.
4. **Fecha:** elegir un día de lunes a sábado a partir de mañana. Aparecen los horarios libres (los datos de demo ya ocupan las 10:00 de un día cercano); elegir uno → **Siguiente**.
5. **Confirmar:** se muestra el resumen (servicio, profesional, fecha, hora, total y seña) → **Confirmar reserva**.
6. Marcar *Acepto los Términos de Servicio y la Política de Privacidad* y elegir **Coordinar el pago por WhatsApp**. Se abre una pestaña de WhatsApp con un mensaje armado: se puede cerrar.
7. En *"Antes de terminar..."* elegir **Omitir por ahora**.

**Esperado:** en **Mis turnos** → *Próximos* aparece el turno con estado **Pendiente de seña** (la seña todavía no se pagó; cuando se registra el pago pasa a **Confirmado**), la fecha, la hora y el precio.

### 6.3 Validación: el horario ya ocupado no se puede volver a reservar

1. Volver a **Reservar nuevo turno**, mismo servicio, misma profesional y misma fecha.
2. **Esperado:** el horario reservado en 6.2 **ya no aparece** entre los disponibles.

Para comprobar que la regla vive en el backend y no solo en la pantalla, los tests automáticos (sección 7) mandan la misma reserva dos veces directo a la API y verifican que la segunda recibe **409** y no se guarda.

### 6.4 Verificar que el dato persiste en PostgreSQL

```bash
psql -U postgres -d nexa_dev -c "SELECT date, time, status, payment_status FROM appointments ORDER BY created_at DESC;"
```

**Esperado:** una fila por turno reservado, con `status = confirmed` y `payment_status = pending` (en pantalla: "Pendiente de seña"). Si se reinicia el backend y se recarga **Mis turnos**, el turno sigue estando.

### 6.5 Recorrido de los casos de uso Must

Son los requisitos de prioridad Must del catálogo v10. Cada uno tiene su prueba automatizada (qué archivo cubre cuál: `docs/cobertura-por-requisito.md` del backend); acá está la comprobación a mano. Salvo que se diga otra cosa, con la clienta de demo (`clienta@nexa.local`).

| Requisito | Qué hacer | Esperado |
|---|---|---|
| RF-01 | Pasos 6.2 y 6.3 | El horario ocupado no se ofrece; reservarlo directo por la API da `409 PROFESSIONAL_SLOT_TAKEN` (test `appointments.booking`) |
| RF-02 | Pasos 6.1 y 6.2 | Una visitante se registra y reserva sin verificar el correo |
| RF-03 | En 6.2, paso 5 | El resumen muestra el total y la seña calculada; el administrador cambia el valor en el panel, en Configuración > Pagos |
| RF-04 | **Mis turnos** > un turno *Confirmado* de la demo (seña paga, a 2 días o más) > **Cancelar** | Antes de confirmar dice que la seña se devuelve (12 horas o más de aviso); el turno pasa a *Cancelado* con la seña *Devuelta*. Con `npm run demo:turnos-ahora` hay uno de menos de 12 horas: la seña queda retenida |
| RF-07 | En la reserva, paso *Antes de terminar...*, completar alergias | No deja guardar la alergia sin tildar el consentimiento (test `allergies.consent-visibility`) |
| RF-08 | En **Registro**, intentar registrarse sin aceptar los términos y la política de privacidad | El formulario no avanza; al aceptar se guarda fecha, hora y versión (`2026-11`) |
| RF-11 | Entrar como administradora (4.6) > **Servicios**, y ver la lista pública al reservar | Los servicios salen por categoría (uñas, cabello, cuerpo, rostro), con precio y duración |
| RF-12 | En la reserva, paso *Antes de terminar...*, marcar acompañante | Solo se guarda el vínculo de una lista cerrada, sin nombre ni edad (test `appointments.companion`) |
| RNF-01 | `05-entregas/evidencia-RNF-01/README.md` | Medición de la reserva con 4G simulado: mediana de 0,80 s contra el límite de 5 s |
| RNF-02 | Hacer todo lo anterior solo con el navegador | No se instala nada |
| RNF-03 | Entrar como la profesional de demo (4.6) y abrir la ficha de la clienta de demo, que todavía no tiene un turno *Finalizado* con ella | No ve la alergia del perfil de la clienta hasta que exista ese turno *Finalizado* (test `allergies.consent-visibility`) |
| RNF-04 | `grep -n "card\|tarjeta" prisma/schema.prisma` | Ninguna columna guarda tarjeta ni datos bancarios; solo el identificador del pago |

---

## 7. Ejecutar los tests

### 7.1 Backend

Los tests usan una base **separada** que se vacía antes de cada caso. Crear esa base y su archivo de configuración una sola vez:

```bash
cd nexa-backend
psql -U postgres -c "CREATE DATABASE nexa_test"
cp .env.test.example .env.test
```

Editar `DATABASE_URL` en `.env.test` con tu usuario y contraseña (el nombre de la base tiene que contener `test`). Después:

```bash
npm run test:migrate
npm test
```

**Esperado:**

```
Test Files  64 passed (64)
     Tests  704 passed (704)
```

Los tests del caso de uso vertical están en `tests/integration/appointments.booking.test.ts`, entre ellos:
- *rechaza reservar el mismo horario dos veces con la misma profesional (slot conflict)*
- *permite la misma hora con OTRA profesional (el conflicto es por profesional, no global)*

Y en `tests/integration/appointments.out-of-hours.test.ts`:
- *rechaza reservar a las 23:00 con disponibilidad de 09:00 a 18:00*

La corrida completa tarda unos 4 a 6 minutos (los archivos corren en serie contra la base). Qué prueba cubre cada requisito está en `docs/cobertura-por-requisito.md`.

### 7.2 Frontend

```bash
cd nexa-frontend
npm test
```

**Esperado:**

```
Test Files  58 passed (58)
     Tests  405 passed (405)
```

Si alguna prueba falla en una máquina lenta, volver a correr solo ese archivo (`npx vitest run ruta/del/archivo`) antes de dar el problema por cierto.

### 7.3 Chequeo de tipos y build

Corren en el canal de construcción y se pueden repetir a mano:

```bash
cd nexa-backend  && npm run typecheck:all && npm run build
cd nexa-frontend && npm run typecheck:all && npm run lint && npm run build
```

No tiene que imprimir errores.

---

## 8. Declaración de uso de IA

En este proyecto se usó **Claude Code** (Anthropic) como asistente de programación, con los modelos Claude Sonnet 5, Claude Sonnet 5.5, Claude Haiku 4.5, Claude Opus 5.5 y Claude Fable 5.2. Toda decisión de dominio (entidades, reglas, alcance del MVP, iteraciones) la tomó la autora; el detalle de cada decisión, las alternativas descartadas y en qué intervino la IA está en la bitácora: [`00-gestion/BITACORA.md`](00-gestion/BITACORA.md) (AE1, hasta el 03/09/2026) y su continuación [`00-gestion/20261006_BitacoraIndividual_KohlerAE2_v5.docx`](00-gestion/20261006_BitacoraIndividual_KohlerAE2_v5.docx) (AE2, del 10/09 al 06/10/2026) y [`00-gestion/20261028_BitacoraIndividual_KohlerAE3_v1.md`](00-gestion/20261028_BitacoraIndividual_KohlerAE3_v1.md) (AE3 y AE4, desde el 23/10/2026).

También se usó **Claude** (chat, Anthropic) sobre documentos —el informe, los instrumentos, el libro de requisitos, el acta, el tablero y la bitácora—; ese uso está declarado en la bitácora (las entradas que dicen «Claude (chat)» en el elemento 6) y en el Anexo III.

### 8.1 Cifras (calculadas con `git log`)

**Primer corte (28/10/2026, cierre de la AE3):** commit `6e7d8c0` en nexa-backend y `3090b89` en nexa-frontend (2026-10-28, los merges de los pull requests #12 y #9 en `main`), el último de cada repositorio al escribir esto. No cuentan el commit de este README ni los que se hagan después: un commit no puede citar su propio hash.

| | nexa-backend | nexa-frontend |
|---|---|---|
| Commits totales | 119 | 84 |
| Merges de pull requests (botón de GitHub, los hace la autora) | 12 | 9 |
| Ediciones del README desde la web de GitHub (la autora) | 1 — `47f4a96` | 1 — `087ee9b` |
| Primeros commits del 25 al 28/08, antes de la línea de coautoría (sin registro de Claude Code) | 6 | 5 |
| **Commits hechos con Claude Code** | **100** | **69** |
| de ellos, con la línea `Co-Authored-By: Claude …` | 36 | 36 |
| de ellos, sin la línea | 64 | 33 |

La línea de coautoría, por modelo:

| | nexa-backend | nexa-frontend |
|---|---|---|
| `Co-Authored-By: Claude Sonnet 5` | 24 | 29 |
| `Co-Authored-By: Claude Sonnet 5.5` | 8 | 4 |
| `Co-Authored-By: Claude Haiku 4.5` | 4 | 3 |
| `Co-Authored-By: Claude Opus 5.5` | 0 | 0 |

**Segundo corte (09/11/2026):** commit `078c0c4` en nexa-backend y `7551f05` en nexa-frontend (los merges de los pull requests #34 y #22 en `main`). No cuenta los commits posteriores.

| | nexa-backend | nexa-frontend |
|---|---|---|
| Commits totales | 232 | 148 |
| Merges de pull requests (los hace la autora) | 36 | 23 |
| Commits sin contar merges | 196 | 125 |
| de ellos, con la línea `Co-Authored-By: Claude …` | 67 commits (69 líneas: Sonnet 5.5, 41; Sonnet 5, 24; Haiku 4.5, 4) | 79 commits (80 líneas: Sonnet 5.5, 46; Sonnet 5, 29; Haiku 4.5, 3; Opus 5.5, 2) |
| de ellos, sin la línea | 129 | 46 |

**Tercer corte (13/11/2026, versión `v2.0`):** commit `d0a971d` en nexa-backend y `7fc0857` en nexa-frontend (los merges de los pull requests #39 y #26 en `main`). No cuenta los commits de la rama `docs/entrega-v2-0`, que son posteriores.

| | nexa-backend | nexa-frontend |
|---|---|---|
| Commits totales | 246 | 157 |
| Merges de pull requests (los hace la autora) | 41 | 27 |
| Commits sin contar merges | 205 | 130 |
| de ellos, con la línea `Co-Authored-By: Claude …` | 67 commits (los mismos que en el segundo corte) | 79 commits (los mismos) |
| de ellos, sin la línea | 138 | 51 |

Los 9 commits nuevos del backend y los 5 del frontend, sin contar merges, no llevan la línea: los hizo Claude Code a pedido de la autora y con el nombre de ella como autor; el modelo de cada uno está en la entrada de la bitácora que lo describe (8.3).

Nota: los commits sin la línea incluyen, en cada repositorio, la edición del README desde la web y los primeros commits de agosto (6 en el backend y 5 en el frontend), que no son de Claude Code. Igual que en el primer corte, todos los commits que no son merges, ediciones web ni los primeros de agosto los hizo Claude Code a pedido de la autora, lleven o no la línea; el modelo de cada sesión posterior al 28/10 figura en la entrada de la bitácora que describe el cambio (8.3).

Comandos usados:

```bash
git rev-list --count HEAD
git rev-list --merges --count HEAD
git log --no-merges --format='%h %cn %ad %s' --date=short | grep ' GitHub '
git log --format='%B' | grep -i "^Co-Authored-By: Claude" | sort | uniq -c
git log --no-merges -i --invert-grep --grep='^Co-Authored-By: Claude' --oneline | wc -l
```

### 8.2 Commits sin la línea, hechos con Claude Code

Todos los commits que no son merges, ediciones web ni los primeros de agosto los hizo Claude Code, a pedido de la autora y con el nombre de ella como autor del commit. Desde el 25/09 se dejó de agregar la línea `Co-Authored-By`. Para no subdeclarar, cada commit sin la línea se cruzó con el registro de sesiones de Claude Code (el comando `git commit` ejecutado por el asistente y el modelo de esa sesión), y los posteriores al 06/10 con la bitácora de la AE3 ([`00-gestion/20261028_BitacoraIndividual_KohlerAE3_v1.md`](00-gestion/20261028_BitacoraIndividual_KohlerAE3_v1.md)):

| Modelo | nexa-backend | nexa-frontend |
|---|---|---|
| Claude Opus 5.5 | 11 — `a44fddb`, `294b0f9`, `8a195de`, `9d97c8f`, `3aa5b7b`, `42321bd`, `8c9b778`, `c12671b`, `90e8874`, `631db61`, `54933ca` | 8 — `a986ca9`, `c6bd2d9`, `72b3a6c`, `53817d9`, `90a2391`, `1dd6936`, `4107356`, `ec976da` |
| Claude Sonnet 5.5 (hasta el 06/10) | 4 — `92cd761`, `2836e1d`, `ce550a9`, `9bdc3ee` | 2 — `2e7734f`, `4bf842e` |
| Claude Sonnet 5 | 9 — `adfe572`, `f4e40cb`, `342b59f`, `f2c9d9f`, `c413f0f`, `f8d0455`, `984862f`, `d7ac9fc`, `3ebba2b` | 5 — `0bede0a`, `174ed11`, `dc7f5df`, `858e2be`, `5b74e37` |
| Claude Haiku 4.5 | 9 — `f5d2eb4`, `9a8651b`, `57d1928`, `f4ba7e4`, `c6241b9`, `6d76104`, `edb0bc4`, `4a0fecb`, `8fa18f7` | 4 — `245dcc0`, `8aed419`, `40d4d08`, `7bde3e7` |
| Claude Code, modelo Sonnet 5.5 según la bitácora de la AE3 (después del 06/10) | 31 | 14 |
| **Total sin la línea** | **64** | **33** |

Los commits `54933ca` y `ec976da` son los del README v1.1; `ce550a9` y `2e7734f`, los de la corrección de ese README, y `9bdc3ee` y `4bf842e`, los de la bitácora de la AE2. La última fila reúne los commits sin la línea (sin contar merges) entre `9bdc3ee..6e7d8c0` en el backend y `4bf842e..3090b89` en el frontend; la bitácora de la AE3 describe el trabajo desde el 23/10.

### 8.3 Cambios de la AE4 hechos con Claude Code

El detalle por modelo de 8.2 está cortado en `6e7d8c0`. Desde ahí, cada fase de la AE4 la hizo Claude Code (modelo Sonnet 5.5 hasta la fase 6 y Opus 5.5 en las fases 7 a 9; el de las siguientes figura en cada entrada de la bitácora), a pedido de la autora y con el nombre de ella como autor. Las fases 1 a 9 se hicieron sobre ramas cortadas de `integracion-ae4` (ya integrada en `main` y borrada) y sin la línea de coautoría; las posteriores, sobre ramas cortadas de `main` o directo sobre `main`. Cada commit cita solo los anteriores, nunca el suyo ni el del propio README. El 10/11/2026 la bitácora se renumeró para intercalar por fecha las entradas de las sesiones de Claude (chat): la tabla usa los números nuevos, los mensajes de los commits conservan los anteriores y la equivalencia está en la entrada 144 de la bitácora.

| Fase | Rama | Commits |
|---|---|---|
| 1 — eliminaciones | `refactor/quitar-campanas-puntos-recordatorio-nacimiento` | `b30e849`, `8955406`, `308bb0a` (bitácora, entrada 83), `3139d13` (bitácora, entrada 85) |
| 2 — inasistencia, horario reabierto y reserva tardía | `feat/inasistencia-horario-reabierto` | `1bfdf67`, `76fe8a3`, `3ccdf53` (bitácora, entrada 87), `924564f` (bitácora, entrada 88) |
| 3 — cancelación y devolución | `feat/cancelacion-devolucion-hora-de-aviso` | `7e8a16e`, `60e56b1`, `d41644e` (bitácora, entrada 90) |
| 3b — recordatorio de turno por mail | `feat/recordatorio-turno-mail` | `7cd9a6e`, `2125736`, `9553863`, `9102940` (bitácora, entrada 92) |
| 4 — tienda | `fix/tienda-publica-solo-disponibles` | `ff25797`, `3fc9b79` (bitácora, entrada 96) |
| 5 — anonimización y alergias | `fix/anonimizacion-y-alergias` | `87a7146`, `08d0945`, `e415b02` (bitácora, entrada 99) |
| 6 — brechas de requisitos | `fix/brechas-requisitos` | `8a1c006`, `7a16248`, `f437d34`, `e565249`, `4554e2d`, `c9cdc61`, `b87a817` (bitácora, entrada 100) |
| 7 — pruebas faltantes (Claude Code con el modelo Opus 5.5) | `test/cobertura-completa` | `a34749a`, `f5c2390`, `a4aa471`, `77fd1b8`, `6cc47d7`, `aa86b17`, `718e8e6`, `45d8401` (bitácora, entrada 101), `3cd1199` (bitácora, entrada 102) |
| 8 — deuda técnica (Claude Code con el modelo Opus 5.5) | `chore/deuda-tecnica` | `a687dfb` (RF-06.0x renombrados), `a4812d7` (seed de demostración), `fc9df24` (`.env.example`), `8443f1f` (bitácora, entrada 103), `bd692e9` (bitácora, entrada 104) |
| 9 — informes (Claude Code con el modelo Opus 5.5) | `docs/informes-v8` | `8974ed1` (cobertura por requisito), `d484c3e` (cambios y decisiones), `4051bba` (bitácora, entrada 105), `55d8e68` (bitácora, entrada 106) y, después de integrar todo en `main`, `5cffa20` (estimación de horas); la documentación va en el último (bitácora, entrada 122) |
| 10 — corrección de los hallazgos de la fase 7 y cierre del código | `fix/fase-10-cierre-codigo` (pull request 28) | `6b68383`, `c598c08`, `3a29f03`, `9ac960a`, `d32b129`, `b0300fe`, `ed42315`, `e95e36a`, `88e7bbb` (bitácora, entrada 117) |
| 9.3 a `main` y postulaciones por mail (RF-33) | `docs/fase-9-3-a-main` y `feat/postulaciones-por-mail` (pull requests 29 y 30) | `a78cc8b`, `905f149`, `f1db365`, `bdb0896` (bitácora, entrada 120) |
| Cierre del backend — Mercado Pago en modo prueba, `.env.example`, base vacía, CI y alertas de Sentry | `chore/cierre-final` y `docs/bitacora-104-sentry` (pull requests 31, 32 y 33) | `3ec1f8b`, `d867e55`, `ed8336a`, `5158335`, `8a3d2bf` (bitácora, entradas 126 a 128, 133 y 134) |
| Entradas del frontend copiadas a la bitácora | pull requests 27 y 31 | `6c72b52`, `f9f04ac`, `0f99881` (bitácora, entradas 107 a 110, 114, 115, 124 y 125) |
| Cambios de reglas del 06/11/2026 | `feat/cambios-de-reglas-06-11` (pull request 34) | `fe42e06`, `1fbb562`, `2f06fce`, `99aea11`, `86be0c3`, `0fa6c9d`, `731b097`, `d6dd428`, `b5224b3`, `fee5a80`, `43da484`, `3f3672a` (bitácora, entradas 135 y 137) |
| Cifra única de horas, bitácora renumerada y este README | rama `docs/horas-bitacora-readme` | `6146c03`, `ab1fa4a` (bitácora, entrada 144) y el commit de ese README (bitácora, entrada 145) |
| Seed de la presentación (450 turnos sintéticos, turnos de demostración y recordatorio a pedido) | `feature/seed-presentacion` (pull request 36) | `1b9dcba`, `1441b30` (bitácora, entradas 146 a 157) |
| Modo reducido del seed y ajustes pedidos al probar la demostración | pull request 37 | `310aa9a`, `e29e922` (bitácora, entrada 158) |
| Señas del tablero por día de pago, invitación con vencimiento fijo y comando del seed | `fix/ajustes-demo-13-11-b` (pull request 38) | `6541884` (bitácora, entrada 159) |
| No finalizar turnos que no empezaron y combos fuera de los servicios de la profesional | `fix/ajustes-demo-14-11-c` (pull request 39) | `be1f478` (bitácora, entrada 160) |
| Catálogo v10, manual de despliegue y etiqueta `v2.0` | `docs/entrega-v2-0` | Catálogo v10 (bitácora, entrada 161) y este README (bitácora, entrada 162), ver `git log v2.0` |

### 8.4 Terceros: servicios y librerías

Ninguno recibe datos de clientas reales en la instalación local de este manual.

| Tercero | Para qué se usa | Hace falta para el manual |
|---|---|---|
| Mercado Pago (SDK `mercadopago`) | Cobro de la seña; el sistema solo guarda el identificador del pago (RNF-04) | No: la reserva se puede coordinar por WhatsApp |
| Supabase | PostgreSQL de producción y almacenamiento de imágenes | No: se usa PostgreSQL local |
| Render y Vercel | Hosting del backend y del frontend | No |
| Brevo | Envío de mails en producción (API HTTPS) | No |
| Sentry | Registro de errores | No (opcional) |
| GitHub y GitHub Actions | Repositorios, canal de construcción y backup diario cifrado | Solo para clonar |
| UptimeRobot | Mantiene despiertos Render y Supabase | No |
| Google Search Console | Indexación del sitio (10.1) | No |
| Context7 (MCP) | Documentación actualizada de las librerías que consultó el asistente de IA al programar; no recibe código ni datos del proyecto | No |

Las librerías de npm están fijadas en `package-lock.json` de cada repositorio (se instalan con `npm ci`); cada una se distribuye con la licencia de su paquete. Las principales están en la sección 2. El uso de IA (Claude Code y Claude en el chat) es el declarado en esta sección 8 y coincide con lo que dicen las entradas de la bitácora (`Herramienta auxiliar`, elemento 6).

---

## 9. Canal de construcción (CI)

Cada push a `main` corre GitHub Actions en los dos repos. El registro de corridas está en:

- Backend: https://github.com/emilykohler12/nexa-backend/actions/workflows/ci.yml
- Frontend: https://github.com/emilykohler12/nexa-frontend/actions/workflows/ci.yml

| Repo | Pasos |
|---|---|
| Backend | `npm ci` → `prisma generate` + `migrate deploy` (sobre un PostgreSQL de CI) → type-check → tests → build |
| Frontend | `npm ci` → type-check → tests → build → lint |

---

## 10. Build de producción

```bash
cd nexa-backend  && npm run build   # genera dist/
cd nexa-frontend && npm run build   # genera dist/
```

### 10.1 Indexación en Google (SEO)

El frontend se publica en Vercel (https://lorenestudiodebelleza.vercel.app) y trae lo necesario para que Google lo indexe. Todo está en `nexa-frontend`; el backend no interviene.

| Qué | Dónde |
|---|---|
| Título, descripción, canonical, Open Graph y Twitter de la home | `index.html` |
| Etiqueta de verificación de Google Search Console (no se debe quitar) | `index.html` |
| `robots.txt`: permite el sitio y bloquea los paneles `/admin`, `/client` y `/professional` | `public/robots.txt` |
| `sitemap.xml` con la home y las dos páginas legales | `public/sitemap.xml` |
| `X-Robots-Tag: noindex` en `/login`, `/registro-profesional`, `/pago/*` y `/mis-turnos` | `vercel.json` |
| Título, descripción y canonical por página (y `noindex` en las privadas) | `src/shared/hooks/usePageMeta.ts` |
| Dominio y nombre del sitio | `src/app/config/seo.config.ts` |

Para un estudio nuevo hay que cambiar el dominio y el nombre en `seo.config.ts`, `index.html`, `public/robots.txt` y `public/sitemap.xml` (los tres últimos lo llevan escrito a mano). Después de desplegar: verificar la propiedad en Search Console, enviar `sitemap.xml` y pedir la indexación de la home con «Inspección de URL».

---

## 11. Solución de problemas

**`❌ Variables de entorno inválidas: DATABASE_URL ...`**
Falta el `.env` del backend. Volver al paso 4.4.

**`Can't reach database server at localhost:5432` / `ECONNREFUSED`**
PostgreSQL no está corriendo. En Windows, iniciar el servicio *postgresql-x64-NN* desde *Servicios*; en macOS `brew services start postgresql`; en Linux `sudo systemctl start postgresql`.

**`password authentication failed`**
El usuario o la contraseña de `DATABASE_URL` no coinciden con los de tu PostgreSQL.

**`@prisma/client did not initialize yet`**
Falta generar el cliente: `npx prisma generate` y volver a correr `npm run dev`.

**`npx prisma migrate dev` se queda esperando**
Cortarlo con Ctrl+C y usar `npx prisma migrate deploy` (paso 4.5).

**La app carga pero no muestra servicios, o da error de conexión**
- Verificar que el backend esté corriendo en http://localhost:4000/api/health.
- Verificar que exista `nexa-frontend/.env.local` con `VITE_API_URL="http://localhost:4000"`. Después de cambiarlo, reiniciar `npm run dev` del frontend.
- Si no aparece ningún servicio para reservar, falta `npm run seed:demo` (paso 4.5).

**El puerto 5173 ya está en uso**
Arrancar el frontend en otro puerto (`npm run dev -- --port 5183`) y poner ese origen en `FRONTEND_URL` de `nexa-backend/.env` (el backend solo acepta pedidos del origen configurado); después reiniciar el backend.

**El registro rechaza el teléfono**
Tiene que ser un celular argentino: código de área más número, 10 dígitos (por ejemplo `3764123456`).

**El puerto 4000 ya está en uso**
Cambiar `PORT` en `nexa-backend/.env` (ej. `4100`) y `VITE_API_URL` en `nexa-frontend/.env.local` al mismo puerto.

**La versión desplegada (Render, Supabase) tarda en responder o da error la primera vez**
Los planes gratuitos se duermen cuando pasan un rato sin tráfico: el primer pedido a Render puede tardar cerca de un minuto en despertar el backend y Supabase pausa los proyectos inactivos. Esperar y volver a cargar; si sigue, probar `/api/health`. Un monitor de UptimeRobot consulta `/api/health` para mantenerlos despiertos. En la instalación local de este manual no pasa.

**No llegan los mails (recuperar contraseña, recordatorio) en local**
Sin `BREVO_API_KEY` el backend intenta enviar por SMTP con `MAIL_*`, y con esos valores vacíos falla. No impide reservar ni nada del recorrido de 6; el fallo queda solo en el log del servidor (`[mail] ❌`). Los mails de producción salen por la API de Brevo.

**`npm run seed:presentacion` se niega a correr**
Es una protección: la base no es local (si es tu base de demostración, definir `SEED_CONFIRM_HOST` con el nombre del servidor) o ya tiene cuentas reales. Usar una base local vacía (4.3).

**`git checkout v2.0` dice que la etiqueta no existe**
Falta traer las etiquetas: `git fetch --tags` y repetir.

**Los tests abortan con `DATABASE_URL no parece ser una base de test`**
Falta `.env.test`, o su `DATABASE_URL` apunta a una base cuyo nombre no contiene `test`. Es una protección para no borrar la base de desarrollo (paso 7.1).

---

**Última actualización:** 2026-11-13 (versión congelada `v2.0`; ver 1.1)
