import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Bold,
  Italic,
  Heading,
  List,
  ListChecks,
  Quote,
  Code,
  Camera,
  ImagePlus,
  Maximize,
  Minimize,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  NotebookPen,
} from 'lucide-react'
import { day, formatDay, sessionLabel, type Note } from '../../../shared/model'
import { useApp } from '../app/context'
import { api, ApiError, attachImage, msg, refresh } from '../lib/api'
import {
  Alert,
  Badge,
  Button,
  Chip,
  Empty,
  Field,
  Header,
  Modal,
  Panel,
  Tabs,
  useSubmit,
  Loading,
} from '../components/ui'
const Markdown = lazy(() => import('./Markdown'))
export function NoteList({ notes }: { notes: Note[] }) {
  const { w } = useApp()
  return notes.length ? (
    <div className="notes-list">
      {notes.map((n) => {
        const s = w.sessions.find((s) => s.id === n.sessionId)
        return (
          <Link key={n.id} to={'/catatan/' + n.id} className="note-entry">
            <div className="row-meta">
              <Badge course={w.courses.find((c) => c.id === n.courseId)} />
              <small>
                {s ? sessionLabel(s) + ' · ' : ''}
                {formatDay(s?.date ?? day(n.updatedAt))}
              </small>
            </div>
            <strong>{n.title}</strong>
            <p>
              {n.body.replace(/!\[[^\]]*\]\([^)]+\)/g, '[Gambar]').slice(0, 220) ||
                'Catatan masih kosong.'}
            </p>
            <div>
              {JSON.parse(n.tagsJson).map((t: string) => (
                <small className="tag" key={t}>
                  #{t}
                </small>
              ))}
            </div>
            <ChevronRight className="note-arrow" size={17} />
          </Link>
        )
      })}
    </div>
  ) : (
    <Empty title="Belum ada catatan untuk pilihan ini." />
  )
}
export function Notes() {
  const { w } = useApp(),
    nav = useNavigate(),
    [course, setCourse] = useState(''),
    [tag, setTag] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [create, open] = useState(false),
    [ctx, setCtx] = useState({ courseId: w.courses[0]?.id ?? '', sessionId: '' }),
    save = useSubmit()
  const tags = [...new Set<string>(w.notes.flatMap((n) => JSON.parse(n.tagsJson)))]
  const notes = w.notes.filter((n) => {
    const d = w.sessions.find((s) => s.id === n.sessionId)?.date ?? day(n.createdAt)
    return (
      (!course || n.courseId === course) &&
      (!tag || JSON.parse(n.tagsJson).includes(tag)) &&
      (!from || d >= from) &&
      (!to || d <= to)
    )
  })
  return (
    <>
      <Header
        eyebrow="BUKU CATATAN"
        title="Catatan kuliah."
        sub="Buka kembali ide dan materi dari setiap pertemuan."
        action={
          <Button color="sunny" onClick={() => open(true)}>
            <Plus size={17} /> Tambah catatan
          </Button>
        }
      />
      <div className="filters">
        <Field label="Mata kuliah">
          <select value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">Semua MK</option>
            {w.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tag">
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Semua tag</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Dari tanggal">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Sampai tanggal">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <Panel title={'Semua catatan · ' + notes.length} icon={<NotebookPen size={19} />}>
        <NoteList notes={notes} />
      </Panel>
      {create && (
        <Modal title="Tambah catatan" onClose={() => open(false)}>
          <form
            className="form-stack"
            onSubmit={(e) =>
              save.run(async () => {
                const n = await api<Note>('/notes', 'POST', {
                  ...ctx,
                  sessionId: ctx.sessionId || null,
                })
                await refresh()
                nav('/catatan/' + n.id)
              }, e)
            }
          >
            <Field label="Mata kuliah">
              <select
                value={ctx.courseId}
                required
                onChange={(e) => setCtx({ courseId: e.target.value, sessionId: '' })}
              >
                {w.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pertemuan">
              <select
                value={ctx.sessionId}
                onChange={(e) => setCtx({ ...ctx, sessionId: e.target.value })}
              >
                <option value="">Umum mata kuliah</option>
                {w.sessions
                  .filter((s) => s.courseId === ctx.courseId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {sessionLabel(s)} · {formatDay(s.date)}
                    </option>
                  ))}
              </select>
            </Field>
            {save.error && <Alert>{save.error}</Alert>}
            <Button type="submit" color="sunny" disabled={save.busy}>
              Buka editor
            </Button>
          </form>
        </Modal>
      )}
    </>
  )
}
type Draft = { title: string; body: string; tagText: string; base?: string }
const fromNote = (n: Note): Draft => ({
  title: n.title,
  body: n.body,
  tagText: JSON.parse(n.tagsJson).join(', '),
  base: n.updatedAt,
})
export function Editor() {
  const { id } = useParams(),
    { w } = useApp(),
    n = w.notes.find((n) => n.id === id)
  return n ? <EditorBody key={n.id} n={n} /> : <Empty title="Catatan tidak ditemukan." />
}
function EditorBody({ n }: { n: Note }) {
  const { w, user, p, toast } = useApp(),
    nav = useNavigate(),
    key = 'kuliahku:draft:' + user.id + ':' + n.id
  const [draft, set] = useState<Draft>(() => {
    try {
      const d = JSON.parse(localStorage.getItem(key) ?? 'null')
      if (
        d &&
        typeof d.body === 'string' &&
        typeof d.title === 'string' &&
        typeof d.tagText === 'string'
      )
        return d
    } catch {
      /* Start from the saved note. */
    }
    return fromNote(n)
  })
  const [conflict, setConflict] = useState(false),
    [status, setStatus] = useState(localStorage.getItem(key) ? 'Draft dipulihkan' : 'Tersimpan'),
    [error, setError] = useState(''),
    [tab, setTab] = useState('Edit'),
    [focus, setFocus] = useState(false),
    [del, setDel] = useState(false),
    [uploading, setUploading] = useState(false)
  const version = useRef(draft.base ?? n.updatedAt),
    text = useRef<HTMLTextAreaElement>(null),
    current = useRef(draft),
    dirty = useRef(Boolean(localStorage.getItem(key))),
    timer = useRef<ReturnType<typeof setTimeout>>(),
    queue = useRef<Promise<void>>(Promise.resolve()),
    mounted = useRef(true),
    save = useSubmit()
  function update(d: Draft) {
    const next = { ...d, base: version.current }
    current.current = next
    dirty.current = true
    set(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* Ignore quota errors; persist() still falls back to current.current. */
    }
    setStatus('Menunggu simpan…')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void persist().catch(() => {})
    }, 1000)
  }
  function persist() {
    clearTimeout(timer.current)
    const job = async () => {
      const raw = localStorage.getItem(key)
      if (!raw && !dirty.current) return
      const d = raw ? (JSON.parse(raw) as Draft) : current.current
      if (mounted.current) setStatus('Menyimpan…')
      try {
        const saved = await api<Note>('/notes/' + n.id, 'PATCH', {
          expectedUpdatedAt: version.current,
          title: d.title,
          body: d.body,
          tags: [
            ...new Set(
              d.tagText
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean),
            ),
          ],
        })
        version.current = saved.updatedAt
        setConflict(false)
        if ((!raw && current.current === d) || (raw && localStorage.getItem(key) === raw)) {
          localStorage.removeItem(key)
          dirty.current = false
          if (mounted.current) setStatus('Tersimpan')
        } else {
          const latest = { ...current.current, base: saved.updatedAt }
          current.current = latest
          try {
            localStorage.setItem(key, JSON.stringify(latest))
          } catch {
            /* Ignore quota errors. */
          }
        }
        if (mounted.current) setError('')
        await refresh()
      } catch (e) {
        if (mounted.current) {
          setStatus('Draft lokal')
          setConflict(e instanceof ApiError && e.status === 409)
          setError(msg(e) + ' Draft ada di perangkat ini.')
        }
        throw e
      }
    }
    queue.current = queue.current.catch(() => {}).then(job)
    return queue.current
  }
  useEffect(() => {
    mounted.current = true
    if (localStorage.getItem(key))
      timer.current = setTimeout(() => {
        void persist().catch(() => {})
      }, 1000)
    const online = () => {
      void persist().catch(() => {})
    }
    window.addEventListener('online', online)
    return () => {
      mounted.current = false
      window.removeEventListener('online', online)
      clearTimeout(timer.current)
      if (localStorage.getItem(key)) void persist().catch(() => {})
    }
  }, [key])
  useEffect(() => {
    if (localStorage.getItem(key) || uploading) return
    const next = fromNote(n)
    version.current = n.updatedAt
    current.current = next
    set(next)
  }, [n.updatedAt, uploading])
  useEffect(() => {
    document.body.classList.toggle('focus-mode', focus)
    document.body.classList.add('editor-open')
    return () => document.body.classList.remove('focus-mode', 'editor-open')
  }, [focus])
  async function images(files: File[]) {
    if (!files.length || uploading) return
    setUploading(true)
    setError('')
    try {
      await persist()
      for (const f of files) await attachImage(f, n)
      const updated = await api<Note>('/notes/' + n.id)
      const d = fromNote(updated)
      version.current = updated.updatedAt
      current.current = d
      set(d)
      await refresh()
      setStatus('Tersimpan')
    } catch (e) {
      setError(msg(e))
      await refresh()
    } finally {
      setUploading(false)
    }
  }
  function wrap(before: string, after = '') {
    const area = text.current
    if (!area) return
    const a = area.selectionStart,
      b = area.selectionEnd,
      d = current.current
    const value = d.body.slice(a, b) || 'teks'
    update({ ...d, body: d.body.slice(0, a) + before + value + after + d.body.slice(b) })
    requestAnimationFrame(() => {
      area.focus()
      area.setSelectionRange(a + before.length, a + before.length + value.length)
    })
  }
  const course = w.courses.find((c) => c.id === n.courseId),
    session = w.sessions.find((s) => s.id === n.sessionId)
  return (
    <div className="editor">
      <div className="between">
        <Link className="back-link" to="/catatan">
          <ChevronLeft size={16} /> Semua catatan
        </Link>
        <Button onClick={() => setFocus(!focus)}>
          {focus ? <Minimize size={16} /> : <Maximize size={16} />}{' '}
          {focus ? 'Keluar fokus' : 'Mode fokus'}
        </Button>
      </div>
      <div className="row-meta">
        <Badge course={course} />
        {session && (
          <Chip>
            {sessionLabel(session)} · {formatDay(session.date)}
          </Chip>
        )}
      </div>
      <div className="editor-paper" style={{ fontSize: p.noteSize }}>
        <Field label="Judul catatan">
          <input
            className="note-title"
            value={draft.title}
            disabled={uploading}
            onChange={(e) => update({ ...draft, title: e.target.value })}
          />
        </Field>
        <div className="editor-top">
          <Tabs items={['Edit', 'Pratinjau']} value={tab} onChange={setTab} />
          <small aria-live="polite">{uploading ? 'Mengunggah foto…' : status}</small>
        </div>
        {tab === 'Edit' ? (
          <>
            <div className="toolbar">
              {[
                [Bold, 'Tebal', '**', '**'],
                [Italic, 'Miring', '*', '*'],
                [Heading, 'Judul', '\n## ', ''],
                [List, 'Daftar', '\n- ', ''],
                [ListChecks, 'Checklist', '\n- [ ] ', ''],
                [Quote, 'Kutipan', '\n> ', ''],
                [Code, 'Kode', String.fromCharCode(96), String.fromCharCode(96)],
              ].map(([Icon, label, a, b]) => {
                const I = Icon as typeof Bold
                return (
                  <button
                    disabled={uploading}
                    title={String(label)}
                    aria-label={String(label)}
                    key={String(label)}
                    onClick={() => wrap(String(a), String(b))}
                  >
                    <I size={17} />
                  </button>
                )
              })}
              <label className="tool-file" title="Pilih gambar">
                <ImagePlus size={18} />
                <input
                  aria-label="Pilih gambar"
                  type="file"
                  multiple
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => {
                    void images(Array.from(e.target.files ?? []))
                    e.target.value = ''
                  }}
                />
              </label>
              <label className="tool-file" title="Ambil foto">
                <Camera size={18} />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  aria-label="Ambil foto"
                  disabled={uploading}
                  onChange={(e) => {
                    void images(Array.from(e.target.files ?? []))
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
            <textarea
              className="note-body"
              aria-label="Isi catatan"
              ref={text}
              value={draft.body}
              disabled={uploading}
              placeholder="Tulis catatan pertemuanmu di sini…"
              onChange={(e) => update({ ...draft, body: e.target.value })}
              onPaste={(e) => {
                const fs = Array.from(e.clipboardData.files)
                if (fs.length) {
                  e.preventDefault()
                  void images(fs)
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                void images(Array.from(e.dataTransfer.files))
              }}
            />
          </>
        ) : (
          <article className="markdown">
            <Suspense fallback={<Loading />}>
              <Markdown body={draft.body || 'Belum ada isi catatan.'} />
            </Suspense>
          </article>
        )}
        <div className="editor-foot">
          <span>
            <FileText size={14} />
            {draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0} kata
          </span>
          <span>Markdown</span>
        </div>
        <Field label="Tag (pisahkan dengan koma)">
          <input
            value={draft.tagText}
            disabled={uploading}
            onChange={(e) => update({ ...draft, tagText: e.target.value })}
            placeholder="penting, ujian"
          />
        </Field>
        {error && (
          <>
            <Alert>{error}</Alert>
            {conflict ? (
              <div className="actions">
                {['Pakai versi server', 'Simpan draft saya'].map((label, i) => (
                  <Button
                    key={label}
                    onClick={() =>
                      save.run(async () => {
                        const latest = await api<Note>('/notes/' + n.id)
                        version.current = latest.updatedAt
                        if (i) {
                          await persist()
                        } else {
                          localStorage.removeItem(key)
                          current.current = fromNote(latest)
                          set(current.current)
                          setStatus('Tersimpan')
                          setError('')
                          setConflict(false)
                          await refresh()
                        }
                      })
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
            ) : (
              <Button onClick={() => void persist().catch(() => {})}>Coba simpan lagi</Button>
            )}
          </>
        )}
      </div>
      <Button onClick={() => setDel(true)}>
        <Trash2 size={15} /> Hapus catatan
      </Button>
      {del && (
        <Modal title="Hapus catatan ini?" onClose={() => setDel(false)}>
          <p>Catatan dan gambar di dalamnya akan dihapus.</p>
          {save.error && <Alert>{save.error}</Alert>}
          <div className="actions">
            <Button onClick={() => setDel(false)}>Batal</Button>
            <Button
              color="coral"
              disabled={save.busy}
              onClick={() =>
                save.run(async () => {
                  clearTimeout(timer.current)
                  await queue.current.catch(() => {})
                  await api('/notes/' + n.id, 'DELETE')
                  localStorage.removeItem(key)
                  await refresh()
                  toast('Catatan dihapus.')
                  nav('/catatan')
                })
              }
            >
              Hapus catatan
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
