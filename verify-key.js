// Verify Supabase anon key
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkc3Z4cHp5c3djb2RyaXZlemJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTk5ODIsImV4cCI6MjA3NzQ3NTk4Mn0.qKHk_GVCuxkEkAEZMpCOzIJbT9FhzWJbn-e0wAnWnBU';

const parts = key.split('.');
console.log('=== Key Verification ===\n');
console.log('Total length:', key.length, 'characters');
console.log('Number of parts:', parts.length);
console.log('Part 1 (header) length:', parts[0]?.length || 0);
console.log('Part 2 (payload) length:', parts[1]?.length || 0);
console.log('Part 3 (signature) length:', parts[2]?.length || 0);
console.log('');

if (parts.length === 3) {
  console.log('✓ Key has all 3 parts (valid JWT structure)');
} else {
  console.log('✗ Key is missing parts');
}

if (key.length >= 200) {
  console.log('✓ Key length is good (200+ chars)');
} else {
  console.log('⚠ Key length:', key.length, '(should be 200+)');
}

console.log('');
console.log('Decoding payload to check project reference...');
try {
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  console.log('Project ref:', payload.ref);
  console.log('Role:', payload.role);
  console.log('Your URL project ID: fdsvxpzyswcodrivezbz');
  console.log('');
  if (payload.ref === 'fdsvxpzyswcodrivezbz') {
    console.log('✓ Key matches your project URL!');
    console.log('✓ This key should work!');
  } else {
    console.log('⚠ Key project ref:', payload.ref);
    console.log('⚠ URL project ID: fdsvxpzyswcodrivezbz');
    console.log('⚠ They do not match - key is from a different project!');
  }
} catch(e) {
  console.log('Could not decode payload:', e.message);
}

console.log('');
console.log('=== Summary ===');
if (key.length >= 200 && parts.length === 3) {
  console.log('✓ Key format is correct');
  console.log('Update your .env file with this key and restart the server!');
} else {
  console.log('✗ Key format has issues');
}

