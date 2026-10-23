import * as Sentry from '@sentry/react';

let enabled = false;
let reporter = null; // test hook: receives every captured error instead of Sentry

/** Starts Sentry when VITE_SENTRY_DSN is set; otherwise monitoring is a no-op. */
export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
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

/** Reports an unexpected error with optional context. Never throws. */
export function captureError(err, context = {}) {
  try {
    if (reporter) return reporter(err, context);
    if (!enabled) return;
    Sentry.withScope((scope) => {
      scope.setContext('details', context);
      Sentry.captureException(err);
    });
  } catch {
    /* monitoring must never break the app */
  }
}

/** Tags errors with who hit them (id and role only, no personal data). */
export function setMonitoringUser(user) {
  if (!enabled) return;
  Sentry.setUser(user ? { id: String(user.id), role: user.role } : null);
}
