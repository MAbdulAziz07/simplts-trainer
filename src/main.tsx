import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './index.css';
import { App } from './App';

// Halaman pengembang; cabang ini dibuang dari build produksi karena `DEV` bernilai tetap `false`.
const DevPage =
  import.meta.env.DEV && window.location.pathname === '/dev/terminal-editor'
    ? lazy(async () => ({ default: (await import('@/features/terminal-editor')).TerminalEditor }))
    : undefined;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {DevPage ? (
      <Suspense>
        <DevPage />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
