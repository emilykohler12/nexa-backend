---
name: nuevo-modulo
description: Crea un módulo nuevo bajo src/modules con la misma estructura que los existentes (routes, controller, service), validación con zod, rutas registradas en src/app/routes.ts, autorización por rol y por dueña del recurso, y tests de integración. Usar cuando haya que agregar un recurso o conjunto de endpoints nuevo a la API.
---

# Nuevo módulo de la API

Los módulos de este repo **no son uniformes**. No inventes una estructura: copiá la de un vecino del mismo tamaño. Referencias reales:

- Chico y completo: `src/modules/reviews/` (`review.routes.ts`, `review.controller.ts`, `review.service.ts`) y `src/modules/specialEvents/` (`routes`, `controller`, `model` con Prisma directo).
- Con DTOs, repositorio y middlewares: `src/modules/auth/`, `src/modules/invitations/`.

Antes de empezar leé `CLAUDE.md` y dos módulos de esos. Si el pedido es ambiguo (qué roles acceden, qué datos guarda, si toca el schema), preguntá antes de escribir.

## Pasos

1. **Definir el contrato**: rutas, métodos, rol que accede a cada una (`client`, `professional`, `admin` o público), cuerpo y respuesta, y códigos de error. Si hay tablas nuevas o columnas nuevas, primero seguí la skill `nueva-migracion`.
2. **Crear la carpeta** `src/modules/<nombre>/` con el archivo por capa que corresponda, nombrados `<singular>.routes.ts`, `<singular>.controller.ts`, `<singular>.service.ts` (o `.model.ts` si el vecino lo usa para acceso a Prisma). Usá `prisma` desde `src/app/database/prisma`.
3. **Controller**:
   - Esquema zod arriba del archivo. Para fechas y horas usá `dateSchema` y `timeSchema` de `src/app/validators/datetime.ts`. IDs con `z.string().uuid()`.
   - Un helper `parseBody`/`validate` que lance `new AppError(HTTP.BAD_REQUEST, mensaje, 'VALIDATION_ERROR')` (400, como casi todos los módulos).
   - Cada handler en `try { … } catch (err) { next(err) }`. Nunca responder `err.message` de Prisma: el `errorHandler` ya devuelve un 500 genérico.
   - El usuario sale de `req.user!` (`id`, `email`, `role`), nunca del body ni de la query.
   - Respuestas JSON con claves explícitas (`res.json({ review })`), sin devolver el objeto Prisma crudo si tiene campos sensibles (`passwordHash`, tokens, notas internas).
   - Errores con `AppError(HTTP.X, 'mensaje en español', 'CODIGO_EN_MAYUSCULAS')`. Las constantes salen de `src/app/constants/http.ts`.
4. **Service**: la lógica de negocio y el acceso a datos. Operaciones de varios pasos dentro de `prisma.$transaction`. Si dependés de unicidad, apoyate en un índice único y traducí el error, como hace R-01, en lugar de consultar antes.
5. **Routes**: `Router()` con `authenticate` y `authorize('rol')` (de `auth/middleware/auth.middleware.ts`) o `requireRole` (de `guest.middleware.ts`), el que use el módulo vecino. Toda ruta que no sea pública lleva `authenticate`. Exportá `export { router as <nombre>Routes }`.
6. **Registrar** el router en `src/app/routes.ts`: import arriba y `router.use('/<ruta>', <nombre>Routes)` abajo, respetando el estilo de alineación del archivo. Todo queda bajo `/api`.
7. **Aislamiento**: este sistema es **single-tenant por despliegue** (ADR-001), así que no agregues `tenantId` ni `businessId`. Lo que sí tenés que garantizar es la pertenencia al usuario: una clienta solo accede a sus recursos (`where: { id, clientId: <la de req.user> }`), una profesional solo a los suyos, y el admin al conjunto. Devolvé 404 (o 403 según el vecino) cuando el recurso no es suyo.
8. **Tests** en `tests/integration/<nombre>.test.ts` (podés delegar en el subagente `escritor-tests`). Mínimo: camino feliz, 401 sin sesión, 403 con rol incorrecto, recurso de otra usuaria, validación inválida y la regla de negocio principal. Si agregaste una tabla, sumala a `TABLES` en `tests/setup.ts`.
9. **Contrato con el frontend**: es un endpoint nuevo, así que avisá qué rutas y formas de respuesta expone para que se consuman desde `../nexa-frontend` (skill `cambio-de-contrato`, secciones de aviso).

## Verificación antes de terminar

- `npm run typecheck:all`
- `npm test` (necesita el PostgreSQL de pruebas)
- Revisá el diff buscando: ruta sin `authenticate`, `req.body` pasado directo a Prisma (mass assignment), `console.log` con datos personales, y secretos. Para un módulo que toque pagos, archivos o autenticación, usá el subagente `revisor-seguridad-api`.

## No hacer

- No crear archivos fuera de `src/modules/<nombre>/`, `src/app/routes.ts`, `tests/` y, si hace falta, `prisma/`.
- No tocar `src/generated/`, `dist/`, `package-lock.json` ni migraciones existentes (los hooks lo bloquean).
- No instalar dependencias.
