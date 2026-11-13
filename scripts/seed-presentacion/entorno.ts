/**
 * Entorno y protecciones comunes de los scripts de la presentación (seed, turnos de demostración y recordatorio).
 * Ubicación: nexa-backend/scripts/seed-presentacion/entorno.ts
 *
 * Importar ESTE módulo primero en cada script: carga el .env antes de leer cualquier variable. Una variable ya
 * definida en la terminal gana sobre el .env (dotenv no pisa lo existente), así que `DATABASE_URL=... npm run ...`
 * apunta el script a otra base sin tocar el archivo.
 */
import { config } from 'dotenv';
config({ quiet: true });

import type { PrismaClient } from '@prisma/client';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

export function databaseHost(): string {
  try { return new URL(process.env.DATABASE_URL ?? '').hostname; } catch { return ''; }
}

/** Se niega a seguir si la base no es local (o si es producción). Devuelve el nombre del servidor. */
export function guardDatabase(): string {
  if (process.env.NODE_ENV === 'production') throw new Error('Este script no puede correr con NODE_ENV=production.');
  const host = databaseHost();
  if (!host) throw new Error('DATABASE_URL no está definida o no es una URL válida.');
  if (!LOCAL_HOSTS.includes(host) && process.env.SEED_CONFIRM_HOST !== host) {
    throw new Error(`La base apunta a "${host}", que no es local. Si es una base de demostración propia, definí SEED_CONFIRM_HOST=${host}.`);
  }
  return host;
}

/** Una variable vacía (como queda al copiar .env.example) cuenta como no definida. */
export function envText(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

/** Correo de una variable de entorno, normalizado como en el backend (trim + minúsculas). */
export function envEmail(name: string, fallback: string): string {
  const v = (envText(name) ?? fallback).toLowerCase();
  if (!/^[^\s@"']+@[^\s@"']+\.[^\s@"']+$/.test(v)) throw new Error(`${name} no es un correo válido.`);
  return v;
}

/** Fecha YYYY-MM-DD de una variable de entorno (con valor por defecto), validada. */
export function envDate(name: string, fallback: string): string {
  const v = envText(name) ?? fallback;
  const d = new Date(`${v}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
    throw new Error(`${name} tiene que ser una fecha AAAA-MM-DD válida (recibido "${v}").`);
  }
  return v;
}

/** Las cuentas reales de la demostración no pueden ser la del administrador ni la misma entre sí. */
export function assertDemoEmails(pro: string, client: string): void {
  const admin = envText('ADMIN_EMAIL')?.toLowerCase();
  if (pro === client) throw new Error('SEED_PRO_EMAIL y SEED_CLIENT_EMAIL tienen que ser correos distintos.');
  if (admin && (pro === admin || client === admin)) throw new Error('SEED_PRO_EMAIL y SEED_CLIENT_EMAIL no pueden ser el correo del administrador (ADMIN_EMAIL).');
}

/**
 * La base tiene que estar vacía o contener solo datos de demostración: administrador, cuentas @example.com y las dos
 * cuentas reales de la demostración. Si hay otras cuentas, es una base con datos de verdad y se corta.
 */
export async function assertDemoDatabase(prisma: PrismaClient, allowedEmails: string[]): Promise<void> {
  if (process.env.SEED_ACEPTAR_CUENTAS_AJENAS === '1') return; // ya probaste la demostración con otras cuentas en esta base local
  const foreign = await prisma.user.count({
    where: { role: { not: 'admin' }, NOT: { email: { endsWith: '@example.com', mode: 'insensitive' } }, email: { notIn: allowedEmails } },
  });
  if (foreign > 0) {
    throw new Error(`La base tiene ${foreign} cuenta(s) que no son de demostración. Usá una base local nueva y vacía; este script no se corre sobre datos reales. (Si son cuentas que creaste a propósito en esta base de demostración: SEED_ACEPTAR_CUENTAS_AJENAS=1.)`);
  }
}

/** Lee la configuración de las variables y, si una está mal, muestra solo el mensaje (sin el seguimiento de pila) y termina. */
export function leerConfiguracion<T>(leer: () => T): T {
  try { return leer(); } catch (e) { console.error('Error de configuración:', (e as Error).message); process.exit(1); }
}
