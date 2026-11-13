/**
 * Verifica el plan sin base de datos.  Ejecutar: npm run seed:presentacion:verificar
 * Comprueba: totales de los Gráficos 1 y 2, grilla de 120 min, ningún solapamiento ni inicio repetido por profesional,
 * todo dentro de las franjas, ningún domingo, y salida idéntica en dos corridas.
 */
import { CASES, TARGET_BY_CATEGORY, TARGET_BY_PRO, addDays, dow, gridStarts, pickDemoAppointments, planMonth, pro, tally, toMin } from './plan';

const WEEK = '2026-11-02'; const REF = '2026-11-21';
const opts = { monthStart: '2026-11-01', weekStart: WEEK, refDate: REF, clientPool: 60 };
const month = planMonth(opts);
const cases = CASES.map((c) => ({ pro: c.pro, service: c.service, date: addDays(WEEK, c.day), time: c.time, active: c.kind !== 'cancelled' }));
const all = [...cases, ...month.map((m) => ({ pro: m.pro, service: m.service, date: m.date, time: m.time, active: true }))];
let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error('FALLA:', msg); } else console.log('ok   :', msg); };

const t = tally(all);
check(t.total === 450, `total 450 (da ${t.total})`);
for (const [c, n] of Object.entries(TARGET_BY_CATEGORY)) check(t.byCat[c] === n, `categoría ${c} = ${n} (da ${t.byCat[c]})`);
for (const [p, n] of Object.entries(TARGET_BY_PRO)) check(t.byPro[p] === n, `profesional ${p} = ${n} (da ${t.byPro[p]})`);

const seen = new Set<string>(); let dup = 0, offGrid = 0, sundays = 0;
for (const a of all) {
  const key = `${a.pro}|${a.date}|${a.time}`;
  if (a.active) { if (seen.has(key)) dup++; seen.add(key); }
  if (dow(a.date) === 6) sundays++;
  if (!gridStarts(pro(a.pro), a.date).includes(toMin(a.time))) offGrid++;
}
check(dup === 0, `0 turnos activos con el mismo inicio por profesional (da ${dup})`);
check(offGrid === 0, `0 turnos fuera de la grilla de 120 min y de las franjas (da ${offGrid})`);
check(sundays === 0, `0 turnos en domingo (da ${sundays})`);
check(JSON.stringify(planMonth(opts)) === JSON.stringify(month), 'determinístico (misma salida en dos corridas)');
check(pickDemoAppointments(month, REF).length === 2, 'hay 2 turnos futuros de la profesional de demostración para la clienta de demostración');
console.log('\nPor profesional:', t.byPro, '\nPor categoría:', t.byCat);
process.exit(fails ? 1 : 0);
