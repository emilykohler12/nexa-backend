# ADR-001: Estrategia de Multi-Tenancy

**Fecha:** 2026-09-25
**Estado:** ACEPTADO (reemplaza la decisión previa registrada en `04-diseno/adr-001-multi-tenancy.md`)
**Impacto:** ALTO

---

## 1. Contexto

Nexa nace para resolver el problema real de Loren Estudio de Belleza (gestión
de turnos, hoy hecha por WhatsApp y cuaderno). La idea original contemplaba un
SaaS multi-tenant clásico (un mismo proceso sirviendo a N estudios de belleza
distintos). Al momento de decidir la arquitectura de datos definitiva, se
evaluó de nuevo esa premisa contra la realidad del proyecto:

- Un solo cliente real y validado: Loren.
- Recursos de un desarrollador único (PIF de grado, no un equipo).
- Presupuesto de infraestructura acotado (Supabase free tier, Render free/starter).
- La eventual venta a otros estudios no requiere que corran en el **mismo**
  proceso/base al mismo tiempo — cada estudio puede tener su propia instancia.

## 2. Alternativas consideradas

### Alternativa A — Base de datos separada por tenant (dentro de un mismo backend)

Un solo backend desplegado, que according a un `tenantId` de la request elige
a qué base de datos conectarse (una por estudio).

**Ventajas:** aislamiento fuerte de datos; un estudio no puede ver datos de otro.
**Desventajas:** el backend necesita lógica de enrutamiento de conexión por
tenant (pooling de N conexiones, no 1); un bug en esa capa es un riesgo de
fuga de datos entre clientes; opera y factura como una operación de
infraestructura multi-cliente real (backups por tenant, límites de conexión
de Supabase por proyecto, etc.) — sobre-ingeniería para un solo cliente activo.

### Alternativa B — Schema separado por tenant (RLS, una sola base)

Una base de datos, un schema de Postgres por estudio, aislamiento vía
Row-Level Security.

**Ventajas:** más barato que A (una sola base/proyecto de Supabase).
**Desventajas:** el aislamiento depende 100% de que las políticas de RLS estén
bien escritas en cada tabla — un error de policy es indistinguible de "andar
bien" hasta que se filtran datos entre estudios. Exige disciplina y testing de
seguridad constante que no es viable mantener en solitario a este tamaño de
equipo.

### Alternativa C — Tabla compartida con columna `businessId` (multi-tenant real, un solo backend)

Todas las tablas (`Appointment`, `Client`, etc.) comparten fila física, y cada
fila se filtra por `businessId` en cada query.

**Ventajas:** más simple de programar que A/B a nivel de código de aplicación;
un solo deploy sirve a todos los clientes.
**Desventajas:** el riesgo es máximo — **un solo `where` mal escrito en
cualquiera de las decenas de queries de Prisma del sistema expone datos de un
estudio a otro**. No hay ninguna barrera a nivel de base de datos que lo
impida (a diferencia de A o B). Para un sistema que maneja datos personales de
clientas (nombres, teléfonos, turnos) esto es inaceptable como diseño
principal.

## 3. Decisión

**Arquitectura elegida: single-tenant con plantilla ("una instancia completa
por cliente", no multi-tenancy en tiempo de ejecución).**

Cada estudio de belleza que use Nexa tiene su **propio** despliegue completo,
aislado a nivel de infraestructura, no de código:
- Su propio proyecto de Supabase (base de datos física separada).
- Su propio servicio de Render (backend).
- Su propio proyecto de Vercel (frontend).
- Su propia configuración de variables de entorno (Mercado Pago, WhatsApp, mail, etc.).

El "multi-tenant" no desaparece como objetivo de negocio (Nexa sigue pudiendo
venderse a otros estudios) — se resuelve **por fuera del runtime**: agregar un
cliente nuevo es clonar el repositorio (la "plantilla") y repetir el proceso
de despliegue documentado en este mismo proyecto (ver `00-gestion/SOP.md`),
no agregar una fila a una tabla de tenants.

## 4. Justificación

1. **Aislamiento perfecto por construcción, no por disciplina de código:**
   cada cliente vive en su propia base de datos físicamente separada — el
   equivalente a la Alternativa A, pero sin la complejidad de que un mismo
   proceso backend gestione el ruteo entre bases. No existe la clase de bug
   "un where mal escrito filtra datos entre clientes" — es estructuralmente
   imposible, no evitada por testing.
2. **Costo real hoy: uno.** Con un solo cliente activo (Loren), el costo de
   operar N infraestructuras separadas es exactamente el costo de operar una,
   que es lo que hoy paga el proyecto. La complejidad de A/B/C (pooling
   multi-tenant, RLS multi-tenant, filtros por `businessId`) sería costo
   pagado por adelantado para un escenario (varios clientes simultáneos en un
   mismo proceso) que todavía no existe.
3. **Consistente con las capacidades reales del equipo:** un desarrollador
   único manteniendo el sistema. Las alternativas A/B/C exigen disciplina de
   seguridad y testing de aislamiento multi-tenant constantes; el modelo
   elegido elimina esa categoría de riesgo por diseño.
4. **Escala razonablemente para el modelo de negocio real:** vender Nexa a
   otro estudio de belleza no es "agregar una fila", pero tampoco es
   reescribir nada — es repetir un proceso de despliegue ya documentado y
   probado (Supabase + Render + Vercel), algo que este mismo proyecto
   ejecutó una vez para Loren y puede repetirse.
5. **Portabilidad ya validada:** al no depender de funciones exclusivas de
   Supabase (ver `00-gestion/PROTOCOLO_BACKUP_Y_RESTAURACION.md`, sección de
   estrategia de salida), migrar la base de un cliente puntual a otro
   proveedor de Postgres es un procedimiento simple y ya probado con un
   simulacro real — no hay vendor lock-in agregado por esta decisión.

## 5. Consecuencias

### Positivas
| Aspecto | Impacto |
|---|---|
| Seguridad / aislamiento | Máximo posible — separación física, no lógica |
| Complejidad de código | Mínima — cero lógica de multi-tenancy en el backend |
| Riesgo de fuga entre clientes | Estructuralmente eliminado |
| Cumplimiento de privacidad (Ley 25.326, etc.) | Trivial — "borrar los datos de un cliente" es borrar su proyecto entero |

### Negativas
| Aspecto | Impacto |
|---|---|
| Onboarding de un cliente nuevo | Requiere repetir el despliegue completo (documentado en SOP.md), no es instantáneo |
| Costo por cliente | Cada cliente nuevo suma su propia infraestructura (mitigado: tiers gratuitos de Supabase/Render/Vercel cubren varios clientes chicos) |
| Actualizaciones de código | Un fix o feature nuevo debe desplegarse por cliente, no una vez para todos |

## 6. Revisión futura

Si Nexa creciera a decenas de estudios simultáneos, esta decisión se
revisaría a favor de una variante de la Alternativa A (bases separadas, pero
con automatización de aprovisionamiento) — el punto de quiebre es cuando el
costo operativo de mantener N despliegues manuales supere el costo de
desarrollar el ruteo multi-tenant necesario para consolidarlos.

---

**Revisado por:** Emily Kohler
**Fecha de decisión:** 2026-09-25
