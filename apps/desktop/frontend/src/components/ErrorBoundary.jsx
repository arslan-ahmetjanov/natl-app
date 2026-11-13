import React from 'react';

/**
 * Last line of defense for the renderer.
 *
 * A React error otherwise leaves a blank window with no way to find out what
 * happened. Here it is logged first, and the user gets a readable screen
 * instead of white space.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const api = window.electronAPI;
    if (api && typeof api.logsWrite === 'function') {
      api.logsWrite({
        level: 'fatal',
        scope: 'renderer',
        message: error && error.message ? error.message : String(error),
        details: {
          stack: error && error.stack,
          componentStack: info && info.componentStack,
        },
      });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ padding: 24, fontFamily: 'monospace', color: '#eee', background: '#161616', minHeight: '100vh' }}>
        <h3 style={{ marginTop: 0 }}>Интерфейс упал</h3>
        <p>Подробности записаны в разделе Logs. Откройте его после перезапуска и скопируйте записи уровня fatal.</p>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error && this.state.error.message)}</pre>
        <button type="button" onClick={() => window.location.reload()}>Перезагрузить окно</button>
      </div>
    );
  }
}
