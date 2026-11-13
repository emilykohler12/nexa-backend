/**
 * Verifica sin base de datos que los turnos de demostración caen en la ventana correcta para distintas horas de presentación.
 * Ejecutar: npm run demo:turnos-ahora:verificar
 */
import { WINDOWS, pickDemoStarts } from './demo-times';
let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error('FALLA:', msg); } else console.log('ok   :', msg); };
for (const hhmm of ['10:00', '15:00', '19:40', '20:30', '21:30', '23:00']) {
  const now = new Date(`2026-11-20T${hhmm}:00-03:00`);
  const r = pickDemoStarts(now, new Set());
  console.log(`\nPresentación a las ${hhmm}`);
  for (const [k, v] of Object.entries(r)) console.log(`  ${k.padEnd(13)} ${v.date} ${v.time}  (${v.hoursAhead.toFixed(1)} h)${v.onGrid ? '' : '  FUERA DEL HORARIO DEL ESTUDIO'}`);
  check(r.menosDe12h.hoursAhead < 12 && r.menosDe12h.hoursAhead >= WINDOWS.menosDe12h.lo, `${hhmm}: el turno "menos de 12 h" cae por debajo de 12 h (${r.menosDe12h.hoursAhead.toFixed(1)})`);
  check(r.masDe12h.hoursAhead >= 13, `${hhmm}: el turno "12 h o más" tiene al menos 13 h (${r.masDe12h.hoursAhead.toFixed(1)})`);
  check(r.recordatorio.hoursAhead >= 1.5 && r.recordatorio.hoursAhead <= 4.5, `${hhmm}: el turno del recordatorio está entre 1,5 y 4,5 h (${r.recordatorio.hoursAhead.toFixed(1)})`);
  const keys = Object.values(r).map((v) => `${v.date}|${v.time}`);
  check(new Set(keys).size === 3, `${hhmm}: los tres horarios son distintos`);
}
process.exit(fails ? 1 : 0);
