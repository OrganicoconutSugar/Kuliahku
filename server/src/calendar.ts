import { agenda } from '../../shared/agenda'
import { addDays, day, instant, time, weekday, type Workspace } from '../../shared/model'
const esc = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
const compact = (d: string) => d.replaceAll('-', '')
const local = (d: string, t: string) => compact(d) + 'T' + t.replace(':', '') + '00'
const utc = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
export function fold(line: string) {
  const lines = ['']
  let bytes = 0
  for (const char of line) {
    const size = Buffer.byteLength(char)
    if (bytes + size > 75) {
      lines.push(' ')
      bytes = 1
    }
    lines[lines.length - 1] += char
    bytes += size
  }
  return lines.join('\r\n')
}
export function calendar(
  w: Workspace,
  includeSchedule: boolean,
  includeTasks: boolean,
  alarm: number,
  now = new Date(),
) {
  if (w.semester && includeSchedule)
    w = { ...w, sessions: agenda(w, w.semester.startDate, w.semester.endDate) }
  const rows = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KuliahKu//Jadwal ID//ID',
    'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Jakarta',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0700',
    'TZOFFSETTO:+0700',
    'TZNAME:WIB',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
  const event = (uid: string, title: string, fields: string[]) =>
    rows.push(
      'BEGIN:VEVENT',
      'UID:' + uid + '@kuliahku',
      'DTSTAMP:' + utc(now),
      'SUMMARY:' + esc(title),
      ...fields,
      ...(alarm
        ? [
            'BEGIN:VALARM',
            'ACTION:DISPLAY',
            'DESCRIPTION:Pengingat KuliahKu',
            'TRIGGER:-PT' + alarm + 'M',
            'END:VALARM',
          ]
        : []),
      'END:VEVENT',
    )
  if (includeSchedule && w.semester)
    for (const c of w.courses) {
      const title = c.name + ' (' + c.code + ')'
      const individual = (s: Workspace['sessions'][number]) =>
        event('session-' + s.id, title, [
          'DTSTART;TZID=Asia/Jakarta:' + local(s.date, time(s.startAt)),
          'DTEND;TZID=Asia/Jakarta:' + local(s.date, time(s.endAt)),
          'LOCATION:' + esc(s.room),
          'DESCRIPTION:' + esc(c.lecturerName + ' · ' + c.lecturerPhone),
        ])
      for (const slot of c.schedules) {
        const meetings = w.sessions.filter((s) => s.scheduleId === slot.id)
        const matches = meetings.filter(
          (s) =>
            weekday(s.date) === slot.dayOfWeek &&
            time(s.startAt) === slot.startTime &&
            time(s.endAt) === slot.endTime &&
            s.room === slot.room,
        )
        const first = matches.find((s) => s.status === 'normal')
        if (first) {
          const exclusions = []
          for (let d = first.date; d <= w.semester.endDate; d = addDays(d, 7))
            if (!matches.some((s) => s.date === d && s.status === 'normal'))
              exclusions.push(local(d, slot.startTime))
          event('schedule-' + slot.id, title, [
            'DTSTART;TZID=Asia/Jakarta:' + local(first.date, slot.startTime),
            'DTEND;TZID=Asia/Jakarta:' + local(first.date, slot.endTime),
            'RRULE:FREQ=WEEKLY;UNTIL=' + utc(instant(w.semester.endDate, '23:59')),
            ...(exclusions.length ? ['EXDATE;TZID=Asia/Jakarta:' + exclusions.join(',')] : []),
            'LOCATION:' + esc(slot.room),
            'DESCRIPTION:' + esc(c.lecturerName + ' · ' + c.lecturerPhone),
          ])
        }
        meetings.filter((s) => s.status === 'normal' && !matches.includes(s)).forEach(individual)
      }
      w.sessions
        .filter(
          (s) =>
            s.courseId === c.id &&
            s.status === 'normal' &&
            !c.schedules.some((slot) => slot.id === s.scheduleId),
        )
        .forEach(individual)
    }
  if (includeTasks)
    for (const t of w.tasks.filter((t) => t.status === 'todo'))
      event(
        'task-' + t.id,
        'PR: ' + t.title + ' (' + w.courses.find((c) => c.id === t.courseId)?.code + ')',
        [
          t.dueHasTime
            ? 'DTSTART;TZID=Asia/Jakarta:' + local(day(t.dueAt), time(t.dueAt))
            : 'DTSTART;VALUE=DATE:' + compact(day(t.dueAt)),
        ],
      )
  return [...rows, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n'
}
