import express from 'express';
import helmet from 'helmet';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { InputError, validBody, validRunId, validId } from './validation.js';
const hash = value => createHash('sha256').update(value).digest();
export function createApp({ repository, config }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('strict routing', true);
  app.set('query parser', 'simple');
  app.use(helmet());
  app.get('/login/', (_req, res) => res.type('text/plain').send(config.login));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const header = req.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !timingSafeEqual(hash(token), hash(config.token))) {
      res.set('WWW-Authenticate', 'Bearer');
      return res.status(401).json({ error: 'Требуется корректный Bearer-токен' });
    }
    next();
  });
  const api = express.Router({ strict: true });
  api.use(express.json({ limit: '16kb', strict: false }));
  api.get('/author/', (_req, res) => res.json({ login: config.login, fullName: config.fullName }));
  // Внешние ошибки репозитория всегда 503, включая ошибки форматирования данных БД.
  const db = async operation => {
    try { return await operation(); } catch { const error = new Error('База данных временно недоступна'); error.status = 503; throw error; }
  };
  api.post('/tasks/', async (req, res) => {
    if (!req.is('application/json')) throw new InputError('Ожидается Content-Type: application/json');
    const body = validBody(req.body);
    const task = await db(() => repository.create({ ...body, id: randomUUID(), ownerLogin: config.login,
      done: false, createdAt: new Date().toISOString() }));
    res.location(`/api/tasks/${task.id}/`).status(201).json(task);
  });
  api.get('/tasks/', async (req, res) => {
    const runId = validRunId(req.query.runId);
    res.json(await db(() => repository.list(config.login, runId)));
  });
  api.param('id', (req, _res, next, id) => { validId(id); next(); });
  api.get('/tasks/:id/', async (req, res) => {
    const task = await db(() => repository.get(config.login, req.params.id));
    if (!task) return res.status(404).json({ error: 'Дело не найдено' });
    res.json(task);
  });
  api.patch('/tasks/:id/', async (req, res) => {
    if (!req.is('application/json')) throw new InputError('Ожидается Content-Type: application/json');
    const patch = validBody(req.body, true);
    const task = await db(() => repository.patch(config.login, req.params.id, patch));
    if (!task) return res.status(404).json({ error: 'Дело не найдено' });
    res.json(task);
  });
  api.delete('/tasks/:id/', async (req, res) => {
    if (!await db(() => repository.delete(config.login, req.params.id))) return res.status(404).json({ error: 'Дело не найдено' });
    res.status(204).end();
  });
  api.use((_req, res) => res.status(404).json({ error: 'Маршрут не найден' }));
  app.use('/api', api);
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.use((_req, res) => res.status(404).json({ error: 'Маршрут не найден' }));
  app.use((error, _req, res, _next) => {
    if (error instanceof InputError || error.type === 'entity.parse.failed' || error.type === 'entity.too.large' || [400, 413, 415].includes(error.status) || error instanceof URIError) {
      return res.status(400).json({ error: error instanceof InputError ? error.message : 'Некорректный JSON или запрос' });
    }
    res.status(error.status === 503 ? 503 : 500).json({ error: error.status === 503 ? error.message : 'Внутренняя ошибка сервера' });
  });
  return app;
}
