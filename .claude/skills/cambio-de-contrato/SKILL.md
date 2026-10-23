---
name: cambio-de-contrato
description: Checklist para cuando cambia una ruta, un método, un código de error o la forma de una respuesta de la API. Actualiza la documentación, busca con grep qué archivos de ../nexa-frontend/src consumen esa ruta (sin editarlos) y revisa los tests. Usar siempre antes de dar por terminado un cambio que el frontend pueda notar.
---

# Cambio de contrato con el frontend

`nexa-frontend` (React + Vite, en `../nexa-frontend`) consume esta API con cookies. La base es `VITE_API_URL` (por ejemplo `http://localhost:4000`, sin `/api`) y las rutas se escriben completas con el prefijo, por ejemplo `api.post('/api/auth/login')`. La mayoría de las llamadas están en `src/features/*/api/*.ts` y usan el cliente de `src/shared/utils/api`; unas pocas usan `fetch` directo (por ejemplo `AdminSidebar.tsx`). Es un contrato implícito: nada lo valida en CI, así que hay que revisarlo a mano.

**Es un cambio de contrato** si: cambia o se elimina una ruta o un método, un parámetro de path, query o body (nombre, tipo, obligatoriedad), la forma o los nombres de campos de una respuesta, un status HTTP o un `code` de error, un cookie, o las reglas que hacen que antes pasara y ahora no (por ejemplo `OUT_OF_HOURS`, `PROFESSIONAL_SLOT_TAKEN`).

## 1. Describir el cambio

Anotá en una tabla: ruta y método, **antes**, **después**, y si es compatible hacia atrás (agregar un campo opcional a la respuesta lo es; quitar o renombrar no).

## 2. Buscar quién lo consume en el frontend (solo leer)

Usá la herramienta Grep sobre `../nexa-frontend/src` (no edites nada del frontend). Buscá:

- La ruta completa, por ejemplo `/api/client/appointments`, y también sin el prefijo (`/client/appointments`) y fragmentos de rutas con parámetros (`/appointments/${`).
- El `code` de error que cambia: por ejemplo `PROFESSIONAL_SLOT_TAKEN`, `OUT_OF_HOURS`.
- Los nombres de campos de la respuesta que se renombran o se quitan.
- Los tipos o interfaces del frontend que modelan esa respuesta (buscar el nombre del campo en `*.ts` y `*.tsx`).
- Mocks y tests del frontend que reproducen la respuesta (`../nexa-frontend/tests`).

Listá cada hallazgo como `archivo:línea` y qué hace con la ruta o el campo. Si no encontrás nada, decí qué términos buscaste.

## 3. Avisar

Entregá a Emily un resumen con: el cambio, si rompe al frontend actual, la lista de archivos del frontend afectados y qué habría que cambiar en cada uno. Ofrecé el orden de despliegue: backend compatible primero (acepta lo viejo y lo nuevo), frontend después, y recién ahí quitar lo viejo. Backend en Render y frontend en Vercel se despliegan por separado, así que habrá un rato en que conviven versiones distintas.

## 4. Documentación

Buscá dónde se menciona la ruta o el código en el backend: `README.md`, `00-gestion/`, `03-requisitos/`, `04-diseno/` (usar Grep sobre esos directorios). Proponé los cambios exactos a Emily, y editá solo `README.md` si ella lo confirma. La documentación académica y de gestión (`00-gestion/` a `05-entregas/`) no se edita sin que lo pida. Si cambia una regla documentada en un ADR, señalalo.

## 5. Tests

- Actualizá o agregá tests en `tests/integration/` que cubran el contrato nuevo: status, `code` de error y forma de la respuesta (podés delegar en el subagente `escritor-tests`).
- Si hay un test que pasaba y dejó de pasar por el cambio, no lo relajes sin entender por qué: confirmá que el cambio de contrato es intencional.
- Compatibilidad: si mantenés la ruta vieja un tiempo, que tenga su test.

## 6. Cierre

1. `npm run typecheck:all`
2. `npm test` (necesita el PostgreSQL de pruebas)
3. Registrá el cambio de contrato (ruta, antes, después, archivos del frontend afectados) en la bitácora o en el mensaje de commit que Emily pida.
