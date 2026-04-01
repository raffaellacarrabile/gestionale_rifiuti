import { Prenotazione, Config, TipologiaRifiuto } from '../types';
import { format } from 'date-fns';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const DB_KEY = 'eco_ritiri_db';
const CONFIG_KEY = 'eco_ritiri_config';

const DEFAULT_CONFIG: Config = {
  dateExtra: [],
  materialiVietati: ['macerie', 'vernice', 'batteria', 'eternit', 'pneumatici'],
  limiti: {
    Ingombranti: 10,
    Potature: 5
  }
};

// --- Supabase Functions ---

export async function fetchDatabase(): Promise<Prenotazione[]> {
  if (!isSupabaseConfigured) return caricaDatabase();
  
  const { data, error } = await supabase
    .from('prenotazioni')
    .select('*')
    .order('dataRitiro', { ascending: true });
    
  if (error) {
    console.error('Error fetching database from Supabase:', error);
    return caricaDatabase();
  }
  
  return data || [];
}

export async function updateDatabase(db: Prenotazione[]) {
  if (!isSupabaseConfigured) {
    salvaDatabase(db);
    return;
  }
  
  // For simplicity in this implementation, we'll upsert the entire database.
  // In a production app, you'd handle individual row updates.
  const { error } = await supabase
    .from('prenotazioni')
    .upsert(db, { onConflict: 'id' });
    
  if (error) {
    console.error('Error updating database in Supabase:', error);
    salvaDatabase(db);
  }
}

export async function upsertPrenotazione(p: Prenotazione) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('prenotazioni')
    .upsert(p, { onConflict: 'id' });
  if (error) console.error('Error upserting record:', error);
}

export async function upsertConfig(config: Config) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('config')
    .upsert({ key: 'main_config', value: config }, { onConflict: 'key' });
  if (error) console.error('Error upserting config:', error);
}

export async function deleteFromDatabase(id: string) {
  if (!isSupabaseConfigured) return;
  
  const { error } = await supabase
    .from('prenotazioni')
    .delete()
    .eq('id', id);
    
  if (error) {
    console.error('Error deleting from Supabase:', error);
  }
}

export async function fetchConfig(): Promise<Config> {
  if (!isSupabaseConfigured) return caricaConfig();
  
  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'main_config')
    .single();
    
  if (error) {
    console.error('Error fetching config from Supabase:', error);
    return caricaConfig();
  }
  
  return data?.value || DEFAULT_CONFIG;
}

export async function updateConfig(config: Config) {
  if (!isSupabaseConfigured) {
    salvaConfig(config);
    return;
  }
  
  const { error } = await supabase
    .from('config')
    .upsert({ key: 'main_config', value: config }, { onConflict: 'key' });
    
  if (error) {
    console.error('Error updating config in Supabase:', error);
    salvaConfig(config);
  }
}

// --- LocalStorage Fallbacks ---

export function caricaDatabase(): Prenotazione[] {
  const data = localStorage.getItem(DB_KEY);
  return data ? JSON.parse(data) : [];
}

export function salvaDatabase(db: Prenotazione[]) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function caricaConfig(): Config {
  const data = localStorage.getItem(CONFIG_KEY);
  return data ? JSON.parse(data) : DEFAULT_CONFIG;
}

export function salvaConfig(config: Config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// Generatore CSV per l'export (formato compatibile con il parser)
export function generateCSV(db: Prenotazione[]): string {
  const header = "DATA RITIRO;UTENTE;VIA;TELEFONO;MATERIALI;NOTE;TIPOLOGIA;DATA PRENOTAZIONE\n";
  const rows = db.map(p => {
    return [
      p.dataRitiro,
      p.utente,
      p.via,
      p.telefono,
      `"${p.materiali.replace(/"/g, '""')}"`, // Gestione virgolette per materiali
      p.note,
      p.tipologia,
      p.dataPrenotazione
    ].join(';');
  }).join('\n');
  
  return header + rows;
}

// Parser CSV specifico per il formato del Comune di Offida
export function parseCSV(content: string): Prenotazione[] {
  const lines = content.split('\n').filter(line => line.trim() !== '');
  const result: Prenotazione[] = [];
  
  // Rilevamento intestazione e skip
  const startIndex = lines[0].toUpperCase().includes('DATA RITIRO') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    // Gestione righe con virgolette (per materiali con a capo)
    // Semplice split per ora, ma il CSV fornito sembra usare ;
    const cols = lines[i].split(';');
    
    if (cols.length >= 7) {
      result.push({
        id: Math.random().toString(36).substr(2, 9),
        dataRitiro: cols[0]?.trim() || '',
        utente: cols[1]?.trim() || '',
        via: cols[2]?.trim() || '',
        telefono: cols[3]?.trim() || '',
        materiali: cols[4]?.replace(/^"|"$/g, '').trim() || '',
        note: cols[5]?.trim() || '',
        tipologia: (cols[6]?.trim().includes('Potature') ? 'Potature' : 'Ingombranti') as TipologiaRifiuto,
        dataPrenotazione: cols[7]?.trim() || format(new Date(), 'dd/MM/yyyy HH:mm')
      });
    }
  }
  return result;
}
