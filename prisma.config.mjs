import { defineConfig } from 'prisma/config';
// Окружение загружает Node --env-file-if-exists=.env в npm-командах.
// Миграции используют DATABASE_URL, генерация клиента не подключается к БД.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL },
});
