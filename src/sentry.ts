import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      nodeProfilingIntegration(),
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],
    environment: process.env.NODE_ENV || "development",

    // Tracing: capture 100% de transacciones (reducir en producción si hay mucho tráfico)
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Profiling: 100% de sesiones
    profileSessionSampleRate: 1.0,

    // Automáticamente perfil durante traces activos
    profileLifecycle: "trace",

    // Ignorar ciertos errores
    beforeSend(event, hint) {
      if (event.exception) {
        const error = hint.originalException;

        // Ignorar errores de validación que ya manejamos
        if (error instanceof Error && error.name === "ValidationError") {
          return null;
        }

        // Ignorar 404s
        if (event.tags?.["http.status_code"] === 404) {
          return null;
        }
      }
      return event;
    },

    // Redactar datos sensibles
    allowUrls: [/https?:\/\/(.*\.)?nexa\.app/],
    denyUrls: [],

    // Release tracking
    release: process.env.COMMIT_SHA ? `nexa-backend@${process.env.COMMIT_SHA.slice(0, 7)}` : undefined,
  });
}

// Middleware para Express
export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler();
}

export function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler({
    ip: true,
    request: true,
    serverName: false,
  });
}
