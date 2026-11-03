import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  GraduationCap,
  MapPin,
  MessageCircle,
  NotebookPen,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  SquareCheckBig,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  days,
  formatDay,
  time,
  sessionLabel,
  phoneInternational,
  type Attachment,
  type Course,
  type Meeting,
  type Note,
} from '../../../shared/model'
import { useApp } from '../app/context'
import { api, refresh } from '../lib/api'
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
} from '../components/ui'
import { CourseForm, blankCourse } from './CourseForm'
import { TaskRow, ExtraSession } from './Agenda'
import { NoteList } from './Notes'
export function Courses() {
  const { w, toast } = useApp(),
    [add, setAdd] = useState(false)
  return (
    <>
      <Header
        eyebrow="INDEKS SEMESTER"
        title="Mata kuliah."
        sub={
          w.courses.length +
          ' mata kuliah · ' +
          w.courses.reduce((n, c) => n + c.sks, 0) +
          ' SKS semester ini.'
        }
        action={
          <Button color="sunny" disabled={w.courses.length >= 6} onClick={() => setAdd(true)}>
            <Plus size={17} /> Tambah MK
          </Button>
        }
      />
      <div className="course-grid">
        {w.courses.map((c, i) => (
          <Link key={c.id} className={'course-cover bg-' + c.color} to={'/matkul/' + c.id}>
            <div>
              <Chip>{c.code}</Chip>
              <span className="mono">MK / {String(i + 1).padStart(2, '0')}</span>
            </div>
            <h2>{c.name}</h2>
            <p>
              <GraduationCap size={16} />
              {c.sks} SKS
            </p>
            <footer>
              {c.schedules.length
                ? c.schedules
                    .map((s) => days[s.dayOfWeek - 1].slice(0, 3) + ' ' + s.startTime)
                    .join(' · ')
                : 'Belum ada slot'}
              <ExternalLink size={17} />
            </footer>
          </Link>
        ))}
      </div>
      {!w.courses.length && <Empty title="Belum ada mata kuliah di semester ini." />}
      {add && (
        <CourseForm
          initial={blankCourse(w.courses.map((c) => c.color))}
          used={w.courses.map((c) => c.color)}
          onClose={() => setAdd(false)}
          onSave={async (v) => {
            await api('/courses', 'POST', { ...v, semesterId: w.semester?.id })
            await refresh()
            toast('Mata kuliah ditambahkan.')
          }}
        />
      )}
    </>
  )
}
export function ModuleList({ course, session }: { course: Course; session?: Meeting }) {
  const { w, toast } = useApp(),
    [add, setAdd] = useState(false),
    [selected, setSelected] = useState<Attachment | null>(null),
    [op, setOp] = useState(''),
    [name, setName] = useState(''),
    [filter, setFilter] = useState(''),
    save = useSubmit()
  const [form, set] = useState({
      title: '',
      description: '',
      sessionId: session?.id ?? '',
      source: 'File',
      url: '',
    }),
    [file, setFile] = useState<File | null>(null)
  const list = w.attachments.filter(
    (a) =>
      a.kind === 'module' &&
      a.courseId === course.id &&
      (!(session?.id || filter) || a.sessionId === (session?.id || filter)),
  )
  const [params] = useSearchParams(),
    target = params.get('item')
  useEffect(() => {
    if (target) document.getElementById('item-' + target)?.scrollIntoView({ block: 'center' })
  }, [target])
  const submit = async () => {
    if (form.source === 'File' && !file) throw new Error('Pilih file modul terlebih dahulu.')
    const data = new FormData()
    data.set('title', form.title)
    data.set('description', form.description)
    data.set('courseId', course.id)
    if (form.sessionId) data.set('sessionId', form.sessionId)
    if (form.source === 'File') data.set('file', file!)
    else data.set('url', form.url)
    await api('/attachments', 'POST', data)
    await refresh()
    toast('Modul tersimpan.')
    setAdd(false)
    set({ ...form, title: '', description: '', url: '' })
    setFile(null)
  }
  return (
    <>
      <div className="filter-bar">
        {!session && (
          <select
            aria-label="Filter pertemuan modul"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Semua pertemuan</option>
            {w.sessions
              .filter((s) => s.courseId === course.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {sessionLabel(s)} · {formatDay(s.date)}
                </option>
              ))}
          </select>
        )}
        <Button
          onClick={() => {
            save.setError('')
            setAdd(true)
          }}
        >
          <Plus size={16} /> Tambah modul
        </Button>
      </div>
      {list.length ? (
        list.map((a) => (
          <div className="list-item" key={a.id} id={'item-' + a.id}>
            <span className="stamp bg-cream">
              <FileText size={18} />
            </span>
            <div className="grow">
              <a
                className="text-link"
                href={a.url ?? '/api/files/' + a.id}
                target="_blank"
                rel="noreferrer"
              >
                {a.title}
                <ExternalLink size={13} />
              </a>
              <small>
                {a.description || a.fileName || 'Tautan modul'}
                {a.sizeBytes ? ' · ' + (a.sizeBytes / 1048576).toFixed(1) + ' MB' : ''}
              </small>
            </div>
            <div className="row-tools">
              {!a.url && (
                <a
                  className="icon-btn"
                  href={'/api/files/' + a.id + '?download=1'}
                  aria-label={'Unduh ' + a.title}
                >
                  <Download size={16} />
                </a>
              )}
              {[
                ['rename', Pencil, 'Ubah'],
                ['delete', Trash2, 'Hapus'],
              ].map(([action, Icon, label]) => {
                const I = Icon as typeof Pencil
                return (
                  <button
                    key={String(action)}
                    className="icon-btn"
                    aria-label={label + ' ' + a.title}
                    onClick={() => {
                      save.setError('')
                      setSelected(a)
                      setOp(String(action))
                      setName(a.title)
                    }}
                  >
                    <I size={16} />
                  </button>
                )
              })}
            </div>
          </div>
        ))
      ) : (
        <Empty title="Belum ada modul untuk pilihan ini." />
      )}
      {add && (
        <Modal title="Tambah modul" onClose={() => setAdd(false)}>
          <form className="form-stack" onSubmit={(e) => save.run(submit, e)}>
            <Field label="Judul modul">
              <input
                required
                value={form.title}
                onChange={(e) => set({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Keterangan atau bab">
              <input
                value={form.description}
                onChange={(e) => set({ ...form, description: e.target.value })}
              />
            </Field>
            <Field label="Pertemuan terkait">
              <select
                value={form.sessionId}
                onChange={(e) => set({ ...form, sessionId: e.target.value })}
              >
                <option value="">Umum mata kuliah</option>
                {w.sessions
                  .filter((s) => s.courseId === course.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {sessionLabel(s)} · {formatDay(s.date)}
                    </option>
                  ))}
              </select>
            </Field>
            <Tabs
              items={['File', 'Tautan']}
              value={form.source}
              onChange={(source) => set({ ...form, source })}
            />
            {form.source === 'File' ? (
              <Field label="File modul (maks. 20 MB)">
                <input
                  type="file"
                  accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Field>
            ) : (
              <Field label="URL modul">
                <input
                  type="url"
                  required
                  value={form.url}
                  onChange={(e) => set({ ...form, url: e.target.value })}
                />
              </Field>
            )}
            {save.error && <Alert>{save.error}</Alert>}
            <Button type="submit" color="sunny" disabled={save.busy}>
              Simpan modul
            </Button>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal
          title={op === 'delete' ? 'Hapus modul ini?' : 'Ubah judul modul'}
          onClose={() => setSelected(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) =>
              save.run(async () => {
                await api(
                  '/attachments/' + selected.id,
                  op === 'delete' ? 'DELETE' : 'PATCH',
                  op === 'delete' ? undefined : { title: name },
                )
                await refresh()
                setSelected(null)
              }, e)
            }
          >
            {op === 'delete' ? (
              <p>{selected.title} akan dihapus dari pustaka.</p>
            ) : (
              <Field label="Judul baru">
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            )}
            {save.error && <Alert>{save.error}</Alert>}
            <Button type="submit" color={op === 'delete' ? 'coral' : 'sunny'} disabled={save.busy}>
              {op === 'delete' ? 'Hapus modul' : 'Simpan judul'}
            </Button>
          </form>
        </Modal>
      )}
    </>
  )
}
export function NewNoteButton({ courseId, sessionId }: { courseId: string; sessionId?: string }) {
  const nav = useNavigate(),
    save = useSubmit()
  return (
    <>
      <Button
        disabled={save.busy}
        onClick={() =>
          save.run(async () => {
            const n = await api<Note>('/notes', 'POST', { courseId, sessionId })
            await refresh()
            nav('/catatan/' + n.id)
          })
        }
      >
        <Plus size={15} /> Tambah catatan
      </Button>
      {save.error && <Alert>{save.error}</Alert>}
    </>
  )
}
export function CourseDetail() {
  const { id } = useParams(),
    { w, task, toast } = useApp(),
    [params, setParams] = useSearchParams(),
    tab = params.get('tab') ?? 'Pertemuan',
    c = w.courses.find((c) => c.id === id),
    [editing, setEditing] = useState(false),
    [del, setDel] = useState(false),
    [extra, setExtra] = useState(false),
    save = useSubmit(),
    nav = useNavigate()
  if (!c) return <Empty title="Mata kuliah tidak ditemukan." />
  const sessions = w.sessions.filter((s) => s.courseId === id),
    notes = w.notes.filter((n) => n.courseId === id),
    tasks = w.tasks.filter((t) => t.courseId === id),
    modules = w.attachments.filter((a) => a.courseId === id && a.kind === 'module')
  return (
    <>
      <Link className="back-link" to="/matkul">
        <ChevronLeft size={16} /> Mata kuliah
      </Link>
      <div className={'course-banner bg-' + c.color}>
        <Badge course={c} />
        <h1>{c.name}</h1>
        <p>
          {c.sks} SKS · {c.lecturerName || 'Dosen belum diisi'}
        </p>
        <Button onClick={() => setEditing(true)}>
          <Pencil size={15} /> Ubah mata kuliah
        </Button>
      </div>
      <Tabs
        items={['Pertemuan', 'Catatan', 'Modul', 'PR', 'Info Dosen']}
        value={tab}
        onChange={(tab) => setParams({ tab })}
      />
      <Panel key={tab} className="tab-content" title={tab} icon={<FolderOpen size={19} />}>
        {tab === 'Pertemuan' && (
          <>
            <div className="actions">
              <Button onClick={() => setExtra(true)}>
                <Plus size={16} /> Tambah pertemuan
              </Button>
            </div>
            {sessions.length ? (
              sessions.map((s) => (
                <Link to={'/pertemuan/' + s.id} key={s.id} className="list-item">
                  <Chip color={s.status === 'libur' ? 'blush' : c.color}>{sessionLabel(s)}</Chip>
                  <div className="grow">
                    <strong>{s.topic || formatDay(s.date, true)}</strong>
                    <small>
                      {time(s.startAt)}–{time(s.endAt)} · {s.room}
                      {!s.tracked ? ' · Sebelum pelacakan' : ''}
                    </small>
                  </div>
                  <ChevronRight size={16} />
                </Link>
              ))
            ) : (
              <Empty title="Belum ada pertemuan. Tambahkan nomor pertemuan sesuai progres kelasmu." />
            )}
          </>
        )}
        {tab === 'Catatan' && (
          <>
            <NewNoteButton courseId={c.id} />
            <NoteList notes={notes} />
          </>
        )}
        {tab === 'Modul' && <ModuleList course={c} />}
        {tab === 'PR' && (
          <>
            <Button onClick={() => task({ courseId: id })}>
              <Plus size={16} /> Tambah PR
            </Button>
            {tasks.length ? (
              tasks.map((t) => <TaskRow key={t.id} t={t} editable />)
            ) : (
              <Empty title="Belum ada PR di mata kuliah ini." />
            )}
          </>
        )}
        {tab === 'Info Dosen' && (
          <div className="form-stack">
            <span className="stamp bg-violet">
              <GraduationCap />
            </span>
            <h3>{c.lecturerName || 'Nama dosen belum diisi'}</h3>
            {c.lecturerPhone && (
              <div className="actions">
                <a className="brut-btn" href={'tel:+' + phoneInternational(c.lecturerPhone)}>
                  <Phone size={16} />
                  {c.lecturerPhone}
                </a>
                <a
                  className="brut-btn bg-teal"
                  href={'https://wa.me/' + phoneInternational(c.lecturerPhone)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </div>
            )}
            {c.schedules.map((s) => (
              <p key={s.id}>
                {days[s.dayOfWeek - 1]} · {s.startTime}–{s.endTime} · {s.room}
              </p>
            ))}
            <Button onClick={() => setDel(true)}>
              <Trash2 size={16} /> Hapus mata kuliah
            </Button>
          </div>
        )}
      </Panel>
      {editing && (
        <CourseForm
          initial={{ ...c, color: c.color as 'violet' }}
          used={w.courses.filter((x) => x.id !== id).map((x) => x.color)}
          onClose={() => setEditing(false)}
          onSave={async (v) => {
            await api('/courses/' + id, 'PATCH', v)
            await refresh()
            toast('Mata kuliah diperbarui.')
          }}
        />
      )}
      {del && (
        <Modal title={'Hapus ' + c.code + '?'} onClose={() => setDel(false)}>
          <p>
            {notes.length} catatan, {modules.length} modul, dan {tasks.length} PR akan ikut
            terhapus.
          </p>
          {save.error && <Alert>{save.error}</Alert>}
          <div className="actions">
            <Button onClick={() => setDel(false)}>Batal</Button>
            <Button
              color="coral"
              disabled={save.busy}
              onClick={() =>
                save.run(async () => {
                  await api('/courses/' + id, 'DELETE')
                  await refresh()
                  nav('/matkul')
                })
              }
            >
              Hapus mata kuliah
            </Button>
          </div>
        </Modal>
      )}
      {extra && <ExtraSession courseId={id} onClose={() => setExtra(false)} />}
    </>
  )
}
export function SessionDetail() {
  const { id } = useParams(),
    { w, task, toast } = useApp(),
    s = w.sessions.find((s) => s.id === id),
    c = w.courses.find((c) => c.id === s?.courseId)
  if (!s || !c) return <Empty title="Pertemuan tidak ditemukan." />
  return (
    <SessionBody
      key={s.id}
      s={s}
      c={c}
      notify={toast}
      addPR={() => task({ courseId: c.id, sessionId: s.id })}
    />
  )
}
function SessionBody({
  s,
  c,
  notify,
  addPR,
}: {
  s: Meeting
  c: Course
  notify: (text: string) => void
  addPR: () => void
}) {
  const { w } = useApp(),
    [topic, setTopic] = useState(s.topic ?? ''),
    [holiday, setHoliday] = useState(false),
    [reason, setReason] = useState(s.reason ?? ''),
    save = useSubmit()
  const siblings = w.sessions.filter((m) => m.courseId === c.id),
    i = siblings.findIndex((m) => m.id === s.id),
    tasks = w.tasks.filter((t) => t.sessionId === s.id)
  const patch = async (data: object) => {
    await api('/sessions/' + s.id, 'PATCH', data)
    await refresh()
    notify('Pertemuan diperbarui.')
  }
  return (
    <>
      <Link className="back-link" to={'/matkul/' + c.id}>
        <ChevronLeft size={16} />
        {c.name}
      </Link>
      <div className={'course-banner bg-' + c.color}>
        <Badge course={c} />
        <h1>{s.status === 'libur' ? 'Pertemuan libur' : 'Pertemuan ke-' + s.meetingNo}</h1>
        <div className="meta-line">
          <span>
            <CalendarDays />
            {formatDay(s.date, true)}
          </span>
          <span>
            <Clock3 />
            {time(s.startAt)}–{time(s.endAt)}
          </span>
          <span>
            <MapPin />
            {s.room}
          </span>
        </div>
        <p>
          {c.lecturerName}
          {s.reason && s.status === 'libur' ? ' · ' + s.reason : ''}
        </p>
      </div>
      <div className="detail-grid">
        <div>
          <Panel title="Topik pertemuan" icon={<BookOpen size={19} />}>
            <form className="inline-form" onSubmit={(e) => save.run(() => patch({ topic }), e)}>
              <input
                aria-label="Topik pertemuan"
                placeholder="Apa topik hari ini?"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              <Button type="submit" disabled={save.busy}>
                Simpan
              </Button>
            </form>
            {save.error && <Alert>{save.error}</Alert>}
          </Panel>
          <Panel title="Catatan" icon={<NotebookPen size={19} />}>
            <NewNoteButton courseId={c.id} sessionId={s.id} />
            <NoteList notes={w.notes.filter((n) => n.sessionId === s.id)} />
          </Panel>
          <Panel title="Modul terkait" icon={<Paperclip size={19} />}>
            <ModuleList course={c} session={s} />
          </Panel>
        </div>
        <div>
          <Panel title="PR pertemuan" icon={<SquareCheckBig size={19} />}>
            <Button onClick={addPR}>
              <Plus size={16} /> Tambah PR
            </Button>
            {tasks.length ? (
              tasks.map((t) => <TaskRow key={t.id} t={t} />)
            ) : (
              <Empty title="Belum ada PR dari pertemuan ini." />
            )}
          </Panel>
          <Panel title="Status pertemuan">
            <Button
              onClick={() =>
                s.status === 'libur'
                  ? save.run(() => patch({ status: 'normal', reason: null }))
                  : setHoliday(true)
              }
            >
              {s.status === 'libur' ? 'Kembalikan kelas normal' : 'Tandai libur'}
            </Button>
          </Panel>
        </div>
      </div>
      <div className="between">
        {siblings[i - 1] && (
          <Link className="brut-btn" to={'/pertemuan/' + siblings[i - 1].id}>
            <ChevronLeft size={16} /> Sebelumnya
          </Link>
        )}
        {siblings[i + 1] && (
          <Link className="brut-btn" to={'/pertemuan/' + siblings[i + 1].id}>
            Berikutnya <ChevronRight size={16} />
          </Link>
        )}
      </div>
      {holiday && (
        <Modal title="Tandai pertemuan libur" onClose={() => setHoliday(false)}>
          <form
            className="form-stack"
            onSubmit={(e) =>
              save.run(async () => {
                await patch({ status: 'libur', reason })
                setHoliday(false)
              }, e)
            }
          >
            <Field label="Alasan (opsional)">
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <p>Catatan tetap tersimpan. Nomor pertemuan lain tetap sesuai input kamu.</p>
            {save.error && <Alert>{save.error}</Alert>}
            <Button type="submit" color="sunny">
              Tandai libur
            </Button>
          </form>
        </Modal>
      )}
    </>
  )
}
