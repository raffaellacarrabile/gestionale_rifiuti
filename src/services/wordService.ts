import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, TextRun, SectionType, BorderStyle, VerticalAlign, PageOrientation, Header, Footer, PageNumber } from 'docx';
import { Prenotazione, TipologiaRifiuto } from '../types';
import { saveAs } from 'file-saver';
import { parseFullDate } from './engine';

export async function generaDocumentoWord(prenotazioni: Prenotazione[], tipo: TipologiaRifiuto, data: string) {
  // Default sorting by dataPrenotazione for Word export
  const sortedPrenotazioni = [...prenotazioni].sort((a, b) => parseFullDate(a.dataPrenotazione) - parseFullDate(b.dataPrenotazione));
  
  const total = sortedPrenotazioni.length;
  // Se ci sono più di 12 prenotazioni (2 pagine standard), passiamo alla modalità "Densa"
  const isDense = total > 12;
  const rowsPerPage = isDense ? 10 : 6;
  const dataFontSize = isDense ? 24 : 32; // 12pt vs 16pt (half-points)
  const rowHeight = isDense ? 800 : 1200;

  const chunks: Prenotazione[][] = [];
  for (let i = 0; i < sortedPrenotazioni.length; i += rowsPerPage) {
    chunks.push(sortedPrenotazioni.slice(i, i + rowsPerPage));
  }

  // Paginazione minima
  const minPages = 1;
  while (chunks.length < minPages) {
    chunks.push([]);
  }

  const sections = chunks.map((chunk) => {
    const headerRow = new TableRow({
      children: [
        new TableCell({ 
          children: [new Paragraph({ children: [new TextRun({ text: "DATA PRENOT.NE", bold: true, size: 24, font: "Calibri" })], alignment: AlignmentType.CENTER })],
          verticalAlign: VerticalAlign.CENTER,
          width: { size: 12, type: WidthType.PERCENTAGE }
        }),
        new TableCell({ 
          children: [new Paragraph({ children: [new TextRun({ text: "UTENTE", bold: true, size: 24, font: "Calibri" })], alignment: AlignmentType.CENTER })],
          verticalAlign: VerticalAlign.CENTER,
          width: { size: 18, type: WidthType.PERCENTAGE }
        }),
        new TableCell({ 
          children: [new Paragraph({ children: [new TextRun({ text: "VIA", bold: true, size: 24, font: "Calibri" })], alignment: AlignmentType.CENTER })],
          verticalAlign: VerticalAlign.CENTER,
          width: { size: 20, type: WidthType.PERCENTAGE }
        }),
        new TableCell({ 
          children: [new Paragraph({ children: [new TextRun({ text: "TELEFONO", bold: true, size: 24, font: "Calibri" })], alignment: AlignmentType.CENTER })],
          verticalAlign: VerticalAlign.CENTER,
          width: { size: 15, type: WidthType.PERCENTAGE }
        }),
        new TableCell({ 
          children: [new Paragraph({ children: [new TextRun({ text: "MATERIALI", bold: true, size: 24, font: "Calibri" })], alignment: AlignmentType.CENTER })],
          verticalAlign: VerticalAlign.CENTER,
          width: { size: 15, type: WidthType.PERCENTAGE }
        }),
        new TableCell({ 
          children: [new Paragraph({ children: [new TextRun({ text: "NOTE", bold: true, size: 24, font: "Calibri" })], alignment: AlignmentType.CENTER })],
          verticalAlign: VerticalAlign.CENTER,
          width: { size: 20, type: WidthType.PERCENTAGE }
        }),
      ],
    });

    const dataRows = chunk.map(p => new TableRow({
      height: { value: rowHeight, rule: "atLeast" },
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.dataPrenotazione?.split(' ')[0] || '', size: dataFontSize, font: "Calibri" })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.utente, size: dataFontSize, font: "Calibri" })], alignment: AlignmentType.LEFT })], verticalAlign: VerticalAlign.CENTER, margins: { left: 100 } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.via, size: dataFontSize, font: "Calibri" })], alignment: AlignmentType.LEFT })], verticalAlign: VerticalAlign.CENTER, margins: { left: 100 } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.telefono, size: dataFontSize, font: "Calibri" })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.materiali || '', size: dataFontSize, font: "Calibri" })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.note || '', size: dataFontSize, font: "Calibri" })], alignment: AlignmentType.LEFT })], verticalAlign: VerticalAlign.CENTER, margins: { left: 100 } }),
      ],
    }));

    const emptyRows = Array(Math.max(0, rowsPerPage - chunk.length)).fill(0).map(() => new TableRow({
      height: { value: rowHeight, rule: "atLeast" },
      children: [
        new TableCell({ children: [new Paragraph("")] }),
        new TableCell({ children: [new Paragraph("")] }),
        new TableCell({ children: [new Paragraph("")] }),
        new TableCell({ children: [new Paragraph("")] }),
        new TableCell({ children: [new Paragraph("")] }),
        new TableCell({ children: [new Paragraph("")] }),
      ],
    }));

    return {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: {
            orientation: PageOrientation.LANDSCAPE,
          },
          margin: {
            top: 400,
            bottom: 400,
            left: 400,
            right: 400,
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${tipo.toUpperCase()} – ${data}`, bold: true, size: 24, font: "Calibri" }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  children: ["Pagina ", PageNumber.CURRENT],
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
        }),
      },
      children: [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows, ...emptyRows],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          },
        }),
      ],
    };
  });

  const doc = new Document({
    sections: sections,
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `ritiri_${tipo.toLowerCase()}_${data.replace(/\//g, '-')}.docx`);
}
