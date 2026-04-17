// ============================================================
// SUPABASE CONFIGURATION
// Replace these values with your actual Supabase project credentials
// Get them from: https://app.supabase.com → Project Settings → API
// ============================================================

const SUPABASE_URL = 'https://bwkmcmduymwagdussbgv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QyjO3oHk1_wyb1uVNn_t_Q_79IZ90WF';

// Initialize Supabase client
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// STORAGE BUCKETS
// Create these in Supabase Storage dashboard:
//   - "screenshots" (public: false) — for profile verification screenshots
// ============================================================

const SCREENSHOT_BUCKET = 'screenshots';
