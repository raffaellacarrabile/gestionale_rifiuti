import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient | null = null;

const isValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  try {
    new URL(url);
    return url.startsWith('http');
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  isValidUrl(supabaseUrl)
);

export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    const urlToUse = isSupabaseConfigured ? supabaseUrl! : 'https://placeholder-project.supabase.co';
    const keyToUse = isSupabaseConfigured ? supabaseAnonKey! : 'placeholder-key';
    
    supabaseInstance = createClient(urlToUse, keyToUse);
  }
  return supabaseInstance;
};

// We export the instance but it's initialized with a safe placeholder if config is missing/invalid
export const supabase = getSupabase();
