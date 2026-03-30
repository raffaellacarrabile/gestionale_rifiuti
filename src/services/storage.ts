import { Prenotazione, Config, TipologiaRifiuto } from '../types';
import { format } from 'date-fns';

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
