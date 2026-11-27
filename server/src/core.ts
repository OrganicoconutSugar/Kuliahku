import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'
import { resolve } from 'node:path'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import pino from 'pino'
import type { Workspace } from '../../shared/model'
export const db = new PrismaClient()
export type Tx = Prisma.TransactionClient
export const transaction = <T>(run: (tx: Tx) => Promise<T>) =>
  db.$transaction(run, { timeout: 30000, maxWait: 15000 })
export const log = pino({ level: process.env.LOG_LEVEL || 'info' })
export class Problem extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'INVALID_REQUEST',
  ) {
    super(message)
  }
}
export const fail = (message: string, status = 400): never => {
  throw new Problem(status, message)
}
export const missing = () => new Problem(404, 'Data ini tidak ditemukan.', 'NOT_FOUND')
export const uploadDir = resolve(process.env.UPLOAD_DIR || 'data/uploads')
const storageUrl = () => process.env.CLOUDVEA_STORAGE_URL?.replace(/\/+$/, '') || ''
const storageToken = () => process.env.CLOUDVEA_STORAGE_TOKEN || ''
export const hasObjectStorage = () => Boolean(storageUrl() && storageToken())
export async function storeFile(key: string, data: Buffer, mimeType: string) {
  if (hasObjectStorage()) {
    const res = await fetch(`${storageUrl()}/o/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${storageToken()}`,
        'Content-Type': mimeType || 'application/octet-stream',
      },
      body: new Uint8Array(data),
    })
    if (!res.ok) {
      log.error({ status: res.status, key }, 'Gagal menyimpan file ke object storage')
      throw new Problem(502, 'Gagal menyimpan file unggahan. Coba lagi sebentar.', 'STORAGE_ERROR')
    }
    return
  }
  await mkdir(uploadDir, { recursive: true })
  await writeFile(resolve(uploadDir, key), data, { mode: 0o600, flag: 'wx' })
}
export async function fetchStoredFile(key: string): Promise<Buffer> {
  const res = await fetch(`${storageUrl()}/o/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${storageToken()}` },
  })
  if (res.status === 404) throw missing()
  if (!res.ok) {
    log.error({ status: res.status, key }, 'Gagal membaca file dari object storage')
    throw new Problem(502, 'Gagal membaca file unggahan. Coba lagi sebentar.', 'STORAGE_ERROR')
  }
  return Buffer.from(await res.arrayBuffer())
}
export async function discardFiles(keys: (string | null)[]) {
  await Promise.all(
    keys
      .filter((k): k is string => Boolean(k))
      .map(async (k) => {
        if (hasObjectStorage()) {
          try {
            const res = await fetch(`${storageUrl()}/o/${encodeURIComponent(k)}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${storageToken()}` },
            })
            if (!res.ok && res.status !== 404)
              log.error({ status: res.status, key: k }, 'Gagal membersihkan file di object storage')
          } catch (e) {
            log.error({ err: e, key: k }, 'Gagal membersihkan file di object storage')
          }
          return
        }
        try {
          await unlink(resolve(uploadDir, k))
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
            log.error({ err: e }, 'Gagal membersihkan file')
        }
      }),
  )
}
export async function workspace(userId: string, semesterId?: string): Promise<Workspace> {
  const semesters = await db.semester.findMany({
    where: { userId },
    orderBy: { startDate: 'desc' },
  })
  const semester = semesterId
    ? semesters.find((s) => s.id === semesterId)
    : semesters.find((s) => s.isActive)
  if (semesterId && !semester) throw missing()
  const course = { semesterId: semester?.id ?? '__none__' }
  const [courses, sessions, notes, tasks, attachments] = await Promise.all([
    db.course.findMany({
      where: course,
      include: {
        schedules: {
          where: { active: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
      orderBy: { code: 'asc' },
    }),
    db.session.findMany({ where: { course }, orderBy: [{ startAt: 'asc' }, { id: 'asc' }] }),
    db.note.findMany({ where: { userId, course }, orderBy: { updatedAt: 'desc' } }),
    db.task.findMany({ where: { userId, course }, orderBy: { dueAt: 'asc' } }),
    db.attachment.findMany({ where: { userId, course }, orderBy: { createdAt: 'desc' } }),
  ])
  return JSON.parse(
    JSON.stringify({
      semesters,
      semester: semester ?? null,
      courses,
      sessions,
      notes,
      tasks,
      attachments,
    }),
  )
}
export async function ownCourse(tx: Tx, userId: string, id: string) {
  const c = await tx.course.findFirst({
    where: { id, semester: { userId } },
    include: { semester: true },
  })
  if (!c) throw missing()
  return c
}
export async function ownContext(
  tx: Tx,
  userId: string,
  courseId: string,
  sessionId?: string | null,
) {
  const c = await ownCourse(tx, userId, courseId)
  const s = sessionId ? await tx.session.findFirst({ where: { id: sessionId, courseId } }) : null
  if (sessionId && !s) throw missing()
  return { c, s }
}
