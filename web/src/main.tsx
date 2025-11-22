import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../../global.css';
import './styles/web.css';
import { initEnv } from '../../src/services/env';
// Import viteEnv to ensure it's initialized early (sets __VITE_ENV__ on globalThis)
import './utils/viteEnv';

// Initialize environment variables from Vite's import.meta.env
// Also map VITE_ prefixed vars to simple names for easier access
// @ts-ignore - import.meta is available in Vite
const viteEnv = import.meta.env as Record<string, string>;
const envMap: Record<string, string> = { ...viteEnv };

// Also expose to globalThis for direct access (viteEnv.ts also does this, but ensure it's set)
(globalThis as any).__VITE_ENV__ = viteEnv;
if (typeof window !== 'undefined') {
  (window as any).__VITE_ENV__ = viteEnv;
}

// Map VITE_ prefixed variables to simple names (e.g., VITE_SUPABASE_URL -> SUPABASE_URL)
// This allows using simple names in code while keeping Vite compatibility
Object.keys(viteEnv).forEach((key) => {
  if (key.startsWith('VITE_')) {
    const simpleName = key.replace(/^VITE_/, '');
    // Only map if simple name doesn't already exist
    if (!envMap[simpleName]) {
      envMap[simpleName] = viteEnv[key];
    }
  }
});

initEnv(envMap);

// Log environment variable status for debugging
console.log('Environment variables initialized:');
console.log(`  VITE_SUPABASE_URL: ${viteEnv.VITE_SUPABASE_URL ? 'Found' : 'Missing'}`);
console.log(`  VITE_SUPABASE_ANON_KEY: ${viteEnv.VITE_SUPABASE_ANON_KEY ? 'Found' : 'Missing'}`);
console.log(`  SUPABASE_URL (mapped): ${envMap.SUPABASE_URL ? 'Found' : 'Missing'}`);
console.log(`  SUPABASE_ANON_KEY (mapped): ${envMap.SUPABASE_ANON_KEY ? 'Found' : 'Missing'}`);

// Add error handler for unhandled errors
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: red; color: white; padding: 20px; z-index: 9999; font-family: monospace;';
  const errorMessage = event.error && event.error.message ? event.error.message : 'Unknown error';
  const errorStack = event.error && event.error.stack ? event.error.stack : JSON.stringify(event.error, null, 2);
  errorDiv.innerHTML = '<h2>Error: ' + errorMessage + '</h2><pre>' + errorStack + '</pre>';
  document.body.appendChild(errorDiv);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: orange; color: white; padding: 20px; z-index: 9999; font-family: monospace;';
  const reasonMessage = event.reason && event.reason.message ? event.reason.message : String(event.reason);
  const reasonStack = event.reason && event.reason.stack ? event.reason.stack : JSON.stringify(event.reason, null, 2);
  errorDiv.innerHTML = '<h2>Promise Rejection: ' + reasonMessage + '</h2><pre>' + reasonStack + '</pre>';
  document.body.appendChild(errorDiv);
});

console.log('Starting app initialization...');

// Check environment variables on startup
import('./utils/checkEnv').then(({ checkEnvironmentVariables }) => {
  const envCheck = checkEnvironmentVariables();
  if (!envCheck.allRequired) {
    console.error('❌ Missing required environment variables!');
    console.error('Please ensure your .env file has:');
    console.error('  VITE_SUPABASE_URL=your_supabase_url');
    console.error('  VITE_SUPABASE_ANON_KEY=your_anon_key');
    console.error('');
    console.error('After updating .env, restart the dev server with: npm run dev');
  } else {
    // Test Supabase connection if variables are present
    import('./utils/testSupabase').then(({ testSupabaseConnection }) => {
      setTimeout(() => {
        testSupabaseConnection().then((result) => {
          if (!result.success) {
            console.error('\n❌ Supabase connection test failed!');
            console.error('Error:', result.error);
            if (result.hint) {
              console.error('Hint:', result.hint);
            }
          }
        });
      }, 2000); // Wait 2 seconds for app to initialize
    });
  }
});

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  console.log('Root element found, rendering app...');

  ReactDOM.createRoot(rootElement).render(
    <App />
  );

  console.log('App rendered successfully');
} catch (error: any) {
  console.error('Failed to render app:', error);
  const errorMessage = error && error.message ? error.message : String(error);
  const errorStack = error && error.stack ? error.stack : '';
  
  document.body.innerHTML = '<div style="padding: 20px; font-family: sans-serif; background: #fee; border: 2px solid red; margin: 20px;"><h1 style="color: red;">Error Loading App</h1><pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto;">' + errorMessage + '\n\n' + errorStack + '</pre><p>Check the browser console (F12) for more details.</p></div>';
}

