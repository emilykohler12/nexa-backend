// src/app/utils/dateFormat.ts
//
// Las fechas se guardan como texto «AAAA-MM-DD», pero todo lo que lee una persona (mails, avisos, registro de
// actividad) las muestra primero día, después mes y después año: «DD/MM/AAAA».

// «2026-11-21» → «21/11/2026». Si el texto no tiene la forma de una fecha se devuelve como vino.
export function formatDateDMY(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date
}
