import { loadConfig } from './config.js';
import { createPrisma, TaskRepository } from './db.js';
import { createApp } from './app.js';
const config = loadConfig();
const prisma = createPrisma(config.databaseUrl);
const app = createApp({ repository: new TaskRepository(prisma), config });
const server = app.listen(config.port, config.host, () => console.log(`Сервер запущен на порту ${config.port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
});
