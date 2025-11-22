// Script to verify Supabase key format
import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env');

try {
  const content = readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');

  console.log('=== Supabase Key Verification ===\n');

  let supabaseUrl = '';
  let supabaseKey = '';

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
      supabaseUrl = trimmed.split('=').slice(1).join('=').trim();
    }
    if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      supabaseKey = trimmed.split('=').slice(1).join('=').trim();
    }
  });

  // Check for common issues
  console.log('URL Check:');
  if (!supabaseUrl) {
    console.log('  ✗ VITE_SUPABASE_URL is empty');
  } else {
    console.log(`  ✓ URL found: ${supabaseUrl.substring(0, 30)}...`);
    if (supabaseUrl.startsWith('"') || supabaseUrl.startsWith("'")) {
      console.log('  ⚠ WARNING: URL has quotes - remove them!');
    }
    if (supabaseUrl.includes(' ')) {
      console.log('  ⚠ WARNING: URL contains spaces!');
    }
    if (!supabaseUrl.startsWith('https://')) {
      console.log('  ⚠ WARNING: URL should start with https://');
    }
    if (!supabaseUrl.includes('.supabase.co')) {
      console.log('  ⚠ WARNING: URL should contain .supabase.co');
    }
  }

  console.log('\nKey Check:');
  if (!supabaseKey) {
    console.log('  ✗ VITE_SUPABASE_ANON_KEY is empty');
  } else {
    const keyPreview = supabaseKey.length > 20 ? `${supabaseKey.substring(0, 20)}...` : supabaseKey;
    console.log(`  ✓ Key found: ${keyPreview}`);
    
    if (supabaseKey.startsWith('"') || supabaseKey.startsWith("'")) {
      console.log('  ⚠ WARNING: Key has quotes - remove them!');
      console.log('     Current: VITE_SUPABASE_ANON_KEY="eyJ..."');
      console.log('     Should be: VITE_SUPABASE_ANON_KEY=eyJ...');
    }
    if (supabaseKey.includes(' ')) {
      console.log('  ⚠ WARNING: Key contains spaces!');
    }
    if (!supabaseKey.startsWith('eyJ')) {
      console.log('  ⚠ WARNING: Key should start with "eyJ" (JWT format)');
    }
    if (supabaseKey.length < 100) {
      console.log('  ⚠ WARNING: Key seems too short (should be ~200+ characters)');
    }
  }

  console.log('\n=== How to Get Correct Keys ===');
  console.log('1. Go to https://app.supabase.com');
  console.log('2. Select your project');
  console.log('3. Go to Settings → API');
  console.log('4. Copy "Project URL" → use for VITE_SUPABASE_URL');
  console.log('5. Copy "anon public" key → use for VITE_SUPABASE_ANON_KEY');
  console.log('\n=== .env File Format ===');
  console.log('VITE_SUPABASE_URL=https://xxxxx.supabase.co');
  console.log('VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
  console.log('\n⚠ NO quotes, NO spaces around = sign!');

} catch (error) {
  console.error('Error:', error.message);
}

