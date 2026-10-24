import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

// Cabeceras que nunca deben llegar a Sentry: sesión, firmas de webhook y credenciales.
const SENSITIVE_HEADERS = ['authorization', 'proxy-authorization', 'cookie', 'set-cookie', 'x-signature', 'x-api-key']

// Quita de un evento los datos del pedido que pueden ser sensibles: cookies de sesión
// (access_token / refresh_token), cuerpo (contraseñas, datos de pago), query string
// (por ejemplo el token de verify-email) y datos personales del usuario. Se conserva
// el id de usuario para poder ubicar el error.
export function scrubSensitiveData<E extends Sentry.ErrorEvent>(event: E): E {
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
