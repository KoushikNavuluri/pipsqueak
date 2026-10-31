import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Null when .env.local is missing, so the app can explain what to configure.
export const supabase = url && key ? createClient(url, key) : null;
