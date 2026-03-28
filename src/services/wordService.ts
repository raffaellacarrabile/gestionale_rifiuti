import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, TextRun, PageBreak, SectionType } from 'docx';
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
    const rows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "UTENTE", style: "HeaderCell" })] }),
          new TableCell({ children: [new Paragraph({ text: "VIA", style: "HeaderCell" })] }),
          new TableCell({ children: [new Paragraph({ text: "TELEFONO", style: "HeaderCell" })] }),
          new TableCell({ children: [new Paragraph({ text: "MATERIALI", style: "HeaderCell" })] }),
        ],
      }),
      ...chunk.map(p => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(p.utente)] }),
          new TableCell({ children: [new Paragraph(p.via)] }),
          new TableCell({ children: [new Paragraph(p.telefono)] }),
          new TableCell({ children: [new Paragraph(p.materiali)] }),
        ],
      })),
      // Fill empty rows to maintain 6 rows per page if needed for layout consistency
      ...Array(Math.max(0, 6 - chunk.length)).fill(0).map(() => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph("")] }),
          new TableCell({ children: [new Paragraph("")] }),
          new TableCell({ children: [new Paragraph("")] }),
          new TableCell({ children: [new Paragraph("")] }),
        ],
      }))
    ];

    return {
      properties: {
        type: SectionType.NEXT_PAGE,
      },
      children: [
        new Paragraph({
          text: `RITIRO ${tipo.toUpperCase()} - DATA: ${data}`,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: rows,
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
