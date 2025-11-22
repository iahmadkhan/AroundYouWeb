// Check all environment variables in .env file
import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env');

try {
  const content = readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');

  console.log('=== Complete .env File Check ===\n');

  const variables = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim();
        variables.push({ key, value, line: index + 1 });
      }
    }
  });

  console.log('Found variables:\n');
  variables.forEach(({ key, value, line }) => {
    const hasVite = key.startsWith('VITE_');
    const valueLength = value.length;
    const preview = valueLength > 40 ? value.substring(0, 40) + '...' : value;
    
    console.log(`Line ${line}: ${hasVite ? '✓' : '✗'} ${key}`);
    console.log(`  Value: ${preview} (${valueLength} chars)`);
    
    if (!hasVite && (key.includes('API_KEY') || key.includes('SUPABASE') || key.includes('GEOAPIFY'))) {
      console.log(`  ⚠️  WARNING: Missing VITE_ prefix! This won't be accessible in the web app.`);
      console.log(`     Should be: VITE_${key}`);
    }
    
    // Check for common issues
    if (value.startsWith('"') || value.startsWith("'")) {
      console.log(`  ⚠️  WARNING: Value has quotes - remove them!`);
    }
    if (value.includes(' ')) {
      console.log(`  ⚠️  WARNING: Value contains spaces!`);
    }
    
    console.log('');
  });

  // Summary
  const requiredVite = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const missing = requiredVite.filter(key => !variables.some(v => v.key === key));
  
  if (missing.length > 0) {
    console.log('✗ Missing required variables:');
    missing.forEach(key => console.log(`   - ${key}`));
  } else {
    console.log('✓ All required Supabase variables found!');
  }

  // Check for non-VITE API keys that should have VITE_ prefix
  const shouldHaveVite = variables.filter(v => 
    !v.key.startsWith('VITE_') && 
    (v.key.includes('API_KEY') || v.key.includes('GEOAPIFY'))
  );
  
  if (shouldHaveVite.length > 0) {
    console.log('\n⚠️  Variables that need VITE_ prefix for web access:');
    shouldHaveVite.forEach(({ key }) => {
      console.log(`   - ${key} → should be VITE_${key}`);
    });
  }

} catch (error) {
  console.error('Error reading .env file:', error.message);
}

