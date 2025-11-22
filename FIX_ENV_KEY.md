# Fix Your .env File

## Problem
Your `VITE_SUPABASE_ANON_KEY` in `.env` is **TRUNCATED** (only 104 characters instead of 208).

## Solution
Update line 3 in your `.env` file with the **COMPLETE** key:

```env
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkc3Z4cHp5c3djb2RyaXZlemJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTk5ODIsImV4cCI6MjA3NzQ3NTk4Mn0.qKHk_GVCuxkEkAEZMpCOzIJbT9FhzWJbn-e0wAnWnBU
```

## Important:
- ✅ The entire key must be on **ONE line** (no line breaks)
- ✅ **NO quotes** around the value
- ✅ **NO spaces** around the `=` sign
- ✅ Copy the **ENTIRE** key (all 208 characters)

## After updating:
1. Save the `.env` file
2. **Restart your dev server** (stop with Ctrl+C, then run `npm run dev`)
3. Refresh your browser
4. Check the console - key length should show 208 characters

## Verify it worked:
Run: `node debug-env-key.js` to verify the key is correct.

