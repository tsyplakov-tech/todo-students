import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
});
child.on('error', () => { console.error('Prisma CLI недоступен: установите npm ci'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
