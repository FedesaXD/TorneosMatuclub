// ============================================================
// SUPABASE CONFIGURATION
// Replace these values with your actual Supabase project credentials
// Get them from: https://app.supabase.com → Project Settings → API
// ============================================================

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';

// Initialize Supabase client
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// STORAGE BUCKETS
// Create these in Supabase Storage dashboard:
//   - "screenshots" (public: false) — for profile verification screenshots
// ============================================================

const SCREENSHOT_BUCKET = 'screenshots';
