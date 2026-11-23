import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import request from 'supertest';
import { createPrisma, TaskRepository } from '../../src/db.js';
import { createApp } from '../../src/app.js';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL обязателен; используйте отдельную БД с суффиксом _test');
const config = { login:`test_${randomUUID().slice(0,8)}`, fullName:'Тестовый Автор', token:'integration-test-token-only-1234567890' };
const runId = `ci_${randomUUID()}`;
let pool, app, reviewer, appPool, prisma, restrictedPrisma;
const sqlPool = connectionString => new pg.Pool({ connectionString, max: 2, connectionTimeoutMillis: 3000 });
const auth = (method, path) => request(app)[method](path).set('Authorization',`Bearer ${config.token}`);
before(async () => {
  pool = sqlPool(url);
  prisma = createPrisma(process.env.TEST_APP_URL || url);
  app = createApp({ repository:new TaskRepository(prisma),config });
});
after(async () => {
  if (pool) { await pool.query('DELETE FROM todo.tasks WHERE owner_login=$1',[config.login]); await pool.end(); }
  await reviewer?.end(); await appPool?.end();
  await prisma?.$disconnect(); await restrictedPrisma?.$disconnect();
});
test('API CRUD writes to real PostgreSQL; field names, UUID, UTC and 204', async () => {
  const created = await auth('post','/api/tasks/').send({ title:'  Из API  ',runId }).expect(201);
  const task = created.body;
  assert.deepEqual(Object.keys(task).sort(), ['id','ownerLogin','title','done','runId','createdAt'].sort());
  assert.match(task.id,/^[a-f0-9-]{36}$/); assert.equal(task.title,'Из API');
  assert.equal(task.ownerLogin,config.login); assert.equal(task.done,false); assert.equal(task.runId,runId);
  assert.equal(new Date(task.createdAt).toISOString(),task.createdAt);
  assert.equal((await pool.query('SELECT title FROM todo.tasks WHERE id=$1',[task.id])).rows[0].title,'Из API');
  const list = await auth('get',`/api/tasks/?runId=${runId}`).expect(200); assert.equal(list.body.length,1);
  await auth('patch',`/api/tasks/${task.id}/`).send({ title:'Новое название',done:true }).expect(200);
  const row = (await pool.query('SELECT * FROM todo.tasks WHERE id=$1',[task.id])).rows[0];
  assert.equal(row.done,true); assert.equal(row.title,'Новое название');
  const deleted = await auth('delete',`/api/tasks/${task.id}/`).expect(204); assert.equal(deleted.text,'');
  assert.equal((await pool.query('SELECT 1 FROM todo.tasks WHERE id=$1',[task.id])).rowCount,0);
  for (const method of ['get','patch','delete']) {
    const r = auth(method,`/api/tasks/${task.id}/`); if (method === 'patch') r.send({ done:true }); await r.expect(404);
  }
  assert.deepEqual((await auth('get',`/api/tasks/?runId=${runId}`).expect(200)).body,[]);
});
test('independent SQL INSERT/UPDATE/DELETE immediately visible in API and owner isolation', async () => {
  const id = randomUUID();
  await pool.query('INSERT INTO todo.tasks(id,owner_login,title,run_id) VALUES($1,$2,$3,$4)',[id,config.login,'SQL insert',runId]);
  assert.equal((await auth('get',`/api/tasks/${id}/`).expect(200)).body.title,'SQL insert');
  await pool.query('UPDATE todo.tasks SET title=$1,done=true WHERE id=$2',['SQL update',id]);
  const updated = (await auth('get',`/api/tasks/?runId=${runId}`).expect(200)).body.find(t => t.id === id);
  assert.equal(updated.title,'SQL update'); assert.equal(updated.done,true);
  await pool.query('UPDATE todo.tasks SET owner_login=$1 WHERE id=$2',['different_owner',id]);
  await auth('get',`/api/tasks/${id}/`).expect(404);
  await auth('patch',`/api/tasks/${id}/`).send({ done:false }).expect(404);
  await auth('delete',`/api/tasks/${id}/`).expect(404);
  await pool.query('DELETE FROM todo.tasks WHERE id=$1',[id]);
  await auth('get',`/api/tasks/${id}/`).expect(404);
});
test('restricted application and reviewer roles can CRUD only classroom table', {
  skip: process.env.TEST_REVIEWER_URL && process.env.TEST_APP_URL ? false : 'Нужны готовые TEST_REVIEWER_URL и TEST_APP_URL',
}, async () => {
  reviewer = sqlPool(process.env.TEST_REVIEWER_URL); appPool = sqlPool(process.env.TEST_APP_URL);
  await pool.query('CREATE TABLE IF NOT EXISTS todo.private_notes (id integer)');
  try {
    for (const connection of [reviewer,appPool]) {
      const id = randomUUID();
      await connection.query('INSERT INTO todo.tasks(id,owner_login,title,run_id) VALUES($1,$2,$3,$4)',[id,config.login,'Restricted insert',runId]);
      await connection.query('UPDATE todo.tasks SET title=$1 WHERE id=$2',['Restricted update',id]);
      assert.equal((await connection.query('SELECT title FROM todo.tasks WHERE id=$1',[id])).rows[0].title,'Restricted update');
      await connection.query('DELETE FROM todo.tasks WHERE id=$1',[id]);
      for (const sql of ['SELECT * FROM todo.private_notes','SELECT * FROM public._prisma_migrations','TRUNCATE todo.tasks','CREATE TABLE todo.forbidden(id int)','CREATE ROLE forbidden_role','DROP TABLE todo.tasks']) {
        await assert.rejects(() => connection.query(sql), error => error.code === '42501');
      }
    }
    // Веб-приложение работает с ограниченной ролью.
    restrictedPrisma = createPrisma(process.env.TEST_APP_URL);
    const restrictedApp = createApp({ repository:new TaskRepository(restrictedPrisma),config });
    const response = await request(restrictedApp).post('/api/tasks/').set('Authorization',`Bearer ${config.token}`).send({ title:'Restricted API',runId }).expect(201);
    const id = response.body.id;
    await reviewer.query('UPDATE todo.tasks SET done=true WHERE id=$1',[id]);
    assert.equal((await request(restrictedApp).get(`/api/tasks/${id}/`).set('Authorization',`Bearer ${config.token}`).expect(200)).body.done,true);
    await reviewer.query('DELETE FROM todo.tasks WHERE id=$1',[id]);
    await request(restrictedApp).get(`/api/tasks/${id}/`).set('Authorization',`Bearer ${config.token}`).expect(404);
  } finally { await pool.query('DROP TABLE todo.private_notes'); }
});
test('data persists through a real Node server process restart', async () => {
  const socket = createServer(); socket.listen(0,'127.0.0.1'); await once(socket,'listening');
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const launch = async () => {
    const child = spawn(process.execPath,['src/server.js'],{ env:{ ...process.env,DATABASE_URL:process.env.TEST_APP_URL || url,MOODLE_LOGIN:config.login,MOODLE_FULL_NAME:config.fullName,API_TOKEN:config.token,PORT:String(port),HOST:'127.0.0.1' },stdio:['ignore','pipe','pipe'] });
    await Promise.race([once(child.stdout,'data'),once(child,'exit').then(() => { throw new Error('Сервер завершился до запуска'); })]);
    return child;
  };
  const stop = async child => { const done = once(child,'exit'); child.kill('SIGTERM'); await done; };
  let child = await launch();
  try {
    const response = await fetch(`${base}/api/tasks/`,{ method:'POST',headers:{ Authorization:`Bearer ${config.token}`,'Content-Type':'application/json' },body:JSON.stringify({ title:'После перезапуска',runId }) });
    assert.equal(response.status,201); const task = await response.json();
    await stop(child); child = await launch();
    const read = await fetch(`${base}/api/tasks/${task.id}/`,{ headers:{ Authorization:`Bearer ${config.token}` } });
    assert.equal(read.status,200); assert.equal((await read.json()).title,'После перезапуска');
  } finally { await stop(child); }
});

test('Prisma migrations enforce SQL checks and database outages become 503', async () => {
  const migration = await pool.query('SELECT migration_name, finished_at FROM public._prisma_migrations WHERE rolled_back_at IS NULL');
  assert.ok(migration.rows.some(row => row.migration_name === '20261123000000_init' && row.finished_at));
  for (const [title, run] of [['x'.repeat(201), runId], [' ', runId], ['x', 'invalid run!']]) {
    await assert.rejects(() => pool.query('INSERT INTO todo.tasks(id,owner_login,title,run_id) VALUES($1,$2,$3,$4)',
      [randomUUID(),config.login,title,run]), error => error.code === '23514');
  }
  const badUrl = new URL(url); badUrl.hostname = '127.0.0.1'; badUrl.port = '1';
  const unavailable = createPrisma(badUrl.toString());
  try {
    const failingApp = createApp({ repository:new TaskRepository(unavailable),config });
    const response = await request(failingApp).get('/api/tasks/?runId=outage')
      .set('Authorization', `Bearer ${config.token}`).expect(503);
    assert.deepEqual(response.body, { error: 'База данных временно недоступна' });
  } finally { await unavailable.$disconnect(); }
});
