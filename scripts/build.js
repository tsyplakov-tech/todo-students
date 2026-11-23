import { mkdir, cp, rm } from 'node:fs/promises';
const target = new URL('../dist/', import.meta.url);
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const name of ['src', 'public', 'prisma', 'prisma.config.mjs', 'tsconfig.prisma.json',
  'scripts', 'package.json', 'package-lock.json']) {
  await cp(new URL(`../${name}`, import.meta.url), new URL(name, target), { recursive: true });
}
await cp(new URL('../generated/client', import.meta.url), new URL('generated/client', target), { recursive: true });
console.log('dist/ готов: сервер, интерфейс, миграции и скомпилированный Prisma Client. Установка runtime: npm ci --omit=dev --ignore-scripts.');
