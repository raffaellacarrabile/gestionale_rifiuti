import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, TextRun, PageBreak, SectionType, BorderStyle, VerticalAlign } from 'docx';
import { Prenotazione, TipologiaRifiuto } from '../types';
import { saveAs } from 'file-saver';

export async function generaDocumentoWord(prenotazioni: Prenotazione[], tipo: TipologiaRifiuto, data: string) {
  const chunks: Prenotazione[][] = [];
  for (let i = 0; i < prenotazioni.length; i += 6) {
    chunks.push(prenotazioni.slice(i, i + 6));
  }

  // Paginazione minima
  const minPages = tipo === 'Ingombranti' ? 2 : 1;
  while (chunks.length < minPages) {
    chunks.push([]);
  }

  const sections = chunks.map((chunk, index) => {
    const headerRow = new TableRow({
      children: [
        new TableCell({ 
          children: [new Paragraph({ children: [new TextRun({ text: "UTENTE", bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
          shading: { fill: "059669" },
          verticalAlign: VerticalAlign.CENTER,
        }),
        new TableCell({ 
          children: [new Paragraph({ children: [new TextRun({ text: "VIA", bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
          shading: { fill: "059669" },
          verticalAlign: VerticalAlign.CENTER,
        }),
        new TableCell({ 
          children: [new Paragraph({ children: [new TextRun({ text: "TELEFONO", bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
          shading: { fill: "059669" },
          verticalAlign: VerticalAlign.CENTER,
        }),
        new TableCell({ 
          children: [new Paragraph({ children: [new TextRun({ text: "MATERIALI", bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
          shading: { fill: "059669" },
          verticalAlign: VerticalAlign.CENTER,
        }),
      ],
    });

    const dataRows = chunk.map(p => new TableRow({
      height: { value: 800, rule: "atLeast" },
      children: [
        new TableCell({ children: [new Paragraph({ text: p.utente, alignment: AlignmentType.LEFT })], verticalAlign: VerticalAlign.CENTER, margins: { left: 100 } }),
        new TableCell({ children: [new Paragraph({ text: p.via, alignment: AlignmentType.LEFT })], verticalAlign: VerticalAlign.CENTER, margins: { left: 100 } }),
        new TableCell({ children: [new Paragraph({ text: p.telefono, alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph({ text: p.materiali, alignment: AlignmentType.LEFT })], verticalAlign: VerticalAlign.CENTER, margins: { left: 100 } }),
      ],
    }));

    const emptyRows = Array(Math.max(0, 6 - chunk.length)).fill(0).map(() => new TableRow({
      height: { value: 800, rule: "atLeast" },
      children: [
        new TableCell({ children: [new Paragraph("")] }),
        new TableCell({ children: [new Paragraph("")] }),
        new TableCell({ children: [new Paragraph("")] }),
        new TableCell({ children: [new Paragraph("")] }),
      ],
    }));

    return {
      properties: {
        type: SectionType.NEXT_PAGE,
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: "COMUNE DI OFFIDA", bold: true, size: 28, color: "059669" }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `ELENCO RITIRI ${tipo.toUpperCase()}`, bold: true, size: 24 }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `DATA: ${data}`, italics: true, size: 20 }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
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
            new TextRun({ text: `Pagina ${index + 1} di ${chunks.length}`, size: 16 }),
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { before: 400 },
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
