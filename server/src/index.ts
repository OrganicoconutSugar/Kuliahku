import 'dotenv/config'
import express, { type ErrorRequestHandler } from 'express'
import helmet from 'helmet'
import multer from 'multer'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { resolve } from 'node:path'
import { auth, authenticated } from './auth'
import { routes } from './routes'
import { db, Problem, missing, log } from './core'
import { startScheduler } from './notifications'
import { startBackups } from './backup'
const app = express(),
  dev = process.argv.includes('--dev'),
  port = Number(process.env.PORT || 5173)
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
  throw new Error('Jalankan npm run setup untuk menyiapkan rahasia sesi.')
const origin = new URL(process.env.APP_ORIGIN || 'http://localhost:' + port).origin
app.disable('x-powered-by')
app.use(
  helmet({
    contentSecurityPolicy: dev
      ? false
      : {
          directives: {
            'upgrade-insecure-requests': null,
            'img-src': ["'self'", 'data:', 'blob:'],
            'style-src': ["'self'", "'unsafe-inline'"],
          },
        },
    strictTransportSecurity: origin.startsWith('https:') ? undefined : false,
  }),
)
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
app.use('/api', (req, _res, next) => {
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.get('origin') !== origin &&
    !(req.get('origin') === undefined && req.get('sec-fetch-site') === 'same-origin')
  )
    throw new Problem(
      403,
      'Alamat asal permintaan tidak sesuai. Buka aplikasi melalui ' + origin + '.',
      'ORIGIN',
    )
  next()
})
app.use(express.json({ limit: '2mb' }))
app.get('/api/health', async (_req, res) => {
  await db.$queryRaw`SELECT 1`
  res.json({ ok: true })
})
app.use('/api/auth', auth)
app.use('/api', authenticated, routes, () => {
  throw missing()
})
app.get('/setup', async (_req, res, next) => {
  if (await db.user.count()) {
    res
      .status(404)
      .type('html')
      .send(
        '<html lang="id"><meta charset="utf-8"><title>Setup ditutup · KuliahKu</title><h1>Akun pemilik sudah tersedia.</h1><p><a href="/login">Masuk ke KuliahKu</a></p></html>',
      )
  } else next()
})
const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500,
    message = 'Ada kendala saat menyimpan atau membaca data. Coba lagi sebentar.',
    code = 'INTERNAL'
  if (err instanceof Problem) {
    status = err.status
    message = err.message
    code = err.code
  } else if (err instanceof z.ZodError) {
    status = 400
    code = 'VALIDATION'
    const issue = err.issues[0]
    message =
      issue.message.startsWith('Invalid') ||
      issue.message.startsWith('Expected') ||
      issue.message === 'Required' ||
      issue.message.startsWith('String must')
        ? 'Periksa kembali isian ' + issue.path.join(' / ') + '.'
        : issue.message
  } else if (err instanceof multer.MulterError) {
    status = 413
    code = 'FILE_LIMIT'
    message = 'Ukuran atau jumlah file melebihi batas unggahan.'
  } else if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    ['P2002', 'P2025', 'P2003'].includes(err.code)
  ) {
    status = err.code === 'P2025' ? 404 : 409
    code = err.code
    message =
      status === 404
        ? 'Data tidak ditemukan.'
        : 'Kode atau warna sudah digunakan, atau data terkait telah berubah.'
  } else if (err.status === 400 || err.status === 413) {
    status = err.status
    message = 'Isi permintaan tidak valid atau terlalu besar.'
  } else log.error({ err }, 'Permintaan gagal')
  res.status(status).json({ error: { code, message } })
}
app.use(onError)
if (dev) {
  const { createServer } = await import('vite')
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: port + 100 } },
    appType: 'spa',
  })
  app.use(vite.middlewares)
} else {
  app.use(express.static(resolve('dist')))
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')))
}
const server = app.listen(port, process.env.HOST || '127.0.0.1', () =>
  log.info({ url: origin }, 'KuliahKu siap'),
)
const cron = startScheduler(),
  backups = startBackups()
async function close() {
  await cron.stop()
  await backups.stop()
  await new Promise<void>((done) => server.close(() => done()))
  await db.$disconnect()
  process.exit(0)
}
process.on('SIGTERM', close)
process.on('SIGINT', close)
