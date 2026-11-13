/**
 * Elige los inicios de los turnos de demostración que dependen del reloj. Funciones puras: no tocan la base de datos.
 * Ubicación: nexa-backend/scripts/seed-presentacion/demo-times.ts
 *
 * Por qué hace falta: la regla R-02 compara la hora del aviso (que no puede ser futura) con el inicio del turno.
 * Un turno de dentro de varios días siempre tiene 12 horas o más, así que para mostrar la cancelación con menos de
 * 12 horas el turno tiene que empezar en pocas horas, contadas desde el momento real de la demostración.
 */
import { DEMO_PRO, addDays, dow, fromMin, gridStarts, pro } from './plan';

export interface DemoStart { date: string; time: string; hoursAhead: number; onGrid: boolean }
export interface Window { target: number; lo: number; hi: number }

/** Ventanas de horas por delante del momento actual. */
export const WINDOWS: Record<'menosDe12h' | 'masDe12h' | 'recordatorio', Window> = {
  menosDe12h: { target: 7, lo: 2, hi: 11.9 },     // al cancelar: seña retenida
  masDe12h: { target: 17, lo: 13, hi: 40 },        // al cancelar: seña devuelta (margen de 1 h sobre las 12 h)
  recordatorio: { target: 3, lo: 1.5, hi: 4.5 },   // dentro de la ventana del recordatorio (de 5 h a 1 h antes)
};

const MS_H = 3600000;
const instant = (date: string, mins: number) => new Date(`${date}T${fromMin(mins)}:00-03:00`);
function argParts(d: Date) { const l = new Date(d.getTime() - 3 * MS_H); return { date: l.toISOString().slice(0, 10), min: l.getUTCHours() * 60 + l.getUTCMinutes() }; }

/** taken: claves "fecha|hora" ya ocupadas por otro turno activo de la profesional de demostración. */
export function pickStart(now: Date, w: Window, taken: Set<string>, proKey: string = DEMO_PRO): DemoStart {
  const loren = pro(proKey);
  const today = argParts(now).date;
  let best: DemoStart | undefined;
  for (let i = 0; i <= 3; i++) {
    const date = addDays(today, i); if (dow(date) === 6) continue;
    for (const s of gridStarts(loren, date)) {
      const time = fromMin(s); if (taken.has(`${date}|${time}`)) continue;
      const h = (instant(date, s).getTime() - now.getTime()) / MS_H;
      if (h >= w.lo && h <= w.hi && (!best || Math.abs(h - w.target) < Math.abs(best.hoursAhead - w.target))) best = { date, time, hoursAhead: h, onGrid: true };
    }
  }
  if (best) return best;
  // Sin horario de la grilla que cumpla: se busca el horario de 30 minutos más cercano al objetivo (puede quedar fuera del horario del estudio).
  const t0 = argParts(new Date(now.getTime() + w.target * MS_H));
  for (let step = 0; step < 48; step++) {
    for (const sign of [1, -1]) {
      let m = Math.round(t0.min / 30) * 30 + sign * step * 30; let date = t0.date;
      while (m >= 1440) { m -= 1440; date = addDays(date, 1); }
      while (m < 0) { m += 1440; date = addDays(date, -1); }
      const h = (instant(date, m).getTime() - now.getTime()) / MS_H;
      if (h >= w.lo && h <= w.hi && !taken.has(`${date}|${fromMin(m)}`)) return { date, time: fromMin(m), hoursAhead: h, onGrid: false };
    }
  }
  throw new Error('No se encontró un horario para el turno de demostración.');
}

/** Los tres turnos de demostración, sin repetir horario. */
export function pickDemoStarts(now: Date, busy: Set<string>, proKey: string = DEMO_PRO) {
  const taken = new Set(busy);
  const out = {} as Record<keyof typeof WINDOWS, DemoStart>;
  for (const k of ['recordatorio', 'menosDe12h', 'masDe12h'] as const) {
    out[k] = pickStart(now, WINDOWS[k], taken, proKey); taken.add(`${out[k].date}|${out[k].time}`);
  }
  return out;
}
