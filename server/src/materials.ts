import { Router } from 'express'
import multer from 'multer'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import AdmZip from 'adm-zip'
import { z } from 'zod'
import {
  db,
  transaction,
  ownContext,
  Problem,
  missing,
  uploadDir,
  discardFiles,
  type Tx,
} from './core'
import { validBody } from './insights'
import { instant, time, addDays, day } from '../../shared/model'
import { contextInput, noteFields, taskFields, label } from '../../shared/validation'
export const maxBytes =
  Math.min(20, Math.max(1, Number(process.env.MAX_UPLOAD_MB) || 20)) * 1024 * 1024
export function identify(bytes: Buffer, limit = maxBytes): string {
  if (!bytes.length || bytes.length > limit)
    throw new Problem(413, 'File kosong atau melebihi batas ukuran.')
  if (bytes.subarray(0, 5).toString() === '%PDF-') return 'application/pdf'
  if (bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png'
  if (bytes.subarray(0, 3).toString('hex') === 'ffd8ff') return 'image/jpeg'
  if (['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString())) return 'image/gif'
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp'
  if (bytes.subarray(0, 4).toString('hex') === '504b0304') {
    try {
      const zip = new AdmZip(bytes),
        types = zip.getEntry('[Content_Types].xml')
      if (types && types.header.size <= 512000) {
        const xml = types.getData().toString('utf8')
        for (const [part, kind] of [
          ['word/document.xml', 'wordprocessingml.document'],
          ['ppt/presentation.xml', 'presentationml.presentation'],
          ['xl/workbook.xml', 'spreadsheetml.sheet'],
        ]) {
          if (
            zip.getEntry(part) &&
            xml.includes('application/vnd.openxmlformats-officedocument.' + kind + '.main+xml')
          )
            return 'application/vnd.openxmlformats-officedocument.' + kind
        }
      }
    } catch {
      /* An invalid ZIP is never served. */
    }
  }
  throw new Problem(
    415,
    'Jenis file tidak didukung. Pilih PDF, DOCX, PPTX, XLSX, JPG, PNG, GIF, atau WebP.',
  )
}
export async function revalidate(tx: Tx, id: string) {
  const n = await tx.note.findUniqueOrThrow({
    where: { id },
    include: {
      session: true,
      _count: { select: { attachments: { where: { kind: 'note_image' } } } },
    },
  })
  const content = n.quickKey ? n.body.replace(/^\*\*\d{2}:\d{2} WIB\*\*\n/gm, '') : n.body
  const isValid = validBody(content, n._count.attachments),
    now = new Date()
  const inWindow = (d: Date) =>
    !n.session || (d >= n.session.startAt && d < instant(addDays(n.session.date, 3), '00:00'))
  const qualifiedAt = isValid
    ? n.qualifiedAt && inWindow(n.qualifiedAt)
      ? n.qualifiedAt
      : now
    : null
  return tx.note.update({ where: { id }, data: { isValid, qualifiedAt, updatedAt: now } })
}
export const materials = Router()
materials.post('/notes/quick', async (req, res) => {
  const v = contextInput
    .extend({ text: z.string().trim().max(500000), photo: z.boolean().optional() })
    .parse(req.body)
  if (!v.text && !v.photo) throw new Problem(400, 'Tulis sesuatu dulu.')
  const note = await transaction(async (tx) => {
    const { s } = await ownContext(tx, res.locals.user.id, v.courseId, v.sessionId)
    const key = v.sessionId ?? 'course:' + v.courseId
    const old = await tx.note.findUnique({ where: { quickKey: key } })
    const block = v.text ? '**' + time(new Date()) + ' WIB**\n' + v.text : ''
    const body = [old?.body, block].filter(Boolean).join('\n\n')
    const note = await tx.note.upsert({
      where: { quickKey: key },
      create: {
        userId: res.locals.user.id,
        courseId: v.courseId,
        sessionId: s?.id,
        quickKey: key,
        title: 'Catatan cepat' + (s?.meetingNo ? ' P' + s.meetingNo : ''),
        body,
      },
      update: { body },
    })
    return revalidate(tx, note.id)
  })
  res.status(201).json(note)
})
materials.post('/notes', async (req, res) => {
  const v = contextInput.merge(noteFields.partial()).parse(req.body)
  const n = await transaction(async (tx) => {
    const { c, s } = await ownContext(tx, res.locals.user.id, v.courseId, v.sessionId)
    const n = await tx.note.create({
      data: {
        userId: res.locals.user.id,
        courseId: c.id,
        sessionId: s?.id ?? null,
        title: v.title || 'Catatan ' + c.code + (s?.meetingNo ? ' P' + s.meetingNo : ''),
        body: v.body ?? '',
        tagsJson: JSON.stringify(v.tags ?? []),
      },
    })
    return revalidate(tx, n.id)
  })
  res.status(201).json(n)
})
materials.get('/notes/:id', async (req, res) => {
  const n = await db.note.findFirst({
    where: { id: String(req.params.id), userId: res.locals.user.id },
  })
  if (!n) throw missing()
  res.json(n)
})
materials.patch('/notes/:id', async (req, res) => {
  const update = noteFields
    .partial()
    .extend({ expectedUpdatedAt: z.string().datetime().optional() })
    .parse(req.body)
  res.json(
    await transaction(async (tx) => {
      const n = await tx.note.findFirst({
        where: { id: String(req.params.id), userId: res.locals.user.id },
        include: { course: true, session: true },
      })
      if (!n) throw missing()
      const { tags, title, body } = update
      if (update.expectedUpdatedAt && n.updatedAt.toISOString() !== update.expectedUpdatedAt) {
        if (
          (title === undefined || n.title === title) &&
          (body === undefined || n.body === body) &&
          (tags === undefined || JSON.stringify(tags) === n.tagsJson)
        )
          return n
        throw new Problem(
          409,
          'Catatan ini berubah dari tab lain. Pilih versi yang ingin kamu simpan.',
          'NOTE_CONFLICT',
        )
      }
      await tx.note.update({
        where: { id: n.id },
        data: {
          body,
          title:
            title === undefined
              ? undefined
              : title ||
                'Catatan ' +
                  n.course.code +
                  (n.session?.meetingNo ? ' P' + n.session.meetingNo : ''),
          tagsJson: tags ? JSON.stringify(tags) : undefined,
        },
      })
      return revalidate(tx, n.id)
    }),
  )
})
materials.delete('/notes/:id', async (req, res) => {
  const keys = await transaction(async (tx) => {
    const note = await tx.note.findFirst({
      where: { id: String(req.params.id), userId: res.locals.user.id },
      include: { attachments: true },
    })
    if (!note) throw missing()
    await tx.note.delete({ where: { id: note.id } })
    return note.attachments.map((a) => a.storageKey)
  })
  await discardFiles(keys)
  res.json({ ok: true })
})
const multipart = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: 1, fields: 10, fieldSize: 16000 },
}).single('file')
materials.post('/attachments', multipart, async (req, res) => {
  const v = contextInput
    .extend({
      noteId: label.optional(),
      kind: z.enum(['module', 'note_image']).default('module'),
      title: label,
      description: z.string().max(5000).default(''),
      url: z
        .string()
        .url()
        .refine((u) => /^https?:\/\//i.test(u), 'Tautan harus memakai HTTP atau HTTPS.')
        .optional(),
    })
    .parse(req.body)
  if (Boolean(req.file) === Boolean(v.url))
    throw new Problem(400, 'Pilih satu file atau satu tautan.')
  const mime = req.file ? identify(req.file.buffer) : null
  if (
    (v.kind === 'note_image' && (!mime?.startsWith('image/') || !v.noteId)) ||
    (v.kind === 'module' && v.noteId)
  )
    throw new Problem(400, 'Lampiran catatan harus berupa gambar dengan catatan tujuan.')
  const storageKey = req.file ? randomUUID() : null
  if (req.file && storageKey) {
    await mkdir(uploadDir, { recursive: true })
    await writeFile(resolve(uploadDir, storageKey), req.file.buffer, { mode: 0o600, flag: 'wx' })
  }
  try {
    const a = await transaction(async (tx) => {
      await ownContext(tx, res.locals.user.id, v.courseId, v.sessionId)
      if (
        v.noteId &&
        !(await tx.note.count({
          where: {
            id: v.noteId,
            userId: res.locals.user.id,
            courseId: v.courseId,
            sessionId: v.sessionId ?? null,
          },
        }))
      )
        throw missing()
      const a = await tx.attachment.create({
        data: {
          ...v,
          userId: res.locals.user.id,
          source: req.file ? 'upload' : 'link',
          fileName: req.file?.originalname,
          mimeType: mime,
          sizeBytes: req.file?.size,
          storageKey,
        },
      })
      if (a.noteId) {
        const n = await tx.note.findUniqueOrThrow({ where: { id: a.noteId } })
        await tx.note.update({
          where: { id: n.id },
          data: { body: [n.body, '![](/api/files/' + a.id + ')'].filter(Boolean).join('\n\n') },
        })
        await revalidate(tx, n.id)
      }
      return a
    })
    res.status(201).json(a)
  } catch (e) {
    await discardFiles([storageKey])
    throw e
  }
})
materials.get('/files/:id', async (req, res) => {
  const a = await db.attachment.findFirst({
    where: { id: String(req.params.id), userId: res.locals.user.id },
  })
  if (!a?.storageKey) throw missing()
  const inline = a.mimeType?.startsWith('image/') || a.mimeType === 'application/pdf'
  res
    .set(
      'Content-Disposition',
      (inline && req.query.download !== '1' ? 'inline' : 'attachment') +
        "; filename*=UTF-8''" +
        encodeURIComponent(a.fileName || 'file'),
    )
    .type(a.mimeType || 'application/octet-stream')
    .sendFile(resolve(uploadDir, a.storageKey))
})
materials.patch('/attachments/:id', async (req, res) =>
  res.json(
    await db.attachment.update({
      where: { id: String(req.params.id), userId: res.locals.user.id },
      data: z.object({ title: label }).parse(req.body),
    }),
  ),
)
materials.delete('/attachments/:id', async (req, res) => {
  const a = await transaction(async (tx) => {
    const a = await tx.attachment.delete({
      where: { id: String(req.params.id), userId: res.locals.user.id },
    })
    if (a.noteId) {
      const n = await tx.note.findUniqueOrThrow({ where: { id: a.noteId } })
      await tx.note.update({
        where: { id: n.id },
        data: { body: n.body.replaceAll('![](/api/files/' + a.id + ')', '') },
      })
      await revalidate(tx, n.id)
    }
    return a
  })
  await discardFiles([a.storageKey])
  res.json({ ok: true })
})
const taskWrite = contextInput.merge(taskFields)
materials.post('/tasks', async (req, res) => {
  const { dueDate, dueTime, ...v } = taskWrite.parse(req.body)
  await ownContext(db, res.locals.user.id, v.courseId, v.sessionId)
  res
    .status(201)
    .json(
      await db.task.create({
        data: {
          ...v,
          userId: res.locals.user.id,
          dueHasTime: !!dueTime,
          dueAt: instant(dueDate, dueTime || '23:59'),
        },
      }),
    )
})
materials.patch('/tasks/:id', async (req, res) => {
  const v = taskWrite.partial().parse(req.body),
    id = String(req.params.id)
  const t = await db.task.findFirst({ where: { id, userId: res.locals.user.id } })
  if (!t) throw missing()
  const { dueDate, dueTime, ...fields } = v
  await ownContext(
    db,
    res.locals.user.id,
    v.courseId ?? t.courseId,
    v.sessionId === undefined ? t.sessionId : v.sessionId,
  )
  const changed = dueDate !== undefined || dueTime !== undefined
  res.json(
    await db.task.update({
      where: { id },
      data: {
        ...fields,
        dueHasTime: dueTime === undefined ? undefined : !!dueTime,
        dueAt: changed
          ? instant(
              dueDate ?? day(t.dueAt),
              dueTime === undefined ? time(t.dueAt) : dueTime || '23:59',
            )
          : undefined,
      },
    }),
  )
})
materials.post('/tasks/:id/:action', async (req, res) => {
  const done = req.params.action === 'complete'
  if (!done && req.params.action !== 'reopen') throw missing()
  await db.task.updateMany({
    where: {
      id: String(req.params.id),
      userId: res.locals.user.id,
      status: done ? 'todo' : 'done',
    },
    data: { status: done ? 'done' : 'todo', completedAt: done ? new Date() : null },
  })
  res.json(
    await db.task.findFirstOrThrow({
      where: { id: String(req.params.id), userId: res.locals.user.id },
    }),
  )
})
materials.delete('/tasks/:id', async (req, res) => {
  await db.task.delete({ where: { id: String(req.params.id), userId: res.locals.user.id } })
  res.json({ ok: true })
})
