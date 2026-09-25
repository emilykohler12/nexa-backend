import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

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
      if (event.exception) {
        const error = event.exception[0]?.value;
        if (error?.includes?.("ValidationError")) return null;
      }
      if (event.tags?.["http.status_code"] === 404) return null;
      return event;
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
