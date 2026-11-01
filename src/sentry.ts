import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

// Cabeceras que nunca deben llegar a Sentry: sesión, firmas de webhook y credenciales.
const SENSITIVE_HEADERS = ['authorization', 'proxy-authorization', 'cookie', 'set-cookie', 'x-signature', 'x-api-key']

// Contextos que pone el propio SDK y no llevan datos de la clienta. Cualquier otro se descarta.
const SAFE_CONTEXTS = ['trace', 'runtime', 'os', 'device', 'app', 'culture', 'cloud_resource', 'profile', 'response']

// Lo único que se conserva de los datos de un breadcrumb: método, estado y URL (sin query).
const SAFE_BREADCRUMB_DATA = ['method', 'status_code', 'url', 'reason']

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

// Los errores de Prisma traen en el mensaje el código de la consulta con los valores que se
// le pasaron (por ejemplo una alergia), así que de esos solo quedan el encabezado y la última
// línea, que es el motivo. A cualquier texto se le tapan los emails.
function cleanText(text: string | undefined): string | undefined {
  if (typeof text !== 'string') return text
  let clean = text
  if (/prisma\./i.test(clean) && /invocation/i.test(clean)) {
    const lines = clean.split('\n').map(l => l.trim()).filter(Boolean)
    clean = lines.length > 1 ? `${lines[0]} … ${lines[lines.length - 1]}` : (lines[0] ?? '')
  }
  return clean.replace(EMAIL_RE, '[email]')
}

function stripQuery(url: unknown): unknown {
  return typeof url === 'string' ? url.split('?')[0] : url
}

// Quita de un evento los datos que pueden ser sensibles: cookies de sesión
// (access_token / refresh_token), cuerpo (contraseñas, datos de pago), query string
// (por ejemplo el token de verify-email), datos personales del usuario, el texto de los
// errores y breadcrumbs (puede traer valores de la consulta), `extra` y los contextos
// que no son del SDK. Se conserva el id de usuario para poder ubicar el error.
export function scrubSensitiveData<E extends Sentry.ErrorEvent>(event: E): E {
  event.message = cleanText(event.message)
  if (event.logentry?.message) event.logentry.message = cleanText(event.logentry.message)
  for (const ex of event.exception?.values ?? []) {
    ex.value = cleanText(ex.value)
    for (const frame of ex.stacktrace?.frames ?? []) delete frame.vars
  }
  for (const crumb of event.breadcrumbs ?? []) {
    crumb.message = cleanText(crumb.message)
    if (crumb.data) {
      const kept: Record<string, unknown> = {}
      for (const key of SAFE_BREADCRUMB_DATA) {
        if (key in crumb.data) kept[key] = key === 'url' ? stripQuery(crumb.data[key]) : crumb.data[key]
      }
      crumb.data = kept
    }
  }
  delete event.extra
  if (event.contexts) {
    for (const name of Object.keys(event.contexts)) {
      if (!SAFE_CONTEXTS.includes(name)) delete event.contexts[name]
    }
  }

  const req = event.request
  if (req) {
    delete req.cookies
    delete req.data
    if (req.headers) {
      for (const name of Object.keys(req.headers)) {
        if (SENSITIVE_HEADERS.includes(name.toLowerCase())) req.headers[name] = '[Filtrado]'
      }
    }
    if (req.query_string) req.query_string = '[Filtrado]'
    if (typeof req.url === 'string') req.url = req.url.split('?')[0]
  }
  if (event.user) {
    delete event.user.email
    delete event.user.username
    delete event.user.ip_address
  }
  return event
}

export function initSentry() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const sentryDsn = process.env.SENTRY_DSN;

  // Los tests corren contra una base que se trunca en cada caso y provocan errores a propósito: si el
  // DSN del .env llega a la corrida, cada test fallido se manda a Sentry como si fuera un error real
  // (así llegaron los avisos del 1/11/2026 con environment "test").
  if (nodeEnv === "test") return;

  if (!sentryDsn) {
    console.warn("Sentry DSN not configured (SENTRY_DSN env var)");
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      nodeProfilingIntegration(),
    ],
    environment: nodeEnv,
    tracesSampleRate: nodeEnv === "production" ? 0.1 : 1.0,
    profileSessionSampleRate: 1.0,
    profileLifecycle: "trace",
    beforeSend(event) {
      const exception = event.exception?.values?.[0];
      if (exception?.type === "ValidationError" || exception?.value?.includes("ValidationError")) {
        return null;
      }
      if (event.tags?.["http.status_code"] === 404) return null;
      return scrubSensitiveData(event);
    },
  });
}

export function sentryErrorHandler() {
  return Sentry.expressErrorHandler();
}

// En @sentry/node v8+ el tracing de requests es automático (instrumentación
// basada en OpenTelemetry, activada por Sentry.init()) — ya no existe un
// middleware de request handler separado, así que este queda como no-op para
// no tener que tocar app.ts (que sigue llamando app.use(sentryRequestHandler())).
export function sentryRequestHandler() {
  return (_req: unknown, _res: unknown, next: () => void) => next();
}
