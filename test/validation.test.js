import test from 'node:test';
import assert from 'node:assert/strict';
import { validBody, validRunId, validId, validTitle } from '../src/validation.js';
import { loadConfig } from '../src/config.js';
test('Unicode title, trim and boundaries', () => {
  assert.equal(validTitle('  Учёба  '), 'Учёба');
  assert.equal(validTitle('😀'.repeat(200)), '😀'.repeat(200));
  for (const value of ['', '   ', 'a'.repeat(201), '😀'.repeat(201), null, 1, true, {}, 'a\0b']) {
    assert.throws(() => validTitle(value));
  }
});
test('runId and UUID are strictly validated', () => {
  assert.equal(validRunId('A_z-09'), 'A_z-09');
  assert.equal(validRunId('a'.repeat(64)).length, 64);
  for (const value of [undefined, [], ['one','two'], '', 'a'.repeat(65), 'кириллица', 'a b', 'x/']) assert.throws(() => validRunId(value));
  assert.equal(validId('12345678-1234-1234-1234-123456789abc'), '12345678-1234-1234-1234-123456789abc');
  assert.throws(() => validId('broken'));
});
test('POST and PATCH allow only prescribed fields and types', () => {
  assert.deepEqual(validBody({ title: ' x ', runId: 'manual' }), { title: 'x', runId: 'manual' });
  assert.deepEqual(validBody({ done: false }, true), { done: false });
  for (const value of [null, [], 'x', 1, {}, { title:'x' }, { runId:'x' }, { title:'x', runId:'x', ownerLogin:'fake' }]) assert.throws(() => validBody(value));
  for (const value of [{}, { done:'true' }, { done:0 }, { done:null }, { runId:'x' }, { title:'x', createdAt:'x' }]) assert.throws(() => validBody(value, true));
});
test('configuration refuses missing personalization and weak token', () => {
  const good = { DATABASE_URL:'postgres://localhost/test', MOODLE_LOGIN:'student_test', MOODLE_FULL_NAME:'Учебный Автор', API_TOKEN:'a'.repeat(40) };
  assert.equal(loadConfig(good).port, 3000);
  for (const key of Object.keys(good)) assert.throws(() => loadConfig({ ...good, [key]:'' }));
  assert.throws(() => loadConfig({ ...good, API_TOKEN:'short' }));
  assert.throws(() => loadConfig({ ...good, MOODLE_LOGIN:'your_moodle_login' }));
  assert.throws(() => loadConfig({ ...good, PORT:'NaN' }));
});
