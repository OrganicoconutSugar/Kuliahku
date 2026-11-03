import { addDays, day, instant, weekday, type Meeting, type Workspace } from './model'

export function agenda(w: Workspace, from: string, to: string): Meeting[] {
  const list = w.sessions.filter((s) => s.date >= from && s.date <= to)
  const result = [...list]
  if (!w.semester) return result
  for (
    let date = from < w.semester.startDate ? w.semester.startDate : from;
    date <= to && date <= w.semester.endDate;
    date = addDays(date, 1)
  ) {
    for (const c of w.courses)
      for (const slot of c.schedules) {
        if (slot.dayOfWeek !== weekday(date)) continue
        const startAt = instant(date, slot.startTime).toISOString()
        const recorded = list.find(
          (s) =>
            s.courseId === c.id &&
            s.date === date &&
            (s.scheduleId === slot.id || s.startAt === startAt),
        )
        if (recorded) {
          if (!recorded.scheduleId)
            result[result.indexOf(recorded)] = { ...recorded, scheduleId: slot.id }
          continue
        }
        result.push({
          id: 'slot:' + slot.id + ':' + date,
          courseId: c.id,
          scheduleId: slot.id,
          date,
          startAt,
          endAt: instant(date, slot.endTime).toISOString(),
          room: slot.room,
          status: 'normal',
          reason: null,
          meetingNo: null,
          topic: null,
          tracked: false,
        })
      }
  }
  return result.sort((a, b) => a.startAt.localeCompare(b.startAt))
}
export const isRoutine = (s: Meeting) => s.id.startsWith('slot:')
export const meetingLink = (s: Meeting) =>
  isRoutine(s) ? '/matkul/' + s.courseId : '/pertemuan/' + s.id
export function weeklyTasks(w: Workspace, start: string) {
  const end = addDays(start, 6)
  return w.tasks
    .filter((t) => t.status === 'todo' && day(t.dueAt) >= start && day(t.dueAt) <= end)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
}
