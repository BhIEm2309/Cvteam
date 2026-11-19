// Pruebas de la elección de modelo al analizar de nuevo un CV (no usan base de datos).
// Usan configuraciones explícitas para no depender de lo que tenga api/.env.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { allowedExtractionModels, modelForRun, readRequestedModel } from '../src/modules/extraction/extraction-models';

const CLAUDE = { model: 'claude-haiku-5-5', alternativeModel: 'claude-sonnet-5-5' };
const GEMINI = { model: 'gemini-3.5-flash-lite', alternativeModel: null };

test('sin cuerpo o sin "model" se usa el modelo configurado (null)', () => {
  for (const settings of [CLAUDE, GEMINI]) {
    assert.equal(readRequestedModel(undefined, settings), null);
    assert.equal(readRequestedModel({}, settings), null);
    assert.equal(readRequestedModel({ model: null }, settings), null);
    assert.equal(readRequestedModel({ model: '' }, settings), null);
  }
});

test('con Claude acepta el modelo configurado y el alternativo', () => {
  assert.deepEqual(allowedExtractionModels(CLAUDE), ['claude-haiku-5-5', 'claude-sonnet-5-5']);
  assert.equal(readRequestedModel({ model: 'claude-sonnet-5-5' }, CLAUDE), 'claude-sonnet-5-5');
  assert.equal(readRequestedModel({ model: 'claude-haiku-5-5' }, CLAUDE), 'claude-haiku-5-5');
});

test('con Gemini no hay modelo alternativo: pedir Sonnet es un error', () => {
  assert.deepEqual(allowedExtractionModels(GEMINI), ['gemini-3.5-flash-lite']);
  assert.equal(readRequestedModel({ model: 'gemini-3.5-flash-lite' }, GEMINI), 'gemini-3.5-flash-lite');
  assert.throws(() => readRequestedModel({ model: 'claude-sonnet-5-5' }, GEMINI), BadRequestException);
});

test('rechaza cualquier otro modelo o un cuerpo inválido', () => {
  for (const body of [{ model: 'claude-fable-5-2' }, { model: 5 }, { model: 'CLAUDE-SONNET-5-5' }, [1], 'texto']) {
    assert.throws(() => readRequestedModel(body, CLAUDE), BadRequestException, JSON.stringify(body));
  }
});

test('un análisis en cola con un modelo de otro proveedor usa el configurado', () => {
  assert.equal(modelForRun(null, GEMINI), 'gemini-3.5-flash-lite');
  assert.equal(modelForRun('claude-sonnet-5-5', GEMINI), 'gemini-3.5-flash-lite');
  assert.equal(modelForRun('claude-sonnet-5-5', CLAUDE), 'claude-sonnet-5-5');
  assert.equal(modelForRun('gemini-3.5-flash-lite', CLAUDE), 'claude-haiku-5-5');
});
