import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Service Worker: em dev, desregistra + limpa todos caches. Em prod, registra.
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then(regs =>
      regs.forEach(r => r.unregister())
    );
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('SW registration failed: ', err);
      });
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
