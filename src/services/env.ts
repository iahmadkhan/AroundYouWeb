// Environment variable accessor
// This file provides a way to access environment variables in both web and Node.js environments

// For Vite/web: import.meta.env is available at runtime
// For Node.js: process.env is available
// This module provides a unified interface

let envCache: Record<string, string> | null = null;

// Initialize environment variables (call this from web app entry point)
export function initEnv(env: Record<string, string>) {
  envCache = env;
}

// Get environment variable
// Supports both simple names (SUPABASE_URL) and Vite-prefixed names (VITE_SUPABASE_URL)
export function getEnvVar(key: string, fallback: string = ''): string {
  // For Vite/web: Try to access import.meta.env directly first (available at module load time)
  // This works even before initEnv() is called
  try {
    // @ts-ignore - import.meta is available in Vite
    const viteEnv = (globalThis as any).__VITE_ENV__ || 
                    (typeof globalThis !== 'undefined' && 'window' in globalThis ? (globalThis as any).window?.__VITE_ENV__ : null) ||
                    // Try to access import.meta.env directly via eval (only works in Vite)
                    (() => {
                      try {
                        // In Vite, we can access import.meta.env directly
                        // Use a function that will be evaluated in the Vite context
                        const metaEnv = (globalThis as any).__import_meta_env__;
                        if (metaEnv) return metaEnv;
                        // Fallback: try to get from module scope (this won't work in TypeScript but might at runtime)
                        return null;
                      } catch {
                        return null;
                      }
                    })();
    
    if (viteEnv && typeof viteEnv === 'object') {
      // Try VITE_ prefixed version first (this is what Vite exposes)
      const viteKey = `VITE_${key}`;
      if (viteKey in viteEnv && viteEnv[viteKey]) {
        return viteEnv[viteKey];
      }
      // Also try simple name
      if (key in viteEnv && viteEnv[key]) {
        return viteEnv[key];
      }
    }
  } catch {
    // Ignore errors accessing env
  }
  
  // Check cache (set by web app) - try simple name first
  if (envCache) {
    if (key in envCache) {
      return envCache[key];
    }
    // Also try VITE_ prefixed version
    const viteKey = `VITE_${key}`;
    if (viteKey in envCache) {
      return envCache[viteKey];
    }
  }
  
  // Try process.env (Node.js) - try simple name first
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[key]) {
      return process.env[key];
    }
    // Also try VITE_ prefixed version
    const viteKey = `VITE_${key}`;
    if (process.env[viteKey]) {
      return process.env[viteKey];
    }
  }
  
  return fallback;
}

