/**
 * Dispara a pedido el recordatorio por mail de UN turno de demostración, como si faltaran 3 horas para su inicio.
 * Ubicación: nexa-backend/scripts/demo-recordatorio.ts
 *
 * Por qué hace falta: el recordatorio sale solo cuando faltan entre 5 y 1 horas. Para mostrarlo sin esperar, se llama
 * a runAppointmentReminderJob con `now` = inicio del turno menos 3 horas (el job recibe el reloj por parámetro).
 *
 * ATENCIÓN: el job NO manda el mail de un solo turno: manda el de TODOS los turnos que entran en esa ventana. Por eso
 * el comportamiento normal es solo MOSTRAR cuáles entrarían (sin enviar nada) y enviar únicamente con --enviar, y solo
 * si el turno elegido es el único que entra.
 *
 *   npm run demo:recordatorio -- <idTurno>              muestra cuántos turnos entran en la ventana (no envía nada)
 *   npm run demo:recordatorio -- <idTurno> --enviar     envía el mail (real, por el proveedor configurado en .env)
 *   npm run demo:recordatorio -- <idTurno> --restaurar  vuelve a dejar el recordatorio como "sin enviar" para repetir la demostración
 *
 * Después de enviar, el turno queda marcado como "recordatorio enviado" (reminder_sent_at): usar --restaurar si ese
 * mismo turno tiene que recibir el recordatorio solo, más adelante. Solo contra una base local.
 */
import { assertDemoEmails, envEmail, guardDatabase, leerConfiguracion } from './seed-presentacion/entorno'; // primero: carga el .env
import { prisma } from '../src/app/database/prisma';
import { runAppointmentReminderJob } from '../src/jobs/appointmentReminder.job';
import { REMINDER_HOURS_BEFORE, REMINDER_MIN_BOOKING_HOURS, REMINDER_RETRY_UNTIL_HOURS, isReminderDue } from '../src/modules/appointments/reminder';
import { startInstant } from '../src/modules/appointments/reopenedSlots';
import { isDepositPaid } from '../src/modules/appointments/cancellationRules';
import { todayArgentinaStr } from '../src/app/utils/argentinaTime';
import { maskEmail } from '../src/app/utils/maskEmail';

const HOUR_MS = 3600000;
const SIMULATED_HOURS_LEFT = 3;

async function main() {
  guardDatabase();
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith('--'));
  const send = args.includes('--enviar');
  const restore = args.includes('--restaurar');
  if (!id) throw new Error('Uso: npm run demo:recordatorio -- <idTurno> [--enviar | --restaurar]');
  const emails = leerConfiguracion(() => [envEmail('SEED_PRO_EMAIL', 'profesional.e@example.com'), envEmail('SEED_CLIENT_EMAIL', 'clienta.cdemo@example.com')]);
  assertDemoEmails(emails[0], emails[1]);

  const target = await prisma.appointment.findUnique({ where: { id }, include: { client: { include: { client: true } } } });
  if (!target) throw new Error('No encontré un turno con ese id.');
  const groupIds = target.comboGroupId
    ? (await prisma.appointment.findMany({ where: { comboGroupId: target.comboGroupId }, select: { id: true } })).map((a) => a.id)
    : [target.id];

  if (restore) {
    const r = await prisma.appointment.updateMany({ where: { id: { in: groupIds } }, data: { reminderSentAt: null } });
    console.log(`Recordatorio restaurado como "sin enviar" en ${r.count} turno(s).`);
    return;
  }

  const start = startInstant(target);
  const now = new Date(start.getTime() - SIMULATED_HOURS_LEFT * HOUR_MS);
  console.log(`Turno ${target.id}: ${target.date} ${target.time} (estado: ${target.status}). Reloj simulado: ${now.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} hora de Argentina (faltan ${SIMULATED_HOURS_LEFT} h).`);

  // Misma búsqueda que hace el job (appointmentReminder.job.ts), con el reloj simulado.
  const dates = [...new Set([todayArgentinaStr(now), todayArgentinaStr(new Date(now.getTime() + REMINDER_HOURS_BEFORE * HOUR_MS))])];
  const rows = await prisma.appointment.findMany({
    where: { status: 'confirmed', reminderSentAt: null, date: { in: dates } },
    include: { client: { include: { client: true } }, professional: true, service: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const due = rows.filter((r) => isReminderDue(r, now));
  const groups = new Map<string, typeof due>();
  for (const r of due) { const k = r.comboGroupId ?? r.id; groups.set(k, [...(groups.get(k) ?? []), r]); }

  console.log(`\nTurnos que entran en la ventana de este reloj (se mandaría 1 mail por grupo): ${groups.size}`);
  for (const legs of groups.values()) {
    const l = legs[0];
    console.log(`  - ${l.id}  ${l.date} ${l.time}  ${legs.map((x) => x.service.name).join(' + ')}  → ${maskEmail(l.client.email)}${legs.some((x) => groupIds.includes(x.id)) ? '   <== el turno elegido' : ''}`);
  }

  const targetIsDue = due.some((r) => groupIds.includes(r.id));
  if (!targetIsDue) {
    const why: string[] = [];
    if (target.status !== 'confirmed') why.push(`el estado es "${target.status}" (tiene que ser confirmed)`);
    if (target.reminderSentAt) why.push('ya figura con el recordatorio enviado (usar --restaurar)');
    if (Number(target.depositAmount) > 0 && !isDepositPaid(target)) why.push('la seña no está paga');
    if ((start.getTime() - target.createdAt.getTime()) / HOUR_MS < REMINDER_MIN_BOOKING_HOURS) why.push(`se reservó con menos de ${REMINDER_MIN_BOOKING_HOURS} h de anticipación`);
    if (!target.client.active || target.client.client?.blocked) why.push('la cuenta de la clienta está desactivada o bloqueada');
    console.log(`\nEl turno elegido NO entra en la ventana (${REMINDER_RETRY_UNTIL_HOURS} a ${REMINDER_HOURS_BEFORE} h): ${why.join('; ') || 'revisar la regla en src/modules/appointments/reminder.ts'}.`);
  }

  if (!send) {
    console.log('\nNo se envió nada (modo de solo lectura). Para enviar el mail: agregar --enviar.');
    return;
  }
  if (!targetIsDue) throw new Error('No se envía: el turno elegido no entra en la ventana.');
  if (groups.size !== 1) throw new Error(`No se envía: entran ${groups.size} grupos de turnos y el job mandaría un mail por cada uno. Dejar solo el turno elegido.`);
  if (target.client.email.toLowerCase().endsWith('@example.com')) throw new Error('No se envía: la clienta de ese turno tiene un correo @example.com, que no tiene buzón. Usar un turno de la clienta de demostración con SEED_CLIENT_EMAIL.');

  console.log(`\nEnviando el recordatorio a ${maskEmail(target.client.email)} ...`);
  const result = await runAppointmentReminderJob(now);
  console.log('Resultado del job:', result);
  if (result.sent !== 1) process.exitCode = 1;
  else console.log('Listo. El turno quedó marcado como "recordatorio enviado": para repetirlo, npm run demo:recordatorio -- ' + id + ' --restaurar');
}

main()
  .catch((e) => { console.error('Error:', e?.message ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
