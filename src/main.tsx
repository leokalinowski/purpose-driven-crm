import React from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';

// Health check logging
console.log('🚀 REOP CRM Initializing...');
console.log('📡 Supabase URL:', 'https://cguoaokqwgqvzkqqezcq.supabase.co');
console.log('🌍 Environment:', import.meta.env.MODE);
console.log('📍 Base URL:', import.meta.env.BASE_URL);

// Global error handler for chunk loading and parse failures
window.addEventListener('error', (e) => {
  const isChunkError = e.message && (
    e.message.includes('Failed to fetch') || 
    e.message.includes('Loading chunk') || 
    e.message.includes('dynamically imported module') ||
    e.message.includes('Load failed') || // Safari generic error
    e.message.toLowerCase().includes('parse') ||
    e.message.toLowerCase().includes('syntax')
  );
  
  if (isChunkError) {
    console.error('❌ Chunk/parse error detected, attempting cache-busting reload...', e);
    const reloadKey = 'chunk_reload_attempt';
    const lastReload = sessionStorage.getItem(reloadKey);
    const now = Date.now();
    
    if (!lastReload || now - parseInt(lastReload) > 5000) {
      sessionStorage.setItem(reloadKey, now.toString());
      // Cache-busting reload
      window.location.href = window.location.href.split('?')[0] + '?v=' + now;
    } else {
      console.error('❌ Multiple reload attempts detected, please clear cache and try again');
      alert('Unable to load application. Please clear your browser cache (Safari: Cmd+Option+E) and refresh the page.');
    }
  }
});

// Unhandled promise rejections (catches dynamic import failures)
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && (e.reason.message?.includes('Failed') || e.reason.message?.includes('fetch') || e.reason.message?.includes('import'))) {
    console.error('❌ Unhandled promise rejection (likely import failure):', e.reason);
    const reloadKey = 'promise_reload_attempt';
    const lastReload = sessionStorage.getItem(reloadKey);
    const now = Date.now();
    
    if (!lastReload || now - parseInt(lastReload) > 5000) {
      sessionStorage.setItem(reloadKey, now.toString());
      window.location.href = window.location.href.split('?')[0] + '?v=' + now;
    }
  }
});

// Log successful mount
try {
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </React.StrictMode>
  );
  // Mark successful boot
  (window as any).__APP_BOOT = 'mounted';
  console.log('✅ React app mounted successfully');
  
  // Hide boot loader after 100ms to allow React to render
  setTimeout(() => {
    const loader = document.getElementById('boot-loader');
    if (loader) loader.remove();
  }, 100);
} catch (error) {
  console.error('❌ Failed to mount React app:', error);
  (window as any).__APP_BOOT = 'error';
  throw error;
}
