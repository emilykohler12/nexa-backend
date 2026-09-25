# Plan Completo de Entrega — Checklist Detallado

## Estructura de Carpetas Requerida

```
/
├── 00-gestion/           ← Bitácora, actas, presupuesto
├── 01-relevamiento/      ← Acta de validación con Loren
├── 02-analisis/          ← Lienzo de negocio, competencia
├── 03-requisitos/        ← Catálogo de requisitos, matriz
├── 04-diseno/            ← Decisiones arquitectónicas
├── 05-entregas/          ← PDF final + evidencias
└── src/
    ├── nexa-backend/
    └── nexa-frontend/
```

---

## 📋 CHECKLIST POR CARPETA

### 📁 **/00-gestion** — Gestión del Proyecto

**Archivos requeridos:**

- [ ] **Bitácora Individual (Kohler, Emily)**
  - Archivo: `bitacora-emily-kohler.md`
  - Contenido: Entrada por día/sesión con:
    - Fecha y hora
    - Qué hice
    - Tiempo dedicado
    - Decisiones tomadas
    - Bloqueos o problemas
  - Ejemplo:
    ```markdown
    ## 2026-09-24
    - 10:00-11:30 (1.5h) — Removí Google OAuth de frontend/backend
      - Eliminé rutas, componentes, DTO
      - Actualicé tests para nueva estructura
      - Validación de endpoints funciona
    
    - 14:00-16:00 (2h) — Creé 5 documentos legales
      - Privacy Policy (Supabase + AWS + Meta + Art. 12)
      - Cookies Policy, Cancelación, ARCO, T&C
      - Botones de retroceso en todas
    
    - 16:30-17:15 (0.75h) — Git push a ambos repos
      - Commit 678cbcc (backend), 33a8f02 (frontend)
      - CI/CD ejecutándose correctamente
    ```

- [ ] **Actas de Reunión**
  - Archivo: `acta-reunion-[fecha].md`
  - 1-2 reuniones mínimo con notas de decisiones

- [ ] **Plan de 4 Semanas**
  - Archivo: `plan-4-semanas.md`
  - Desglose semanal con:
    - Objetivos
    - Tareas
    - Dueño
    - Horas estimadas

- [ ] **Presupuesto de Horas (Instrumento 24)**
  - Archivo: `presupuesto-horas.xlsx` o `.md`
  - Tabla: Fase | Tarea | Horas | Completado (%)
  - Total: 240 horas (según reglamento)

**Estado actual:** ❌ FALTA TODO

---

### 📁 **/01-relevamiento** — Validación con Stakeholder

**Archivos requeridos:**

- [ ] **Acta de Sesión de Validación (Instrumento 31)**
  - Archivo: `acta-validacion-loren.md`
  - Contenido:
    - Fecha y participantes (Loren + Emily)
    - Requisitos validados (uno por uno)
    - Conformidad/observaciones de Loren
    - Firma o consentimiento (captura de email/WhatsApp)
  - Ejemplo:
    ```markdown
    # Acta de Validación — Sesión con Loren
    
    **Fecha:** 2026-09-20  
    **Participantes:** Loren (stakeholder), Emily (dev)  
    **Duración:** 1 hora
    
    ## Requisitos Validados
    
    ✅ RF-01: Reservar turno sin conflictos horarios
    - Loren probó: reserva turno → intenta reservar mismo horario → rechazado
    - Conformidad: "Perfecto, así debe ser"
    
    ✅ RF-02: Notificaciones por WhatsApp
    - Loren recibió notificación real en su teléfono
    - Conformidad: "Llega al instante, perfecto"
    
    [... más requisitos ...]
    
    ## Firma de Conformidad
    Loren consiente que el sistema cumple con sus necesidades.
    [Captura de email de Loren: "Emily, me encanta cómo quedó"]
    ```

**Estado actual:** ❌ FALTA

---

### 📁 **/02-analisis** — Análisis de Negocio

**Archivos requeridos:**

- [ ] **Lienzo de Modelo de Negocio (Canvas)**
  - Archivo: `canvas-modelo-negocio.pdf` + `canvas-modelo-negocio.md`
  - 9 bloques:
    1. Propuesta de valor (¿qué resuelve?)
    2. Segmentos de clientes (quién lo usa)
    3. Canales (cómo se accede)
    4. Relación con clientes (support)
    5. Flujos de ingresos (cómo gana dinero)
    6. Recursos clave
    7. Actividades clave
    8. Asociados
    9. Estructura de costos

- [ ] **Matriz de Rivalidad Amplificada**
  - Archivo: `matriz-competencia.md`
  - Competidores: Calendly, Acuity Scheduling, Square Appointments
  - Tabla: Sistema | Precio | Turnos | Pagos | Notificaciones | Rating
  - Ventaja diferencial de Nexa

- [ ] **Mapeo de Competencia**
  - Archivo: `mapeo-competencia.md`
  - Fortalezas de Nexa vs competencia
  - Debilidades a mejorar
  - Oportunidades de mercado

**Estado actual:** ❌ FALTA TODO

---

### 📁 **/03-requisitos** — Especificación de Requisitos

**Archivos requeridos:**

- [ ] **Catálogo de Requisitos Versionado**
  - Archivo: `requisitos.xlsx` + `requisitos.md`
  - Columnas: ID | Descripción | Tipo (Funcional/No-funcional) | Prioridad | Estado | Tests | Observaciones
  - Debe coincidir CON EL CÓDIGO:
    ```
    RF-01: Validar disponibilidad horaria
    ✅ Test: tests/integration/appointments.booking.test.ts (línea 45)
    ✅ Código: src/modules/appointments/appointment.service.ts (método validateAvailability)
    ✅ Estado: Implementado y probado
    ```

- [ ] **Modelo del Dominio**
  - Archivo: `modelo-dominio.md`
  - Diagrama o descripción de entidades:
    - User (Cliente, Profesional, Admin)
    - Service (Depilación definitiva, etc.)
    - Appointment (Turno)
    - Order (Compra)
    - ...

- [ ] **Registro de Reglas de Negocio**
  - Archivo: `reglas-negocio.md`
  - Cada regla con:
    - ID
    - Descripción
    - Dónde se implementa (archivo + línea)
    - Test que la valida
  - Ejemplo:
    ```markdown
    ## RN-01: Cancelación de turno
    - Descripción: Si se cancela <12h antes, pierde la seña
    - Implementado en: src/modules/appointments/appointment.service.ts:245
    - Validado por: tests/integration/appointments.cancellation.test.ts
    - Estado: ✅ Listo
    ```

- [ ] **Glosario**
  - Archivo: `glosario.md`
  - Definiciones de términos del dominio:
    - Turno, Seña, Combo, No-show, Profesional, Cliente, etc.

- [ ] **Matriz de Trazabilidad**
  - Archivo: `matriz-trazabilidad.xlsx`
  - Requisito → Test → Código
  - Cobertura al 100%

**Estado actual:**
- ✅ Requisitos en código (vistos en repos)
- ❌ Documentación falta

---

### 📁 **/04-diseno** — Decisiones de Arquitectura

**Archivos requeridos:**

- [ ] **Decisiones de Arquitectura (ADRs)**
  
  - **ADR-001: Multi-Tenancy**
    - Archivo: `adr-001-multi-tenancy.md`
    - Contenido:
      ```markdown
      # ADR-001: Estrategia de Multi-Tenancy
      
      ## Contexto
      El sistema necesita soportar múltiples estudios de belleza con datos completamente aislados.
      
      ## Alternativas Consideradas
      1. Base de datos separada por cliente (máx aislamiento, mayor costo)
      2. Schema separado por cliente (aislamiento lógico, buena flexibilidad)
      3. Tabla compartida con column "businessId" (simple, riesgo de data leaks)
      
      ## Decisión
      **Opción 1: Base de datos separada** (usar Supabase con branching o RLS)
      
      ## Justificación
      - Máxima seguridad de datos
      - Escalabilidad independiente por cliente
      - Cumple con regulaciones de privacidad (GDPR-like)
      
      ## Consecuencias
      - (+) Aislamiento total
      - (+) Easier compliance audits
      - (-) Mayor complejidad de deployment
      - (-) Costo más alto de infra
      ```

  - **ADR-002: Validación Antes de Persistencia**
    - Archivo: `adr-002-validacion-antes-persistencia.md`
    - Explicar por qué la validación de disponibilidad ocurre en `appointment.service.ts` ANTES del `prisma.appointment.create()`

  - **ADR-003: JWT para Autenticación**
    - Archivo: `adr-003-jwt-auth.md`
    - Comparar con sesiones, OAuth, etc.

- [ ] **Modelo de Datos (ER Diagram)**
  - Archivo: `modelo-datos.md` + `modelo-datos.svg`
  - Tablas con relaciones
  - Puede generarse con:
    ```bash
    npx prisma db pull  # Si la BD ya existe
    npx prisma studio  # UI interactiva
    ```

- [ ] **Configuración de CI/CD**
  - Archivo: `ci-cd-config.md`
  - Explica workflow, triggers, pasos
  - Link a `.github/workflows/ci.yml`

- [ ] **Decisiones de Stack**
  - Archivo: `tech-stack-decisions.md`
  - Por qué React, Express, Prisma, Zod, etc.

**Estado actual:**
- ❌ ADRs no documentados
- ❌ Modelo ER no formalizado
- ❌ CI/CD no documentado en archivo

---

### 📁 **/05-entregas** — Entregables Finales

**Archivos requeridos:**

- [ ] **PDF Informe Final**
  - Archivo: `Nexa-PIF-Kohler-Emily-2026-09-24.pdf`
  - Estructura:
    1. Portada
    2. Índice
    3. Identificación (como en README)
    4. Contexto y problemática
    5. Solución propuesta
    6. Requisitos validados
    7. Arquitectura
    8. Casos de uso (vertical testing)
    9. Tests y CI/CD
    10. Monitoreo y mantenimiento
    11. Conclusiones
    12. Apéndices (diagramas, código snippet)

- [ ] **Evidencias de Funcionamiento**
  - Archivos: Screenshots PNG de:
    - Login exitoso
    - Reserva de turno
    - Validación de conflicto
    - Notificación WhatsApp
    - Dashboard admin
    - Tests pasando (terminal output)

- [ ] **Código Fuente Limpio**
  - Git con historial de commits
  - README funcional (✅ ya lo hicimos)
  - .env.example configurado
  - Sin archivos .env reales

**Estado actual:**
- ✅ Código limpio
- ✅ README completo
- ❌ PDF informe falta
- ❌ Screenshots de evidencia faltan

---

### 📁 **/src** — Código del Prototipo

**Estructura:**

```
src/
├── nexa-backend/
│   ├── README.md                    ✅
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma            ✅
│   │   └── migrations/              ✅ (15+ migraciones)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── appointments/        ✅
│   │   │   ├── auth/                ✅
│   │   │   ├── orders/              ✅
│   │   │   └── ...
│   │   └── app/
│   │       ├── app.ts
│   │       └── database/
│   └── tests/
│       └── integration/             ✅ (108 tests)
│
└── nexa-frontend/
    ├── README.md                    ❌ Falta
    ├── package.json
    ├── src/
    │   ├── pages/public/
    │   │   ├── LoginPage.tsx        ✅
    │   │   ├── PrivacyPolicyPage.tsx ✅
    │   │   ├── TermsConditionsPage.tsx ✅
    │   │   ├── CookiesPolicyPage.tsx ✅
    │   │   ├── CancellationPolicyPage.tsx ✅
    │   │   ├── ARCORightsPage.tsx   ✅
    │   │   └── ...
    │   └── features/
    │       ├── auth/
    │       │   ├── LoginForm.tsx    ✅ (Google OAuth removido)
    │       │   └── RegisterForm.tsx ✅ (Google OAuth removido)
    │       └── ...
    └── tests/                       ✅ (31 tests)
```

**Estado actual:**
- ✅ Backend: Código completo, 108 tests
- ✅ Frontend: Código completo, 31 tests
- ❌ Frontend README falta

---

## 🎯 PLAN PASO A PASO (Esta Semana)

### Hoy (Lunes, si es el lunes):

**1. Crear estructura de carpetas (30 min)**
```bash
mkdir -p 00-gestion 01-relevamiento 02-analisis 03-requisitos 04-diseno 05-entregas
```

**2. Llenar /00-gestion (2 horas)**
- [ ] Crear `bitacora-emily-kohler.md` (entra eventos desde inicio del proyecto)
- [ ] Crear `plan-4-semanas.md` (si no existe)
- [ ] Crear `presupuesto-horas.xlsx` (tiempo real gastado)

**3. Llenar /01-relevamiento (1.5 horas)**
- [ ] Contactar a Loren por WhatsApp/email: "¿Podemos hacer una sesión de 1 hora para validar que el sistema cumpla con tus necesidades?"
- [ ] Hacer video call o en persona
- [ ] Registrar acta con `acta-validacion-loren.md`

**4. Llenar /02-analisis (2 horas)**
- [ ] Canvas de modelo de negocio (usar figma o draw.io)
- [ ] Matriz de competencia vs Calendly/Acuity
- [ ] Mapeo de competencia

**5. Llenar /03-requisitos (1.5 horas)**
- [ ] Exportar requisitos a Excel/MD
- [ ] Crear glosario
- [ ] Matriz de trazabilidad (Req → Test → Code)

**6. Llenar /04-diseno (1.5 horas)**
- [ ] ADR-001 (multi-tenancy)
- [ ] ADR-002 (validación antes de persistencia)
- [ ] ADR-003 (JWT auth)
- [ ] Modelo de datos (ER diagram)

**7. Llenar /05-entregas (3 horas)**
- [ ] Captura de pantallas de funcionamiento (login, reserva, validación)
- [ ] Screenshot de tests pasando
- [ ] Draft de PDF informe (usar LaTeX o Google Docs)

### Martes-Viernes:

**8. Integración Mercado Pago Real (2-3 horas)**
- [ ] Obtener credenciales TEST de Loren
- [ ] Integrar endpoint de checkout
- [ ] Probar flujo completo: Reserva → Pago → Confirmación

**9. Documentación de Despliegue (2 horas)**
- [ ] ADR-004: Estrategia de salida de Supabase (exit strategy)
- [ ] PROTOCOLO_BACKUP_RESTAURACION.md
  - Pasos para pg_dump
  - Pasos para restaurar localmente
  - Captura de pantalla del éxito

**10. Base de Datos AAIP (1 hora)**
- [ ] Si es requerido por institución, crear documento de conformidad

**11. Finales (README + commit + push)**
- [ ] Frontend README.md
- [ ] Commit de toda la documentación
- [ ] Git push a ambos repos
- [ ] Crear release v1.0.0 en GitHub

---

## 📊 Checklist de Entrega Final

```markdown
## ANTES DE ENTREGAR

- [ ] Repo Backend
  - [ ] README.md completo ✅
  - [ ] .env.example con todas las variables
  - [ ] tests/ pasando al 100% ✅
  - [ ] CI/CD verde ✅
  - [ ] Documentación en /04-diseno/

- [ ] Repo Frontend
  - [ ] README.md completo ❌
  - [ ] .env.example
  - [ ] tests/ pasando al 100% ✅
  - [ ] CI/CD verde ✅

- [ ] Carpeta /00-gestion/
  - [ ] Bitácora individual
  - [ ] Actas de reunión
  - [ ] Plan 4 semanas
  - [ ] Presupuesto horas

- [ ] Carpeta /01-relevamiento/
  - [ ] Acta validación Loren (Instrumento 31)

- [ ] Carpeta /02-analisis/
  - [ ] Canvas modelo de negocio
  - [ ] Matriz de competencia
  - [ ] Mapeo de competencia

- [ ] Carpeta /03-requisitos/
  - [ ] Catálogo requisitos (Excel + MD)
  - [ ] Modelo del dominio
  - [ ] Registro de reglas de negocio
  - [ ] Glosario
  - [ ] Matriz de trazabilidad

- [ ] Carpeta /04-diseno/
  - [ ] ADR-001 (multi-tenancy)
  - [ ] ADR-002 (validación arquitectura)
  - [ ] ADR-003 (JWT auth)
  - [ ] ADR-004 (exit strategy Supabase)
  - [ ] Modelo de datos (ER diagram)
  - [ ] CI/CD documentation
  - [ ] PROTOCOLO_BACKUP_RESTAURACION.md

- [ ] Carpeta /05-entregas/
  - [ ] PDF Informe Final
  - [ ] Screenshots evidencia
  - [ ] Video demostración (opcional)

- [ ] Código
  - [ ] Sin archivos .env reales
  - [ ] Sin node_modules
  - [ ] .gitignore completo
  - [ ] Tests pasando
  - [ ] Build sin errores
```

---

## 📞 Próximos Pasos

1. **Esta tarde:** Crear carpetas y bitácora
2. **Mañana:** Sesión de validación con Loren
3. **Miércoles:** Documentación de análisis y requisitos
4. **Jueves:** Documentación de arquitectura
5. **Viernes:** Informe PDF final + mercado pago real

¿Por dónde quieres que empecemos?
