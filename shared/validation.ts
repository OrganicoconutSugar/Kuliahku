import { z } from 'zod'
import { colors } from './model'
export const label = z.string().trim().min(1, 'Bagian ini wajib diisi.').max(240)
export const dateInput = z
  .string()
  .regex(/^\d{4}-\d\d-\d\d$/)
  .refine((d) => {
    const t = new Date(d + 'T12:00:00Z')
    return Number.isFinite(+t) && t.toISOString().slice(0, 10) === d
  }, 'Tanggal tidak valid.')
export const clockInput = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Jam tidak valid.')
export const slotInput = z
  .object({
    id: z.string().optional(),
    dayOfWeek: z.number().int().min(1).max(7),
    startTime: clockInput,
    endTime: clockInput,
    room: label,
  })
  .refine((x) => x.endTime > x.startTime, 'Jam selesai harus sesudah jam mulai.')
export const courseInput = z.object({
  code: label.max(20),
  name: label,
  sks: z.number().int().min(1).max(24),
  lecturerName: z.string().max(160).default(''),
  lecturerPhone: z
    .string()
    .regex(/^[+\d ()-]{0,35}$/, 'Kontak dosen tidak valid.')
    .default(''),
  color: z.enum(colors),
  schedules: z.array(slotInput).max(20).default([]),
})
export type CourseInput = z.infer<typeof courseInput>
export const semesterFields = z.object({
  name: label,
  startDate: dateInput,
  endDate: dateInput,
  trackingStart: dateInput,
  totalMeetings: z.number().int().min(1).max(100),
})
export const validSemester = (x: z.infer<typeof semesterFields>) =>
  x.startDate <= x.endDate && Date.parse(x.endDate) - Date.parse(x.startDate) <= 3 * 366 * 86400000
export const setupInput = z.object({
  name: label.max(80),
  email: z.string().trim().email('Periksa alamat email kamu.').toLowerCase(),
  password: z
    .string()
    .min(8, 'Gunakan minimal 8 karakter.')
    .max(72)
    .refine(
      (v) => new TextEncoder().encode(v).length <= 72,
      'Gunakan maksimal 72 byte untuk kata sandi.',
    ),
})
export const loginInput = setupInput
  .omit({ name: true })
  .extend({ password: z.string().min(1).max(72) })
export const noteFields = z.object({
  title: z.string().trim().max(240),
  body: z.string().max(500000),
  tags: z.array(z.string().trim().min(1).max(40)).max(30),
})
export const contextInput = z.object({ courseId: label, sessionId: label.nullish() })
export const taskFields = z.object({
  title: label,
  description: z.string().max(10000).default(''),
  dueDate: dateInput,
  dueTime: z.union([clockInput, z.literal('')]).optional(),
  priority: z.enum(['rendah', 'normal', 'tinggi']).default('normal'),
})
export const settingsInput = z
  .object({
    classReminderMin: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(60)]),
    briefEnabled: z.boolean(),
    briefTime: clockInput,
    taskRemindersOn: z.boolean(),
    d3Enabled: z.boolean(),
    d1Enabled: z.boolean(),
    d0Enabled: z.boolean(),
    lateEnabled: z.boolean(),
    d3Time: clockInput,
    d1Time: clockInput,
    d0Time: clockInput,
    lateTime: clockInput,
    nudgeEnabled: z.boolean(),
    nudgeDelay: z.number().int().min(0).max(180),
    recapEnabled: z.boolean(),
    recapDow: z.number().int().min(1).max(7),
    recapTime: clockInput,
    animationLevel: z.enum(['auto', 'full', 'reduced', 'off']),
    mascotEnabled: z.boolean(),
    mascotName: label.max(30),
    noteSize: z.number().int().min(14).max(24),
  })
  .partial()
