// src/app/utils/argentinaTime.ts
//
// Los turnos se guardan como texto en hora de Argentina: date "YYYY-MM-DD" y time
// "HH:mm". El servidor de producción (Render) corre en UTC, y `new Date('2026-10-24T10:00:00')`
// sin zona usa la del proceso: en UTC esa hora queda 3 horas ANTES de la real. Todo cálculo
// que compare "ahora" con un turno, o necesite "la fecha de hoy", tiene que pasar por acá y
// no depender de la zona del servidor.
//
// Argentina no tiene horario de verano, así que el offset es siempre -03:00.

export const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires'

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ARGENTINA_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

// Fecha ("YYYY-MM-DD") y hora ("HH:mm") de Argentina para un instante.
export function argentinaParts(at: Date = new Date()): { date: string; time: string } {
  const p: Record<string, string> = {}
  for (const part of formatter.formatToParts(at)) p[part.type] = part.value
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

// "Hoy" en Argentina como "YYYY-MM-DD".
export function todayArgentinaStr(at: Date = new Date()): string {
  return argentinaParts(at).date
}

// Un Date cuyos campos "locales" (getFullYear, getMonth, getDate, getHours...) valen lo que marca
// el reloj de Argentina en ese instante, sea cual sea la zona del servidor. Es para el código que
// arma calendarios (rangos de día, semana, mes y año de los dashboards) con esos getters. NO es un
// instante real: no se compara con fechas de la base ni con Date.now().
export function argentinaWallClock(at: Date = new Date()): Date {
  const { date, time } = argentinaParts(at)
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes]   = time.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}

// Instante absoluto de un turno guardado como date + time (hora de Argentina).
export function appointmentInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00-03:00`)
}
