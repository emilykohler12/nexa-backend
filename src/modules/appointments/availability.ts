// Franjas horarias que cada profesional define (professional_availability) y
// rango de la semana — compartido por la asignación automática (R-04) y la
// validación de horario del flujo de la clienta.

// professional_availability.day_of_week usa 0 = lunes … 6 = domingo
// (DAY_MAP en professional.service.ts); Date#getUTCDay usa 0 = domingo.
export function backendDayOf(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
}

// Lunes y domingo (YYYY-MM-DD) de la semana de `date`. Las fechas de turno se
// guardan como texto ISO, así que alcanza con comparar strings.
export function weekRangeOf(date: string): { from: string; to: string } {
  const d      = new Date(`${date}T00:00:00Z`)
  const monday = new Date(d.getTime() - backendDayOf(date) * 86_400_000)
  const sunday = new Date(monday.getTime() + 6 * 86_400_000)
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) }
}

// La hora de inicio tiene que caer dentro de alguna franja del día:
// startTime <= time < endTime (puede haber varias, ej. 08–12 y 14–20).
export function isTimeInRanges(ranges: { startTime: string; endTime: string }[], time: string): boolean {
  return ranges.some(r => r.startTime <= time && time < r.endTime)
}

export function isOnVacation(p: { vacationFrom: Date | null; vacationTo: Date | null }, date: string): boolean {
  if (!p.vacationFrom || !p.vacationTo) return false
  return p.vacationFrom.toISOString().slice(0, 10) <= date && date <= p.vacationTo.toISOString().slice(0, 10)
}
