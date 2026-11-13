/**
 * Plan de datos de presentación de Nexa. Funciones puras: no tocan la base de datos.
 * Ubicación: nexa-backend/scripts/seed-presentacion/plan.ts
 *
 * Contiene: catálogo de servicios, las 7 agendas (Gráfico 2 del informe), las cuotas que reproducen
 * los Gráficos 1 y 2 (450 turnos), 14 casos de prueba de la semana del 2 al 7 de noviembre de 2026
 * y el reparto del mes por cuotas, sin azar y sobre la grilla real de reserva (bloques de 120 min).
 *
 * PROVISORIO = dato que se debe confirmar con Loren antes de la defensa.
 * Reglas según el libro de requisitos v9.1 (09/11/2026) y las respuestas de Claude Code del 12/11/2026.
 */

export type CatKey = 'unas' | 'rostro' | 'cuerpo' | 'cabello';
export type Range = [string, string];

export interface ServiceDef { key: string; name: string; cat: CatKey; price: number; duration: number; description: string; fictitious?: boolean }
export interface ProDef { key: string; name: string; email: string; specialty: string; joinedAt: string; services: string[]; availability: Record<number, Range[]> }
export type CaseKind = 'finished' | 'cancelled' | 'cancelled_no_show' | 'no_show_auto';
export interface CaseDef {
  key: string; client: string; pro: string; service: string; day: number; time: string; kind: CaseKind;
  comboGroup?: string; deposit?: number; review?: { rating: number; message?: string };
  allergies?: string; previous?: { day: number; time: string }; noticeAt?: { day: number; time: string };
  purpose: string;
}
export interface Planned { key: string; pro: string; service: string; date: string; time: string; duration: number; price: number; clientKey: string; status: 'finished' | 'confirmed' }

// Grilla real de reserva: el frontend arma bloques de 120 minutos desde el inicio de cada franja
// y descarta el último bloque si no entra completo (availability.ts, SLOT_DURATION_MINUTES = 120).
export const SLOT_MINUTES = 120;

// ---------- Catálogo (lista de precios de noviembre de 2026) ----------
export const SERVICES: ServiceDef[] = [
  { key: 'S1', name: 'Semipermanente manos', cat: 'unas', price: 20000, duration: 90, description: 'Esmaltado semipermanente en manos, incluye el diseño elegido.' },
  { key: 'S2', name: 'Capping manos', cat: 'unas', price: 22000, duration: 90, description: 'Capping en manos, incluye el diseño elegido.' },
  { key: 'S3', name: 'Soft gel manos', cat: 'unas', price: 24000, duration: 120, description: 'Soft gel en manos, incluye el diseño elegido.' },
  { key: 'S4', name: 'Extensiones de pestañas clásicas', cat: 'rostro', price: 24000, duration: 120, description: 'Extensiones pelo por pelo, estilo clásico.' },
  { key: 'S5', name: 'Lifting de pestañas con tinte, nutrición y botox', cat: 'rostro', price: 25000, duration: 60, description: 'Lifting de pestañas con tinte, nutrición y botox.' },
  { key: 'S6', name: 'Perfilado de cejas', cat: 'rostro', price: 15000, duration: 30, description: 'Perfilado de cejas, henna opcional.' },
  { key: 'S7', name: 'Laminado de cejas', cat: 'rostro', price: 20000, duration: 60, description: 'Alinea y acomoda los vellos para lograr un efecto peinado.' },
  { key: 'S10', name: 'Limpieza facial profunda', cat: 'rostro', price: 22000, duration: 60, description: 'Limpieza facial profunda.' },
  { key: 'S11', name: 'Maquillaje', cat: 'rostro', price: 50000, duration: 60, description: 'Maquillaje social.' },
  { key: 'S12', name: 'Maquillaje con prueba', cat: 'rostro', price: 70000, duration: 120, description: 'Incluye limpieza y preparación de la piel.' },
  { key: 'S8', name: 'Masaje descontracturante cuerpo completo dama', cat: 'cuerpo', price: 25000, duration: 60, description: 'Masaje descontracturante de cuerpo completo.' },
  { key: 'S9', name: 'Masaje relajante cuerpo completo dama', cat: 'cuerpo', price: 20000, duration: 60, description: 'Masaje relajante de cuerpo completo.' },
  // Cabello: peinado para eventos. Precio y duración de prueba, no constan en ninguna lista.
  { key: 'S14', name: 'Peinado para eventos', cat: 'cabello', price: 25000, duration: 90, description: 'Peinado para eventos. Precio y duración de prueba.', fictitious: true },
];

// Servicios simultáneos (combos): cada servicio lo hace una profesional distinta a la misma hora (R-07).
// El precio del combo es menor que la suma de los servicios. No cuentan en los 450 turnos: ningún turno del plan los usa.
export interface ComboDef { name: string; parts: string[]; price: number; duration: number; description: string }
export const COMBOS: ComboDef[] = [
  { name: 'Semipermanente + Perfilado de cejas', parts: ['S1', 'S6'], price: 32000, duration: 90, description: 'Semipermanente en manos y perfilado de cejas, en simultáneo con dos profesionales.' },
  { name: 'Extensiones de pestañas + Capping manos', parts: ['S4', 'S2'], price: 42000, duration: 120, description: 'Extensiones de pestañas clásicas y capping en manos, en simultáneo con dos profesionales.' },
];

// ---------- Agendas (Gráfico 2) ----------
// dayOfWeek: 0 = lunes ... 5 = sábado (6 = domingo, sin atención).
const DAYS = [0, 1, 2, 3, 4, 5];
const open = (r: Range[]): Record<number, Range[]> => Object.fromEntries(DAYS.map((d) => [d, r]));
// El correo de la profesional E (DEMO_PRO) puede reemplazarse por un correo real con SEED_PRO_EMAIL (ver el seed).
export const PROFESSIONALS: ProDef[] = [
  { key: 'LOREN', name: 'Loren', email: 'loren.demo@example.com', specialty: 'Uñas', joinedAt: '2025-09-01', services: ['S1', 'S2', 'S3'], availability: open([['08:00', '20:00']]) },
  // Franjas PROVISORIAS de cada agenda (inspiradas en los horarios publicados por el estudio, ajustadas a la grilla de 120 min).
  { key: 'C', name: 'Profesional C', email: 'profesional.c@example.com', specialty: 'Cejas y pestañas', joinedAt: '2025-10-15', services: ['S4', 'S5', 'S6', 'S7'], availability: open([['09:00', '13:00'], ['14:00', '18:00']]) },
  { key: 'A', name: 'Profesional A', email: 'profesional.a@example.com', specialty: 'Tratamientos faciales, corporales y masajes', joinedAt: '2025-09-15', services: ['S8', 'S9', 'S10'], availability: open([['08:00', '12:00'], ['15:00', '19:00']]) },
  { key: 'B', name: 'Profesional B', email: 'profesional.b@example.com', specialty: 'Uñas', joinedAt: '2025-10-01', services: ['S1', 'S2', 'S3'], availability: open([['08:00', '20:00']]) },
  { key: 'D', name: 'Profesional D', email: 'profesional.d@example.com', specialty: 'Maquillaje y peinados', joinedAt: '2025-11-01', services: ['S11', 'S12', 'S14'], availability: open([['08:00', '20:00']]) },
  { key: 'E', name: 'Profesional E', email: 'profesional.e@example.com', specialty: 'Uñas', joinedAt: '2026-03-01', services: ['S1', 'S2', 'S3'], availability: open([['08:00', '20:00']]) },
  { key: 'F', name: 'Profesional F', email: 'profesional.f@example.com', specialty: 'Peinados', joinedAt: '2026-05-01', services: ['S14'], availability: open([['08:00', '20:00']]) },
];

// ---------- Cuotas (Gráficos 1 y 2) ----------
// Equipo real: 1 de cejas y pestañas, 3 de uñas (Loren y dos más), 1 de tratamientos faciales, corporales y masajes,
// 1 de maquillaje y 1 de peinados. Uñas: 120 + 85 + 15 = 220 (única combinación posible con el Gráfico 2).
// SUPUESTO PROVISORIO: la profesional de maquillaje (D, 65) hace 50 de maquillaje y 15 de peinados; sin eso ninguna
// agenda del Gráfico 2 puede producir los 30 turnos de Cabello del Gráfico 1.
export const QUOTAS: Record<string, Partial<Record<CatKey, number>>> = {
  LOREN: { unas: 120 }, B: { unas: 85 }, E: { unas: 15 },
  C: { rostro: 65 }, A: { cuerpo: 70, rostro: 15 }, D: { rostro: 50, cabello: 15 }, F: { cabello: 15 },
};
export const TARGET_BY_CATEGORY: Record<CatKey, number> = { unas: 220, rostro: 130, cuerpo: 70, cabello: 30 };
export const TARGET_BY_PRO: Record<string, number> = { LOREN: 120, B: 85, A: 85, C: 65, D: 65, E: 15, F: 15 };

// ---------- Casos de prueba (semana lunes 2 a sábado 7 de noviembre de 2026) ----------
// day: 0 = lunes ... 5 = sábado. Clientas C1 a C6 ficticias. Todos los inicios caen sobre la grilla de 120 minutos.
export const CASES: CaseDef[] = [
  { key: 'A01', client: 'C1', pro: 'LOREN', service: 'S1', day: 3, time: '16:00', kind: 'finished', comboGroup: 'G1', review: { rating: 5 }, purpose: 'Combo R-07, pata 1: lleva la única seña' },
  { key: 'A02', client: 'C1', pro: 'C', service: 'S6', day: 3, time: '16:00', kind: 'finished', comboGroup: 'G1', deposit: 0, review: { rating: 5 }, purpose: 'Combo R-07, pata 2: sin seña propia, mismo horario con otra profesional' },
  { key: 'A03', client: 'C2', pro: 'LOREN', service: 'S3', day: 1, time: '08:00', kind: 'finished', review: { rating: 5, message: 'Excelente atención' }, purpose: 'Consecutivos de 120 min: 1 de 3' },
  { key: 'A04', client: 'C3', pro: 'LOREN', service: 'S3', day: 1, time: '10:00', kind: 'finished', review: { rating: 4 }, purpose: 'Consecutivos: empieza justo cuando termina el anterior' },
  { key: 'A05', client: 'C4', pro: 'LOREN', service: 'S3', day: 1, time: '12:00', kind: 'finished', review: { rating: 5 }, purpose: 'Consecutivos: 3 de 3, sin baches' },
  { key: 'A06', client: 'C5', pro: 'C', service: 'S5', day: 5, time: '09:00', kind: 'finished', allergies: 'Piel sensible', review: { rating: 5 }, purpose: 'R-05: advertencia operativa con consentimiento' },
  { key: 'A07', client: 'C5', pro: 'A', service: 'S10', day: 5, time: '10:00', kind: 'finished', allergies: 'Piel sensible', purpose: 'Encadenado: la misma clienta pasa de una profesional a otra' },
  { key: 'A08', client: 'C6', pro: 'LOREN', service: 'S3', day: 0, time: '10:00', kind: 'finished', review: { rating: 4 }, purpose: 'Turno de 120 min realizado con reseña' },
  { key: 'A09', client: 'C4', pro: 'LOREN', service: 'S2', day: 2, time: '14:00', kind: 'cancelled', noticeAt: { day: 0, time: '20:00' }, purpose: 'R-02: aviso con 42 h, seña devuelta' },
  { key: 'A10', client: 'C2', pro: 'C', service: 'S4', day: 4, time: '14:00', kind: 'cancelled_no_show', purpose: 'R-03: no asistió marcado por el personal, seña retenida, horario original bloqueado' },
  { key: 'A11', client: 'C3', pro: 'LOREN', service: 'S1', day: 4, time: '16:00', kind: 'finished', previous: { day: 2, time: '16:00' }, review: { rating: 5 }, purpose: 'Reprogramación (RF-13) sin límite de intentos' },
  { key: 'A12', client: 'C6', pro: 'LOREN', service: 'S2', day: 5, time: '10:00', kind: 'cancelled', noticeAt: { day: 4, time: '22:00' }, purpose: 'Límite R-02: aviso con exactamente 12 h, seña devuelta' },
  { key: 'A13', client: 'C1', pro: 'LOREN', service: 'S1', day: 5, time: '14:00', kind: 'cancelled', noticeAt: { day: 5, time: '02:01' }, purpose: 'Límite R-02: aviso con 11 h 59 min, seña retenida' },
  { key: 'A14', client: 'C5', pro: 'B', service: 'S1', day: 3, time: '10:00', kind: 'no_show_auto', purpose: 'R-03: más de 30 min sin llegar, no asistió automático, horario sigue ocupado' },
];

// ---------- helpers ----------
export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export function addDays(date: string, n: number): string { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
// 0 = lunes ... 6 = domingo (misma convención que el backend)
export const dow = (date: string) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
export const svc = (key: string) => SERVICES.find((s) => s.key === key)!;
export const pro = (key: string) => PROFESSIONALS.find((p) => p.key === key)!;
const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];
/** Inicios válidos de un día para una profesional: bloques de 120 min desde el inicio de cada franja. */
export function gridStarts(p: ProDef, date: string): number[] {
  const out: number[] = [];
  for (const [rs, re] of p.availability[dow(date)] ?? []) for (let s = toMin(rs); s + SLOT_MINUTES <= toMin(re); s += SLOT_MINUTES) out.push(s);
  return out;
}

// ---------- Reparto del mes por cuotas ----------
export interface PlanOpts { monthStart: string; weekStart: string; refDate: string; clientPool: number }
export function planMonth(o: PlanOpts): Planned[] {
  const dates: string[] = [];
  for (let i = 0; i < 31; i++) { const d = addDays(o.monthStart, i); if (d.slice(0, 7) !== o.monthStart.slice(0, 7)) break; if (dow(d) !== 6) dates.push(d); }
  const busy = new Set<string>(); // pro|fecha|inicio
  const clientBusy: Record<string, [number, number][]> = {};
  const caseStarts = new Set<string>();
  const used: Record<string, Record<string, number>> = {};
  const addC = (k: string, iv: [number, number]) => (clientBusy[k] ??= []).push(iv);
  for (const c of CASES) {
    const date = addDays(o.weekStart, c.day); const s = svc(c.service);
    caseStarts.add(`${c.pro}|${date}|${c.time}`);
    if (c.kind !== 'cancelled') busy.add(`${c.pro}|${date}|${c.time}`);
    addC(`${c.client}|${date}`, [toMin(c.time), toMin(c.time) + s.duration]);
    used[c.pro] ??= {}; used[c.pro][s.cat] = (used[c.pro][s.cat] ?? 0) + 1;
  }
  const out: Planned[] = []; let cursor = 0; let seq = 1;
  for (const p of PROFESSIONALS) {
    const items: { cat: CatKey; frac: number }[] = [];
    for (const [cat, total] of Object.entries(QUOTAS[p.key] ?? {}) as [CatKey, number][]) {
      const left = total - (used[p.key]?.[cat] ?? 0);
      for (let i = 0; i < left; i++) items.push({ cat, frac: (i + 0.5) / left });
    }
    items.sort((a, b) => a.frac - b.frac || a.cat.localeCompare(b.cat));
    const rot: Record<string, number> = {};
    items.forEach((it, k) => {
      const options = p.services.filter((sk) => svc(sk).cat === it.cat);
      const sKey = options[(rot[it.cat] = (rot[it.cat] ?? -1) + 1) % options.length]; const s = svc(sKey);
      const d0 = Math.floor(((k + 0.5) * dates.length) / items.length); let placed = false;
      for (let j = 0; j < dates.length && !placed; j++) {
        const date = dates[(d0 + j) % dates.length];
        for (const st of gridStarts(p, date)) {
          const t = fromMin(st);
          if (caseStarts.has(`${p.key}|${date}|${t}`) || busy.has(`${p.key}|${date}|${t}`)) continue;
          const iv: [number, number] = [st, st + s.duration]; let ck = '';
          for (let q = 0; q < o.clientPool; q++) {
            const cand = `M${String(((cursor + q) % o.clientPool) + 1).padStart(3, '0')}`;
            if (!(clientBusy[`${cand}|${date}`] ?? []).some((b) => overlaps(b, iv))) { ck = cand; cursor += q + 1; break; }
          }
          if (!ck) continue;
          busy.add(`${p.key}|${date}|${t}`); addC(`${ck}|${date}`, iv);
          out.push({ key: `M${String(seq++).padStart(4, '0')}`, pro: p.key, service: sKey, date, time: t, duration: s.duration, price: s.price, clientKey: ck, status: date < o.refDate ? 'finished' : 'confirmed' });
          placed = true; break;
        }
      }
      if (!placed) throw new Error(`Sin lugar para ${p.key} (${it.cat}); revisar cuotas o agenda.`);
    });
  }
  return out;
}

/** Profesional de demostración: la que usa el correo real de prueba (SEED_PRO_EMAIL). Es la de 15 turnos al mes, así que tiene pocos turnos. */
export const DEMO_PRO = 'E';

/** Elige los 2 turnos de la clienta de demostración: los primeros confirmados de la profesional de demostración desde refDate + 4 días. */
export function pickDemoAppointments(plan: Planned[], refDate: string, proKey: string = DEMO_PRO): string[] {
  const from = addDays(refDate, 4);
  const mine = plan.filter((a) => a.status === 'confirmed' && a.pro === proKey).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const late = mine.filter((a) => a.date >= from);
  return (late.length >= 2 ? late : mine).slice(0, 2).map((a) => a.key);
}

export function tally(rows: { pro: string; service: string }[]) {
  const byCat: Record<string, number> = { unas: 0, rostro: 0, cuerpo: 0, cabello: 0 }; const byPro: Record<string, number> = {};
  for (const r of rows) { byCat[svc(r.service).cat]++; byPro[r.pro] = (byPro[r.pro] ?? 0) + 1; }
  return { byCat, byPro, total: rows.length };
}
