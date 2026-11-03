import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import type * as DB from '@prisma/client'

type JsonDates<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K]
}
export type Course = JsonDates<DB.Course> & { schedules: Slot[] }
export type Slot = JsonDates<DB.ClassSchedule>
export type Meeting = JsonDates<DB.Session>
export type Note = JsonDates<DB.Note>
export type Task = JsonDates<DB.Task>
export type Attachment = JsonDates<DB.Attachment>
export type Semester = JsonDates<DB.Semester>
export type Settings = JsonDates<DB.Settings>
export type Notice = JsonDates<DB.NotificationLog>
export type Owner = { id: string; name: string; email: string }
export type Workspace = {
  semester: Semester | null
  semesters: Semester[]
  courses: Course[]
  sessions: Meeting[]
  notes: Note[]
  tasks: Task[]
  attachments: Attachment[]
}
export const colors = ['violet', 'sky', 'coral', 'tangerine', 'teal', 'sunny'] as const
export const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
export const zone = 'Asia/Jakarta'
const wib = new Intl.DateTimeFormat('sv-SE', {
  timeZone: zone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
export const stamp = (date: Date | string | number = new Date()) => wib.format(new Date(date))
export const day = (date: Date | string | number = new Date()) => stamp(date).slice(0, 10)
export const time = (date: Date | string | number) => stamp(date).slice(-5)
export const instant = (date: string, clock: string) =>
  fromZonedTime(date + 'T' + clock + ':00', zone)
export const addDays = (date: string, n: number) =>
  new Date(Date.parse(date + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10)
export const weekday = (date: string) => new Date(date + 'T12:00:00Z').getUTCDay() || 7
export const monday = (date: string) => addDays(date, 1 - weekday(date))
export const isoWeek = (date: string) =>
  formatInTimeZone(instant(date, '12:00'), zone, "RRRR-'W'II")
export const formatDay = (date: string, long = false) =>
  new Intl.DateTimeFormat('id-ID', {
    timeZone: zone,
    day: 'numeric',
    month: long ? 'long' : 'short',
    ...(long ? { weekday: 'long' as const, year: 'numeric' as const } : {}),
  }).format(instant(date, '12:00'))
export const sessionLabel = (s: Meeting) =>
  s.status === 'libur' ? 'Libur' : s.meetingNo === null ? 'Jadwal kelas' : 'P' + s.meetingNo
export function classStatus(s: Pick<Meeting, 'status' | 'startAt' | 'endAt'>, now = new Date()) {
  if (s.status === 'libur') return 'Libur'
  if (now.getTime() < Date.parse(s.startAt)) return 'Akan datang'
  return now.getTime() < Date.parse(s.endAt) ? 'Sedang berlangsung' : 'Selesai'
}
export function taskGroup(t: Task, now = new Date()) {
  const today = day(now),
    due = day(t.dueAt)
  if (Date.parse(t.dueAt) < +now) return 'Terlambat'
  if (due === today) return 'Hari ini'
  if (due === addDays(today, 1)) return 'Besok'
  return due <= addDays(monday(today), 6) ? 'Minggu ini' : 'Nanti'
}
export const phoneInternational = (value: string) => value.replace(/\D/g, '').replace(/^0/, '62')
export const emptyWork: Workspace = {
  semester: null,
  semesters: [],
  courses: [],
  sessions: [],
  notes: [],
  tasks: [],
  attachments: [],
}
