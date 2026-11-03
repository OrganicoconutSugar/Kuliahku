import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import webpush from 'web-push'
mkdirSync('data/uploads', { recursive: true })
if (!existsSync('.env')) {
  const keys = webpush.generateVAPIDKeys()
  const values = {
    SESSION_SECRET: randomBytes(48).toString('hex'),
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
  }
  const template = readFileSync('.env.example', 'utf8').replace(
    /^(SESSION_SECRET|VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY)=$/gm,
    (_, key) => key + '=' + values[key],
  )
  writeFileSync('.env', template, { mode: 0o600, flag: 'wx' })
}
// Prisma's SQLite migrator expects an existing file on some macOS builds.
const { config } = await import('dotenv')
config()
const { resolve, dirname } = await import('node:path')
const url = process.env.DATABASE_URL
if (url?.startsWith('file:')) {
  const path = resolve('server/prisma', url.slice(5).split('?')[0])
  mkdirSync(dirname(path), { recursive: true })
  if (!existsSync(path)) writeFileSync(path, '', { flag: 'wx', mode: 0o600 })
}
