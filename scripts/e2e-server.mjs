import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import webpush from 'web-push'
const dir = mkdtempSync(join(tmpdir(), 'kuliahku-browser-'))
const file = join(dir, 'e2e.db'),
  keys = webpush.generateVAPIDKeys()
writeFileSync(file, '')
const env = {
  ...process.env,
  DATABASE_URL: 'file:' + file,
  UPLOAD_DIR: join(dir, 'uploads'),
  BACKUP_DIR: join(dir, 'backups'),
  APP_ORIGIN: 'http://localhost:5291',
  HOST: '127.0.0.1',
  PORT: '5291',
  SESSION_SECRET: randomBytes(40).toString('hex'),
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: 'mailto:test@example.test',
  LOG_LEVEL: 'warn',
}
execFileSync(resolve('node_modules/.bin/prisma'), ['migrate', 'deploy'], { env, stdio: 'pipe' })
const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/index.ts'], {
  env,
  stdio: 'inherit',
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', (code) => {
  rmSync(dir, { recursive: true, force: true })
  process.exit(code ?? 0)
})
