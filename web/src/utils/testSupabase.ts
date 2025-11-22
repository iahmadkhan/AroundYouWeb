// Test Supabase connection
import { supabase } from '../../../src/services/supabase';
import { getEnvVar } from '../../../src/services/env';

export async function testSupabaseConnection() {
  console.log('=== Testing Supabase Connection ===');
  
  try {
    // Test 1: Check if client is initialized
    // Get environment variables directly
    const url = getEnvVar('SUPABASE_URL') || '';
    const key = getEnvVar('SUPABASE_ANON_KEY') || '';
    
    // Also check import.meta.env for debugging (Vite environment)
    // @ts-ignore - import.meta is available in Vite
    const viteEnv = (globalThis as any).__VITE_ENV__ || (typeof window !== 'undefined' ? (window as any).__VITE_ENV__ : null);
    const viteUrl = viteEnv?.VITE_SUPABASE_URL || '';
    const viteKey = viteEnv?.VITE_SUPABASE_ANON_KEY || '';
    
    console.log('Environment variable check:');
    console.log(`   From getEnvVar - URL: ${url ? 'Found' : 'Missing'}`);
    console.log(`   From getEnvVar - Key: ${key ? 'Found' : 'Missing'}`);
    console.log(`   From Vite env - VITE_SUPABASE_URL: ${viteUrl ? 'Found' : 'Missing'}`);
    console.log(`   From Vite env - VITE_SUPABASE_ANON_KEY: ${viteKey ? 'Found' : 'Missing'}`);
    
    console.log('1. Client initialization:');
    console.log(`   URL: ${url ? url.substring(0, 40) + '...' : 'MISSING'}`);
    console.log(`   Key: ${key ? key.substring(0, 20) + '...' : 'MISSING'}`);
    console.log(`   Key length: ${key ? key.length : 0} characters`);
    console.log(`   Key starts with: ${key ? key.substring(0, 3) : 'N/A'}`);
    console.log(`   Key ends with: ${key && key.length > 10 ? '...' + key.substring(key.length - 10) : 'N/A'}`);
    
    // Check for common issues
    if (key) {
      if (key.startsWith('"') || key.startsWith("'")) {
        console.error('   ⚠️  WARNING: Key starts with quotes! Remove quotes from .env file');
      }
      if (key.endsWith('"') || key.endsWith("'")) {
        console.error('   ⚠️  WARNING: Key ends with quotes! Remove quotes from .env file');
      }
      if (key.includes(' ')) {
        console.error('   ⚠️  WARNING: Key contains spaces!');
      }
      if (key.length < 150) {
        console.warn(`   ⚠️  WARNING: Key seems short (${key.length} chars). Full JWT should be ~200+ characters`);
      }
      if (!key.startsWith('eyJ')) {
        console.error('   ⚠️  WARNING: Key should start with "eyJ" (JWT format)');
      }
    }
    
    if (!url || url.includes('placeholder')) {
      console.error('   ✗ Supabase URL is not configured');
      console.error('   Hint: Make sure VITE_SUPABASE_URL is set in your .env file');
      console.error('   Hint: Restart your dev server after adding/updating .env file');
      return { success: false, error: 'URL not configured', hint: 'Check your .env file and restart the dev server' };
    }
    
    if (!key || key.includes('placeholder')) {
      console.error('   ✗ Supabase key is not configured');
      console.error('   Hint: Make sure VITE_SUPABASE_ANON_KEY is set in your .env file');
      console.error('   Hint: Restart your dev server after adding/updating .env file');
      return { success: false, error: 'Key not configured', hint: 'Check your .env file and restart the dev server' };
    }
    
    console.log('   ✓ Client initialized');
    
    // Test 2: Try a simple query
    console.log('\n2. Testing database connection:');
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('id')
        .limit(1);
      
      if (error) {
        console.error('   ✗ Database query failed:');
        console.error(`   Code: ${error.code || 'N/A'}`);
        console.error(`   Message: ${error.message || 'N/A'}`);
        console.error(`   Details: ${error.details || 'N/A'}`);
        console.error(`   Hint: ${error.hint || 'N/A'}`);
        console.error(`   Full error:`, error);
        
        if (error.message?.includes('JWT') || error.message?.includes('invalid') || error.message?.includes('API key') || error.message?.includes('Invalid API key')) {
          return { 
            success: false, 
            error: 'Invalid API key',
            details: error.message,
            hint: 'Verify your VITE_SUPABASE_ANON_KEY matches the "anon public" key from Supabase dashboard. Make sure the key and URL are from the same project.'
          };
        }
        
        if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('policy')) {
          console.warn('   ⚠ This might be a Row Level Security (RLS) issue');
          console.warn('   The key is valid but may not have permission to read from shops table');
        }
        
        return { success: false, error: error.message, details: error };
      }
      
      console.log('   ✓ Database connection successful');
      console.log(`   Found ${data?.length || 0} shops`);
    } catch (queryError: any) {
      console.error('   ✗ Database query exception:');
      console.error(`   Error: ${queryError.message || 'Unknown error'}`);
      console.error(`   Full error:`, queryError);
      
      // Check for network/CORS errors
      if (queryError.message?.includes('Failed to fetch') || queryError.message?.includes('NetworkError') || queryError.name === 'TypeError') {
        return {
          success: false,
          error: 'Network error - Failed to fetch',
          details: queryError.message,
          hint: 'This could be a CORS issue, network connectivity problem, or incorrect Supabase URL. Check: 1) Your internet connection, 2) The Supabase URL is correct, 3) CORS is enabled in Supabase dashboard'
        };
      }
      
      return { success: false, error: queryError.message || 'Query exception', details: queryError };
    }
    
    // Test 3: Try RPC function
    console.log('\n3. Testing RPC function:');
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('find_shops_by_location', {
        point_wkt: 'POINT(74.3587 31.5204)', // Lahore coordinates
      });
      
      if (rpcError) {
        console.warn('   ⚠ RPC function test:');
        console.warn(`   Code: ${rpcError.code || 'N/A'}`);
        console.warn(`   Message: ${rpcError.message || 'N/A'}`);
        console.warn(`   Full error:`, rpcError);
        
        if (rpcError.code === '42883' || rpcError.message?.includes('does not exist') || rpcError.message?.includes('function')) {
          console.warn('   Function does not exist - this is okay, fallback will be used');
        } else if (rpcError.message?.includes('JWT') || rpcError.message?.includes('invalid') || rpcError.message?.includes('API key')) {
          return { 
            success: false, 
            error: 'Invalid API key in RPC call',
            details: rpcError.message,
            hint: 'Verify your VITE_SUPABASE_ANON_KEY is correct'
          };
        } else {
          return { success: false, error: 'RPC function error', details: rpcError };
        }
      } else {
        console.log('   ✓ RPC function works');
        console.log(`   Returned ${rpcData?.length || 0} results`);
      }
    } catch (rpcException: any) {
      console.error('   ✗ RPC function exception:');
      console.error(`   Error: ${rpcException.message || 'Unknown error'}`);
      console.error(`   Full error:`, rpcException);
      return { success: false, error: rpcException.message || 'RPC exception', details: rpcException };
    }
    
    console.log('\n=== All Tests Passed ===');
    return { success: true };
    
  } catch (error: any) {
    console.error('\n✗ Connection test failed:');
    console.error(`Error type: ${error.name || 'Unknown'}`);
    console.error(`Error message: ${error.message || 'Unknown error'}`);
    console.error(`Full error:`, error);
    
    // Check for network/CORS errors
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError') || error.name === 'TypeError') {
      return {
        success: false,
        error: 'Network error - Failed to fetch',
        details: error.message,
        hint: 'This could be a CORS issue, network connectivity problem, or incorrect Supabase URL. Check: 1) Your internet connection, 2) The Supabase URL is correct, 3) CORS is enabled in Supabase dashboard, 4) Environment variables are loaded (check console for env check)'
      };
    }
    
    return { success: false, error: error.message || 'Unknown error', details: error };
  }
}

