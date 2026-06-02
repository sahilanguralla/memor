import React from 'react';
import ReactDOM from 'react-dom/client';
import 'semantic-ui-css/semantic.min.css';
import App from './app/App';

const TAURI_INTERNALS_KEY = '__TAURI_INTERNALS__';

function isTauriRuntime(): boolean {
  return Boolean((window as unknown as Record<string, unknown>)[TAURI_INTERNALS_KEY]);
}

if (import.meta.env.DEV && !isTauriRuntime()) {
  const { installTauriMock } = await import('./test/e2e/tauri-mock');
  installTauriMock();
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
