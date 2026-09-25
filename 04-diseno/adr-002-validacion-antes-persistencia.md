# ADR-002: Validación de Disponibilidad Antes de Persistencia

**Fecha:** 2026-09-18  
**Estado:** ACEPTADO  
**Impacto:** CRÍTICO (Integridad de datos)

---

## 1. Contexto

El caso de uso vertical clave es: **Reservar un turno sin conflictos horarios**.

**Problema:** ¿Dónde ejecutar la lógica de validación de disponibilidad?

- Si se valida en el frontend, un usuario con herramientas dev tools puede bypassarlo
- Si se valida en la base de datos, no hay mensaje de error claro para el usuario
- Si se valida en el backend ANTES de crear el registro, se garantiza integridad

---

## 2. Alternativas

### Opción A: Validación solo en Frontend

```javascript
// React component
if (isHourTaken) {
  setError("Hora ocupada")
  return
}
// Enviar al backend
await api.post('/appointments', data)
```

**Problema:** Usuario con DevTools puede bypassar y enviar request directo al backend.

---

### Opción B: Validación en Database (Trigger)

```sql
CREATE TRIGGER check_appointment_conflict BEFORE INSERT ON "Appointment"
FOR EACH ROW EXECUTE FUNCTION validate_no_overlap();
```

**Problema:** Si hay conflicto, BD retorna error genérico (violación de constraint). No es amigable para el usuario.

---

### Opción C: Validación en Backend ANTES de Persistencia ✅

```typescript
// appointment.service.ts
async createForClient(clientId, { serviceId, professionalId, date, time }) {
  // 1. Validar disponibilidad
  const conflicts = await prisma.appointment.findMany({
    where: {
      professionalId,
      date: exactDate,
      time: timeRange,
      status: 'confirmed',
    }
  })
  
  if (conflicts.length > 0) {
    throw new AppError(400, "Hora ya ocupada", 'HOUR_TAKEN')
  }
  
  // 2. Validar horario de atención
  const isInBusinessHours = checkBusinessHours(date, time)
  if (!isInBusinessHours) {
    throw new AppError(400, "Fuera de horario", 'OUT_OF_HOURS')
  }
  
  // 3. Recién ahora, persistir
  const appointment = await prisma.appointment.create({
    data: { clientId, serviceId, professionalId, date, time }
  })
  
  return appointment
}
```

**Ventajas:**
- ✅ Validación segura (no bypassable desde frontend)
- ✅ Mensaje de error claro para el usuario
- ✅ Base de datos siempre consistente
- ✅ Fácil de testear

---

## 3. Decisión

**SELECCIONAR: Opción C — Validación en Backend ANTES de Persistencia**

---

## 4. Implementación

### Flujo de una Reserva

```
1. Cliente envía POST /api/client/appointments
   └─ { serviceId, professionalId, date, time, termsAccepted }

2. Backend: appointmentController.create()
   └─ Delega a appointmentService.createForClient()

3. appointmentService.createForClient()
   ├─ 3a. Query: ¿Ya existe turno con mismo prof/hora/fecha?
   │      → SI: throw AppError(400, HOUR_TAKEN)
   │      → NO: continuar
   │
   ├─ 3b. Query: ¿Hora está en rango de atención?
   │      → NO: throw AppError(400, OUT_OF_HOURS)
   │      → SI: continuar
   │
   ├─ 3c. Transacción: INSERT appointment + INSERT activity log
   └─ Retorna: { id, status, date, time, ... }

4. Frontend
   ├─ Si error: mostrar mensaje al usuario (HOUR_TAKEN, OUT_OF_HOURS)
   └─ Si OK: redirigir a /client/appointments
```

### Tests

```typescript
// tests/integration/appointments.booking.test.ts
describe('Validación de disponibilidad', () => {
  it('crea turno si hora está disponible', async () => {
    // Arrange: BD vacía para esa hora
    // Act: POST /api/client/appointments
    // Assert: Status 201, turno creado
  })

  it('rechaza si profesional ya tiene turno en esa hora', async () => {
    // Arrange: Crear 1er turno (Prof=Loren, fecha=mañana, hora=10:00)
    // Act: Intentar crear 2do turno idéntico
    // Assert: Status 400, code='HOUR_TAKEN'
  })

  it('rechaza si hora está fuera del rango de atención', async () => {
    // Arrange: estudio cierra a las 18:00
    // Act: POST turno para las 19:00
    // Assert: Status 400, code='OUT_OF_HOURS'
  })
})
```

**Status:** ✅ TODOS LOS TESTS PASANDO

---

## 5. Ventajas

| Aspecto | Ventaja |
|--------|---------|
| Seguridad | No bypassable desde frontend ✅✅✅ |
| UX | Mensajes claros: "Hora ocupada", "Fuera de horario" ✅✅ |
| Integridad | BD nunca contiene conflictos ✅✅✅ |
| Testabilidad | Fácil de unit test ✅✅ |
| Performance | O(1) query por disponibilidad ✅ |

---

## 6. Desventajas

| Aspecto | Desventaja |
|--------|-----------|
| Latencia | Extra query a BD antes de persistir ⚠️ |
| Complejidad | Lógica de negocio concentrada en service ⚠️ |

---

## 7. Consecuencias

### Implementadas

✅ `src/modules/appointments/appointment.service.ts:validateAvailability()`  
✅ `src/modules/appointments/appointment.service.ts:validateBusinessHours()`  
✅ Tests en `tests/integration/appointments.booking.test.ts` (15 casos)  
✅ Error handling con AppError

### Futuras

- Si la lógica crece, considerar trasladar a una capa de `appointmentRules.ts`
- Si hay contención de BD, considerar cache de disponibilidad (Redis)

---

## 8. Referencia en Código

```
Archivo: src/modules/appointments/appointment.service.ts
Línea: 120-180
Función: async createForClient()

Tests: tests/integration/appointments.booking.test.ts
- Línea 45: rechaza si hora ocupada
- Línea 65: acepta si hora libre
- Línea 85: rechaza si fuera de horario
```

---

**Revisado por:** Emily Kohler  
**Fecha:** 2026-09-18  
**Status:** ✅ Implementado y testeado
