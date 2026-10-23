import * as Sentry from '@sentry/node';
import { config } from './config.js';

let enabled = false;
let reporter = null; // test hook: receives every captured error instead of Sentry

/** Starts Sentry when SENTRY_DSN is set; otherwise monitoring is a no-op. */
export function initMonitoring() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || config.nodeEnv,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
    sendDefaultPii: false,
  });
  enabled = true;
  return true;
}

export const monitoringEnabled = () => enabled;

/** Replace the destination of captured errors (used by tests). Pass null to restore. */
export const setReporter = (fn) => {
  reporter = fn;
};

/** Reports an unexpected error with optional context (route, user id, ...). Never throws. */
export function captureError(err, context = {}) {
  try {
    if (reporter) return reporter(err, context);
    if (!enabled) return;
    Sentry.withScope((scope) => {
      scope.setContext('request', context);
      Sentry.captureException(err);
    });
  } catch {
    /* monitoring must never break the app */
  }
}

/** Waits for queued events to be sent (call before exiting the process). */
export const flushMonitoring = () => (enabled ? Sentry.flush(2000) : Promise.resolve(true));
