import { agenda } from '../../shared/agenda'
import {
  addDays,
  day,
  instant,
  monday,
  type Meeting,
  type Note,
  type Workspace,
} from '../../shared/model'
export const validBody = (body: string, images: number) =>
  Array.from(body.replace(/!\[[^\]]*\]\(\/api\/files\/[^)]+\)/g, '').trim()).length >= 30 ||
  images > 0
export const recorded = (w: Workspace, s: Meeting) =>
  w.notes.some((n) => n.sessionId === s.id && n.isValid)
export function timelyNote(n: Note, s: Meeting) {
  if (!n.isValid) return false
  const end = +instant(addDays(s.date, 3), '00:00')
  return [n.qualifiedAt, n.createdAt, n.updatedAt].some(
    (t) =>
      t &&
      Date.parse(t) >= Date.parse(s.startAt) &&
      Date.parse(t) < end &&
      (t !== n.createdAt || !n.qualifiedAt || n.qualifiedAt === n.createdAt),
  )
}
export function stats(w: Workspace, now = new Date()) {
  const today = day(now)
  const tracked = w.sessions.filter((s) => s.tracked && s.status === 'normal' && s.date <= today)
  const dates = [...new Set(tracked.map((s) => s.date))].sort()
  let current = 0,
    longest = 0
  const history = dates.map((date) => {
    const items = tracked.filter((s) => s.date === date)
    const covered = items.every((s) =>
      w.notes.some((n) => n.sessionId === s.id && timelyNote(n, s)),
    )
    const state = covered
      ? 'Terpenuhi'
      : date === today
        ? 'Berjalan'
        : today <= addDays(date, 2)
          ? 'Tertunda'
          : 'Terlewat'
    if (covered) {
      current++
      longest = Math.max(longest, current)
    } else if (state === 'Terlewat') current = 0
    return { date, state }
  })
  const elapsed = tracked.filter((s) => Date.parse(s.startAt) <= +now)
  const coverage = w.courses.map((c) => {
    const list = elapsed.filter((s) => s.courseId === c.id),
      count = list.filter((s) => recorded(w, s)).length
    return {
      courseId: c.id,
      total: list.length,
      count,
      percent: list.length ? Math.round((count / list.length) * 100) : 0,
    }
  })
  const included = w.notes.filter((n) => !n.sessionId || elapsed.some((s) => s.id === n.sessionId))
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(monday(today), 7 * (i - 7))
    return {
      start,
      count: included.filter(
        (n) => day(n.createdAt) >= start && day(n.createdAt) < addDays(start, 7),
      ).length,
    }
  })
  const done = w.tasks.filter((t) => t.completedAt)
  return {
    current,
    longest,
    history: history.slice(-10),
    coverage,
    weeks,
    lowest: [...coverage].filter((x) => x.total).sort((a, b) => a.percent - b.percent)[0]?.courseId,
    onTime: done.filter((t) => Date.parse(t.completedAt!) <= Date.parse(t.dueAt)).length,
    late: done.filter((t) => Date.parse(t.completedAt!) > Date.parse(t.dueAt)).length,
    active: w.tasks.filter((t) => t.status === 'todo').length,
  }
}
export const RecapService = {
  getRecapData(
    w: Workspace,
    {
      mode = '7d',
      now = new Date(),
      to = day(now),
      from = addDays(to, -6),
    }: { mode?: string; to?: string; from?: string; now?: Date } = {},
  ) {
    const teaching = w.sessions.filter((s) => s.tracked && s.status === 'normal')
    const eligible = teaching.filter((s) => Date.parse(s.startAt) <= +now)
    const dates =
      mode === '5class'
        ? [
            ...new Set(
              eligible
                .filter(
                  (s) =>
                    s.date < to ||
                    (s.date === to &&
                      teaching
                        .filter((m) => m.date === to)
                        .every((m) => Date.parse(m.endAt) <= +now)),
                )
                .map((s) => s.date),
            ),
          ]
            .sort()
            .slice(-5)
        : null
    const inRange = (d: string) => (dates ? dates.includes(d) : d >= from && d <= to)
    const groups = w.courses.map((c) => {
      const sessions = eligible.filter((s) => s.courseId === c.id && inRange(s.date))
      const notes = w.notes.filter(
        (n) =>
          n.courseId === c.id &&
          (n.sessionId ? sessions.some((s) => s.id === n.sessionId) : inRange(day(n.createdAt))),
      )
      const tasks = w.tasks.filter(
        (t) =>
          t.courseId === c.id &&
          (inRange(day(t.dueAt)) ||
            (!!t.completedAt && inRange(day(t.completedAt))) ||
            sessions.some((s) => s.id === t.sessionId)),
      )
      return {
        courseId: c.id,
        sessions: sessions.length,
        recorded: sessions.filter((s) => recorded(w, s)).length,
        notes,
        hasValid: notes.some((n) => n.isValid),
        done: tasks.filter((t) => t.completedAt && inRange(day(t.completedAt))).length,
        active: tasks.filter((t) => t.status === 'todo').length,
        late: tasks.filter((t) => t.status === 'todo' && Date.parse(t.dueAt) < +now).length,
      }
    })
    return {
      from: dates?.[0] ?? from,
      to: dates?.at(-1) ?? to,
      dates,
      groups,
      streak: stats(w, now).current,
    }
  },
}
export function todayData(w: Workspace, now = new Date()) {
  const today = day(now),
    planned = agenda(w, today, addDays(today, 7)),
    todaySessions = planned.filter((s) => s.date === today)
  return {
    today: todaySessions,
    tomorrow: planned.filter((s) => s.date === addDays(today, 1)),
    next: planned.find((s) => s.status === 'normal' && Date.parse(s.startAt) > +now),
    urgent: w.tasks.filter((t) => t.status === 'todo').slice(0, 5),
    missing: w.sessions.filter(
      (s) =>
        s.date >= addDays(today, -2) &&
        Date.parse(s.endAt) <= +now &&
        s.tracked &&
        s.status === 'normal' &&
        !recorded(w, s),
    ),
    streak: stats(w, now).current,
  }
}
export type Insights = ReturnType<typeof stats>
export type Recap = ReturnType<typeof RecapService.getRecapData>
export type Today = ReturnType<typeof todayData>
