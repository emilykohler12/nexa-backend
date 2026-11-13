/** Hora de Argentina y turnos "relativos a ahora". Funciones puras, sin base de datos. */
export const TZ = 'America/Argentina/Buenos_Aires';

export function argentinaParts(d: Date): { date: string; time: string } {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/**
 * Fecha y hora (de Argentina) de un turno que empieza dentro de `hours` horas.
 * El minuto se fija en :20 para no chocar con la grilla de reserva, que empieza en :00;
 * por eso la diferencia real puede variar hasta una hora (se informa `realHours`).
 */
export function startAfter(hours: number, from: Date = new Date()): { date: string; time: string; realHours: number } {
  const target = new Date(from.getTime() + hours * 3600000);
  const { date, time } = argentinaParts(target);
  const fixed = `${time.slice(0, 2)}:20`;
  const start = new Date(`${date}T${fixed}:00-03:00`);
  return { date, time: fixed, realHours: Math.round(((start.getTime() - from.getTime()) / 3600000) * 10) / 10 };
}
