export function loadConfig(env = process.env) {
  for (const key of ['DATABASE_URL', 'MOODLE_LOGIN', 'MOODLE_FULL_NAME', 'API_TOKEN']) {
    if (!env[key]?.trim()) throw new Error(`Заполните ${key} в окружении`);
  }
  if (env.MOODLE_LOGIN === 'your_moodle_login' || env.MOODLE_FULL_NAME === 'Ваше ФИО из Moodle') {
    throw new Error('Укажите реальные ФИО и логин Moodle');
  }
  if (env.API_TOKEN.length < 32 || env.API_TOKEN.startsWith('replace_')) {
    throw new Error('API_TOKEN: задайте случайный токен длиной не менее 32 символов');
  }
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Некорректный PORT');
  return { databaseUrl: env.DATABASE_URL, login: env.MOODLE_LOGIN.trim(),
    fullName: env.MOODLE_FULL_NAME.trim(), token: env.API_TOKEN, port, host: env.HOST || '127.0.0.1' };
}
