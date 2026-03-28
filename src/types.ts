export type TipologiaRifiuto = 'Ingombranti' | 'Potature';

export interface Prenotazione {
  id: string;
  dataRitiro: string; // DD/MM/YYYY or "Data Extra"
  utente: string;
  via: string;
  telefono: string;
  materiali: string;
  note: string;
  tipologia: TipologiaRifiuto;
  dataPrenotazione: string; // DD/MM/YYYY HH:MM
}

export interface Config {
  dateExtra: string[];
  materialiVietati: string[];
  limiti: {
    Ingombranti: number;
    Potature: number;
  };
}
