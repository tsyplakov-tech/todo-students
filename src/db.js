import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client.js';

export function createPrisma(connectionString) {
  const adapter = new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000, statement_timeout: 5000 });
  // Ошибки подключения обрабатываются HTTP-слоем; реквизиты не логируются.
  return new PrismaClient({ adapter, log: [] });
}
function serialize(task) {
  return task ? { ...task, createdAt: task.createdAt.toISOString() } : null;
}
export class TaskRepository {
  constructor(prisma) { this.prisma = prisma; }
  async create(task) {
    return serialize(await this.prisma.task.create({ data: { id: task.id, ownerLogin: task.ownerLogin,
      title: task.title, runId: task.runId, done: false, createdAt: new Date(task.createdAt) } }));
  }
  async list(ownerLogin, runId) {
    const tasks = await this.prisma.task.findMany({ where: { ownerLogin, runId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return tasks.map(serialize);
  }
  async get(ownerLogin, id) {
    return serialize(await this.prisma.task.findFirst({ where: { id, ownerLogin } }));
  }
  async patch(ownerLogin, id, patch) {
    try {
      return serialize(await this.prisma.task.update({ where: { id, ownerLogin }, data: patch }));
    } catch (error) { if (error.code === 'P2025') return null; throw error; }
  }
  async delete(ownerLogin, id) {
    try {
      await this.prisma.task.delete({ where: { id, ownerLogin } });
      return true;
    } catch (error) { if (error.code === 'P2025') return false; throw error; }
  }
}
