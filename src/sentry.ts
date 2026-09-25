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
  return Sentry.Handlers.errorHandler();
}

export function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler();
}
