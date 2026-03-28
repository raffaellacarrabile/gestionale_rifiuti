import { Prenotazione, Config } from '../types';

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

// Simulazione importazione CSV (solo logica)
export function parseCSV(content: string): Prenotazione[] {
  const lines = content.split('\n');
  const result: Prenotazione[] = [];
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length >= 8) {
      result.push({
        id: Math.random().toString(36).substr(2, 9),
        dataRitiro: cols[0],
        utente: cols[1],
        via: cols[2],
        telefono: cols[3],
        materiali: cols[4],
        note: cols[5],
        tipologia: cols[6] as any,
        dataPrenotazione: cols[7]
      });
    }
  }
  return result;
}
