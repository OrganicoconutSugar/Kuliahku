import { agenda, isRoutine } from '../../../shared/agenda'
import { useEffect, useRef, useState } from 'react'
import { Camera, Save, Paperclip, X } from 'lucide-react'
import {
  addDays,
  day,
  time,
  sessionLabel,
  formatDay,
  type Note,
  type Task,
} from '../../../shared/model'
import { useApp, type CaptureContext } from '../app/context'
import { api, attachImage, compress, refresh } from '../lib/api'
import { Alert, Button, Field, Modal, Tabs, useSubmit } from '../components/ui'
function ContextFields({
  courseId,
  sessionId,
  change,
}: {
  courseId: string
  sessionId: string
  change: (c: string, s: string) => void
}) {
  const { w } = useApp()
  return (
    <div className="form-grid">
      <Field label="Mata kuliah">
        <select value={courseId} required onChange={(e) => change(e.target.value, '')}>
          {w.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Pertemuan">
        <select value={sessionId} onChange={(e) => change(courseId, e.target.value)}>
          <option value="">Umum mata kuliah</option>
          {w.sessions
            .filter((s) => s.courseId === courseId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {sessionLabel(s)} · {formatDay(s.date)}
              </option>
            ))}
        </select>
      </Field>
    </div>
  )
}
function readDraft<T>(key: string): Partial<T> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}')
  } catch {
    return {}
  }
}
export function Capture({ initial, onClose }: { initial: CaptureContext; onClose: () => void }) {
  const { w, user, toast, celebrate, now } = useApp(),
    save = useSubmit(),
    key = 'kuliahku:capture:' + user.id + ':' + w.semester?.id
  const suggested =
    agenda(w, day(now), day(now)).find(
      (s) => s.status === 'normal' && Date.parse(s.startAt) <= +now && Date.parse(s.endAt) > +now,
    ) ??
    w.sessions
      .filter((s) => s.tracked && s.status === 'normal' && Date.parse(s.startAt) <= +now)
      .at(-1)
  const [draft, set] = useState(() => {
    const base = {
      tab: initial.tab ?? 'Catatan',
      text: '',
      title: '',
      dueDate: addDays(day(), 1),
      courseId: initial.courseId ?? suggested?.courseId ?? w.courses[0]?.id ?? '',
      sessionId:
        initial.sessionId ??
        (initial.courseId ? '' : suggested && !isRoutine(suggested) ? suggested.id : ''),
    }
    const d = readDraft<typeof base>(key)
    const merged = {
      ...base,
      ...d,
      ...(initial.courseId
        ? { courseId: initial.courseId, sessionId: initial.sessionId ?? '' }
        : {}),
      ...(initial.tab ? { tab: initial.tab } : {}),
    }
    const validCourse = w.courses.some((c) => c.id === merged.courseId)
      ? merged.courseId
      : base.courseId
    const validSession =
      merged.sessionId &&
      w.sessions.some((s) => s.id === merged.sessionId && s.courseId === validCourse)
        ? merged.sessionId
        : validCourse === base.courseId
          ? base.sessionId
          : ''
    return { ...merged, courseId: validCourse, sessionId: validSession }
  })
  const [files, setFiles] = useState<File[]>([]),
    input = useRef<HTMLTextAreaElement>(null),
    titleInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    try {
      if (draft.text || draft.title) localStorage.setItem(key, JSON.stringify(draft))
      else localStorage.removeItem(key)
    } catch {
      /* Ignore storage quota errors so quick capture keeps working. */
    }
  }, [key, draft])
  useEffect(() => {
    if (draft.tab === 'Catatan') input.current?.focus()
    if (draft.tab === 'PR') titleInput.current?.focus()
  }, [draft.tab])
  const submit = async () => {
    if (!w.courses.some((c) => c.id === draft.courseId))
      throw new Error('Pilih mata kuliah terlebih dahulu.')
    const context = { courseId: draft.courseId, sessionId: draft.sessionId || null }
    if (draft.tab === 'PR') {
      await api('/tasks', 'POST', { ...context, title: draft.title, dueDate: draft.dueDate })
    } else if (draft.tab === 'Foto') {
      if (!files.length) throw new Error('Pilih gambar terlebih dahulu.')
      const prepared = await Promise.all(files.map(async (f) => ({ original: f, ready: await compress(f) })))
      const note = await api<Note>('/notes/quick', 'POST', {
        ...context,
        text: '',
        photo: true,
      })
      for (const { original, ready } of prepared) {
        await attachImage(ready, note, true)
        setFiles((old) => old.filter((f) => f !== original))
      }
    } else {
      await api<Note>('/notes/quick', 'POST', {
        ...context,
        text: draft.text,
        photo: false,
      })
    }
    const remaining =
      draft.tab === 'PR'
        ? { ...draft, title: '' }
        : draft.tab === 'Catatan'
          ? { ...draft, text: '' }
          : draft
    try {
      if (remaining.text || remaining.title) localStorage.setItem(key, JSON.stringify(remaining))
      else localStorage.removeItem(key)
    } catch {
      /* Ignore storage errors. */
    }
    await refresh()
    celebrate()
    toast(
      draft.tab === 'PR'
        ? 'PR tersimpan.'
        : draft.tab === 'Foto'
          ? 'Foto masuk ke catatanmu.'
          : 'Catatan cepat tersimpan.',
    )
    onClose()
  }
  return (
    <Modal
      title="Quick Capture"
      onClose={() => {
        if (!save.busy) onClose()
      }}
    >
      <p className="modal-sub">Tangkap ide sebelum lupa.</p>
      <Tabs
        items={['Catatan', 'PR', 'Foto']}
        value={draft.tab}
        onChange={(tab) => set({ ...draft, tab })}
      />
      <form
        className="form-stack"
        onSubmit={(e) => save.run(submit, e)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            void save.run(submit)
          }
        }}
      >
        {draft.tab === 'Catatan' ? (
          <Field label="Catatan cepat">
            <textarea
              ref={input}
              rows={5}
              required
              placeholder="Apa yang kamu pelajari?"
              value={draft.text}
              onChange={(e) => set({ ...draft, text: e.target.value })}
            />
          </Field>
        ) : draft.tab === 'PR' ? (
          <>
            <Field label="Judul PR">
              <input
                ref={titleInput}
                required
                placeholder="Mis. Buat class diagram"
                value={draft.title}
                onChange={(e) => set({ ...draft, title: e.target.value })}
              />
            </Field>
            <fieldset>
              <legend>Deadline</legend>
              <div className="actions">
                {[
                  ['Besok', 1],
                  ['Lusa', 2],
                  ['Minggu depan', 7],
                ].map(([text, n]) => (
                  <Button
                    key={text}
                    color={draft.dueDate === addDays(day(), Number(n)) ? 'sunny' : 'paper'}
                    onClick={() => set({ ...draft, dueDate: addDays(day(), Number(n)) })}
                  >
                    {text}
                  </Button>
                ))}
              </div>
            </fieldset>
            <Field label="Pilih tanggal">
              <input
                type="date"
                required
                value={draft.dueDate}
                onChange={(e) => set({ ...draft, dueDate: e.target.value })}
              />
            </Field>
          </>
        ) : (
          <>
            <label className="file-box">
              <Camera /> Ambil foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  setFiles((old) => [...old, ...Array.from(e.target.files ?? [])])
                  e.target.value = ''
                }}
              />
            </label>
            <label className="file-box">
              <Paperclip size={18} /> Pilih dari galeri
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  setFiles((old) => [...old, ...Array.from(e.target.files ?? [])])
                  e.target.value = ''
                }}
              />
            </label>
            {files.length ? (
              <div className="list">
                {files.map((f, i) => (
                  <div className="list-item" key={f.name + '-' + i}>
                    <small className="grow">{f.name}</small>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={'Hapus ' + f.name}
                      onClick={() => setFiles((old) => old.filter((_, j) => j !== i))}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <small>Belum ada foto dipilih.</small>
            )}
          </>
        )}
        <ContextFields
          courseId={draft.courseId}
          sessionId={draft.sessionId}
          change={(courseId, sessionId) => set({ ...draft, courseId, sessionId })}
        />
        {save.error && <Alert>{save.error}</Alert>}
        <Button type="submit" color="sunny" disabled={save.busy}>
          <Save size={17} />
          {save.busy
            ? 'Menyimpan…'
            : draft.tab === 'PR'
              ? 'Simpan PR'
              : draft.tab === 'Foto'
                ? 'Simpan foto'
                : 'Simpan catatan'}
        </Button>
      </form>
    </Modal>
  )
}
export function TaskForm({
  initial = {},
  existing: t,
  onClose,
}: {
  initial?: CaptureContext
  existing?: Task
  onClose: () => void
}) {
  const { w, toast } = useApp(),
    save = useSubmit(),
    [form, set] = useState({
      courseId: t?.courseId ?? initial.courseId ?? w.courses[0]?.id ?? '',
      sessionId: t?.sessionId ?? initial.sessionId ?? '',
      title: t?.title ?? '',
      description: t?.description ?? '',
      dueDate: t ? day(t.dueAt) : addDays(day(), 1),
      dueTime: t?.dueHasTime ? time(t.dueAt) : '',
      priority: t?.priority ?? 'normal',
    })
  return (
    <Modal title={t ? 'Ubah PR' : 'Tambah PR'} onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={(e) =>
          save.run(async () => {
            await api(t ? '/tasks/' + t.id : '/tasks', t ? 'PATCH' : 'POST', {
              ...form,
              sessionId: form.sessionId || null,
            })
            await refresh()
            toast('PR tersimpan.')
            onClose()
          }, e)
        }
      >
        <Field label="Judul PR">
          <input
            value={form.title}
            autoFocus
            required
            onChange={(e) => set({ ...form, title: e.target.value })}
          />
        </Field>
        <ContextFields
          courseId={form.courseId}
          sessionId={form.sessionId}
          change={(courseId, sessionId) => set({ ...form, courseId, sessionId })}
        />
        <Field label="Deskripsi">
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => set({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="form-grid">
          <Field label="Tanggal deadline">
            <input
              type="date"
              required
              value={form.dueDate}
              onChange={(e) => set({ ...form, dueDate: e.target.value })}
            />
          </Field>
          <Field label="Jam (opsional)">
            <input
              type="time"
              value={form.dueTime}
              onChange={(e) => set({ ...form, dueTime: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Prioritas">
          <select
            value={form.priority}
            onChange={(e) => set({ ...form, priority: e.target.value })}
          >
            {['rendah', 'normal', 'tinggi'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        {save.error && <Alert>{save.error}</Alert>}
        <Button type="submit" color="sunny" disabled={save.busy}>
          Simpan PR
        </Button>
      </form>
    </Modal>
  )
}
