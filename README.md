# Nexa — Sistema de Gestión de Turnos para Estudio de Belleza (Prototipo v1)

Creado por: Emily Noralí Kohler

## 1. Qué Hace Este Prototipo

### Caso de Uso Vertical Implementado

**Reserva de turno con validación de disponibilidad en tiempo real:**

Una clienta se registra en la plataforma, selecciona un servicio (ej: "Depilación definitiva — 90 min") y una profesional disponible. El sistema valida en tiempo real que:
- La profesional no tenga otro turno confirmado en el mismo horario (RF-01)
- El horario respete el rango de atención del estudio (RF-02)
- El servicio esté activo y disponible (RF-03)

Si la validación falla, el sistema rechaza la reserva con un mensaje de error específico. Si pasa, se crea la cita con estado `confirmed`, se guarda en PostgreSQL, y se envía una notificación por WhatsApp a la profesional.

### Decisión Arquitectónica Probada

**Validación de disponibilidad antes de persistencia:** La capa de lógica de negocio (`appointment.service.ts`) ejecuta todas las reglas de validación ANTES de llamar a `prisma.appointment.create()`. Esto garantiza que la base de datos nunca contenga turnos conflictivos, aunque falle la interfaz. La prueba se encuentra en `/tests/integration/appointments.booking.test.ts`.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Backend** | Node.js | 24.17.0 |
| **Runtime** | Express.js | 4.x |
| **Base de Datos** | PostgreSQL | 18.4 |
| **ORM** | Prisma | 6.x |
| **Validación** | Zod | 3.x |
| **Testing** | Vitest + Supertest | 5.x / 1.x |
| **Autenticación** | JWT (HS256) | - |
| **CI/CD** | GitHub Actions | - |
| **Frontend** | React | 18.x |
| **Styling** | CSS3 + Tailwind | - |

---

## 3. Requisitos Previos

**Sistemas operativos soportados:** Windows, macOS, Linux

**Software requerido:**

```bash
# Verificar versiones instaladas:
node --version        # Debe ser v24.17.0+
npm --version         # Debe ser 11.13.0+
git --version         # Debe ser 2.x+
psql --version        # PostgreSQL 18.4+ (opcional si usas Supabase)
```

**Dependencias:**
- Git (para clonar repositorios)
- npm (incluido con Node.js)
- PostgreSQL (local O Supabase cloud)

---

## 4. Instalación Rápida (10 minutos)

### 5.1 Clonar repositorio

```bash
# Backend
git clone https://github.com/emilykohler12/nexa-backend.git
cd nexa-backend

# Frontend (en carpeta hermana)
git clone https://github.com/emilykohler12/nexa-frontend.git ../nexa-frontend
```

### 5.2 Instalar dependencias

```bash
# Backend (desde nexa-backend/)
npm install

# Frontend (desde nexa-frontend/)
cd ../nexa-frontend
npm install
```

### 5.3 Crear archivo .env (Backend)

Crear archivo `.env` en la raíz de `nexa-backend/`:

```bash
# Base de datos (elige UNA opción)

# Opción A: PostgreSQL local
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nexa_dev"

# Opción B: Supabase cloud (recomendado)
DATABASE_URL="postgresql://[usuario]:[contraseña]@[host].supabase.co:5432/postgres"

# JWT (genera strings aleatorios de 32+ caracteres)
JWT_SECRET="tu_jwt_secret_super_largo_aqui_minimo_32_caracteres_1234567890"
JWT_REFRESH_SECRET="tu_refresh_secret_distinto_aqui_minimo_32_caracteres_1234567890"

# URLs
FRONTEND_URL="http://localhost:5173"

# Admin inicial (para seeding)
ADMIN_EMAIL="admin@nexa.local"
ADMIN_PASSWORD="Admin1234!"
ADMIN_NAME="Admin"

# Mercado Pago (opcional, ver sección 6.4)
MERCADOPAGO_ACCESS_TOKEN="TEST-tu-token-aqui"
```

### 5.4 Crear archivo .env.local (Frontend)

Crear archivo `.env.local` en la raíz de `nexa-frontend/`:

```bash
VITE_API_URL="http://localhost:3000"
```

⚠️ **IMPORTANTE:** Nunca commitear archivos `.env` reales. Usar `.env.example` como plantilla.

### 5.5 Crear base de datos y ejecutar migraciones

```bash
# Desde nexa-backend/
npx prisma migrate dev
```

Esto:
- Crea la base de datos (si no existe)
- Ejecuta todas las migraciones SQL
- Genera el cliente de Prisma
- Ejecuta el seed inicial (si existe)

**Esperado:**
```
✔ Prisma schema loaded
✔ Data source "db": postgresql://...
✔ Migrations to apply: 15
✔ Ran all pending migrations
```

---

## 5. Ejecutar la Aplicación

### 6.1 Backend (Terminal 1)

```bash
cd nexa-backend
npm run dev
```

**Esperado:**
```
✓ Backend listening on http://localhost:3000
✓ Database connection OK
✓ Ctrl+C to stop
```

### 6.2 Frontend (Terminal 2)

```bash
cd nexa-frontend
npm run dev
```

**Esperado:**
```
VITE v5.0.1 ready in 234 ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

### 6.3 Abrir en navegador

```
http://localhost:5173
```

---

## 6. Prueba del Caso de Uso Vertical

### 7.1 Crear cuenta de cliente

1. Ir a `http://localhost:5173` → **Registro**
2. Rellenar:
   - Nombre: `María Test`
   - Email: `maria@test.local`
   - Teléfono: `+5493764123456`
   - Contraseña: `Maria1234!`
   - Género: `Femenino`
3. Aceptar términos
4. Clic en **Registrarse**

**Esperado:** Redirige a `/client` con mensaje "Bienvenida, María"

### 7.2 Reservar un turno

1. Clic en **Reservar Turno**
2. Seleccionar:
   - Servicio: `Depilación definitiva` (90 min, $50.000)
   - Profesional: `Loren` (primera disponible)
   - Fecha: `mañana` (cualquier día siguiente)
   - Hora: `10:00` (o cualquier hora de atención)
3. Clic en **Siguiente**

**Esperado:** Se muestra resumen del turno (fecha, hora, profesional, precio)

### 7.3 Confirmar reserva (Caso Exitoso)

1. Aceptar **Política de cancelación** (12 horas mínimo)
2. Seleccionar método de depósito: **WhatsApp**
3. Clic en **Confirmar Reserva**

**Esperado:**
- ✅ Notificación verde: "Turno reservado"
- ✅ Turno aparece en `/client/appointments` con estado `Confirmado`
- ✅ WhatsApp a Loren: "_María Test reservó Depilación definitiva para [fecha] a las [hora]_"

### 7.4 Validación: Horario ya Ocupado

1. Volver a **Reservar Turno**
2. Seleccionar **EL MISMO HORARIO, LA MISMA PROFESIONAL**
3. Clic en **Siguiente** → **Confirmar**

**Esperado:**
- ❌ Mensaje de error: "Este horario ya está ocupado"
- ❌ Turno NO se crea
- ❌ Usuario regresa al formulario

**Verificación técnica (opcional):**

Desde terminal, conectarse a PostgreSQL:

```bash
psql $DATABASE_URL

# Ver turnos creados
SELECT id, "clientId", "professionalId", date, time, status 
FROM "Appointment" 
ORDER BY "createdAt" DESC;

# Debe mostrar solo 1 turno con el mismo horario
```

---

## 7. Ejecutar Tests

### 8.1 Tests Backend

```bash
cd nexa-backend
npm test
```

**Esperado:**
```
Test Files  14 passed (14)
Tests  108 passed (108)
Duration  23.04s
```

**Tests del caso de uso vertical:**
- `appointments.booking.test.ts` — 15 tests (validación, disponibilidad, errores)
- `appointments.combo.test.ts` — Servicios simultáneos
- `orders.test.ts` — Compra de productos

### 8.2 Tests Frontend

```bash
cd nexa-frontend
npm test
```

**Esperado:**
```
Test Files  8 passed (8)
Tests  31 passed (31)
Duration  2.76s
```

---

## 8. Build y Despliegue

### 9.1 Build Backend

```bash
npm run build
```

Genera `/dist/` listo para Render o Railway.

### 9.2 Build Frontend

```bash
npm run build
```

Genera `/dist/` listo para Vercel o Netlify.

---

## 9. CI/CD (GitHub Actions)

### 10.1 Pipeline Backend

**Archivo:** `.github/workflows/ci.yml`

**Pasos:**
1. Checkout código
2. Setup Node.js v24
3. npm ci (install limpio)
4. Prisma generate + migrate
5. Type-check
6. Tests (Vitest)
7. Build

**Última corrida:**
- ✅ 2026-09-24 23:11:28 UTC
- ✅ 108 tests pasando
- 🔗 Ver: https://github.com/emilykohler12/nexa-backend/actions

### 10.2 Pipeline Frontend

**Archivo:** `.github/workflows/ci.yml`

**Pasos:**
1. Checkout
2. Setup Node.js v24
3. npm ci
4. Type-check
5. Tests
6. Build
7. Lint (no-blocking)

**Última corrida:**
- ✅ 2026-09-24 23:11:54 UTC
- ✅ 31 tests pasando
- 🔗 Ver: https://github.com/emilykohler12/nexa-frontend/actions

---

## 10. Solución de Problemas

### Error: `DATABASE_URL is not defined`

```bash
# Verificar que .env existe
ls -la .env

# Si no existe, crear desde .env.example
cp .env.example .env
```

### Error: `ECONNREFUSED 127.0.0.1:5432`

PostgreSQL no está corriendo:

```bash
# Opción 1: Usar Supabase (recomendado)
# Copiar DATABASE_URL de https://supabase.com/

# Opción 2: Iniciar PostgreSQL localmente
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Windows (en pgAdmin o Services)
# Iniciar servicio "PostgreSQL X.x"
```

### Error: `Port 3000 already in use`

```bash
# Matar proceso en puerto 3000
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# O cambiar puerto en .env
SERVER_PORT=3001
```

### Tests timeoutean

Aumentar timeout en `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    testTimeout: 10000, // 10 segundos
  }
})
```

---

**Versión:** 1.0.0  
**Última actualización:** 2026-09-25  
**Estado:** ✅ Prototipo funcional — 108/108 tests pasando
