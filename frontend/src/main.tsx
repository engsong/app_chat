import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import './index.css';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';

// Prime the offline cache immediately from window so that next app open in airplane mode is 100% instant!
if (typeof window !== 'undefined' && 'caches' in window) {
  window.caches.open('ichat-static-v2').then((cache) => {
    cache.add('/').catch(() => {});
    cache.add('/index.html').catch(() => {});
    cache.add('/manifest.json').catch(() => {});
    cache.add('/logo.png').catch(() => {});
    cache.add('/default-avatar.png').catch(() => {});

    // Cache the exact JS and CSS URLs currently loaded by the browser
    const assetUrls = Array.from(document.querySelectorAll('script[src], link[rel="stylesheet"]'))
      .map((el) => (el as any).src || (el as any).href)
      .filter((u) => u && (u.includes('/assets/') || u.endsWith('.js') || u.endsWith('.css')));
    for (const url of assetUrls) {
      cache.add(url).catch(() => {});
    }
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="Application Error" onReset={() => window.location.reload()}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
