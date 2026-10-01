# Nexa — Sistema de Gestión de Turnos para Estudio de Belleza (Prototipo v1)

Creado por: Emily Noralí Kohler

El sistema está dividido en dos repositorios que se clonan uno al lado del otro:

- **nexa-backend** (este repo): API REST en Node.js + Express + Prisma + PostgreSQL
- **nexa-frontend**: interfaz en React + Vite — https://github.com/emilykohler12/nexa-frontend

---

## 1. Qué hace este prototipo

### Caso de uso vertical: reserva de turno con validación de disponibilidad

Una clienta se registra, elige un servicio, una profesional, una fecha y un horario libre, y confirma la reserva. El recorrido atraviesa las cuatro capas:

| Estación | Dónde vive |
|---|---|
| Interfaz | `nexa-frontend/src/features/client/booking/BookingWizard.tsx` (+ `steps/DateTimeStep.tsx`, `PaymentStep.tsx`) |
| Lógica (regla R-01) | `nexa-backend/src/modules/appointments/appointment.service.ts` → `createForClient` |
| Persistencia | `nexa-backend/prisma/schema.prisma` (modelo `Appointment`, tabla `appointments`) |
| Retorno a la interfaz | `nexa-frontend/src/pages/client/AppointmentsPage.tsx` ("Mis turnos") |

**Requisito:** RF-01 — **Regla de negocio:** R-01 (no se puede confirmar un turno si la profesional ya tiene otro turno activo en ese horario).

### Decisión arquitectónica probada

La disponibilidad se garantiza en el **backend**, no solo en la interfaz:

- El frontend no ofrece los horarios ya ocupados (`GET /api/professional/:id/availability`).
- Aunque alguien salte la interfaz y mande la reserva directo a la API, el backend la rechaza con **HTTP 409** (`PROFESSIONAL_SLOT_TAKEN`) y el turno no se guarda. El respaldo final es un índice único parcial en PostgreSQL sobre `(professional_id, date, time)` para turnos no cancelados, que además cubre dos reservas simultáneas.
- Prueba automatizada: `tests/integration/appointments.booking.test.ts`.
- Alternativas evaluadas: `04-diseno/adr-002-validacion-antes-persistencia.md`.

> **Limitación conocida de v1:** el bloqueo compara la **hora de inicio**. Dos turnos de la misma profesional que empiezan a horas distintas pero se pisan por duración (ej. 16:00 de 90 min y 16:30) todavía no se detectan.

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | 24.x |
| API | Express | 5.x |
| ORM | Prisma | 6.x |
| Base de datos | PostgreSQL | 16 o superior |
| Validación | Zod | 4.x |
| Tests backend | Vitest + Supertest | 5.x / 7.x |
| Autenticación | JWT en cookies httpOnly | — |
| Frontend | React + Vite | 19.x / 8.x |
| Estilos | Tailwind CSS | 4.x |
| CI | GitHub Actions | — |

---

## 3. Requisitos previos

Funciona en Windows, macOS y Linux. Necesitás tener instalado:

| Programa | Versión | Cómo verificar |
|---|---|---|
| Git | 2.x | `git --version` |
| Node.js | 24.x (incluye npm 11) | `node --version` |
| PostgreSQL | 16 o superior, corriendo en tu máquina | `psql --version` |

Además, un usuario y contraseña de PostgreSQL con permiso para crear bases (en una instalación por defecto, el usuario `postgres`).

> No hace falta ninguna cuenta externa (Mercado Pago, Supabase, Sentry, mail) para correr el caso de uso vertical.

---

## 4. Instalación paso a paso

Todos los comandos se escriben en una terminal. En Windows sirve Git Bash o PowerShell.

### 4.1 Clonar los dos repositorios en la etiqueta v1

Crear una carpeta vacía, entrar y clonar ambos repos **uno al lado del otro**:

```bash
mkdir nexa && cd nexa

git clone https://github.com/emilykohler12/nexa-backend.git
git clone https://github.com/emilykohler12/nexa-frontend.git

cd nexa-backend  && git checkout v1 && cd ..
cd nexa-frontend && git checkout v1 && cd ..
```

Queda así:

```
nexa/
├── nexa-backend/
└── nexa-frontend/
```

> `git checkout v1` muestra un aviso de *"detached HEAD"*: es normal, significa que estás parado en la versión etiquetada.

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
46 migrations found in prisma/migrations
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
[jobs] scheduler iniciado — ...
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
VITE v8.x  ready in ... ms
➜  Local:   http://localhost:5173/
```

Abrir **http://localhost:5173** en el navegador.

---

## 6. Prueba del caso de uso vertical (punta a punta)

### 6.1 Crear una cuenta de clienta

1. En http://localhost:5173 ir a **Ingresar** → pestaña **Registro**.
2. Completar nombre, email (ej. `maria@test.local`), teléfono, contraseña (ej. `Maria1234!`) y aceptar los términos.
3. Registrarse. No hace falta verificar el email para reservar.

### 6.2 Reservar un turno

1. Ir a **Mis turnos** → **+ Reservar nuevo turno**.
2. **Servicio:** elegir *Manicura semipermanente* → **Siguiente**.
3. **Profesional:** elegir *Loren (demo)* → **Siguiente**.
4. **Fecha:** elegir un día de lunes a sábado a partir de mañana. Aparecen los horarios libres; elegir uno → **Siguiente**.
5. **Confirmar:** se muestra el resumen (servicio, profesional, fecha, hora, total y seña) → **Confirmar reserva**.
6. Marcar *Acepto los Términos de Servicio y la Política de Privacidad* y elegir **Coordinar el pago por WhatsApp**. Se abre una pestaña de WhatsApp con un mensaje armado: se puede cerrar.
7. En *"Antes de terminar..."* elegir **Omitir por ahora**.

**Esperado:** en **Mis turnos** → *Próximos* aparece el turno con estado **Confirmado**, la fecha, la hora y el precio.

### 6.3 Validación: el horario ya ocupado no se puede volver a reservar

1. Volver a **Reservar nuevo turno**, mismo servicio, misma profesional y misma fecha.
2. **Esperado:** el horario reservado en 6.2 **ya no aparece** entre los disponibles.

Para comprobar que la regla vive en el backend y no solo en la pantalla, los tests automáticos (sección 7) mandan la misma reserva dos veces directo a la API y verifican que la segunda recibe **409** y no se guarda.

### 6.4 Verificar que el dato persiste en PostgreSQL

```bash
psql -U postgres -d nexa_dev -c "SELECT date, time, status, payment_status FROM appointments ORDER BY created_at DESC;"
```

**Esperado:** una fila por turno reservado, con `status = confirmed`. Si se reinicia el backend y se recarga **Mis turnos**, el turno sigue estando.

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
Test Files  15 passed (15)
     Tests  110 passed (110)
```

Los tests del caso de uso vertical están en `tests/integration/appointments.booking.test.ts`, entre ellos:
- *rechaza reservar el mismo horario dos veces con la misma profesional (slot conflict)*
- *permite la misma hora con OTRA profesional (el conflicto es por profesional, no global)*

### 7.2 Frontend

```bash
cd nexa-frontend
npm test
```

**Esperado:**

```
Test Files  8 passed (8)
     Tests  31 passed (31)
```

---

## 8. Canal de construcción (CI)

Cada push a `main` corre GitHub Actions en los dos repos. El registro de corridas está en:

- Backend: https://github.com/emilykohler12/nexa-backend/actions/workflows/ci.yml
- Frontend: https://github.com/emilykohler12/nexa-frontend/actions/workflows/ci.yml

| Repo | Pasos |
|---|---|
| Backend | `npm ci` → `prisma generate` + `migrate deploy` (sobre un PostgreSQL de CI) → type-check → tests → build |
| Frontend | `npm ci` → type-check → tests → build → lint |

---

## 9. Build de producción

```bash
cd nexa-backend  && npm run build   # genera dist/
cd nexa-frontend && npm run build   # genera dist/
```

---

## 10. Solución de problemas

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
