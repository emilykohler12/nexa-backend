# Nexa — Sistema de Gestión de Turnos para Estudio de Belleza (Prototipo v1.3)

Creado por: Emily Noralí Kohler

El sistema está dividido en dos repositorios que se clonan uno al lado del otro:

- **nexa-backend** (este repo): API REST en Node.js + Express + Prisma + PostgreSQL
- **nexa-frontend**: interfaz en React + Vite — https://github.com/emilykohler12/nexa-frontend

---

## 1. Identificación del proyecto y qué hace este prototipo

### 1.1 Identificación

| Campo | Dato |
|---|---|
| Proyecto | Nexa — Sistema de Gestión de Turnos para Estudio de Belleza (cliente real: Loren Estudio de Belleza) |
| Autora | Kohler, Emily Noralí — DNI 45.555.841 |
| Comisión | A |
| Instancia | Proyecto Final de Grado — AE3 |
| Docente | PosDr. Darío Ezequiel Díaz |
| Versión | v1.3 (etiqueta anotada `v1.3` en ambos repos; `v1`, `v1.1` y `v1.2` se conservan) |

### 1.2 Versiones exactas del entorno

| Herramienta | Versión |
|---|---|
| Node.js | 24.x (probado con 24.17.0; el CI usa `node-version: 24`) |
| npm | 11.13.0 |
| PostgreSQL | 16 (versión de referencia: el CI corre con `postgres:16`). Producción en Supabase 17.x; también probado en local con 18.4 |

### 1.3 Caso de uso vertical: reserva de turno con validación de disponibilidad

Una clienta se registra, elige un servicio, una profesional, una fecha y un horario libre, y confirma la reserva. El recorrido atraviesa las cuatro capas:

| Estación | Dónde vive |
|---|---|
| Interfaz | `nexa-frontend/src/features/client/booking/BookingWizard.tsx` (+ `steps/DateTimeStep.tsx`, `PaymentStep.tsx`) |
| Lógica (regla R-01) | `nexa-backend/src/modules/appointments/appointment.service.ts` → `createForClient` |
| Persistencia | `nexa-backend/prisma/schema.prisma` (modelo `Appointment`, tabla `appointments`) |
| Retorno a la interfaz | `nexa-frontend/src/pages/client/AppointmentsPage.tsx` ("Mis turnos") |

**Requisito:** RF-01 — **Regla de negocio:** R-01 (no se puede confirmar un turno si la profesional ya tiene otro turno activo en ese horario).

### 1.4 Decisión arquitectónica probada

La disponibilidad se garantiza en el **backend**, no solo en la interfaz:

- El frontend no ofrece los horarios ya ocupados (`GET /api/professional/:id/availability`).
- La fuente de verdad es un **índice único parcial** en PostgreSQL sobre `(professional_id, date, time)` que excluye los turnos `cancelled` y `cancelled_no_show`, salvo los que tienen el horario original bloqueado (`slot_locked`: marcados como no asistidos o cancelados ya empezados). Un turno `no_show_auto` sigue ocupando el horario. Es atómico: aunque dos reservas lleguen a la vez o alguien salte la interfaz, solo una se guarda y la otra recibe **HTTP 409** (`PROFESSIONAL_SLOT_TAKEN`). No hay consulta previa.
- La reserva de la clienta (simple, combo y reprogramación) además exige que la hora caiga dentro de las franjas que definió la profesional: si no, **HTTP 400** (`OUT_OF_HOURS`). Los turnos manuales del admin no se validan contra la franja.
- **Inasistencia, horario reabierto y reserva tardía** (reglas confirmadas por la propietaria el 30/10/2026; ver el ADR-002, revisión del 31/10/2026): el job pasa a `no_show_auto` («No asistió (automático)») un turno confirmado sin llegada registrada a los **más de 30 minutos** de su hora de inicio (cada 5 minutos); la seña no cambia. El personal puede marcar «No asistió» desde la hora de inicio: hasta 40 minutos después se reabre el horario en inicios de 5 minutos hasta 60 minutos después de la hora original, siempre que el servicio entre. El horario original nunca se vuelve a reservar. La clienta puede reservar o reprogramar hasta 15 minutos después de la hora de inicio (`START_TIME_PASSED` después). El personal corrige el estado a «Finalizado» siempre o a «Confirmado» si no se superpone.
- **Cancelación y devolución de la seña** (fase 3): el sistema solo **marca** la seña como devuelta, no hace ninguna devolución en Mercado Pago. Si la clienta cancela con 12 horas o más de anticipación (`cancellationHours`) y la seña estaba paga, queda como devuelta; con menos, retenida. Cuando cancela el personal indica si cancela la clienta (con la hora en que avisó, el medio y una nota) o el estudio (devuelve siempre). La política de devolución admite solo `full` o `none`.
- Pruebas automatizadas: `tests/integration/appointments.booking.test.ts`, `tests/integration/appointments.out-of-hours.test.ts`, `tests/integration/appointments.arrival-noshow.test.ts`, `tests/integration/appointments.reopened-slots.test.ts` y `tests/integration/appointments.cancellation-refund.test.ts`.
- Alternativas evaluadas y motivo de la elección: `04-diseno/adr-002-validacion-antes-persistencia.md`.

> **Limitación conocida:** el bloqueo compara la **hora de inicio**. Dos turnos de la misma profesional que empiezan a horas distintas pero se pisan por duración (ej. 16:00 de 90 min y 16:30) todavía no se detectan, salvo en los inicios de un horario reabierto, donde sí se verifica la duración. Está registrada como una iteración nueva a planificar.

### 1.5 Dónde está la documentación

Vive en el repositorio **nexa-backend**:

| Documento | Ubicación |
|---|---|
| Catálogo de requisitos (versión vigente) | `03-requisitos/20261005_CatalogoRequisitos_Kohler_v5.xlsx` |
| ADR-001: estrategia de multi-tenancy | `04-diseno/adr-001-multi-tenancy.md` |
| ADR-002: integridad de la reserva (índice único parcial y `OUT_OF_HOURS`) | `04-diseno/adr-002-validacion-antes-persistencia.md` |
| ADR-003: JWT para autenticación | `04-diseno/adr-003-jwt-auth.md` |
| Bitácora de decisiones, AE1 (hasta el 03/09/2026) | `00-gestion/BITACORA.md` |
| Bitácora de decisiones, AE2 (10/09 al 06/10/2026; continúa la anterior) | `00-gestion/20261006_BitacoraIndividual_KohlerAE2_v5.docx` |
| Bitácora de decisiones, AE3 (desde el 23/10/2026; continúa la anterior) | `00-gestion/20261028_BitacoraIndividual_KohlerAE3_v1.md` |
| Backup y restauración, RUNBOOK y SOP | `00-gestion/` |

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | 24.x (probado con 24.17.0) |
| API | Express | 5.2.1 |
| ORM | Prisma | 6.19.3 |
| Base de datos | PostgreSQL | 16 |
| Validación | Zod | 4.6.5 |
| Tests backend | Vitest + Supertest | 5.0.1 / 7.3.0 |
| Autenticación | JWT en cookies httpOnly | — |
| Frontend | React + Vite | 19.2.7 / 8.1.0 |
| Estilos | Tailwind CSS | 4.3.1 |
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

### 4.1 Clonar los dos repositorios en la etiqueta v1.3

Crear una carpeta vacía, entrar y clonar ambos repos **uno al lado del otro**:

```bash
mkdir nexa && cd nexa

git clone https://github.com/emilykohler12/nexa-backend.git
git clone https://github.com/emilykohler12/nexa-frontend.git

cd nexa-backend  && git checkout v1.3 && cd ..
cd nexa-frontend && git checkout v1.3 && cd ..
```

Queda así:

```
nexa/
├── nexa-backend/
└── nexa-frontend/
```

> `git checkout v1.3` muestra un aviso de *"detached HEAD"*: es normal, significa que estás parado en la versión etiquetada.

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

El resto de los valores ya sirven para desarrollo local. Las variables de Mercado Pago, Sentry y Supabase pueden quedar vacías.

**Frontend** — copiar el archivo de ejemplo (no hace falta editarlo):

```bash
cd ../nexa-frontend
cp .env.example .env.local
cd ..
```

Contiene `VITE_API_URL="http://localhost:4000"`, que es el puerto donde escucha el backend.

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
54 migrations found in prisma/migrations
Applying migration `20260720211431_init`
Applying migration `20260813212326_init`
...
All migrations have been successfully applied.
...
✔ Generated Prisma Client
...
✅ Datos de demo listos:
   Servicio:    Manicura semipermanente (60 min, $15.000)
   Profesional: Loren (demo) — lun a sáb 09:00–18:00
   Login profesional: profesional@nexa.local / Profesional1234!
```

`seed:demo` carga una profesional con horario, un servicio y un WhatsApp de demo del negocio, que es lo mínimo necesario para poder reservar. Se puede correr más de una vez sin duplicar nada.

> Usar `migrate deploy`, **no** `migrate dev`: `migrate dev` puede quedarse esperando que escribas el nombre de una migración nueva.

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

### 6.1 Crear una cuenta de clienta

1. En http://localhost:5173 ir a **Ingresar** → pestaña **Registro**.
2. Completar nombre, apellido, teléfono celular (los tres obligatorios, RF-02), email (ej. `maria@test.local`), contraseña (ej. `Maria1234!`) y aceptar los términos. Se guarda la fecha y la versión de la política aceptada (RF-08).
3. Registrarse. No hace falta verificar el email para reservar.

### 6.2 Reservar un turno

1. Ir a **Mis turnos** → **+ Reservar nuevo turno**.
2. **Servicio:** elegir *Manicura semipermanente* → **Siguiente**.
3. **Profesional:** elegir *Loren (demo)* → **Siguiente**.
4. **Fecha:** elegir un día de lunes a sábado a partir de mañana. Aparecen los horarios libres; elegir uno → **Siguiente**.
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
Test Files  37 passed (37)
     Tests  438 passed (438)
```

Los tests del caso de uso vertical están en `tests/integration/appointments.booking.test.ts`, entre ellos:
- *rechaza reservar el mismo horario dos veces con la misma profesional (slot conflict)*
- *permite la misma hora con OTRA profesional (el conflicto es por profesional, no global)*

Y en `tests/integration/appointments.out-of-hours.test.ts`:
- *rechaza reservar a las 23:00 con disponibilidad de 09:00 a 18:00*

### 7.2 Frontend

```bash
cd nexa-frontend
npm test
```

**Esperado:**

```
Test Files  17 passed (17)
     Tests  80 passed (80)
```

---

## 8. Declaración de uso de IA

En este proyecto se usó **Claude Code** (Anthropic) como asistente de programación, con los modelos Claude Sonnet 5, Claude Sonnet 5.5, Claude Haiku 4.5 y Claude Opus 5.5. Toda decisión de dominio (entidades, reglas, alcance del MVP, iteraciones) la tomó la autora; el detalle de cada decisión, las alternativas descartadas y en qué intervino la IA está en la bitácora: [`00-gestion/BITACORA.md`](00-gestion/BITACORA.md) (AE1, hasta el 03/09/2026) y su continuación [`00-gestion/20261006_BitacoraIndividual_KohlerAE2_v5.docx`](00-gestion/20261006_BitacoraIndividual_KohlerAE2_v5.docx) (AE2, del 10/09 al 06/10/2026) y [`00-gestion/20261028_BitacoraIndividual_KohlerAE3_v1.md`](00-gestion/20261028_BitacoraIndividual_KohlerAE3_v1.md) (AE3, desde el 23/10/2026).

También se usó **Claude** (chat, Anthropic) sobre documentos —el informe, los instrumentos, el libro de requisitos, el acta, el tablero y la bitácora—; ese uso está declarado en la bitácora y en el Anexo III.

### 8.1 Cifras (calculadas con `git log`)

Corte: commit `6e7d8c0` en nexa-backend y `3090b89` en nexa-frontend (2026-10-28, los merges de los pull requests #12 y #9 en `main`), el último de cada repositorio al escribir esto. No cuentan el commit de este README ni los que se hagan después: un commit no puede citar su propio hash.

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

### 8.3 Cambios de la AE4 hechos con Claude Code (rama `integracion-ae4`)

Las cifras de 8.1 y 8.2 están cortadas en `6e7d8c0`. Desde ahí, cada fase de la AE4 la hace Claude Code (modelo Sonnet 5.5) sobre su propia rama, a pedido de la autora, con el nombre de ella como autor y sin la línea de coautoría. Cada commit cita solo los anteriores, nunca el suyo ni el del propio README.

| Fase | Rama | Commits |
|---|---|---|
| 1 — eliminaciones | `refactor/quitar-campanas-puntos-recordatorio-nacimiento` | `b30e849`, `8955406`, `308bb0a` (bitácora, entrada 70), `3139d13` (bitácora, entrada 71) |
| 2 — inasistencia, horario reabierto y reserva tardía | `feat/inasistencia-horario-reabierto` | `1bfdf67`, `76fe8a3`, `3ccdf53` (bitácora, entrada 72), `924564f` (bitácora, entrada 73) |
| 3 — cancelación y devolución | `feat/cancelacion-devolucion-hora-de-aviso` | `7e8a16e`, `60e56b1`, `d41644e` (bitácora, entrada 74) |
| 3b — recordatorio de turno por mail | `feat/recordatorio-turno-mail` | `7cd9a6e`, `2125736`, `9553863`, `9102940` (bitácora, entrada 75) |

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
| `X-Robots-Tag: noindex` en `/login`, `/registro-profesional` y `/pago/*` | `vercel.json` |
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

**El puerto 4000 ya está en uso**
Cambiar `PORT` en `nexa-backend/.env` (ej. `4100`) y `VITE_API_URL` en `nexa-frontend/.env.local` al mismo puerto.

**Los tests abortan con `DATABASE_URL no parece ser una base de test`**
Falta `.env.test`, o su `DATABASE_URL` apunta a una base cuyo nombre no contiene `test`. Es una protección para no borrar la base de desarrollo (paso 7.1).

---

**Versión:** 1.0.0 · **Última actualización:** 2026-10-01
