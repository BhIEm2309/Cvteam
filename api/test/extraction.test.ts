// Pruebas del análisis de CVs que no necesitan base de datos ni clave de IA.
// Ejecutar con: pnpm test (en la carpeta api).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config';
import { ClaudeExtractionProvider } from '../src/modules/extraction/claude-extraction.provider';
import { CvExtractionSchema } from '../src/modules/extraction/cv-extraction-schema';
import { ExtractionFailure } from '../src/modules/extraction/extraction-provider';
import { toAnalysisStatus } from '../src/modules/extraction/extraction-queue';
import { cleanText, extractPdfText } from '../src/modules/extraction/pdf-text';
import { buildProposals, MAX_PROPOSALS_PER_CV } from '../src/modules/extraction/proposals';

const CV_TEXT = `Juan Contreras Rojas
Técnico electromecánico
8 años de experiencia en mantención de compresores industriales.
Manejo de SAP PM para órdenes de trabajo.
Trabajo en equipo y comunicación con clientes.`;

// Arma un PDF mínimo con una línea de texto por elemento (fuente Helvetica, sin tildes).
function makePdf(lines: string[]): Buffer {
  const content = 'BT /F1 12 Tf 50 750 Td 14 TL ' + lines.map((line) => `(${line}) Tj T*`).join(' ') + ' ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

test('acepta competencias cuyo fragmento aparece en el CV (sin importar mayúsculas ni saltos de línea)', () => {
  const result = buildProposals(
    {
      candidateName: '  Juan   Contreras Rojas ',
      skills: [
        { name: 'Mantención de compresores', category: 'TECHNICAL', level: 4, excerpt: '8 AÑOS de experiencia en\nmantención de compresores' },
        { name: 'SAP PM', category: 'TECHNICAL', level: null, excerpt: 'Manejo de SAP PM' },
      ],
    },
    CV_TEXT,
  );
  assert.equal(result.candidateName, 'Juan Contreras Rojas');
  assert.deepEqual(result.proposals.map((p) => p.name), ['Mantención de compresores', 'SAP PM']);
  assert.equal(result.proposals[0].excerpt, '8 AÑOS de experiencia en mantención de compresores');
  assert.equal(result.discarded.length, 0);
});

test('descarta fragmentos inventados, repetidos y vacíos', () => {
  const result = buildProposals(
    {
      candidateName: null,
      skills: [
        { name: 'Liderazgo de equipos', category: 'BEHAVIORAL', level: null, excerpt: 'Lideró un equipo de 20 personas' },
        { name: 'Trabajo en equipo', category: 'BEHAVIORAL', level: null, excerpt: 'Trabajo en equipo' },
        { name: 'TRABAJO EN EQUIPO', category: 'BEHAVIORAL', level: null, excerpt: 'Trabajo en equipo' },
        { name: '   ', category: 'TECHNICAL', level: null, excerpt: 'SAP PM' },
        { name: 'SAP', category: 'TECHNICAL', level: null, excerpt: '  ' },
      ],
    },
    CV_TEXT,
  );
  assert.deepEqual(result.proposals.map((p) => p.name), ['Trabajo en equipo']);
  assert.deepEqual(
    result.discarded.map((d) => d.reason),
    ['El fragmento citado no aparece en el CV.', 'Repetida.', 'Sin nombre.', 'Sin fragmento del CV que la respalde.'],
  );
});

test('un nivel fuera de 1 a 5 queda vacío, sin descartar la competencia', () => {
  const result = buildProposals(
    { candidateName: null, skills: [{ name: 'SAP PM', category: 'TECHNICAL', level: 9, excerpt: 'SAP PM' }] },
    CV_TEXT,
  );
  assert.equal(result.proposals[0].level, null);
});

test(`limita las propuestas a ${MAX_PROPOSALS_PER_CV} por CV`, () => {
  const text = Array.from({ length: MAX_PROPOSALS_PER_CV + 5 }, (_, i) => `habilidad numero ${i}`).join('\n');
  const skills = Array.from({ length: MAX_PROPOSALS_PER_CV + 5 }, (_, i) => ({
    name: `Habilidad ${i}`,
    category: 'TECHNICAL' as const,
    level: null,
    excerpt: `habilidad numero ${i}`,
  }));
  const result = buildProposals({ candidateName: null, skills }, text);
  assert.equal(result.proposals.length, MAX_PROPOSALS_PER_CV);
  assert.equal(result.discarded.length, 5);
});

test('el esquema rechaza categorías desconocidas', () => {
  const bad = CvExtractionSchema.safeParse({
    candidateName: null,
    skills: [{ name: 'X', category: 'OTRA', level: null, excerpt: 'x' }],
  });
  assert.equal(bad.success, false);
});

test('extrae el texto de un PDF', async () => {
  const text = await extractPdfText(
    makePdf(['Juan Contreras Rojas', 'Tecnico electromecanico', 'Experiencia en mantencion de compresores industriales', 'Manejo de SAP PM']),
  );
  assert.match(text, /Juan Contreras Rojas/);
  assert.match(text, /Manejo de SAP PM/);
});

test('un PDF casi sin texto (escaneado) queda en error PDF_SIN_TEXTO', async () => {
  await assert.rejects(
    extractPdfText(makePdf(['CV'])),
    (error: unknown) => error instanceof ExtractionFailure && error.code === 'PDF_SIN_TEXTO',
  );
});

test('un archivo que no es un PDF válido queda en error PDF_ILEGIBLE', async () => {
  await assert.rejects(
    extractPdfText(Buffer.from('%PDF-1.4 esto no es un pdf')),
    (error: unknown) => error instanceof ExtractionFailure && error.code === 'PDF_ILEGIBLE',
  );
});

test('cleanText quita espacios repetidos y líneas vacías de más sin cambiar palabras', () => {
  assert.equal(cleanText('Hola   mundo  \r\n\r\n\r\n\r\nSAP\tPM'), 'Hola mundo\n\nSAP PM');
});

test('estados de extraction_runs a estados de la pantalla', () => {
  assert.equal(toAnalysisStatus(undefined), 'PENDING_ANALYSIS');
  assert.equal(toAnalysisStatus('QUEUED'), 'QUEUED');
  assert.equal(toAnalysisStatus('RUNNING'), 'PROCESSING');
  assert.equal(toAnalysisStatus('SUCCEEDED'), 'COMPLETED');
  assert.equal(toAnalysisStatus('FAILED'), 'FAILED');
  assert.equal(toAnalysisStatus('CANCELLED'), 'PENDING_ANALYSIS');
});

test(
  'sin ANTHROPIC_API_KEY el proveedor falla con IA_NO_CONFIGURADA (sin llamar a la IA)',
  { skip: config.extraction.apiKeyConfigured ? 'hay una clave configurada: no se llama a la IA desde las pruebas' : false },
  async () => {
    await assert.rejects(
      new ClaudeExtractionProvider().extractCvSkills(CV_TEXT),
      (error: unknown) => error instanceof ExtractionFailure && error.code === 'IA_NO_CONFIGURADA',
    );
  },
);
