/**
 * Datos de prueba para la presentación de Nexa (sintéticos, Ley N.º 25.326).
 * Ubicación: nexa-backend/scripts/seed-presentacion.ts  (junto a scripts/seed-presentacion/plan.ts)
 * Comando:   npm run seed:presentacion
 *
 * Carga: configuración, catálogo, 7 agendas, clientas ficticias, 14 casos de prueba (semana del 2 al 7 de
 * noviembre de 2026) y el reparto de 450 turnos del mes por cuotas (Gráficos 1 y 2 del informe).
 * NO crea el administrador: lo crea seedAdmin() al arrancar el servidor con ADMIN_EMAIL y ADMIN_PASSWORD.
 * Es idempotente. No usar contra producción ni contra una base compartida.
 *
 * Variables (ver scripts/seed-presentacion/README.md):
 *   SEED_PASSWORD     contraseña de las cuentas de demostración (OBLIGATORIA, sin valor por defecto)
 *   SEED_PRO_EMAIL    correo real de la profesional de demostración (Profesional E), para ver sus mails
 *   SEED_CLIENT_EMAIL correo real de la clienta de demostración (puede ser Hotmail u otro)
 *   SEED_REF_DATE     fecha de "hoy" de la demostración (por defecto 2026-11-21, el día siguiente a la presentación)
 *   SEED_WEEK_START   lunes de la semana de casos (por defecto 2026-11-02)
 *   SEED_SKIP_MONTH   "1" para cargar solo los casos de la semana
 *   SEED_CONFIRM_HOST si la base no es local, debe valer el nombre del servidor de DATABASE_URL
 */
import { assertDemoDatabase, assertDemoEmails, envDate, envEmail, envText, guardDatabase, leerConfiguracion } from './seed-presentacion/entorno'; // primero: carga el .env
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs'; // igual que bcrypt.provider.ts del backend (SALT_ROUNDS = 12)
import { randomUUID } from 'crypto';
import { PRIVACY_POLICY_VERSION } from '../src/app/constants/legal';
import {
  CASES, COMBOS, DEMO_PRO, PROFESSIONALS, SERVICES, TARGET_BY_CATEGORY, TARGET_BY_PRO,
  addDays, pickDemoAppointments, planMonth, svc, tally,
} from './seed-presentacion/plan';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;
const PASSWORD = envText('SEED_PASSWORD'); // obligatoria: no hay contraseña por defecto en un repositorio público
const { WEEK_START, REF_DATE, PRO_EMAIL, CLIENT_EMAIL } = leerConfiguracion(() => ({
  WEEK_START: envDate('SEED_WEEK_START', '2026-11-02'),
  REF_DATE: envDate('SEED_REF_DATE', '2026-11-21'),
  PRO_EMAIL: envEmail('SEED_PRO_EMAIL', 'profesional.e@example.com'),
  CLIENT_EMAIL: envEmail('SEED_CLIENT_EMAIL', 'clienta.cdemo@example.com'),
}));
// Modo reducido (SEED_SKIP_MONTH=1): sin el reparto de 450 turnos ni las 60 clientas del reparto; deja los 14 casos de la semana y
// 2 turnos futuros de la clienta de demostración. SEED_SKIP_BUSINESS=1 no toca los datos del negocio ni el horario público (los carga el
// administrador). SEED_PRO_KEY elige qué agenda usa SEED_PRO_EMAIL (por defecto la E; por ejemplo A).
const SKIP_MONTH = process.env.SEED_SKIP_MONTH === '1';
const SKIP_BUSINESS = process.env.SEED_SKIP_BUSINESS === '1';
const PRO_KEY = envText('SEED_PRO_KEY') ?? DEMO_PRO;
if (!PROFESSIONALS.some((p) => p.key === PRO_KEY)) { console.error(`Error de configuración: SEED_PRO_KEY "${PRO_KEY}" no es una agenda (LOREN, A, B, C, D, E o F).`); process.exit(1); }
const MONTH_START = `${WEEK_START.slice(0, 7)}-01`;
const TERMS_VERSION = PRIVACY_POLICY_VERSION; // versión de la política vigente (RF-08), la misma que usa el backend
const DEPOSIT = 5000;
const CLIENT_POOL = 60;
const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const at = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`);
const plusMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

async function main() {
  console.log(`Base de datos: ${guardDatabase()}`);
  if (!PASSWORD) throw new Error('Definí SEED_PASSWORD en tu .env local (contraseña de las cuentas de demostración).');
  assertDemoEmails(PRO_EMAIL, CLIENT_EMAIL);
  await assertDemoDatabase(prisma, [PRO_EMAIL, CLIENT_EMAIL]);
  const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  const now = new Date();

  // --- Configuración general ---
  if ((await prisma.paymentSettings.count()) === 0) await prisma.paymentSettings.create({ data: {} }); // defaults: $5000 fija, 12 h, política full
  // WhatsApp con código de país (54 9 ...): el frontend arma https://wa.me/<número> con este valor tal cual.
  const info = { name: 'Loren Estudio de Belleza', description: 'Estudio de belleza en Posadas, Misiones.', address: 'Eva Perón 3137, Posadas, Misiones', phone: '3765018665', whatsapp: '5493765018665', instagram: '@loren_estudio' };
  const biz = SKIP_BUSINESS ? null : await prisma.businessSettings.findFirst();
  // "Coordinar por WhatsApp" solo aparece si el negocio tiene WhatsApp cargado.
  if (SKIP_BUSINESS) { /* los datos del negocio los carga el administrador */ }
  else if (!biz) await prisma.businessSettings.create({ data: info });
  else await prisma.businessSettings.update({ where: { id: biz.id }, data: { name: biz.name || info.name, description: biz.description || info.description, address: biz.address || info.address, phone: biz.phone || info.phone, whatsapp: biz.whatsapp || info.whatsapp, instagram: biz.instagram || info.instagram } });
  // Horario público (solo informativo): lunes a sábado de 08:00 a 20:00.
  for (const [i, day] of (SKIP_BUSINESS ? [] : DAY_NAMES).entries()) {
    const isOpen = i < 6;
    await prisma.businessScheduleDay.upsert({ where: { day }, update: { isOpen, openTime: '08:00', closeTime: '20:00' }, create: { day, isOpen, openTime: '08:00', closeTime: '20:00' } });
  }

  // --- Servicios ---
  const serviceId: Record<string, string> = {};
  for (const s of SERVICES) {
    const row = (await prisma.service.findFirst({ where: { name: s.name } })) ??
      (await prisma.service.create({ data: { name: s.name, categoryId: s.cat, description: s.description, duration: s.duration, price: s.price } }));
    serviceId[s.key] = row.id;
  }
  // Servicios simultáneos (combos): categoría "combo", cada componente lo hace una profesional distinta a la misma hora.
  for (const c of COMBOS) {
    if (await prisma.service.findFirst({ where: { name: c.name } })) continue;
    await prisma.service.create({ data: { name: c.name, categoryId: 'combo', description: c.description, duration: c.duration, price: c.price, isCombo: true, simultaneous: true, comboServiceIds: c.parts.map((k) => serviceId[k]) } });
  }

  // --- Profesionales ---
  const proUserId: Record<string, string> = {};
  for (const p of PROFESSIONALS) {
    const email = p.key === PRO_KEY ? PRO_EMAIL : p.email;
    const user = await prisma.user.upsert({
      where: { email }, update: {},
      create: { name: p.name, email, passwordHash, role: 'professional', gender: 'female', emailVerified: true, profileComplete: true, termsAcceptedAt: now, termsVersion: TERMS_VERSION },
    });
    proUserId[p.key] = user.id;
    const prof = await prisma.professional.upsert({
      where: { userId: user.id }, update: {},
      create: { userId: user.id, specialty: p.specialty, toleranceMinutes: 30, joinedAt: new Date(`${p.joinedAt}T12:00:00Z`) },
    });
    await prisma.professionalAvailability.deleteMany({ where: { professionalId: prof.id } });
    for (const [d, ranges] of Object.entries(p.availability)) {
      for (const [startTime, endTime] of ranges) await prisma.professionalAvailability.create({ data: { professionalId: prof.id, dayOfWeek: Number(d), startTime, endTime } });
    }
    for (const sk of p.services) {
      await prisma.professionalService.upsert({
        where: { professionalId_serviceId: { professionalId: prof.id, serviceId: serviceId[sk] } }, update: {},
        create: { professionalId: prof.id, serviceId: serviceId[sk], ownPrice: svc(sk).price, ownDuration: svc(sk).duration },
      });
    }
  }

  // --- Clientas: C1 a C6 (casos), M001 a M060 (reparto mensual) y CDEMO (clienta de demostración) ---
  const keys = ['CDEMO', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', ...(SKIP_MONTH ? [] : Array.from({ length: CLIENT_POOL }, (_, i) => `M${String(i + 1).padStart(3, '0')}`))];
  const clientId: Record<string, string> = {};
  for (const [i, k] of keys.entries()) {
    const email = k === 'CDEMO' ? CLIENT_EMAIL : `clienta.${k.toLowerCase()}@example.com`;
    const user = await prisma.user.upsert({
      where: { email }, update: {},
      create: { name: k === 'CDEMO' ? 'Clienta Demo' : 'Clienta', lastName: k === 'CDEMO' ? 'Presentación' : `Demo ${k}`, email, phone: `3764${String(i + 1).padStart(6, '0')}`, passwordHash, role: 'client', gender: 'female', emailVerified: true, profileComplete: true, termsAcceptedAt: now, termsVersion: TERMS_VERSION },
    });
    clientId[k] = user.id;
    await prisma.client.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
  }

  // --- Casos de prueba de la semana ---
  const groupIds: Record<string, string> = {};
  const seededClientIds = new Set(Object.values(clientId));
  let created = 0;
  const exists = (clientKey: string, proKey: string, date: string, time: string) =>
    prisma.appointment.findFirst({ where: { clientId: clientId[clientKey], professionalId: proUserId[proKey], date, time } });

  for (const c of CASES) {
    const date = addDays(WEEK_START, c.day);
    if (await exists(c.client, c.pro, date, c.time)) continue;
    const s = svc(c.service); const deposit = c.deposit ?? DEPOSIT; const start = at(date, c.time);
    if (c.comboGroup) groupIds[c.comboGroup] ??= randomUUID();
    const base = {
      clientId: clientId[c.client], professionalId: proUserId[c.pro], serviceId: serviceId[c.service], date, time: c.time,
      duration: s.duration, servicePrice: s.price, depositAmount: deposit, depositMethod: 'whatsapp', depositPaidAt: deposit > 0 ? plusMin(start, -2880) : null, allergies: c.allergies ?? null,
      hasCompanion: false, comboGroupId: c.comboGroup ? groupIds[c.comboGroup] : null,
      previousDate: c.previous ? addDays(WEEK_START, c.previous.day) : null, previousTime: c.previous ? c.previous.time : null,
    };
    let appt;
    if (c.kind === 'finished') {
      // seña + saldo cobrado en el local cubren el precio: paymentStatus 'paid'
      appt = await prisma.appointment.create({ data: { ...base, status: 'finished', paymentStatus: 'paid', arrivedAt: start, balancePaymentMethod: 'cash', balancePaidAmount: s.price - deposit, balancePaidAt: plusMin(start, s.duration), balanceCollectedById: proUserId[c.pro] } });
    } else if (c.kind === 'cancelled') {
      const notice = at(addDays(WEEK_START, c.noticeAt!.day), c.noticeAt!.time);
      const hours = (start.getTime() - notice.getTime()) / 3600000;
      // R-02: con 12 horas o más de aviso la seña queda 'refunded'; con menos, queda sin cambio ('partial', retenida).
      appt = await prisma.appointment.create({ data: { ...base, status: 'cancelled', paymentStatus: hours >= 12 ? 'refunded' : 'partial', cancelledAt: notice, cancelReason: 'user_cancelled', cancelledBy: 'client', clientNoticeAt: notice, noticeChannel: 'whatsapp' } });
    } else if (c.kind === 'cancelled_no_show') {
      appt = await prisma.appointment.create({ data: { ...base, status: 'cancelled_no_show', paymentStatus: 'partial', cancelledAt: plusMin(start, 15), slotLocked: true } });
    } else {
      appt = await prisma.appointment.create({ data: { ...base, status: 'no_show_auto', paymentStatus: 'partial' } });
    }
    created++;
    if (c.allergies) {
      // Formato que escribe el backend: alertas_servicio:<idDelTurno>:<ISO UTC>
      const cl = await prisma.client.findUnique({ where: { userId: clientId[c.client] } });
      const entry = `alertas_servicio:${appt.id}:${start.toISOString()}`;
      if (cl && !cl.consents.includes(entry)) await prisma.client.update({ where: { userId: clientId[c.client] }, data: { consents: { push: entry } } });
    }
    if (c.review) {
      await prisma.review.upsert({
        where: { appointmentId: appt.id }, update: {},
        create: { clientId: clientId[c.client], appointmentId: appt.id, rating: c.review.rating, message: c.review.message ?? null, status: c.review.message ? 'pending' : 'approved' },
      });
    }
  }

  // --- Reparto mensual por cuotas ---
  const fullPlan = planMonth({ monthStart: MONTH_START, weekStart: WEEK_START, refDate: REF_DATE, clientPool: CLIENT_POOL });
  const demoKeys = new Set(pickDemoAppointments(fullPlan, REF_DATE, PRO_KEY));
  const plan = SKIP_MONTH ? fullPlan.filter((m) => demoKeys.has(m.key)) : fullPlan; // 2 turnos futuros de la profesional de demostración para la clienta de demostración
  for (const m of plan) {
    const clientKey = demoKeys.has(m.key) ? 'CDEMO' : m.clientKey;
    if (await exists(clientKey, m.pro, m.date, m.time)) continue;
    const start = at(m.date, m.time);
    const base = { clientId: clientId[clientKey], professionalId: proUserId[m.pro], serviceId: serviceId[m.service], date: m.date, time: m.time, duration: m.duration, servicePrice: m.price, depositAmount: DEPOSIT, depositMethod: 'whatsapp', hasCompanion: false, depositPaidAt: m.status === 'finished' ? plusMin(start, -2880) : now };
    await prisma.appointment.create({
      data: m.status === 'finished'
        ? { ...base, status: 'finished', paymentStatus: 'paid', arrivedAt: start, balancePaymentMethod: 'cash', balancePaidAmount: m.price - DEPOSIT, balancePaidAt: plusMin(start, m.duration), balanceCollectedById: proUserId[m.pro] }
        // Confirmado con seña paga (coordinada por WhatsApp). Se marca el recordatorio como enviado para que el job
        // no escriba a las cuentas ficticias; solo los turnos de la clienta de demostración lo reciben.
        : { ...base, status: 'confirmed', paymentStatus: 'partial', reminderSentAt: demoKeys.has(m.key) ? null : now },
    });
    created++;
  }

  // --- Control: lo guardado debe coincidir con los Gráficos 1 y 2 ---
  if (!SKIP_MONTH) {
    const rows = await prisma.appointment.findMany({ where: { clientId: { in: [...seededClientIds] }, OR: [{ internalNotes: null }, { NOT: { internalNotes: { startsWith: 'DEMO-AHORA' } } }] }, select: { professionalId: true, serviceId: true } });
    const proByUser = Object.fromEntries(Object.entries(proUserId).map(([k, v]) => [v, k]));
    const svcByKey = Object.fromEntries(Object.entries(serviceId).map(([k, v]) => [v, k]));
    const t = tally(rows.map((r) => ({ pro: proByUser[r.professionalId], service: svcByKey[r.serviceId] })));
    console.log('Turnos por categoría:', t.byCat, 'esperado:', TARGET_BY_CATEGORY);
    console.log('Turnos por profesional:', t.byPro, 'esperado:', TARGET_BY_PRO);
    if (t.total !== 450) console.warn(`Atención: se esperaban 450 turnos y hay ${t.total} (¿datos previos en la base?).`);
  }
  console.log(`Seed completado. Turnos nuevos: ${created}.`);
  console.log(`Cuentas (todas con la contraseña de SEED_PASSWORD): profesional de demostración (agenda ${PRO_KEY}) ${PRO_EMAIL}, clienta de demostración ${CLIENT_EMAIL}, Loren loren.demo@example.com y profesional.a, b, c, d, f@example.com. El administrador es ADMIN_EMAIL (ve todos los turnos).`);
}

main()
  .catch((e) => { console.error('Error en el seed:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
