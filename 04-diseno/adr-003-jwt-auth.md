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
>
> **Actualización del mismo día (2026-10-24).** Una revisión de seguridad de la
> autenticación llevó a tres cambios, descritos en 4.4 y 5: el refresh token se
> guarda como hash, `logout` funciona con el access token vencido, y los pedidos
> que cambian datos con un `Origin` ajeno se rechazan (CSRF). Quedan abiertos
> los demás riesgos de la sección 5.

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
- `logout` borra el refresh token guardado y las dos cookies. **No exige una
  sesión vigente** (desde el 2026-10-24): si el access token ya venció, la
  usuaria se identifica por la firma del token (se ignora solo el vencimiento) y
  la sesión se cierra igual. Un token ausente o falsificado no cierra la sesión
  de nadie, y la respuesta es siempre 200 con las cookies limpias.
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
2. ~~El refresh token se guardaba en texto plano.~~ **Corregido el 2026-10-24:**
   `users.refresh_token` guarda el SHA-256 del token (`auth.repository.ts`), por
   lo que un backup filtrado no permite abrir sesiones. Durante una transición
   de 7 días se sigue aceptando un token guardado en texto plano (el siguiente
   refresh lo pasa a hash); pasado ese plazo hay que quitar esa segunda
   condición de `findByRefreshToken`. Además los tokens llevan `jti`, por lo que
   dos emitidos en el mismo segundo ya no son idénticos.
3. **Una sola sesión renovable por usuario** (ver 4.4).
4. **CSRF** (mitigado el 2026-10-24). Con `SameSite=None` el navegador manda la
   cookie en pedidos iniciados desde otro sitio, y CORS (`origin` fijo en
   `FRONTEND_URL`) impide *leer* las respuestas pero no *enviar* un pedido
   simple. Antes, un formulario HTML de otro sitio podía cambiar la contraseña
   de una usuaria logueada o, contra una admin, invitar a un profesional. Ahora:
   (a) se quitó `express.urlencoded`, así que la API no interpreta formularios;
   (b) `middlewares/trustedOrigin.ts` rechaza con `403 FORBIDDEN_ORIGIN` todo
   pedido que cambia datos (no GET/HEAD/OPTIONS) cuya cabecera `Origin` no sea la
   del frontend. Los navegadores siempre envían `Origin` en esos pedidos y un
   sitio no puede falsearla; los pedidos sin `Origin` (webhook de Mercado Pago,
   `curl`, tests) pasan porque no arrastran la sesión de un navegador. No se
   agregó un token anti-CSRF. Riesgo que queda: un navegador que no envíe
   `Origin`, algo que los navegadores actuales no hacen en pedidos que cambian
   datos.
5. **El login no exige email verificado**, y la verificación no limita ninguna
   ruta; no encontré esa comprobación en `auth.service.ts`.
6. ~~`POST /api/auth/change-password` no pedía la contraseña actual.~~
   **Corregido el 2026-10-24:** ahora exige `currentPassword` y la compara con
   bcrypt. Si es incorrecta responde `400 INVALID_CURRENT_PASSWORD` (no 401:
   el frontend desloguea ante cualquier 401). La ruta tiene además el límite de
   10 intentos cada 15 minutos por IP. Cuerpo: `{ currentPassword, password }`.
   Cambia el contrato; los formularios del admin y de la profesional se
   actualizaron en `nexa-frontend` (rama `feat/seguridad-login-contrasenas`).
7. ~~El código de recuperación se buscaba solo por su valor.~~ **Corregido el
   2026-10-24:** `POST /api/auth/reset-password` recibe `{ email, token, password }`
   y busca el código **de esa cuenta** (`findPasswordReset(userId, token)`); un
   email inexistente y un código incorrecto dan el mismo `400 INVALID_TOKEN`.
   Los intentos **fallidos** se limitan a 5 cada 15 minutos por email
   (`429 TOO_MANY_ATTEMPTS`; los exitosos no cuentan; el límite está activo
   también en test). El código se consume con una escritura condicional, por lo
   que dos pedidos simultáneos no pueden usarlo los dos, y si al generarlo
   coincide con el de otra usuaria se sortea otro en vez de devolver un 500.
   Contrapartida: quien envíe 5 códigos erróneos con el email de otra persona la
   deja 15 minutos sin poder recuperar la contraseña. El código sigue guardado en
   texto plano (dura 15 minutos y se invalida al usarse o al pedir uno nuevo).
   **Ajustes menores del mismo día (2026-10-24):** (a) un `POST /api/auth/refresh`
   fallido borra las cookies de sesión; (b) el login con un email inexistente
   ejecuta igual la comparación de bcrypt, y `forgot-password` ya no espera el
   envío del mail, para no revelar por el tiempo de respuesta qué cuentas existen
   (`register` sigue respondiendo `EMAIL_TAKEN`, decisión de usabilidad); (c) las
   invitaciones no pisan una cuenta admin (`409 ADMIN_ACCOUNT`) ni chocan con una
   desactivada (`409 ACCOUNT_INACTIVE`), se consumen de forma atómica y entregan
   las dos cookies sin devolver el access token en el cuerpo; (d) los emails se
   guardan en minúsculas y se buscan sin distinguir mayúsculas; (e) el rol solo
   alterna entre profesional y administradora (`400 INVALID_ROLE_CHANGE`); (f) el
   perfil de la clienta valida nombre (máx. 100) y teléfono (máx. 20); (g) el email
   ya no se escribe en los logs de recuperación.
8. El **login social** (Google/Facebook) figura en el RUNBOOK como retirado:
   `auth.routes.ts` ya no expone esas rutas, aunque quedan el DTO y el provider
   sin uso.

**Límites de velocidad:** `register`, `forgot-password`, `reset-password` y
`change-password` tienen un límite de 10 intentos cada 15 minutos por IP; `login`,
20 intentos cada 5 minutos (`auth.routes.ts`). En test están desactivados. El
límite por email de `reset-password` (punto 7) sí está activo en test.

---

## 6. Tests

| Archivo | Qué cubre |
|---|---|
| `tests/integration/auth.test.ts` | Registro con cookies de sesión y validaciones (email repetido, sin apellido, sin teléfono, sin términos); login correcto, con contraseña incorrecta, de usuario inexistente y de usuario inactivo; `/me` con y sin cookie y con token inválido; una clienta y una profesional no entran a rutas de admin |
| `tests/integration/auth.security.test.ts` | CSRF (formulario de otro sitio, `Origin` ajeno o `null`, pedidos sin `Origin`, formularios ya no interpretados); `logout` con el access token vencido, sin cookies, con token vigente y con token falsificado; refresh token guardado como hash, rotación, reutilización y transición del formato viejo |
| `tests/integration/auth.password.test.ts` | Cambio de contraseña con contraseña actual (falta, incorrecta, correcta, sin sesión); recuperación con email y código (correcto, otra cuenta, email inexistente, código usado, vencido, uso simultáneo, límite de intentos por email, colisión de códigos) |
| `tests/integration/auth.minor-fixes.test.ts` | Emails en minúsculas (alta del admin y turno manual), cambio de rol, invitaciones (cuenta admin, cuenta desactivada, registros simultáneos, cookies sin access token en el cuerpo, clienta existente), refresh fallido que limpia cookies y validación del perfil de la clienta |
| `tests/helpers/auth.ts` | `cookieFor()` firma un `access_token` válido para el resto de los tests |

**Sin cobertura hoy:** las propiedades de las cookies (`httpOnly`, `secure`,
`sameSite`), que dependen de `NODE_ENV=production`.

---

## 7. Alternativa futura: OAuth2 / login social

Si se vuelve a ofrecer el login con Google o Facebook, el backend debe verificar
el token del proveedor del lado del servidor y emitir **su propio** par de
cookies con el mismo formato descrito acá.

---

**Revisado por:** Emily Kohler
**Fecha de la revisión:** 2026-10-24
