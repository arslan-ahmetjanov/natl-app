/**
 * Renderer-side error capture.
 *
 * React errors, failed promises and thrown exceptions are invisible once the
 * app is packaged: there is no console to open. Everything goes to the main
 * process log, and the Logs screen shows it.
 */
export function installRendererLogging() {
  const api = window.electronAPI;
  if (!api || typeof api.logsWrite !== 'function') return;

  const write = (level, scope, message, details) => {
    try {
      api.logsWrite({ level, scope, message, details });
    } catch {
      /* the app is in a bad state already; do not throw from a logger */
    }
  };

  window.addEventListener('error', (event) => {
    write('error', 'renderer', event.message || 'window error', {
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error && event.error.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    write('error', 'renderer', 'unhandled rejection', {
      reason: reason && reason.message ? reason.message : String(reason),
      stack: reason && reason.stack,
    });
  });

  write('info', 'renderer', 'renderer started');
}
