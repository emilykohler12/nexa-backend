/**
 * Crea 3 turnos de demostración de la clienta de demostración con la profesional de demostración (Profesional E), contados desde el momento real en que se corre.
 * Ubicación: nexa-backend/scripts/demo-turnos-ahora.ts
 * Comando:   npm run demo:turnos-ahora      (correrlo 15 minutos antes de la presentación, con el servidor ya prendido)
 *
 *   1. "menos de 12 h":  empieza en pocas horas. Al cancelarlo la seña queda retenida (R-02).
 *   2. "12 h o más":     empieza al día siguiente. Al cancelarlo la seña queda devuelta (R-02).
 *   3. "recordatorio":   empieza en unas 3 horas y figura reservado con 6 horas de anticipación, así el recordatorio por mail
 *                        (R-24: entre 5 h y 1 h antes) sale solo en los próximos 5 minutos si el programador de tareas está activo.
 *
 * Son datos de demostración: se cargan directo en la base (no pasan por la reserva) y pueden quedar fuera del horario del estudio.
 * Usa la misma protección de base de datos que el seed. Variables: SEED_PRO_EMAIL, SEED_CLIENT_EMAIL, SEED_CONFIRM_HOST.
 */
import { assertDemoEmails, envEmail, guardDatabase, leerConfiguracion } from './seed-presentacion/entorno'; // primero: carga el .env
import { PrismaClient } from '@prisma/client';
import { pickDemoStarts } from './seed-presentacion/demo-times';
import { DEMO_PRO, svc } from './seed-presentacion/plan';

const prisma = new PrismaClient();
const MARK = 'DEMO-AHORA';
const DEPOSIT = 5000;

async function main() {
  guardDatabase();
  const now = new Date();
  const { proEmail, clientEmail } = leerConfiguracion(() => ({
    proEmail: envEmail('SEED_PRO_EMAIL', 'profesional.e@example.com'),
    clientEmail: envEmail('SEED_CLIENT_EMAIL', 'clienta.cdemo@example.com'),
  }));
  assertDemoEmails(proEmail, clientEmail);
  const proUser = await prisma.user.findUnique({ where: { email: proEmail } });
  const client = await prisma.user.findUnique({ where: { email: clientEmail } });
  if (!proUser || !client) throw new Error('Primero corré npm run seed:presentacion (no se encontró a la profesional o a la clienta de demostración).');
  const service = await prisma.service.findFirst({ where: { name: svc('S1').name } });
  if (!service) throw new Error('No se encontró el servicio. Corré antes el seed.');

  // --reiniciar: borra los turnos de demostración anteriores (solo los marcados DEMO-AHORA de la clienta de demostración)
  // para volver a crearlos desde el momento actual, por ejemplo entre el ensayo y la presentación.
  if (process.argv.includes('--reiniciar')) {
    const removed = await prisma.appointment.deleteMany({ where: { clientId: client.id, internalNotes: { startsWith: MARK } } });
    console.log(`Turnos de demostración anteriores borrados: ${removed.count}.`);
  }

  // Si ya quedan turnos de demostración vigentes, no se crean otros.
  const pending = await prisma.appointment.findMany({ where: { clientId: client.id, internalNotes: { startsWith: MARK }, status: 'confirmed' } });
  const alive = pending.filter((a) => new Date(`${a.date}T${a.time}:00-03:00`).getTime() > now.getTime());
  if (alive.length) { console.log('Ya hay turnos de demostración vigentes (para crear otros: npm run demo:turnos-ahora -- --reiniciar):'); alive.forEach((a) => console.log(`  ${a.date} ${a.time}  ${a.internalNotes}`)); return; }

  // Un horario con turno activo o con el horario original bloqueado (slot_locked) no se puede reservar: es el predicado del índice único.
  const busyRows = await prisma.appointment.findMany({ where: { professionalId: proUser.id, OR: [{ status: { notIn: ['cancelled', 'cancelled_no_show'] } }, { slotLocked: true }] }, select: { date: true, time: true } });
  const starts = pickDemoStarts(now, new Set(busyRows.map((r) => `${r.date}|${r.time}`)), DEMO_PRO);
  const s = svc('S1');
  const base = { clientId: client.id, professionalId: proUser.id, serviceId: service.id, duration: s.duration, servicePrice: s.price, depositAmount: DEPOSIT, depositMethod: 'whatsapp', status: 'confirmed', paymentStatus: 'partial', hasCompanion: false };
  const rows: [keyof typeof starts, string, Date | undefined, boolean][] = [
    ['menosDe12h', `${MARK} menos de 12 h`, undefined, true],
    ['masDe12h', `${MARK} 12 h o más`, undefined, true],
    // reservado 6 h antes del inicio, con el recordatorio todavía sin enviar
    ['recordatorio', `${MARK} recordatorio`, new Date(new Date(`${starts.recordatorio.date}T${starts.recordatorio.time}:00-03:00`).getTime() - 6 * 3600000), false],
  ];
  console.log('Turnos de demostración creados (clienta de demostración, Profesional E):');
  for (const [k, note, createdAt, markReminderSent] of rows) {
    const st = starts[k];
    await prisma.appointment.create({ data: { ...base, date: st.date, time: st.time, internalNotes: note, createdAt, reminderSentAt: markReminderSent ? now : null } });
    console.log(`  ${st.date} ${st.time}  faltan ${st.hoursAhead.toFixed(1)} h  ${note}${st.onGrid ? '' : '  (fuera del horario del estudio)'}`);
  }
  console.log('Cancelar el de "menos de 12 h": seña retenida. Cancelar el de "12 h o más": seña devuelta. El recordatorio llega solo en los próximos 5 minutos si el programador de tareas está activo.');
}

main().catch((e) => { console.error('Error:', e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
