import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, TextRun, SectionType, BorderStyle, VerticalAlign, PageOrientation } from 'docx';
import { Prenotazione, TipologiaRifiuto } from '../types';
import { saveAs } from 'file-saver';

export async function generaDocumentoWord(prenotazioni: Prenotazione[], tipo: TipologiaRifiuto, data: string) {
  const chunks: Prenotazione[][] = [];
  // Il modello PDF mostra 6 righe per pagina
  for (let i = 0; i < prenotazioni.length; i += 6) {
    chunks.push(prenotazioni.slice(i, i + 6));
  }

  // Paginazione minima
  const minPages = 1;
  while (chunks.length < minPages) {
    chunks.push([]);
  }

  const sections = chunks.map((chunk, index) => {
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
          children: [new Paragraph({ children: [new TextRun({ text: "TIPOLOGIA RIFUTO", bold: true, size: 24, font: "Calibri" })], alignment: AlignmentType.CENTER })],
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
      height: { value: 1200, rule: "atLeast" }, // Righe alte come nel PDF
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.dataPrenotazione?.split(' ')[0] || '', size: 22, font: "Calibri" })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.utente, size: 22, font: "Calibri" })], alignment: AlignmentType.LEFT })], verticalAlign: VerticalAlign.CENTER, margins: { left: 100 } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.via, size: 22, font: "Calibri" })], alignment: AlignmentType.LEFT })], verticalAlign: VerticalAlign.CENTER, margins: { left: 100 } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.telefono, size: 22, font: "Calibri" })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.tipologia, size: 22, font: "Calibri" })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.note || '', size: 22, font: "Calibri" })], alignment: AlignmentType.LEFT })], verticalAlign: VerticalAlign.CENTER, margins: { left: 100 } }),
      ],
    }));

    const emptyRows = Array(Math.max(0, 6 - chunk.length)).fill(0).map(() => new TableRow({
      height: { value: 1200, rule: "atLeast" },
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
        },
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: `${tipo.toUpperCase()} – ${data}`, bold: true, size: 32, font: "Calibri" }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),
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
        new Paragraph({
          children: [
            new TextRun({ text: `${index + 1}`, size: 20 }),
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { before: 200 },
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
