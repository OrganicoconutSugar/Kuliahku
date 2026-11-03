import { Router, type Request, type Response, type NextFunction } from 'express'
import { randomBytes, createHmac } from 'node:crypto'
import { hash, compare } from 'bcryptjs'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { setupInput, loginInput, label } from '../../shared/validation'
import { db, Problem, missing, transaction } from './core'
declare module 'express-serve-static-core' {
  interface Locals {
    user: { id: string; name: string; email: string }
    digest: string
  }
}
const publicUser = { id: true, name: true, email: true } as const
const lifetime = 30 * 86400000,
  cookie = 'kuliahku_session'
const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' }
const digest = (v: string) =>
  createHmac('sha256', process.env.SESSION_SECRET!).update(v).digest('hex')
const token = (req: Request) =>
  req.headers.cookie
    ?.split(/;\s*/)
    .find((s) => s.startsWith(cookie + '='))
    ?.slice(cookie.length + 1) || ''
async function issue(res: Response, userId: string) {
  const raw = randomBytes(32).toString('hex')
  await db.loginSession.create({
    data: { digest: digest(raw), userId, expiresAt: new Date(Date.now() + lifetime) },
  })
  res.cookie(cookie, raw, { ...opts, maxAge: lifetime })
}
export async function authenticated(req: Request, res: Response, next: NextFunction) {
  const raw = token(req)
  const session =
    raw &&
    (await db.loginSession.findUnique({
      where: { digest: digest(raw) },
      include: { user: { select: publicUser } },
    }))
  if (!session || +session.expiresAt <= Date.now())
    throw new Problem(401, 'Masuk dulu untuk membuka ruang belajarmu.', 'UNAUTHORIZED')
  if (+session.expiresAt < Date.now() + lifetime - 60000) {
    const renewed = await db.loginSession.updateMany({
      where: { digest: session.digest, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date(Date.now() + lifetime) },
    })
    if (!renewed.count) throw new Problem(401, 'Sesi sudah berakhir.', 'UNAUTHORIZED')
    res.cookie(cookie, raw, { ...opts, maxAge: lifetime })
  }
  res.locals.user = session.user
  res.locals.digest = session.digest
  next()
}
export const auth = Router()
auth.get('/status', async (_req, res) => res.json({ setupAvailable: !(await db.user.count()) }))
auth.post('/setup', async (req, res) => {
  if (await db.user.count()) throw missing()
  const { name, email, password } = setupInput.parse(req.body)
  const passwordHash = await hash(password, 12)
  const user = await db.user
    .create({ data: { name, email, passwordHash, settings: { create: {} } }, select: publicUser })
    .catch(async (e) => {
      if (await db.user.count()) throw missing()
      throw e
    })
  await issue(res, user.id)
  res.status(201).json(user)
})
auth.post(
  '/login',
  rateLimit({
    windowMs: 15 * 60000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMIT', message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' },
    },
  }),
  async (req, res) => {
    const { email, password } = loginInput.parse(req.body)
    const u = await db.user.findUnique({ where: { email } })
    if (!u || !(await compare(password, u.passwordHash)))
      throw new Problem(401, 'Email atau kata sandi belum cocok.', 'LOGIN_FAILED')
    await issue(res, u.id)
    res.json({ id: u.id, email: u.email, name: u.name })
  },
)
auth.use(authenticated)
auth.get('/me', (_req, res) => res.json(res.locals.user))
auth.post('/logout', async (_req, res) => {
  await db.loginSession.deleteMany({ where: { digest: res.locals.digest } })
  res.clearCookie(cookie, opts).json({ ok: true })
})
auth.patch('/profile', async (req, res) =>
  res.json(
    await db.user.update({
      where: { id: res.locals.user.id },
      data: z.object({ name: label.max(80) }).parse(req.body),
      select: publicUser,
    }),
  ),
)
auth.post('/password', async (req, res) => {
  const { current, password } = z
    .object({ current: z.string().max(72), password: setupInput.shape.password })
    .parse(req.body)
  const user = await db.user.findUniqueOrThrow({ where: { id: res.locals.user.id } })
  if (!(await compare(current, user.passwordHash)))
    throw new Problem(400, 'Kata sandi saat ini belum cocok.')
  const passwordHash = await hash(password, 12)
  await transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } })
    await tx.loginSession.deleteMany({
      where: { userId: user.id, digest: { not: res.locals.digest } },
    })
  })
  res.json({ ok: true })
})
