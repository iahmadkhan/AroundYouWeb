import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnvVar } from './env';

// Web-compatible storage adapter using localStorage
const localStorageAdapter = {
  getItem: (key: string): Promise<string | null> => {
    return Promise.resolve(localStorage.getItem(key));
  },
  setItem: (key: string, value: string): Promise<void> => {
    localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    localStorage.removeItem(key);
    return Promise.resolve();
  },
};

// Lazy initialization function to get Supabase credentials
let configLogged = false;
let configWarned = false;

function getSupabaseConfig() {
  const supabaseUrl = getEnvVar('SUPABASE_URL') || '';
  const supabaseAnonKey = getEnvVar('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY') || null;

  // Debug logging (only log once to avoid spam)
  if (!configLogged) {
    console.log('[supabase.ts] getSupabaseConfig called:');
    console.log('[supabase.ts] SUPABASE_URL:', supabaseUrl ? supabaseUrl.substring(0, 40) + '...' : 'MISSING');
    console.log('[supabase.ts] SUPABASE_ANON_KEY:', supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'MISSING');
    console.log('[supabase.ts] __VITE_ENV__ available:', !!(globalThis as any).__VITE_ENV__);
    configLogged = true;
  }

  // Don't throw - just log warning if missing
if (!supabaseUrl || !supabaseAnonKey) {
    if (!configWarned) {
      console.warn('[supabase.ts] Missing Supabase credentials. Some features may not work. Please check your .env file.');
      console.warn('[supabase.ts] Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.');
      console.warn('[supabase.ts] After updating .env, restart your dev server.');
      configWarned = true;
    }
  }

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey };
}

// Lazy client creation - create only when first accessed
let _supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!_supabaseClient) {
    const config = getSupabaseConfig();
    
    if (!config.supabaseUrl || !config.supabaseAnonKey || 
        config.supabaseUrl.includes('placeholder') || 
        config.supabaseAnonKey.includes('placeholder')) {
      console.error('[supabase.ts] Cannot create Supabase client: credentials are missing or invalid.');
      console.error('[supabase.ts] Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.');
      console.error('[supabase.ts] After updating .env, restart your dev server.');
      throw new Error('Supabase credentials are not configured. Please check your .env file and restart the dev server.');
    }
    
    _supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        storage: localStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true, // Enable for web to handle OAuth callbacks
      },
      realtime: {
        params: {
          eventsPerSecond: 10, // Allow up to 10 events per second
        },
        // WebSocket connection settings for better reliability
        heartbeatIntervalMs: 30000, // Send heartbeat every 30 seconds to keep connection alive
        reconnectAfterMs: (tries: number) => {
          // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
          return Math.min(1000 * Math.pow(2, tries), 10000);
        },
        // Increase timeout for subscription to avoid premature timeouts
        timeout: 30000, // 30 seconds timeout (increased from 20s)
        // Log level for debugging (can be 'trace', 'debug', 'info', 'warn', 'error')
        log_level: 'warn' as const,
      },
      // Global settings
      global: {
        headers: {
          'x-client-info': 'aroundyou-web@1.0.0',
        },
      },
    });
    
    console.log('[supabase.ts] Supabase client created successfully with WebSocket realtime support');
  }
  
  return _supabaseClient;
}

// Export supabase as a getter that creates the client lazily
export type SupabaseClientType = SupabaseClient;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    // If it's a function, bind it to the client
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// Admin client for server-side operations (using service_role key)
// Note: In production, this should be used only in backend/serverless functions
// For now, using it in client for development convenience
let _supabaseAdminClient: ReturnType<typeof createClient> | null = null;

function getSupabaseAdminClient() {
  if (!_supabaseAdminClient) {
    const config = getSupabaseConfig();
    if (config.serviceRoleKey && config.supabaseUrl && !config.supabaseUrl.includes('placeholder')) {
      _supabaseAdminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      });
    }
  }
  return _supabaseAdminClient;
}

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    const client = getSupabaseAdminClient();
    if (!client) {
      return null;
    }
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
}) as ReturnType<typeof createClient> | null;

// Database types (you can expand these as you develop your schema)
export type Shop = {
  id: string;
  name: string;
  image_url: string;
  shop_type?: string | null;
  rating: number;
  orders?: number; // number of orders completed
  delivery_fee: number;
  delivery_time?: string; // e.g. "10-15 mins"
  tags: string[];
  address: string;
  latitude?: number;
  longitude?: number;
  is_open: boolean;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  order: number;
};

