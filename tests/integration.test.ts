import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import webpush from 'web-push'
import { addDays, day, weekday } from '../shared/model'
import { exampleCourses } from '../server/src/seed'
const dir = mkdtempSync(join(tmpdir(), 'kuliahku-unit-')),
  file = join(dir, 'test.db')
process.env.DATABASE_URL = 'file:' + file
process.env.UPLOAD_DIR = join(dir, 'uploads')
process.env.BACKUP_DIR = join(dir, 'backups')
let core: typeof import('../server/src/core'),
  rules: typeof import('../server/src/notifications'),
  sessions: typeof import('../server/src/sessions')
let userId: string, semesterId: string, courseId: string
beforeAll(async () => {
  writeFileSync(file, '')
  execFileSync(resolve('node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    stdio: 'pipe',
    env: process.env,
  })
  core = await import('../server/src/core')
  rules = await import('../server/src/notifications')
  sessions = await import('../server/src/sessions')
  const u = await core.db.user.create({
    data: {
      email: 'uji@example.test',
      passwordHash: 'unused',
      name: 'Uji',
      settings: { create: {} },
    },
  })
  userId = u.id
  const s = await core.db.semester.create({
    data: {
      userId,
      name: 'Uji',
      startDate: addDays(day(), -14),
      endDate: addDays(day(), 35),
      totalMeetings: 6,
      trackingStart: day(),
    },
  })
  semesterId = s.id
  const c = await core.transaction((tx) =>
    sessions.writeCourse(tx, semesterId, {
      ...exampleCourses[0],
      schedules: [{ ...exampleCourses[0].schedules[0], dayOfWeek: weekday(day()) }],
    }),
  )
  courseId = c.id
}, 30000)
afterAll(async () => {
  await core?.db.$disconnect()
  rmSync(dir, { recursive: true, force: true })
})
describe('Transaksi SQLite', () => {
  it('dua cron yang tumpang tindih hanya mengklaim satu pengingat, termasuk sesudah restart', async () => {
    const item = {
      key: 'task:a:d1:' + day(),
      type: 'task',
      at: Date.now(),
      window: 180,
      title: 'Besok deadline',
      body: 'PR A',
      url: '/pr',
    }
    const payloads = await Promise.all([rules.claim(userId, [item]), rules.claim(userId, [item])])
    expect(payloads.filter(Boolean)).toHaveLength(1)
    expect(await rules.claim(userId, [item])).toBeNull()
    expect(await core.db.notificationLog.count()).toBe(1)
  })
  it('menghapus subscription yang memberi HTTP 410', async () => {
    await core.db.pushSubscription.create({
      data: {
        userId,
        endpoint: 'https://fcm.googleapis.com/example',
        p256dh: 'unused',
        auth: 'unused',
      },
    })
    const send = vi
      .spyOn(webpush, 'sendNotification')
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
    const generated = webpush.generateVAPIDKeys()
    vi.stubEnv('VAPID_PUBLIC_KEY', generated.publicKey)
    vi.stubEnv('VAPID_PRIVATE_KEY', generated.privateKey)
    try {
      expect(await rules.deliver(userId, { title: 'Uji', body: 'Uji', url: '/' })).toBe(0)
      expect(await core.db.pushSubscription.count()).toBe(0)
    } finally {
      send.mockRestore()
      vi.unstubAllEnvs()
    }
  })
  it('mencadangkan database konsisten beserta berkas yang dirujuk', async () => {
    const { backup } = await import('../server/src/backup'),
      { PrismaClient } = await import('@prisma/client')
    mkdirSync(core.uploadDir, { recursive: true })
    writeFileSync(join(core.uploadDir, 'file-uji'), 'isi modul')
    await core.db.attachment.create({
      data: {
        userId,
        courseId,
        kind: 'module',
        source: 'upload',
        title: 'Contoh',
        storageKey: 'file-uji',
      },
    })
    const target = await backup(),
      snapshot = new PrismaClient({ datasourceUrl: 'file:' + join(target!, 'kuliahku.db') })
    try {
      expect(await snapshot.user.count()).toBe(1)
      expect(await snapshot.attachment.count()).toBe(1)
      expect(readFileSync(join(target!, 'uploads', 'file-uji'), 'utf8')).toBe('isi modul')
      expect(await backup()).toBe(target)
    } finally {
      await snapshot.$disconnect()
    }
  })
  it('menyimpan slot tanpa membuat pertemuan otomatis saat MK dibuat atau diubah', async () => {
    const w = await core.workspace(userId),
      slot = w.courses[0].schedules[0]
    expect(w.sessions).toEqual([])
    await core.transaction((tx) =>
      sessions.writeCourse(
        tx,
        semesterId,
        { ...exampleCourses[0], schedules: [{ ...slot, room: 'R.Baru' }] },
        courseId,
      ),
    )
    expect((await core.workspace(userId)).sessions).toEqual([])
  })
})
