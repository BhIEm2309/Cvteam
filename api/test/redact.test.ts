// Pruebas de redactPersonalData: qué se oculta, qué NO debe ocultarse y los casos que se escapan a propósito.
// Ejecutar con: pnpm test (en la carpeta api).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactPersonalData } from '../src/modules/extraction/redact';
import { buildProposals } from '../src/modules/extraction/proposals';

const hide = (text: string) => redactPersonalData(text).text;

test('oculta RUT con y sin puntos (guion obligatorio)', () => {
  for (const rut of ['12.345.678-9', '1.234.567-K', '12345678-k', '9876543-0']) {
    assert.equal(hide(`RUT: ${rut}`), 'RUT: [RUT]', rut);
  }
});

test('oculta correos', () => {
  assert.equal(hide('Contacto: juan.contreras+cv@mineria-norte.cl.'), 'Contacto: [CORREO].');
});

test('oculta celulares y fijos chilenos en formatos comunes', () => {
  for (const phone of ['+56 9 1234 5678', '+56912345678', '56 9 1234 5678', '9 8765 4321', '987654321', '+56 2 2345 6789', '+56 51 234 5678']) {
    assert.equal(hide(`Llamar al ${phone} en horario hábil`), 'Llamar al [TELÉFONO] en horario hábil', phone);
  }
});

test('oculta el número después de una etiqueta de teléfono y conserva la etiqueta', () => {
  assert.equal(hide('Fono: (51) 221 3344'), 'Fono: [TELÉFONO]');
  assert.equal(hide('Teléfono: 22 345 6789'), 'Teléfono: [TELÉFONO]');
});

test('oculta direcciones con etiqueta o con calle y número', () => {
  assert.equal(hide('Dirección: Los Aromos 1234, La Serena'), 'Dirección: [DIRECCIÓN]');
  assert.equal(hide('Domicilio: Villa El Sol, casa 5'), 'Domicilio: [DIRECCIÓN]');
  assert.equal(hide('Vivo en Av. Francisco de Aguirre 1234, La Serena'), 'Vivo en [DIRECCIÓN], La Serena');
  assert.equal(hide('Calle Los Aromos #567, depto 12B'), '[DIRECCIÓN]');
  assert.equal(hide('Pasaje Ñandú N° 45'), '[DIRECCIÓN]');
});

test('NO oculta datos que no son personales', () => {
  const keep = [
    'Experiencia 2018-2020 y 2021 - 2024',
    'Sueldo pretendido $1.200.000',
    'Certificación ISO 9001:2015 y OHSAS 18001',
    'Dirección de obras en faena (2019-2022)',
    'Manejo de equipos de 10.000 HP',
    'Curso SENCE código 1237894561',
    'Año 2023: 9 meses en mantención de 2 plantas',
  ];
  for (const text of keep) {
    assert.equal(hide(text), text, text);
  }
});

test('casos que se escapan a propósito (documentados)', () => {
  // RUT sin guion: se confundiría con cualquier número.
  assert.equal(hide('RUT 123456789'), 'RUT 123456789');
  // Dirección sin etiqueta ni palabra de calle.
  assert.equal(hide('Los Aromos 1234, La Serena'), 'Los Aromos 1234, La Serena');
});

test('ocultar dos veces da el mismo texto', () => {
  const cv = 'Juan Contreras\nRUT: 12.345.678-9\nCorreo: juan@correo.cl\nCelular: +56 9 1234 5678\nDirección: Los Aromos 1234';
  const once = hide(cv);
  assert.equal(hide(once), once);
  assert.deepEqual(redactPersonalData(cv).counts, { rut: 1, email: 1, phone: 1, address: 1 });
});

test('la verificación de fragmentos usa el texto ya ocultado', () => {
  const redacted = hide('Contacto: juan@correo.cl\nManejo de SAP PM');
  const result = buildProposals(
    {
      candidateName: null,
      skills: [
        { name: 'SAP PM', category: 'TECHNICAL', level: null, excerpt: 'Manejo de SAP PM' },
        // La IA solo vio [CORREO]: un fragmento con el token es válido.
        { name: 'Comunicación', category: 'BEHAVIORAL', level: null, excerpt: 'Contacto: [CORREO]' },
        // Un fragmento con el correo real no aparece en el texto ocultado: se descarta.
        { name: 'Correo', category: 'TECHNICAL', level: null, excerpt: 'juan@correo.cl' },
      ],
    },
    redacted,
  );
  assert.deepEqual(result.proposals.map((p) => p.name), ['SAP PM', 'Comunicación']);
  assert.equal(result.discarded[0].reason, 'El fragmento citado no aparece en el CV.');
});
