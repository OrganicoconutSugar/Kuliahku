import {
  emptyWork,
  instant,
  type Workspace,
  type Meeting,
  type Note,
  type Task,
  type Settings,
  type Course,
} from '../shared/model'
export const course: Course = {
  id: 'aps',
  semesterId: 'sem',
  code: 'IF301',
  name: 'Analisis, Sistem; dan Aplikasi',
  sks: 4,
  lecturerName: 'Dosen',
  lecturerPhone: '',
  color: 'violet',
  schedules: [
    {
      id: 'senin',
      courseId: 'aps',
      active: true,
      startTime: '08:00',
      endTime: '11:20',
      room: 'R.4.6',
      dayOfWeek: 1,
    },
  ],
}
export const at = (date: string, clock = '08:00') => instant(date, clock).toISOString()
export function meeting(date: string, id = date, overrides: Partial<Meeting> = {}): Meeting {
  return {
    id,
    courseId: 'aps',
    scheduleId: 'senin',
    date,
    startAt: at(date),
    endAt: at(date, '11:20'),
    room: 'R.4.6',
    status: 'normal',
    reason: null,
    meetingNo: 1,
    topic: null,
    tracked: true,
    ...overrides,
  }
}
export function note(s: Meeting, when = s.startAt, overrides: Partial<Note> = {}): Note {
  return {
    id: 'n-' + s.id,
    userId: 'owner',
    courseId: s.courseId,
    sessionId: s.id,
    title: 'Pembelajaran',
    body: 'Catatan valid yang cukup panjang.',
    tagsJson: '[]',
    quickKey: null,
    isValid: true,
    qualifiedAt: when,
    createdAt: when,
    updatedAt: when,
    ...overrides,
  }
}
export function task(id: string, date: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    userId: 'owner',
    courseId: 'aps',
    sessionId: null,
    title: 'PR ' + id,
    description: null,
    dueAt: at(date, '23:59'),
    dueHasTime: false,
    priority: 'normal',
    status: 'todo',
    completedAt: null,
    createdAt: at('2026-08-01'),
    ...overrides,
  }
}
export function work(sessions: Meeting[] = [], notes: Note[] = [], tasks: Task[] = []): Workspace {
  return {
    ...emptyWork,
    courses: [course],
    semester: {
      id: 'sem',
      userId: 'owner',
      name: 'Semester uji',
      startDate: '2026-08-31',
      endDate: '2026-12-31',
      totalMeetings: 16,
      trackingStart: '2026-09-07',
      isActive: true,
    },
    sessions,
    notes,
    tasks,
  }
}
export const prefs: Settings = {
  userId: 'owner',
  classReminderMin: 30,
  briefEnabled: true,
  briefTime: '20:00',
  taskRemindersOn: true,
  d3Enabled: true,
  d1Enabled: true,
  d0Enabled: true,
  lateEnabled: true,
  d3Time: '09:00',
  d1Time: '18:00',
  d0Time: '07:00',
  lateTime: '08:00',
  nudgeEnabled: true,
  nudgeDelay: 15,
  recapEnabled: true,
  recapDow: 6,
  recapTime: '09:00',
  animationLevel: 'auto',
  mascotEnabled: true,
  mascotName: 'Mochi',
  noteSize: 16,
}
