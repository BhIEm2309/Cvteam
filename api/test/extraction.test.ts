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
import { makePdf } from './helpers/pdf';
import { finalSkillValues, parseReviewInput, suggestEmployee } from '../src/modules/extraction/proposal-review';
import { SkillCatalog } from '../src/modules/skills/skill-catalog';

const CV_TEXT = `Juan Contreras Rojas
Técnico electromecánico
8 años de experiencia en mantención de compresores industriales.
Manejo de SAP PM para órdenes de trabajo.
Trabajo en equipo y comunicación con clientes.`;

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
  { skip: config.extraction.claude.apiKeyConfigured ?'hay una clave configurada: no se llama a la IA desde las pruebas' : false },
  async () => {
    await assert.rejects(
      new ClaudeExtractionProvider().extractCvSkills(CV_TEXT),
      (error: unknown) => error instanceof ExtractionFailure && error.code === 'IA_NO_CONFIGURADA',
    );
  },
);

// ---------- Revisión humana de las propuestas ----------

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE = '33333333-3333-4333-8333-333333333333';

test('revisión: acepta confirmar con persona y correcciones, y descartar sin persona', () => {
  const input = parseReviewInput({
    employeeId: EMPLOYEE,
    decisions: [
      { proposalId: P1, action: 'confirm', name: '  SAP   PM ', level: 3 },
      { proposalId: P2, action: 'dismiss' },
    ],
  });
  assert.equal(input.employeeId, EMPLOYEE);
  assert.deepEqual(input.decisions[0], { proposalId: P1, action: 'confirm', name: 'SAP PM', level: 3 });

  const onlyDismiss = parseReviewInput({ decisions: [{ proposalId: P2, action: 'dismiss' }] });
  assert.equal(onlyDismiss.employeeId, null);
});

test('revisión: rechaza entradas inválidas con mensajes claros', () => {
  const bad = (body: unknown, pattern: RegExp) => assert.throws(() => parseReviewInput(body), pattern);
  bad({ decisions: [] }, /al menos una decisión/);
  bad({ decisions: [{ proposalId: P1, action: 'confirm' }] }, /a qué persona pertenece/);
  bad({ employeeId: EMPLOYEE, newEmployeeName: 'Ana', decisions: [{ proposalId: P1, action: 'confirm' }] }, /no ambas/);
  bad({ decisions: [{ proposalId: P1, action: 'aprobar' }] }, /"confirm" o "dismiss"/);
  bad({ decisions: [{ proposalId: P1, action: 'dismiss' }, { proposalId: P1, action: 'dismiss' }] }, /más de una vez/);
  bad({ employeeId: EMPLOYEE, decisions: [{ proposalId: P1, action: 'confirm', level: 6 }] }, /entero de 1 a 5/);
  bad({ employeeId: EMPLOYEE, decisions: [{ proposalId: P1, action: 'confirm', category: 'OTRA' }] }, /TECHNICAL o BEHAVIORAL/);
  bad({ employeeId: EMPLOYEE, decisions: [{ proposalId: P1, action: 'confirm', name: '   ' }] }, /no puede quedar vacío/);
  bad({ decisions: [{ proposalId: 'abc', action: 'dismiss' }] }, /id válido/);
});

test('revisión: valores finales usan las correcciones; level null borra el nivel', () => {
  const proposal = { name: 'Mantención', category: 'TECHNICAL' as const, level: 4 };
  assert.deepEqual(finalSkillValues(proposal, { proposalId: P1, action: 'confirm' }), proposal);
  assert.deepEqual(finalSkillValues(proposal, { proposalId: P1, action: 'confirm', name: 'Mantención de compresores', level: null }), {
    name: 'Mantención de compresores',
    category: 'TECHNICAL',
    level: null,
  });
});

test('catálogo: encuentra por nombre sin importar tildes ni mayúsculas y genera códigos únicos', () => {
  const catalog = new SkillCatalog([{ id: 'sap', name: 'SAP PM' }], ['SAP-PM', 'LIDERAZGO']);
  assert.equal(catalog.find('sap  pm'), 'sap');
  assert.equal(catalog.find('Liderazgo'), undefined, 'una competencia archivada no se reutiliza');
  assert.equal(catalog.newCode('Liderazgo'), 'LIDERAZGO-2');
  catalog.remember('Mantención', 'nueva');
  assert.equal(catalog.find('MANTENCION'), 'nueva');
});

test('persona sugerida: solo si hay exactamente una con el mismo nombre', () => {
  const employees = [
    { id: 'a', fullName: 'Juan Contreras Rojas' },
    { id: 'b', fullName: 'Ana Rojas' },
    { id: 'c', fullName: 'Ana  ROJAS' },
  ];
  assert.equal(suggestEmployee('juan contreras rojas', employees), 'a');
  assert.equal(suggestEmployee('Ana Rojas', employees), null, 'dos personas con el mismo nombre: no se adivina');
  assert.equal(suggestEmployee('Pedro', employees), null);
  assert.equal(suggestEmployee(null, employees), null);
});
