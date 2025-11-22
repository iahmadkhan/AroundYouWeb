// Utility to check if environment variables are loaded
import { getEnvVar } from '../../../src/services/env';

export function checkEnvironmentVariables() {
  // Check both Vite env and our env cache
  // @ts-ignore
  const viteSupabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
  // @ts-ignore
  const viteSupabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  // @ts-ignore
  const viteGeoapifyKey = import.meta.env?.VITE_GEOAPIFY_API_KEY;
  
  // Also check via getEnvVar (which uses our cache)
  const supabaseUrl = getEnvVar('SUPABASE_URL') || viteSupabaseUrl;
  const supabaseKey = getEnvVar('SUPABASE_ANON_KEY') || viteSupabaseKey;
  const geoapifyKey = getEnvVar('GEOAPIFY_API_KEY') || viteGeoapifyKey;

  console.log('=== Environment Variables Check ===');
  console.log('VITE_SUPABASE_URL (from import.meta.env):', viteSupabaseUrl ? `${viteSupabaseUrl.substring(0, 20)}...` : '❌ MISSING');
  console.log('SUPABASE_URL (from getEnvVar):', supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : '❌ MISSING');
  console.log('VITE_SUPABASE_ANON_KEY (from import.meta.env):', viteSupabaseKey ? `${viteSupabaseKey.substring(0, 10)}...` : '❌ MISSING');
  console.log('SUPABASE_ANON_KEY (from getEnvVar):', supabaseKey ? `${supabaseKey.substring(0, 10)}...` : '❌ MISSING');
  console.log('VITE_GEOAPIFY_API_KEY:', geoapifyKey ? `${geoapifyKey.substring(0, 10)}...` : '⚠️ Optional');
  console.log('===================================');

  return {
    hasSupabaseUrl: !!supabaseUrl,
    hasSupabaseKey: !!supabaseKey,
    hasGeoapifyKey: !!geoapifyKey,
    allRequired: !!supabaseUrl && !!supabaseKey,
  };
}

