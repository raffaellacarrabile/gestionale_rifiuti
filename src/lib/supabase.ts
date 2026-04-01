import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof process !== 'undefined' && process.env.VITE_SUPABASE_URL) || 
                    import.meta.env.VITE_SUPABASE_URL || 
                    'https://ncppzswviyjvtbkrgdie.supabase.co';

const supabaseAnonKey = (typeof process !== 'undefined' && process.env.VITE_SUPABASE_ANON_KEY) || 
                       import.meta.env.VITE_SUPABASE_ANON_KEY || 
                       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcHB6c3d2aXlqdnRia3JnZGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODE0MjQsImV4cCI6MjA5MDU1NzQyNH0.BJLdpSvXMR6QxFZomdB71NlMSuUonhhimDeblLql1TE';

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
