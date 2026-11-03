import { agenda, meetingLink } from '../../shared/agenda'
import webpush from 'web-push'
import cron from 'node-cron'
import { randomUUID } from 'node:crypto'
import type { Settings, Workspace } from '../../shared/model'
import { day, addDays, instant, time, isoWeek, weekday } from '../../shared/model'
import { db, log, workspace, transaction } from './core'
import { recorded, RecapService } from './insights'
export type Candidate = {
  type: string
  key: string
  at: number
  window: number
  title: string
  body: string
  url: string
  group?: string
  tag?: string
}
const minute = 60000
export function dueRules(w: Workspace, p: Settings, now = new Date(), planned = w.sessions) {
  const out: Candidate[] = []
  const add = (item: Candidate) => {
    if (item.at <= +now && +now - item.at < item.window * minute) out.push(item)
  }
  const normal = planned.filter((s) => s.status === 'normal')
  const name = (id: string) => w.courses.find((c) => c.id === id)?.code ?? 'Kelas'
  for (const s of normal) {
    const start = Date.parse(s.startAt),
      prev = normal.some(
        (other) =>
          other.id !== s.id &&
          other.room === s.room &&
          s.date === other.date &&
          start >= Date.parse(other.endAt) &&
          start - Date.parse(other.endAt) <= 15 * minute,
      )
    if (p.classReminderMin && !prev)
      add({
        type: 'class',
        key: 'class:' + s.id,
        at: start - p.classReminderMin * minute,
        window: 10,
        title: 'Kelas segera mulai',
        body: name(s.courseId) + ' mulai pukul ' + time(s.startAt) + ' di ' + s.room + '.',
        url: meetingLink(s),
      })
  }
  const today = day(now)
  for (const date of [addDays(today, -1), today]) {
    const next = addDays(date, 1),
      tomorrow = normal.filter((s) => s.date === next),
      current = normal.filter((s) => s.date === date),
      missing = current.filter((s) => s.tracked && !recorded(w, s))
    if (p.briefEnabled && tomorrow.length)
      add({
        type: 'brief',
        key: 'brief:' + next,
        at: +instant(date, p.briefTime),
        window: 120,
        title: 'Jadwal besok',
        body:
          'Besok ada ' +
          tomorrow.length +
          ' kelas: ' +
          tomorrow
            .map((s) => time(s.startAt) + ' ' + name(s.courseId) + ' (' + s.room + ')')
            .join(' · ') +
          '. PR jatuh tempo: ' +
          w.tasks.filter((t) => t.status === 'todo' && day(t.dueAt) === next).length +
          '.',
        url: '/hari-ini',
      })
    if (p.nudgeEnabled && missing.length)
      add({
        type: 'nudge',
        key: 'nudge:' + date,
        at: Math.max(...current.map((s) => Date.parse(s.endAt))) + p.nudgeDelay * minute,
        window: 180,
        title: 'Yuk, catat sebentar',
        body: 'Belum ada catatan untuk ' + missing.map((s) => name(s.courseId)).join(', ') + '.',
        url: '/hari-ini',
      })
    if (p.recapEnabled && weekday(date) === p.recapDow) {
      const at = +instant(date, p.recapTime)
      if (at <= +now && +now - at < 360 * minute) {
        const r = RecapService.getRecapData(w, { to: date, now })
        add({
          type: 'recap',
          key: 'recap:' + isoWeek(date),
          at,
          window: 360,
          title: 'Rekap minggu ini siap',
          body:
            r.groups.reduce((v, g) => v + g.notes.length, 0) +
            ' catatan, ' +
            r.groups.reduce((v, g) => v + g.done, 0) +
            ' PR selesai. ' +
            r.groups.filter((g) => !g.hasValid).length +
            ' MK belum dicatat.',
          url: '/rekap',
        })
      }
    }
  }
  if (p.taskRemindersOn)
    for (const t of w.tasks.filter((t) => t.status === 'todo')) {
      const due = day(t.dueAt)
      for (const [kind, offset, clock, on, title] of [
        ['d3', -3, p.d3Time, p.d3Enabled, 'Deadline 3 hari lagi'],
        ['d1', -1, p.d1Time, p.d1Enabled, 'Besok deadline'],
        ['d0', 0, p.d0Time, p.d0Enabled, 'Deadline hari ini'],
        ['late', 1, p.lateTime, p.lateEnabled, 'Terlambat 1 hari'],
      ] as const) {
        const at = +instant(addDays(due, offset), clock)
        if (on && Date.parse(t.createdAt) <= at)
          add({
            type: 'task',
            key: ['task', t.id, kind, due].join(':'),
            at,
            window: 180,
            title,
            body: t.title + ' (' + name(t.courseId) + ')',
            url: '/pr',
            group: 'pr:' + at,
            tag: 'task-' + t.id,
          })
      }
    }
  return out
}
export function batchRules(list: Candidate[]) {
  const groups = new Map<string, Candidate[]>()
  for (const c of list) {
    const key = c.group ?? c.key
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  return [...groups.values()]
}
function message(items: Candidate[]) {
  const one = items[0]
  return {
    type: one.type,
    title: items.length === 1 ? one.title : items.length + ' pengingat PR',
    body:
      items
        .slice(0, 3)
        .map((c) => (items.length === 1 ? c.body : c.title + ' · ' + c.body))
        .join('\n') + (items.length > 3 ? '\ndan ' + (items.length - 3) + ' lainnya' : ''),
    url: one.url,
    tag: items.length === 1 ? (one.tag ?? one.key) : one.group,
  }
}
export async function claim(userId: string, group: Candidate[]) {
  return transaction(async (tx) => {
    const existing = await tx.notificationLog.findMany({
      where: { dedupeKey: { in: group.map((i) => i.key) } },
      select: { dedupeKey: true },
    })
    const fresh = group.filter((c) => !existing.some((e) => e.dedupeKey === c.key))
    if (!fresh.length) return null
    const { type, title, body, url, tag } = message(fresh),
      groupId = randomUUID()
    await tx.notificationLog.createMany({
      data: fresh.map((c) => ({ userId, type, title, body, url, dedupeKey: c.key, groupId })),
    })
    return { title, body, url, tag }
  })
}
export function isPushEndpoint(value: string) {
  try {
    const u = new URL(value)
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      [
        'fcm.googleapis.com',
        'android.googleapis.com',
        'push.services.mozilla.com',
        'push.apple.com',
        'notify.windows.com',
        'push.microsoft.com',
      ].some((h) => u.hostname === h || u.hostname.endsWith('.' + h))
    )
  } catch {
    return false
  }
}
export async function deliver(
  userId: string,
  payload: { title: string; body: string; url: string; tag?: string },
) {
  const keys = {
    subject: process.env.VAPID_SUBJECT!,
    publicKey: process.env.VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!,
  }
  if (!keys.publicKey || !keys.privateKey) return 0
  const subs = await db.pushSubscription.findMany({ where: { userId } })
  const results = await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { vapidDetails: keys, TTL: 3600, timeout: 10000 },
        )
        return 1
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410)
          await db.pushSubscription.deleteMany({ where: { id: s.id } })
        else log.warn({ status }, 'Layanan push menolak kiriman')
        return 0
      }
    }),
  )
  return results.filter(Boolean).length
}
export function startScheduler() {
  return cron.schedule(
    '* * * * *',
    async () => {
      try {
        let evaluated = 0,
          claimed = 0,
          sent = 0
        for (const p of await db.settings.findMany()) {
          const w = await workspace(p.userId)
          if (!w.semester) continue
          const date = day()
          const items = dueRules(w, p, new Date(), agenda(w, addDays(date, -1), addDays(date, 1)))
          evaluated += items.length
          for (const group of batchRules(items)) {
            const payload = await claim(p.userId, group)
            if (payload) {
              claimed++
              sent += await deliver(p.userId, payload)
            }
          }
        }
        log.info({ evaluated, claimed, sent }, 'Pengingat diperiksa')
      } catch (err) {
        log.error({ err }, 'Pemeriksaan pengingat gagal')
      }
    },
    { timezone: 'Asia/Jakarta', noOverlap: true },
  )
}
