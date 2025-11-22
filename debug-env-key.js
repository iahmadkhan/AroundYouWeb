// Debug what's actually in the .env file
import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env');
const expectedKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkc3Z4cHp5c3djb2RyaXZlemJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTk5ODIsImV4cCI6MjA3NzQ3NTk4Mn0.qKHk_GVCuxkEkAEZMpCOzIJbT9FhzWJbn-e0wAnWnBU';

try {
  const content = readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');
  
  console.log('=== .env File Key Debug ===\n');
  
  let foundKey = null;
  let foundLine = 0;
  
  lines.forEach((line, index) => {
    if (line.trim().startsWith('VITE_SUPABASE_ANON_KEY=')) {
      foundLine = index + 1;
      const value = line.split('=').slice(1).join('=').trim();
      foundKey = value;
      
      console.log(`Found on line ${foundLine}:`);
      console.log(`  Raw line: ${line}`);
      console.log(`  Extracted value length: ${value.length} chars`);
      console.log(`  Expected length: ${expectedKey.length} chars`);
      console.log(`  Match: ${value === expectedKey ? '✓ YES' : '✗ NO'}`);
      console.log('');
      
      // Check for common issues
      if (value.startsWith('"') || value.startsWith("'")) {
        console.log('  ⚠️  WARNING: Value starts with quotes!');
        console.log(`     Remove quotes: ${value.substring(1)}`);
      }
      if (value.endsWith('"') || value.endsWith("'")) {
        console.log('  ⚠️  WARNING: Value ends with quotes!');
        console.log(`     Remove quotes: ${value.substring(0, value.length - 1)}`);
      }
      if (value.includes(' ')) {
        console.log('  ⚠️  WARNING: Value contains spaces!');
      }
      
      // Compare character by character
      if (value !== expectedKey) {
        console.log('  Character comparison:');
        const minLen = Math.min(value.length, expectedKey.length);
        let firstDiff = -1;
        for (let i = 0; i < minLen; i++) {
          if (value[i] !== expectedKey[i]) {
            firstDiff = i;
            break;
          }
        }
        if (firstDiff >= 0) {
          console.log(`  First difference at position ${firstDiff}:`);
          console.log(`    In .env: "${value.substring(Math.max(0, firstDiff - 5), firstDiff + 10)}"`);
          console.log(`    Expected: "${expectedKey.substring(Math.max(0, firstDiff - 5), firstDiff + 10)}"`);
        } else if (value.length !== expectedKey.length) {
          console.log(`  Length mismatch: .env has ${value.length}, expected ${expectedKey.length}`);
          if (value.length < expectedKey.length) {
            console.log(`  ⚠️  Key in .env is TRUNCATED! Missing ${expectedKey.length - value.length} characters`);
            console.log(`  Missing part: "${expectedKey.substring(value.length)}"`);
          }
        }
      }
      
      // Show first and last 20 chars
      console.log('');
      console.log('  First 20 chars:', value.substring(0, 20));
      console.log('  Last 20 chars:', value.length > 20 ? '...' + value.substring(value.length - 20) : value);
      console.log('');
      console.log('  Expected first 20:', expectedKey.substring(0, 20));
      console.log('  Expected last 20:', '...' + expectedKey.substring(expectedKey.length - 20));
    }
  });
  
  if (!foundKey) {
    console.log('✗ VITE_SUPABASE_ANON_KEY not found in .env file!');
  } else if (foundKey === expectedKey) {
    console.log('✓ Key in .env matches expected key!');
    console.log('  If you still get "invalid key" error:');
    console.log('  1. Make sure you restarted the dev server after updating .env');
    console.log('  2. Clear browser cache and hard refresh (Ctrl+Shift+R)');
    console.log('  3. Check if the key was rotated in Supabase dashboard');
  } else {
    console.log('✗ Key in .env does NOT match!');
    console.log('  Update your .env file with the correct key.');
  }
  
} catch (error) {
  console.error('Error reading .env file:', error.message);
}

