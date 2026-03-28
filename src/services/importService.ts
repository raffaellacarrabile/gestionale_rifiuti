import mammoth from 'mammoth';
import { Prenotazione, TipologiaRifiuto } from '../types';

export async function importaDaDocx(file: File): Promise<Partial<Prenotazione>[]> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;

  // Simple parser logic: look for lines that look like records
  // In a real scenario, this would parse tables. Mammoth can extract HTML which is better for tables.
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
  const html = htmlResult.value;

  // We can use a DOM parser to extract table data from HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = doc.querySelectorAll('table');
  
  const importedData: Partial<Prenotazione>[] = [];

  tables.forEach(table => {
    const rows = table.querySelectorAll('tr');
    rows.forEach((row, index) => {
      if (index === 0) return; // Skip header
      const cells = row.querySelectorAll('td');
      if (cells.length >= 4) {
        importedData.push({
          utente: cells[0].textContent?.trim() || '',
          via: cells[1].textContent?.trim() || '',
          telefono: cells[2].textContent?.trim() || '',
          materiali: cells[3].textContent?.trim() || '',
        });
      }
    });
  });

  return importedData;
}
