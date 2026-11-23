export class InputError extends Error {}
export function validTitle(value) {
  if (typeof value !== 'string') throw new InputError('title должен быть строкой');
  const title = value.trim();
  if ([...title].length < 1 || [...title].length > 200 || title.includes('\0')) {
    throw new InputError('title: от 1 до 200 символов после trim');
  }
  return title;
}
export function validRunId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new InputError('runId: 1–64 символа A-Z, a-z, 0-9, _ или -');
  }
  return value;
}
export function validId(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new InputError('Некорректный UUID');
  }
  return value;
}
export function validBody(body, patch = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('Ожидается JSON-объект');
  const keys = Object.keys(body);
  const allowed = patch ? ['title', 'done'] : ['title', 'runId'];
  if (!keys.length || keys.some(key => !allowed.includes(key))) throw new InputError('Недопустимые поля');
  if (!patch && (!Object.hasOwn(body, 'title') || !Object.hasOwn(body, 'runId'))) {
    throw new InputError('Обязательны title и runId');
  }
  const result = {};
  if (Object.hasOwn(body, 'title')) result.title = validTitle(body.title);
  if (Object.hasOwn(body, 'runId')) result.runId = validRunId(body.runId);
  if (Object.hasOwn(body, 'done')) {
    if (typeof body.done !== 'boolean') throw new InputError('done должен быть boolean');
    result.done = body.done;
  }
  return result;
}
