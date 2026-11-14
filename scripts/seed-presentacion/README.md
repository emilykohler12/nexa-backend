# Datos de la presentación de Nexa

Todo es sintético (Ley N.º 25.326): sin datos reales de clientas. Los precios y horarios son los publicados por el estudio.

## Comandos (desde `nexa-backend`)

    npm run seed:presentacion:verificar   # comprueba el reparto sin base de datos
    npm run seed:presentacion             # carga los datos (idempotente)

Agregar a `package.json` → scripts:

    "seed:presentacion": "tsx scripts/seed-presentacion.ts",
    "seed:presentacion:verificar": "tsx scripts/seed-presentacion/verify-plan.ts",
    "demo:turnos-ahora": "tsx scripts/demo-turnos-ahora.ts",
    "demo:turnos-ahora:verificar": "tsx scripts/seed-presentacion/verify-demo-times.ts"

## Variables (agregarlas a `.env.example` SIN valores reales)

    SEED_PASSWORD=
    SEED_PRO_EMAIL=        # correo real de la Profesional E (la de demostración)
    SEED_CLIENT_EMAIL=     # correo real de la clienta de demostración
    SEED_REF_DATE=2026-11-21
    SEED_CONFIRM_HOST=

## Instalar en otra computadora (paso a paso)

Todo vive en GitHub (rama `main`): no hace falta copiar nada a mano.

1. Clonar el repositorio y correr `npm install` dentro de `nexa-backend`.
2. Crear una base de PostgreSQL LOCAL y vacía. Si la vas a migrar con `prisma` desde Claude Code, el nombre tiene que llevar «test» (por ejemplo `nexa_presentacion_test`).
3. Copiar `.env.example` como `.env` y completar: `DATABASE_URL` (la base local), los secretos `JWT_*`, `FRONTEND_URL`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` (de demostración, distinta de la real), y los de mail si se quieren ver los correos. Además, solo para el seed: `SEED_PASSWORD` (contraseña de todas las cuentas de demostración), `SEED_PRO_EMAIL` (correo real de la Profesional A) y `SEED_CLIENT_EMAIL` (correo real de la clienta).
4. Aplicar las migraciones a esa base: `npx prisma migrate deploy`.
5. Arrancar el servidor una vez (`npm run dev`) para que cree el administrador, y frenarlo.
6. Cargar los datos, a elegir:

        npm run seed:presentacion:demo     # reducido: 7 profesionales (A es la de SEED_PRO_EMAIL), servicios con 2 simultáneos y los 14 casos de la semana; sin datos del negocio (los carga el administrador)
        npm run seed:presentacion          # completo: lo mismo más los 450 turnos del mes y los datos del negocio

   Los dos son idempotentes (se pueden correr de nuevo sin duplicar) y se niegan si la base no es local o si ya tiene cuentas reales.
7. Para el frontend: clonar `nexa-frontend`, `npm install`, `VITE_API_URL` apuntando al backend local, y `npm run dev`.

## Qué carga

7 agendas (Loren y Profesional A a F; la E es la de demostración), 13 servicios, 1 clienta de demostración, 6 clientas de casos, 60 clientas del reparto,
14 casos de prueba de la semana del 2 al 7 de noviembre y 450 turnos en total (Uñas 220, Rostro 130, Cuerpo 70, Cabello 30;
por profesional 120, 85, 85, 65, 65, 15 y 15). El reparto es determinístico (sin azar) y usa la grilla real de reserva
(bloques de 120 minutos). El administrador NO se crea acá: lo crea `seedAdmin()` al arrancar el servidor.

## Pendiente de confirmar con Loren (marcado PROVISORIO en plan.ts)

Qué categoría atiende cada profesional (en especial que la de maquillaje hace 15 peinados), las franjas de cada agenda, la fecha de
ingreso de cada una, y el precio y la duración del peinado para eventos.

## Declaración de uso de inteligencia artificial (Protocolo de Uso Declarado, apartado 27.2)

| Herramienta | Función | Pieza afectada | Fecha | Verificación posterior |
|---|---|---|---|---|
| Claude (chat, Claude Sonnet 5.5) | Generó el borrador de seed-presentacion.ts, seed-presentacion/plan.ts y verify-plan.ts | scripts/seed-presentacion* | 12/11/2026 | verify-plan.ts ejecutado por Claude sin base de datos. Pendiente de la autora: correr el seed en una base local vacía, revisar el resultado y ajustar el commit. |

## Turnos de demostración que dependen del reloj

La cancelación con menos de 12 horas (R-02) compara la hora del aviso, que no puede ser futura, con el inicio del turno. Un turno de
dentro de varios días siempre tiene 12 horas o más. Por eso, 15 minutos antes de la presentación y con el servidor prendido:

    npm run demo:turnos-ahora

Crea 3 turnos de la clienta de demostración con la Profesional E, contados desde ese momento: uno de "menos de 12 h" (al cancelarlo la seña queda
retenida), uno de "12 h o más" (queda devuelta) y uno para el recordatorio (reservado 6 horas antes de su inicio, el mail sale solo en los
próximos 5 minutos si el programador de tareas está activo). Si no hay un horario del estudio que cumpla, el turno queda a una hora
fuera del horario: el script lo avisa. `npm run demo:turnos-ahora:verificar` comprueba las ventanas para distintas horas de presentación.

## Cuentas de la demostración

| Rol | Cuenta |
|---|---|
| Administrador (ve todos los turnos) | el que se define en ADMIN_EMAIL, por ejemplo la cuenta de Loren; usar una ADMIN_PASSWORD de demostración |
| Profesional de demostración (Profesional E) | SEED_PRO_EMAIL |
| Clienta de demostración | SEED_CLIENT_EMAIL |
| Resto | @example.com (sin buzón) |

No cargar este seed en la base real de ninguna instancia: usar una base de demostración propia.
