import { Router, type Request, type Response } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db, workspace, transaction, ownCourse, missing, Problem, discardFiles } from './core'
import { writeCourse } from './sessions'
import { stats, todayData, RecapService } from './insights'
import { calendar } from './calendar'
import { claim, deliver, isPushEndpoint } from './notifications'
import { day, instant, sessionLabel } from '../../shared/model'
import {
  clockInput,
  courseInput,
  dateInput,
  label,
  semesterFields,
  validSemester,
  settingsInput,
  slotInput,
} from '../../shared/validation'
import { exampleCourses } from './seed'
import { materials } from './materials'
export const routes = Router()
const query = (req: Request, key: string) =>
  typeof req.query[key] === 'string' ? (req.query[key] as string) : undefined
const data = (req: Request, res: Response) =>
  workspace(res.locals.user.id, query(req, 'semesterId'))
routes.use(materials)
routes.get('/onboarding/example', (_req, res) => res.json(exampleCourses))
routes.get('/workspace', async (req, res) => res.json(await data(req, res)))
routes.get('/semesters', async (_req, res) =>
  res.json(
    await db.semester.findMany({
      where: { userId: res.locals.user.id },
      orderBy: { startDate: 'desc' },
    }),
  ),
)
routes.post('/semesters', async (req, res) => {
  const { courses, ...v } = semesterFields
    .extend({ courses: z.array(courseInput).min(1).max(6) })
    .refine(validSemester, 'Periksa rentang semester (maksimal tiga tahun).')
    .parse(req.body)
  const userId = res.locals.user.id
  const result = await transaction(async (tx) => {
    await tx.semester.updateMany({ where: { userId, isActive: true }, data: { isActive: false } })
    const s = await tx.semester.create({ data: { ...v, userId } })
    for (const c of courses) await writeCourse(tx, s.id, c)
    return s
  })
  res.status(201).json(result)
})
routes.patch('/semesters/:id', async (req, res) => {
  const v = semesterFields
    .partial()
    .extend({ isActive: z.literal(false).optional() })
    .parse(req.body)
  res.json(
    await transaction(async (tx) => {
      const old = await tx.semester.findFirst({
        where: { id: String(req.params.id), userId: res.locals.user.id },
      })
      if (!old) throw missing()
      if (!validSemester({ ...old, ...v })) throw new Problem(400, 'Periksa rentang semester.')
      const s = await tx.semester.update({
        where: { id: old.id },
        data: v,
        include: { courses: true },
      })
      if (v.trackingStart)
        for (const tracked of [false, true])
          await tx.session.updateMany({
            where: {
              course: { semesterId: s.id },
              date: tracked ? { gte: v.trackingStart } : { lt: v.trackingStart },
            },
            data: { tracked },
          })
      return s
    }),
  )
})
routes.get('/courses', async (req, res) => res.json((await data(req, res)).courses))
routes.post('/courses', async (req, res) => {
  const v = courseInput.parse(req.body),
    semesterId = z.string().optional().parse(req.body.semesterId)
  const s = await db.semester.findFirst({
    where: {
      userId: res.locals.user.id,
      ...(semesterId ? { id: semesterId } : { isActive: true }),
    },
  })
  if (!s) throw missing()
  res.status(201).json(await transaction((tx) => writeCourse(tx, s.id, v)))
})
routes.patch('/courses/:id', async (req, res) => {
  const c = await ownCourse(db, res.locals.user.id, String(req.params.id))
  const slots = await db.classSchedule.findMany({ where: { courseId: c.id, active: true } })
  const v = courseInput.parse({ ...c, schedules: slots, ...req.body })
  res.json(await transaction((tx) => writeCourse(tx, c.semesterId, v, c.id)))
})
routes.all(['/courses/:id/schedules', '/courses/:id/schedules/:slot'], async (req, res) => {
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) throw missing()
  const id = String(req.params.id),
    c = await ownCourse(db, res.locals.user.id, id)
  const slots = await db.classSchedule.findMany({ where: { courseId: id, active: true } })
  const slotId = req.params.slot ?? req.body?.id,
    original = slots.find((s) => s.id === slotId)
  if (req.method !== 'POST' && !original) throw missing()
  const list =
    req.method === 'POST'
      ? [...slots, slotInput.parse(req.body)]
      : req.method === 'DELETE'
        ? slots.filter((s) => s.id !== slotId)
        : slots.map((s) => (s.id === slotId ? slotInput.parse({ ...s, ...req.body, id: s.id }) : s))
  res.json(
    await transaction((tx) =>
      writeCourse(tx, c.semesterId, courseInput.parse({ ...c, schedules: list }), id),
    ),
  )
})
routes.delete('/courses/:id', async (req, res) => {
  const keys = await transaction(async (tx) => {
    const c = await ownCourse(tx, res.locals.user.id, String(req.params.id))
    const files = await tx.attachment.findMany({ where: { courseId: c.id } })
    await tx.course.delete({ where: { id: c.id } })
    return files.map((a) => a.storageKey)
  })
  await discardFiles(keys)
  res.json({ ok: true })
})
routes.get('/sessions', async (req, res) => {
  const w = await data(req, res)
  res.json(
    w.sessions.filter(
      (s) =>
        (!req.query.courseId || s.courseId === req.query.courseId) &&
        s.date >= (query(req, 'from') ?? '') &&
        s.date <= (query(req, 'to') ?? '9999'),
    ),
  )
})
routes.get('/sessions/:id', async (req, res) => {
  const s = await db.session.findFirst({
    where: { id: String(req.params.id), course: { semester: { userId: res.locals.user.id } } },
    include: { notes: true, tasks: true, attachments: true },
  })
  if (!s) throw missing()
  res.json(s)
})
routes.post('/sessions', async (req, res) => {
  const v = z
    .object({
      courseId: label,
      meetingNo: z.number().int().positive().max(9999),
      date: dateInput,
      startTime: clockInput,
      endTime: clockInput,
      room: label,
    })
    .refine((x) => x.startTime < x.endTime, 'Jam selesai harus sesudah jam mulai.')
    .parse(req.body)
  res.status(201).json(
    await transaction(async (tx) => {
      const c = await ownCourse(tx, res.locals.user.id, v.courseId)
      if (v.date < c.semester.startDate || v.date > c.semester.endDate)
        throw new Problem(400, 'Pilih tanggal dalam semester ini.')
      if (await tx.session.count({ where: { courseId: c.id, meetingNo: v.meetingNo } }))
        throw new Problem(409, 'Nomor pertemuan sudah dipakai di mata kuliah ini.')
      const s = await tx.session.create({
        data: {
          courseId: c.id,
          meetingNo: v.meetingNo,
          date: v.date,
          startAt: instant(v.date, v.startTime),
          endAt: instant(v.date, v.endTime),
          room: v.room,
          tracked: v.date >= c.semester.trackingStart,
        },
      })

      return tx.session.findUniqueOrThrow({ where: { id: s.id } })
    }),
  )
})
routes.patch('/sessions/:id', async (req, res) => {
  const v = z
    .object({
      topic: z.string().max(240).optional(),
      status: z.enum(['normal', 'libur']).optional(),
      reason: z.string().max(500).nullable().optional(),
    })
    .parse(req.body)
  res.json(
    await transaction(async (tx) => {
      const s = await tx.session.findFirst({
        where: { id: String(req.params.id), course: { semester: { userId: res.locals.user.id } } },
      })
      if (!s) throw missing()
      await tx.session.update({ where: { id: s.id }, data: v })

      return tx.session.findUniqueOrThrow({ where: { id: s.id } })
    }),
  )
})
routes.get('/notes', async (req, res) => {
  const w = await data(req, res)
  res.json(
    w.notes.filter((n) => {
      const d = w.sessions.find((s) => s.id === n.sessionId)?.date ?? day(n.createdAt)
      return (
        (!req.query.courseId || n.courseId === req.query.courseId) &&
        (!req.query.sessionId || n.sessionId === req.query.sessionId) &&
        (!req.query.tag || JSON.parse(n.tagsJson).includes(req.query.tag)) &&
        (n.title + ' ' + n.body).toLowerCase().includes((query(req, 'q') ?? '').toLowerCase()) &&
        d >= (query(req, 'from') ?? '') &&
        d <= (query(req, 'to') ?? '9999')
      )
    }),
  )
})
routes.get('/attachments', async (req, res) =>
  res.json(
    (await data(req, res)).attachments.filter(
      (a) =>
        (!req.query.kind || a.kind === req.query.kind) &&
        (!req.query.courseId || a.courseId === req.query.courseId) &&
        (!req.query.sessionId || a.sessionId === req.query.sessionId),
    ),
  ),
)
routes.get('/tasks', async (req, res) =>
  res.json(
    (await data(req, res)).tasks.filter(
      (t) =>
        (!req.query.status || t.status === req.query.status) &&
        (!req.query.courseId || t.courseId === req.query.courseId),
    ),
  ),
)
routes.get('/today', async (req, res) => res.json(todayData(await data(req, res))))
routes.get('/stats', async (req, res) => res.json(stats(await data(req, res))))
routes.get('/recap', async (req, res) =>
  res.json(
    RecapService.getRecapData(await data(req, res), {
      mode: z.enum(['7d', '5class']).default('7d').parse(req.query.mode),
    }),
  ),
)
routes.get('/search', async (req, res) => {
  const w = await data(req, res),
    q = (query(req, 'q') ?? '').trim().toLocaleLowerCase('id')
  if (!q) return res.json([])
  const rows = [
    ...w.notes.map((n) => ({
      type: 'Catatan',
      title: n.title,
      text: n.body,
      courseId: n.courseId,
      sessionId: n.sessionId,
      date: day(n.updatedAt),
      url: '/catatan/' + n.id,
    })),
    ...w.tasks.map((t) => ({
      type: 'PR',
      title: t.title,
      text: '',
      courseId: t.courseId,
      sessionId: t.sessionId,
      date: day(t.dueAt),
      url: '/pr?item=' + t.id,
    })),
    ...w.attachments
      .filter((a) => a.kind === 'module')
      .map((a) => ({
        type: 'Modul',
        title: a.title,
        text: a.description ?? '',
        courseId: a.courseId,
        sessionId: a.sessionId,
        date: day(a.createdAt),
        url: '/matkul/' + a.courseId + '?tab=Modul&item=' + a.id,
      })),
    ...w.courses.map((c) => ({
      type: 'Mata kuliah',
      title: c.name,
      text: c.code,
      courseId: c.id,
      sessionId: null,
      date: '',
      url: '/matkul/' + c.id,
    })),
  ]
  res.json(
    rows
      .filter(
        (r) =>
          (!req.query.type || req.query.type === r.type) &&
          (!req.query.courseId || req.query.courseId === r.courseId) &&
          (r.title + ' ' + r.text).toLowerCase().includes(q),
      )
      .slice(0, 50)
      .map((r) => {
        const i = Math.max(0, r.text.toLowerCase().indexOf(q) - 35),
          s = w.sessions.find((s) => s.id === r.sessionId)
        return { ...r, text: r.text.slice(i, i + 150), meeting: s ? sessionLabel(s) : '' }
      }),
  )
})
routes.get('/settings', async (_req, res) =>
  res.json(await db.settings.findUniqueOrThrow({ where: { userId: res.locals.user.id } })),
)
routes.patch('/settings', async (req, res) =>
  res.json(
    await db.settings.update({
      where: { userId: res.locals.user.id },
      data: settingsInput.parse(req.body),
    }),
  ),
)
routes.get('/push/public-key', (_req, res) =>
  res.json({ key: process.env.VAPID_PUBLIC_KEY ?? null }),
)
routes.get('/push/devices', async (_req, res) =>
  res.json(
    await db.pushSubscription.findMany({
      where: { userId: res.locals.user.id },
      select: { id: true, userAgent: true, createdAt: true },
    }),
  ),
)
routes.post('/push/subscribe', async (req, res) => {
  const key = z.string().regex(/^[\w-]+={0,2}$/)
  const v = z
    .object({
      endpoint: z
        .string()
        .max(3500)
        .refine(isPushEndpoint, 'Layanan push perangkat ini tidak dikenali.'),
      keys: z.object({
        p256dh: key.refine((v) => Buffer.from(v, 'base64url').length === 65),
        auth: key.refine((v) => Buffer.from(v, 'base64url').length === 16),
      }),
    })
    .parse(req.body)
  await db.pushSubscription.upsert({
    where: { endpoint: v.endpoint },
    create: {
      userId: res.locals.user.id,
      endpoint: v.endpoint,
      ...v.keys,
      userAgent: req.get('user-agent'),
    },
    update: { ...v.keys, userAgent: req.get('user-agent') },
  })
  res.json({ ok: true })
})
routes.delete('/push/subscribe', async (req, res) => {
  const v = z
    .union([z.object({ id: label }), z.object({ endpoint: z.string().url() })])
    .parse(req.body)
  await db.pushSubscription.deleteMany({ where: { ...v, userId: res.locals.user.id } })
  res.json({ ok: true })
})
routes.post('/push/test', async (_req, res) => {
  const userId = res.locals.user.id,
    p = await claim(userId, [
      {
        type: 'test',
        key: 'test:' + randomUUID(),
        at: Date.now(),
        window: 1,
        title: 'Halo dari KuliahKu!',
        body: 'Pengingat uji dari ruang belajarmu.',
        url: '/notifikasi',
      },
    ])
  res.json({ delivered: p ? await deliver(userId, p) : 0 })
})
routes.get('/notifications', async (_req, res) => {
  const list = await db.notificationLog.findMany({
    where: { userId: res.locals.user.id },
    orderBy: { firedAt: 'desc' },
  })
  const seen = new Set<string>()
  res.json(
    list.filter((n) => {
      const k = n.groupId ?? n.id
      if (seen.has(k)) return false
      seen.add(k)
      return true
    }),
  )
})
routes.post('/notifications/read-all', async (_req, res) => {
  await db.notificationLog.updateMany({
    where: { userId: res.locals.user.id, readAt: null },
    data: { readAt: new Date() },
  })
  res.json({ ok: true })
})
routes.post('/notifications/:id/read', async (req, res) => {
  const userId = res.locals.user.id,
    n = await db.notificationLog.findFirst({ where: { id: String(req.params.id), userId } })
  if (!n) throw missing()
  await db.notificationLog.updateMany({
    where: { userId, ...(n.groupId ? { groupId: n.groupId } : { id: n.id }) },
    data: { readAt: new Date() },
  })
  res.json({ ok: true })
})
routes.get('/export/ics', async (req, res) => {
  const alarm = z.coerce.number().int().min(0).max(1440).default(0).parse(req.query.alarm)
  res
    .attachment('jadwal-kuliah.ics')
    .type('text/calendar; charset=utf-8')
    .send(
      calendar(await data(req, res), req.query.schedule !== '0', req.query.tasks === '1', alarm),
    )
})
routes.get('/export/json', async (_req, res) => {
  const userId = res.locals.user.id,
    semesters = await db.semester.findMany({ where: { userId } })
  const contents = await Promise.all(
    semesters.map(async (s) => {
      const { semester, courses, sessions, notes, tasks, attachments } = await workspace(
        userId,
        s.id,
      )
      return {
        semester,
        courses,
        sessions,
        notes,
        tasks,
        attachments: attachments.map(({ storageKey: _k, ...a }) => ({
          ...a,
          url: a.url ?? '/api/files/' + a.id,
        })),
      }
    }),
  )
  res
    .attachment('kuliahku-backup-' + day() + '.json')
    .json({ format: 1, exportedAt: new Date(), semesters: contents })
})
