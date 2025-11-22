// Quick script to check .env file format
import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env');

try {
  const content = readFileSync(envPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));

  console.log('=== .env File Check ===\n');
  console.log(`File exists: ✓`);
  console.log(`Lines with content: ${lines.length}\n`);

  const hasViteUrl = lines.some(line => line.startsWith('VITE_SUPABASE_URL='));
  const hasViteKey = lines.some(line => line.startsWith('VITE_SUPABASE_ANON_KEY='));
  
  // Check for common mistakes
  const hasOldUrl = lines.some(line => line.startsWith('SUPABASE_URL=') && !line.startsWith('VITE_'));
  const hasOldKey = lines.some(line => line.startsWith('SUPABASE_ANON_KEY=') && !line.startsWith('VITE_'));

  console.log('Required Variables:');
  console.log(hasViteUrl ? '  ✓ VITE_SUPABASE_URL' : '  ✗ VITE_SUPABASE_URL MISSING');
  console.log(hasViteKey ? '  ✓ VITE_SUPABASE_ANON_KEY' : '  ✗ VITE_SUPABASE_ANON_KEY MISSING');

  if (hasOldUrl || hasOldKey) {
    console.log('\n⚠️  WARNING: Found variables without VITE_ prefix!');
    if (hasOldUrl) console.log('   Found: SUPABASE_URL (should be VITE_SUPABASE_URL)');
    if (hasOldKey) console.log('   Found: SUPABASE_ANON_KEY (should be VITE_SUPABASE_ANON_KEY)');
    console.log('\n   Fix: Add VITE_ prefix to all variables');
  }

  if (hasViteUrl && hasViteKey) {
    console.log('\n✓ All required variables found!');
    console.log('\nIf variables still show as missing:');
    console.log('  1. Make sure there are NO spaces around the = sign');
    console.log('  2. Restart your dev server (npm run dev)');
    console.log('  3. Check browser console for environment variable check');
  } else {
    console.log('\n✗ Missing required variables!');
    console.log('\nYour .env file should have:');
    console.log('  VITE_SUPABASE_URL=https://your-project.supabase.co');
    console.log('  VITE_SUPABASE_ANON_KEY=your-anon-key');
  }
} catch (error) {
  console.error('✗ Error reading .env file:', error.message);
  console.log('\nMake sure .env file exists in the project root!');
}

