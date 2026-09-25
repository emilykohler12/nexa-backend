# ADR-001: Estrategia de Multi-Tenancy

**Fecha:** 2026-09-20  
**Estado:** ACEPTADO  
**Impacto:** ALTO

---

## 1. Contexto

El sistema Nexa debe soportar múltiples estudios de belleza (tenants), cada uno con:
- Sus propios clientes y profesionales
- Sus propios turnos y órdenes
- Datos completamente aislados

La decisión arquitectónica debe balancear:
- **Seguridad de datos:** Máximo aislamiento entre tenants
- **Escalabilidad:** Capacidad de soportar N estudios
- **Costo operacional:** Infraestructura y complejidad
- **Complejidad de desarrollo:** Facilidad de mantenimiento

---

## 2. Alternativas Consideradas

### Alternativa A: Base de Datos Separada por Tenant

```
tenant-1-db  (PostgreSQL)
tenant-2-db  (PostgreSQL)
tenant-3-db  (PostgreSQL)
```

**Ventajas:**
- ✅ Máximo aislamiento de datos
- ✅ Escalabilidad independiente (cada tenant puede crecer)
- ✅ Fácil cumplimiento GDPR (borrar 1 BD = borrar todo)
- ✅ Performance sin contención de recursos

**Desventajas:**
- ❌ Infraestructura más costosa (N BDs = N backups, N conexiones)
- ❌ Complejidad operacional (gestionar N instancias)
- ❌ Overhead de deployment/configuración

---

### Alternativa B: Schema Separado por Tenant (Row-Level Security)

```
DATABASE nexa_prod
  ├─ SCHEMA tenant_1
  ├─ SCHEMA tenant_2
  └─ SCHEMA tenant_3
```

**Ventajas:**
- ✅ Aislamiento lógico con BD única
- ✅ Más flexible que option C
- ✅ Costo operacional moderado
- ✅ RLS (Row-Level Security) en Supabase es nativo

**Desventajas:**
- ⚠️ Riesgo de cross-tenant si RLS falla
- ⚠️ Shared backups (punto único de fallo)

---

### Alternativa C: Tabla Compartida con Columna `businessId`

```
Appointment
├─ id
├─ businessId  ← Aislamiento solo en software
├─ clientId
├─ ...
```

**Ventajas:**
- ✅ Máxima simplificidad
- ✅ Mínimo costo infraestructural
- ✅ Fácil de implementar

**Desventajas:**
- ❌ Riesgo crítico: 1 fallo de filtro = data leak entre tenants
- ❌ Backup conjunto de todos (GDPR deletion difícil)
- ❌ No es verdadero aislamiento

---

## 3. Decisión

**SELECCIONAR: Alternativa A — Base de Datos Separada por Tenant**

Usando Supabase + Branching (dev/staging) o Neon con multi-DB.

---

## 4. Justificación

1. **Seguridad es el requisito #1** — No negociable en sistemas con datos personales (turnos, pagos, contactos)
2. **Regulaciones de privacidad:** GDPR, CCPA, Ley 25.326 (Argentina) requieren aislamiento fuerte
3. **Auditoría:** Si hay un data leak, queda claro cuál tenant fue afectado
4. **Escalabilidad futura:** Si uno de los estudios crece, no afecta a otros
5. **Mercado:** Competidores (Acuity, Calendly) usan BD separadas

---

## 5. Implementación

### En Desarrollo Local

```bash
# Per-tenant setup
DATABASE_URL_TENANT_1="postgresql://user:pass@localhost:5432/nexa_loren_dev"
DATABASE_URL_TENANT_2="postgresql://user:pass@localhost:5432/nexa_otro_dev"

npx prisma migrate dev --name "init" # Por cada DB
```

### En Producción (Supabase)

```
supabase_organization
  ├─ project_loren         (PostgreSQL separada)
  ├─ project_otro_studio   (PostgreSQL separada)
  └─ project_...
```

Con DNS:
```
api.loren.nexa.app        → conexión a DB Loren
api.otro.nexa.app         → conexión a DB Otro
```

---

## 6. Consecuencias

### Positivas

| Aspecto | Impacto |
|--------|--------|
| Seguridad | Máximo aislamiento ✅✅✅ |
| Privacidad | Cumplimiento regulatorio ✅✅ |
| Escalabilidad | Independent per-tenant ✅✅ |
| Auditoría | Logs y backups separados ✅ |

### Negativas

| Aspecto | Impacto |
|--------|--------|
| Costo | 3-5x más caro que BD única ⚠️ |
| Complexity | Gestión de N conexiones ⚠️ |
| Ops | Más trabajo en deployment ⚠️ |
| Desarrollo | Nuevos estudios = nueva DB provision ⚠️ |

---

## 7. Plan de Migración (si cambia)

Si en el futuro necesitamos cambiar a Alternativa B (Schemas):

1. Exportar datos de cada DB
2. Importar a schema distinto en BD única
3. Implementar RLS en todas las tablas
4. Validar aislamientos (tests de penetración)
5. Deprecar BDs viejas

**Downtime estimado:** 2-4 horas por tenant

---

## 8. Referencias

- Supabase Multi-Database Guide: https://supabase.com/
- Neon Multi-Database: https://neon.tech/
- GDPR Article 25 (Data Protection by Design): https://gdpr-info.eu/
- Row-Level Security en PostgreSQL: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

---

**Revisado por:** Emily Kohler  
**Fecha de decisión:** 2026-09-20  
**Próxima revisión:** 2026-12-20
