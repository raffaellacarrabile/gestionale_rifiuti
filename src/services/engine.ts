import { 
  addMonths, 
  startOfMonth, 
  nextWednesday, 
  format, 
  isAfter, 
  parse, 
  startOfToday,
  isBefore,
  isEqual
} from 'date-fns';
import { it } from 'date-fns/locale';
import { Prenotazione, TipologiaRifiuto } from '../types';

export const LIMITI = {
  Ingombranti: 10,
  Potature: 5
};

export function generaDateRitiro(dateExtra: string[] = []): string[] {
  const oggi = startOfToday();
  const dateStandard: string[] = [];
  
  // Routine Standard: Prossimi 6 mercoledì iniziali dei mesi successivi
  // Nota: Il PRD dice "primi mercoledì dei mesi successivi"
  for (let i = 1; i <= 6; i++) {
    const primoDelMese = startOfMonth(addMonths(oggi, i));
    // Se il primo del mese è già mercoledì, nextWednesday darà quello dopo.
    // Dobbiamo gestire se il 1° è mercoledì.
    let primoMercoledi = primoDelMese;
    if (primoDelMese.getDay() !== 3) { // 3 is Wednesday
      primoMercoledi = nextWednesday(primoDelMese);
    }
    dateStandard.push(format(primoMercoledi, 'dd/MM/yyyy'));
  }

  // Routine Straordinaria: Date extra non antecedenti a oggi
  const dateExtraValide = (dateExtra || [])
    .filter(d => {
      if (!d) return false;
      try {
        const parsed = parse(d, 'dd/MM/yyyy', new Date());
        return isAfter(parsed, oggi) || isEqual(parsed, oggi);
      } catch {
        return false;
      }
    });

  // Unione e ordinamento
  const tutteLeDate = Array.from(new Set([...dateStandard, ...dateExtraValide]))
    .sort((a, b) => {
      const da = parse(a, 'dd/MM/yyyy', new Date());
      const db = parse(b, 'dd/MM/yyyy', new Date());
      return da.getTime() - db.getTime();
    })
    .slice(0, 10);

  return [...tutteLeDate, "Data Extra"];
}

export function contaPrenotazioni(database: Prenotazione[], data: string, tipo: TipologiaRifiuto): number {
  if (!data || data === "Data Extra") return 0;
  return database.filter(p => p && p.dataRitiro === data && p.tipologia === tipo).length;
}

export function validaMateriali(materiali: string | null | undefined, vietati: string[]): boolean {
  if (!materiali) return false;
  const matLower = materiali.toLowerCase();
  return vietati.some(v => v && matLower.includes(v.toLowerCase()));
}

export function formattaMateriali(materiali: string | null | undefined): string {
  if (!materiali) return '';
  return materiali
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => `• ${line.trim()}`)
    .join('\n');
}

export function separaDatabase(database: Prenotazione[]) {
  const oggi = startOfToday();
  
  const safeDb = (database || []).filter(p => p && p.id);

  const attive = safeDb.filter(p => {
    if (!p.dataRitiro || p.dataRitiro === "Data Extra") return true;
    try {
      const d = parse(p.dataRitiro, 'dd/MM/yyyy', new Date());
      return isAfter(d, oggi) || isEqual(d, oggi);
    } catch {
      return true; // Keep it in active if date is invalid
    }
  });

  const storico = safeDb.filter(p => {
    if (!p.dataRitiro || p.dataRitiro === "Data Extra") return false;
    try {
      const d = parse(p.dataRitiro, 'dd/MM/yyyy', new Date());
      return isBefore(d, oggi);
    } catch {
      return false;
    }
  }).sort((a, b) => {
    try {
      const dateB = parse(b.dataRitiro, 'dd/MM/yyyy', new Date()).getTime();
      const dateA = parse(a.dataRitiro, 'dd/MM/yyyy', new Date()).getTime();
      return dateB - dateA;
    } catch {
      return 0;
    }
  });

  return { attive, storico };
}
