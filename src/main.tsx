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

// Add global error handler for chunk loading failures
window.addEventListener('error', (e) => {
  if (e.message && (e.message.includes('Failed to fetch') || e.message.includes('Loading chunk') || e.message.includes('dynamically imported module'))) {
    console.error('❌ Chunk loading failed, attempting reload...', e);
    // Store reload attempt to prevent infinite loops
    const reloadKey = 'chunk_reload_attempt';
    const lastReload = sessionStorage.getItem(reloadKey);
    const now = Date.now();
    
    if (!lastReload || now - parseInt(lastReload) > 5000) {
      sessionStorage.setItem(reloadKey, now.toString());
      window.location.reload();
    } else {
      console.error('❌ Multiple reload attempts detected, please clear cache and try again');
      alert('Unable to load application. Please clear your browser cache and refresh the page.');
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
  console.log('✅ React app mounted successfully');
} catch (error) {
  console.error('❌ Failed to mount React app:', error);
  throw error;
}
