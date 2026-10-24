# ADR-003: Autenticación con JWT en cookies httpOnly

**Fecha:** 2026-09-16 (reescrito el 2026-10-24 para que describa el código real)
**Estado:** ACEPTADO
**Impacto:** ALTO (autenticación y autorización)

> **Nota de revisión (2026-10-24).** La versión anterior de este ADR decía que el
> token se guardaba en `localStorage` y viajaba en el header
> `Authorization: Bearer`, que el CSRF "no aplicaba" y citaba archivos que no
> existen (`src/app/middlewares/auth.ts`, `tests/integration/auth.login.test.ts`,
> `verifyJWT()`). Nada de eso estaba en el código: las cookies `httpOnly` se
> usan desde el commit inicial (`98c15ea`, 2026-08-25). Esta versión documenta lo
> que hace el sistema, incluidas sus limitaciones. Las referencias a líneas son
> de la fecha de la revisión y pueden moverse.

---

## 1. Contexto

La API tiene tres roles (`client`, `professional`, `admin`) y necesita
autenticarlos con sesiones que expiren, sin guardar una sesión por request en
el servidor, con el frontend (Vercel) y el backend (Render) en dominios
distintos.

Requisitos:
- Un token de acceso de vida corta y un mecanismo para renovar la sesión sin
  volver a pedir la contraseña.
- Que un robo de datos del navegador por XSS no entregue el token.
- Funcionar con HTTPS en producción y con HTTP en desarrollo.

---

## 2. Alternativas evaluadas

### A — Sesiones en el servidor (id de sesión guardado en base o en Redis)

**Ventajas:** revocación inmediata, modelo conocido.
**Descartada:** exige una consulta a la base en cada request o un almacén
compartido, y el proyecto corre una sola instancia con presupuesto acotado
(ADR-001), sin Redis.

### B — JWT en `localStorage` con header `Authorization: Bearer`

**Ventajas:** no depende de cookies ni de la política `SameSite`, y no hay
CSRF por construcción.
**Descartada:** cualquier script inyectado (XSS) puede leer el token y
llevárselo. La API maneja datos personales de clientas, y con cookies
`httpOnly` el JavaScript de la página no puede leer el token.

### C — JWT en cookies `httpOnly` ✅

El backend firma los tokens y los entrega como cookies que el navegador manda
solo; el frontend nunca los ve ni los guarda.

**Ventajas:** el token no es legible por JavaScript; el frontend no maneja
tokens; verificar el acceso no consulta la base.
**Desventajas:** al ser frontend y backend de sitios distintos hace falta
`SameSite=None`, lo que reintroduce el riesgo de CSRF y obliga a controlarlo
(ver 5); el access token no se puede revocar antes de que expire.

---

## 3. Decisión

**Opción C.** Dos JWT firmados con HS256 y secretos distintos:

| | Access token | Refresh token |
|---|---|---|
| Cookie | `access_token` | `refresh_token` |
| Secreto | `JWT_SECRET` | `JWT_REFRESH_SECRET` |
| Duración | `JWT_EXPIRES_IN`, por defecto 15 min | `JWT_REFRESH_EXPIRES_IN`, por defecto 7 días |
| Ruta de la cookie | `/` | `/api/auth/refresh` (solo viaja a esa ruta) |
| Contenido | `sub` (id), `email`, `role` | igual |
| Dónde se verifica | cada request protegido, solo con la firma | `POST /api/auth/refresh`, contra la firma **y** contra la base |

Ambos secretos son obligatorios y de al menos 32 caracteres
(`src/app/config/env.ts`; si faltan, el proceso no arranca).

Atributos de las cookies (`auth.controller.ts:19`): `httpOnly` siempre. En
producción `secure` y `sameSite=none` (necesario para que el navegador mande la
cookie entre dominios; `none` exige `secure`). En desarrollo `sameSite=lax` y
sin `secure`.

---

## 4. Cómo funciona

### 4.1 Emisión
`register` y `login` (`auth.service.ts:97` y `:110`) generan el par con
`generateTokens()` (`utils/generateTokens.ts`), guardan el refresh token en la
columna `users.refresh_token` y el controller lo entrega con `setTokenCookies()`
(`auth.controller.ts:25`). El login responde el mismo error
`INVALID_CREDENTIALS` si el email no existe o si la contraseña no coincide, para
no revelar qué cuentas existen. Las contraseñas se guardan con bcrypt.

### 4.2 Request protegido
`authenticate` (`middleware/auth.middleware.ts:8`) lee la cookie `access_token`,
verifica la firma y la expiración, y deja `req.user = { id, email, role }`.
Responde `401 NO_TOKEN` o `401 INVALID_TOKEN`. **No consulta la base.**
`authorize(...roles)` (`:21`) y `requireRole(...roles)` (`guest.middleware.ts`)
comparan el rol con la lista permitida y responden `403 FORBIDDEN`.
(`guestOnly`, que rechazaría el registro y el login con una sesión activa, está
definido en `guest.middleware.ts` pero ninguna ruta lo usa.)

### 4.3 Renovación
`POST /api/auth/refresh` lee la cookie `refresh_token`, la busca en la base
(`findByRefreshToken`, solo usuarios activos) y verifica su firma. Si está
vencida limpia el token guardado y responde `401 INVALID_REFRESH_TOKEN`. Si es
válida emite un par nuevo y lo guarda: el refresh token se **rota** en cada uso,
así que uno ya usado deja de servir.

### 4.4 Cierre de sesión e invalidación
- `logout` borra el refresh token guardado y las dos cookies.
- Cambiar o restablecer la contraseña también borra el refresh token
  (`auth.repository.ts:117`), lo que cierra la sesión en cualquier dispositivo
  al vencer el access token.
- Hay **un solo refresh token por usuario**: iniciar sesión en otro dispositivo
  reemplaza al anterior y cierra la renovación de la sesión anterior.

---

## 5. Consecuencias y riesgos conocidos

**Positivas**
- El JavaScript de la página no puede leer los tokens.
- Verificar el acceso es una operación local, sin consulta a la base.
- La ventana de exposición de un access token robado es de 15 minutos.

**Negativas / a tener en cuenta**
1. **El access token no se revoca.** Cerrar sesión, desactivar una cuenta o
   cambiar el rol de una usuaria no corta los access tokens ya emitidos: valen
   hasta 15 minutos. Aceptado por el tamaño del sistema; la renovación sí se
   corta de inmediato.
2. **El refresh token se guarda en texto plano** en `users.refresh_token`. Quien
   lea la base podría usarlo hasta que venza. Mitigación posible: guardar solo un
   hash.
3. **Una sola sesión renovable por usuario** (ver 4.4).
4. **CSRF.** Con `SameSite=None` el navegador manda la cookie en pedidos
   iniciados desde otro sitio. CORS (`origin` fijo en `FRONTEND_URL`) impide que
   otro sitio *lea* las respuestas, pero no impide que *envíe* un pedido simple.
   Hoy no hay un token anti-CSRF y `app.ts:67` mantiene activo
   `express.urlencoded`, por lo que un formulario HTML de otro sitio podría
   disparar un `POST` con la cookie de la usuaria. **Pendiente de revisar**: la
   mitigación mínima es quitar ese parser (el frontend envía JSON) para que las
   mutaciones solo acepten `application/json`, que obliga a una verificación
   previa de CORS.
5. **El login no exige email verificado**, y la verificación no limita ninguna
   ruta; no encontré esa comprobación en `auth.service.ts`.
6. **`POST /api/auth/change-password` no pide la contraseña actual**
   (`auth.controller.ts:126`): alcanza con una sesión activa. Quien consiga un
   access token vigente (15 minutos) podría cambiar la contraseña y, como eso
   borra el refresh token, dejar fuera a la dueña. Mitigación posible: exigir la
   contraseña actual.
7. El **login social** (Google/Facebook) figura en el RUNBOOK como retirado:
   `auth.routes.ts` ya no expone esas rutas, aunque quedan el DTO y el provider
   sin uso.

**Límites de velocidad:** `register`, `forgot-password` y `reset-password` tienen
un límite de 10 intentos cada 15 minutos; `login`, 20 intentos cada 5 minutos
(`auth.routes.ts`). En test están desactivados.

---

## 6. Tests

| Archivo | Qué cubre |
|---|---|
| `tests/integration/auth.test.ts` | Registro con cookies de sesión y validaciones (email repetido, sin apellido, sin teléfono, sin términos); login correcto, con contraseña incorrecta, de usuario inexistente y de usuario inactivo; `/me` con y sin cookie y con token inválido; una clienta y una profesional no entran a rutas de admin |
| `tests/helpers/auth.ts` | `cookieFor()` firma un `access_token` válido para el resto de los tests |

**Sin cobertura hoy:** `POST /api/auth/refresh`, `logout`, el cambio de
contraseña, y las propiedades de las cookies (`httpOnly`, `secure`, `sameSite`).
Son los casos que más conviene agregar.

---

## 7. Alternativa futura: OAuth2 / login social

Si se vuelve a ofrecer el login con Google o Facebook, el backend debe verificar
el token del proveedor del lado del servidor y emitir **su propio** par de
cookies con el mismo formato descrito acá.

---

**Revisado por:** Emily Kohler
**Fecha de la revisión:** 2026-10-24
