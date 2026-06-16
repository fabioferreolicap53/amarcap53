import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Captura beforeinstallprompt ANTES do React montar
// Guarda no window pro componente InstallBanner acessar
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).__deferredPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-install-ready'));
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration failed: ', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
