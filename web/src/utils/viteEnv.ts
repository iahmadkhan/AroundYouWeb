// Vite-specific environment variable accessor
// This file can directly access import.meta.env because it's in the web/ directory

// @ts-ignore - import.meta is available in Vite
const viteEnv = import.meta.env as Record<string, string>;

// Debug: Log what env vars are available
console.log('[viteEnv] Available Vite environment variables:', Object.keys(viteEnv).filter(k => k.startsWith('VITE_')));
console.log('[viteEnv] VITE_SUPABASE_URL:', viteEnv.VITE_SUPABASE_URL ? 'Found (' + viteEnv.VITE_SUPABASE_URL.substring(0, 30) + '...)' : 'MISSING');
console.log('[viteEnv] VITE_SUPABASE_ANON_KEY:', viteEnv.VITE_SUPABASE_ANON_KEY ? 'Found (' + viteEnv.VITE_SUPABASE_ANON_KEY.substring(0, 20) + '...)' : 'MISSING');

// Expose to globalThis for use in other modules
(globalThis as any).__VITE_ENV__ = viteEnv;
if (typeof window !== 'undefined') {
  (window as any).__VITE_ENV__ = viteEnv;
}

// Export a function to get env vars
export function getViteEnvVar(key: string, fallback: string = ''): string {
  // Try VITE_ prefixed version first (this is what Vite exposes)
  const viteKey = `VITE_${key}`;
  if (viteKey in viteEnv && viteEnv[viteKey]) {
    return viteEnv[viteKey];
  }
  // Also try simple name
  if (key in viteEnv && viteEnv[key]) {
    return viteEnv[key];
  }
  return fallback;
}

// Export the env object itself
export { viteEnv };

