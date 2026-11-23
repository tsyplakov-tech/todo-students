import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
const config = { login:'student_test', fullName:'Тестовый Автор', token:'test-token-only-never-a-production-secret' };
const repository = Object.fromEntries(['create','list','get','patch','delete'].map(key => [key, async () => { throw new Error('postgres://private:secret@host'); }]));
const app = createApp({ repository, config });
const authed = (method, path) => request(app)[method](path).set('Authorization', `Bearer ${config.token}`);
test('public login, protected API and JSON errors', async () => {
  const login = await request(app).get('/login/').expect(200).expect('Content-Type', /text\/plain/);
  assert.equal(login.text, config.login);
  for (const path of ['/api/author/','/api/tasks/?runId=x','/api/unknown/']) {
    await request(app).get(path).expect(401).expect('Content-Type', /application\/json/);
    await request(app).get(path).set('Authorization','Bearer wrong').expect(401);
  }
  const author = await authed('get','/api/author/').expect(200);
  assert.deepEqual(author.body, { login:config.login, fullName:config.fullName });
  await authed('get','/api/author').expect(404);
  await authed('get','/api/tasks').expect(404);
});
test('400 for invalid JSON, media type, UUID, query, field types and extra fields', async () => {
  await authed('post','/api/tasks/').set('Content-Type','application/json').send('{').expect(400);
  await authed('post','/api/tasks/').send('title=x&runId=x').expect(400);
  for (const body of [[], null, {}, { title:' ',runId:'a' }, { title:'x',runId:'!' }, { title:'x', runId:'x', done:false }, { title:'x', runId:'x', id:'fake' }, { title:'x',runId:'x',ownerLogin:'fake' }, { title:3,runId:'x' }]) {
    await authed('post','/api/tasks/').set('Content-Type','application/json').send(JSON.stringify(body)).expect(400);
  }
  for (const path of ['/api/tasks/','/api/tasks/?runId=','/api/tasks/?runId=a&runId=b','/api/tasks/not-a-uuid/']) await authed('get',path).expect(400);
  for (const body of [{}, { done:1 }, { done:'false' }, { done:null }, { runId:'x' }, { createdAt:'x' }]) {
    await authed('patch','/api/tasks/12345678-1234-1234-1234-123456789abc/').send(body).expect(400);
  }
});
test('database failures are 503 and cannot disclose credentials', async () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  const responses = [await authed('get','/api/tasks/?runId=x'), await authed('get',`/api/tasks/${id}/`),
    await authed('post','/api/tasks/').send({ title:'x',runId:'x' }),
    await authed('patch',`/api/tasks/${id}/`).send({ done:true }), await authed('delete',`/api/tasks/${id}/`)];
  for (const response of responses) {
    assert.equal(response.status,503); assert.deepEqual(response.body, { error:'База данных временно недоступна' });
    assert.ok(!response.text.includes('secret'));
  }
});
