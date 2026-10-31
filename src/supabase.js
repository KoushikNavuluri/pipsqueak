import { createClient } from "@supabase/supabase-js";

// The project's public URL and publishable key: VITE_* from .env.local in
// development, NEXT_PUBLIC_* from the Vercel Supabase integration when
// deployed. Both are safe to ship to the browser.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Null when neither is set, so the app can explain what to configure.
export const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
