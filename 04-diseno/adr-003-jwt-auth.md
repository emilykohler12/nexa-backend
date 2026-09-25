# ADR-003: JWT para Autenticación Stateless

**Fecha:** 2026-09-16  
**Estado:** ACEPTADO  
**Impacto:** ALTO (Autenticación)

---

## 1. Contexto

La plataforma necesita autenticar usuarios (clientes, profesionales, admins) de forma segura y escalable.

**Requisitos:**
- Múltiples clientes simultáneos
- Sin estado en el servidor (stateless) → escalable horizontalmente
- Tokens que expiren
- Refresh tokens para mantener sesión sin revalidar credenciales
- HTTPS en producción (mandatory)

---

## 2. Alternativas

### A: Sesiones Basadas en Servidor (Traditional)

```
POST /login → crea SESSION en servidor → guardar en DB
GET /appointments → verificar SESSION en DB → si existe, OK
```

**Ventajas:**
- ✅ Revocación inmediata (borrar de DB)
- ✅ Bien entendido, simple

**Desventajas:**
- ❌ Requiere BD para cada request (hit a DB)
- ❌ Escalabilidad: si tengo 10 servidores, debo compartir sesiones (Redis)
- ❌ Logout requiere eliminar de DB (extra operación)

---

### B: Cookies + Sessions (Híbrido)

Similar a A pero guardando en cookies. Mismo problema de escalabilidad.

---

### C: JWT (JSON Web Tokens) ✅

```
POST /login 
  → generar JWT = base64(header.payload.signature)
  → retornar al cliente
  → cliente guarda en localStorage

GET /appointments 
  → incluye token en header: Authorization: Bearer <JWT>
  → servidor verifica firma criptográfica (sin BD)
  → si válido, procesa
```

**Ventajas:**
- ✅ Stateless (no necesita BD para verificar)
- ✅ Escalable (10 servidores, misma clave privada = mismo resultado)
- ✅ Revocación opcional (blacklist de tokens)
- ✅ Multi-dispositivo fácil
- ✅ Móvil-friendly (no cookies required)

**Desventajas:**
- ⚠️ Size: JWT es más largo que session ID
- ⚠️ Revocación: no es instantánea (token sigue válido hasta expiración)

---

## 3. Decisión

**SELECCIONAR: Opción C — JWT**

Con:
- **Access Token:** Corta vida (15 min) — para autenticación
- **Refresh Token:** Larga vida (7 días) — para renovar access token

---

## 4. Implementación

### Estructura JWT

```
Header: { alg: "HS256", typ: "JWT" }
Payload: { 
  sub: "user-id",
  role: "client",
  email: "maria@test.local",
  iat: 1695139200,
  exp: 1695142800  // 15 min desde ahora
}
Signature: HMAC-SHA256(secret)
```

### Flujo de Login

```typescript
// auth.controller.ts
async login(email, password) {
  1. Verificar email + password contra BD (bcrypt)
  2. Si correcto, generar JWT:
     - accessToken (15 min)
     - refreshToken (7 días)
  3. Guardar refreshToken en BD (con expiración)
  4. Retornar ambos tokens
  5. Cliente guarda en localStorage (accessToken)
}
```

### Flujo de Request Autenticado

```typescript
// middleware
function verifyToken(req) {
  const token = req.headers.authorization.split(" ")[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload
    next()
  } catch (err) {
    return res.status(401).json({ code: 'TOKEN_EXPIRED' })
  }
}
```

### Flujo de Refresh

```typescript
// POST /api/auth/refresh
async refresh(refreshToken) {
  1. Verificar refreshToken en BD
  2. Si válido y no expirado, generar nuevo accessToken
  3. Retornar nuevo accessToken
  4. Cliente lo usa para siguientes requests
}
```

---

## 5. Seguridad

### Protecciones Implementadas

| Protección | Implementación |
|-----------|----------------|
| Secreto fuerte | JWT_SECRET: 32+ caracteres ✅ |
| Algoritmo seguro | HS256 (HMAC-SHA256) ✅ |
| HTTPS | Requerido en producción ✅ |
| Expiración | accessToken: 15 min, refreshToken: 7 días ✅ |
| XSS | localStorage (no cookies) = menos vulnerable ⚠️ |
| CSRF | No aplicable con JWT en header ✅ |
| Revocación | Blacklist de tokens si es necesario ⏳ |

---

## 6. Referencia en Código

```
Archivo: src/modules/auth/auth.service.ts
- Línea 45: generateTokens()
- Línea 78: verifyToken()
- Línea 110: refreshToken()

Middleware: src/app/middlewares/auth.ts
- verifyJWT()

Tests: tests/integration/auth.login.test.ts
- "login con credenciales válidas"
- "refresh token válido"
- "reject access token expirado"
```

---

## 7. Alternativa Futura: OAuth2

Si en el futuro queremos integrar Google/Facebook login:

- **OAuth2 con JWT:** Google retorna ID token (JWT)
- **Validar ID token:** Verificar firma contra Google's public keys
- **Emitir nuestro JWT:** Con claims nuestros (role, businessId)

---

**Revisado por:** Emily Kohler  
**Fecha:** 2026-09-16  
**Status:** ✅ Implementado
