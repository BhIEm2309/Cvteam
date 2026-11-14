// Pruebas de la elección de modelo al analizar de nuevo un CV (no usan base de datos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { config } from '../src/config';
import { allowedExtractionModels, readRequestedModel } from '../src/modules/extraction/extraction-models';

test('sin cuerpo o sin "model" se usa el modelo configurado (null)', () => {
  assert.equal(readRequestedModel(undefined), null);
  assert.equal(readRequestedModel({}), null);
  assert.equal(readRequestedModel({ model: null }), null);
  assert.equal(readRequestedModel({ model: '' }), null);
});

test('acepta el modelo configurado y el alternativo', () => {
  assert.deepEqual(allowedExtractionModels(), [...new Set([config.extraction.model, 'claude-sonnet-5-5'])]);
  assert.equal(readRequestedModel({ model: 'claude-sonnet-5-5' }), 'claude-sonnet-5-5');
  assert.equal(readRequestedModel({ model: config.extraction.model }), config.extraction.model);
});

test('rechaza cualquier otro modelo o un cuerpo inválido', () => {
  for (const body of [{ model: 'claude-fable-5-2' }, { model: 5 }, { model: 'CLAUDE-SONNET-5-5' }, [1], 'texto']) {
    assert.throws(() => readRequestedModel(body), BadRequestException, JSON.stringify(body));
  }
});
