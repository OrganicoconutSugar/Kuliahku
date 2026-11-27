import { agenda, weeklyTasks, meetingLink, isRoutine } from '../../../shared/agenda'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  MapPin,
  NotebookPen,
  Plus,
  SquareCheckBig,
  Pencil,
  Trash2,
  Sun,
  AlarmClock,
  GraduationCap,
} from 'lucide-react'
import type { Meeting, Task } from '../../../shared/model'
import {
  addDays,
  classStatus,
  day,
  days,
  formatDay,
  monday,
  taskGroup,
  time,
  sessionLabel,
  weekday,
} from '../../../shared/model'
import type { Today } from '../../../server/src/insights'
import { useApp } from '../app/context'
import { api, msg, refresh, termQuery } from '../lib/api'
import {
  Badge,
  Button,
  Chip,
  Empty,
  Field,
  Header,
  Loading,
  Panel,
  Tabs,
  Alert,
  Modal,
  useSubmit,
} from '../components/ui'
import { MascotCat, Spark } from '../components/Mascot'
export function TaskRow({ t, editable = false }: { t: Task; editable?: boolean }) {
  const { w, now, toast, task, celebrate } = useApp(),
    save = useSubmit(),
    [confirm, setConfirm] = useState(false),
    done = t.status === 'done',
    late = !done && taskGroup(t, now) === 'Terlambat'
  const toggle = async () => {
    await api('/tasks/' + t.id + (done ? '/reopen' : '/complete'), 'POST')
    await refresh()
    if (!done) {
      celebrate()
      toast('Mantap! Satu PR beres.', () => {
        void api('/tasks/' + t.id + '/reopen', 'POST')
          .then(() => refresh())
          .catch((e) => toast(msg(e), undefined, true))
      })
    } else toast('PR kembali aktif.')
  }
  const elapsed = Math.max(
    0,
    Math.round((Date.parse(day(now)) - Date.parse(day(t.dueAt))) / 86400000),
  )
  return (
    <div
      className={'task-row ' + (done ? 'done' : '') + ' ' + (late ? 'late' : '')}
      id={'item-' + t.id}
    >
      <button
        className="check-btn"
        role="checkbox"
        aria-checked={done}
        aria-label={(done ? 'Buka lagi ' : 'Selesaikan ') + t.title}
        disabled={save.busy}
        onClick={() => save.run(toggle)}
      >
        {done && <Check size={16} />}
      </button>
      <div className="grow">
        <strong>{t.title}</strong>
        <small>
          <Badge course={w.courses.find((c) => c.id === t.courseId)} />
          {late ? (
            <b>{elapsed ? 'Terlambat ' + elapsed + ' hari' : 'Terlambat hari ini'}</b>
          ) : (
            <span>
              {formatDay(day(t.dueAt))}
              {t.dueHasTime ? ' · ' + time(t.dueAt) : ''}
            </span>
          )}
          {t.priority === 'tinggi' && <span>Prioritas tinggi</span>}
        </small>
        {editable && t.description && <p>{t.description}</p>}
      </div>
      {editable && (
        <div className="row-tools">
          <button className="icon-btn" aria-label={'Ubah ' + t.title} onClick={() => task({}, t)}>
            <Pencil size={16} />
          </button>
          <button
            className="icon-btn"
            aria-label={'Hapus ' + t.title}
            onClick={() => setConfirm(true)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
      {save.error && <Alert>{save.error}</Alert>}
      {confirm && (
        <Modal title="Hapus PR ini?" onClose={() => setConfirm(false)}>
          <p>{t.title}</p>
          <div className="actions">
            <Button onClick={() => setConfirm(false)}>Batal</Button>
            <Button
              color="coral"
              onClick={() =>
                save.run(async () => {
                  await api('/tasks/' + t.id, 'DELETE')
                  await refresh()
                  setConfirm(false)
                })
              }
            >
              Hapus PR
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
export function Dashboard() {
  const { w, p, now, user, capture, term, cheering } = useApp()
  const q = useQuery({
    queryKey: ['today', term, day(now)],
    queryFn: () => api<Today>(termQuery('/today', term)),
    refetchInterval: 30000,
  })
  useEffect(() => {
    if (q.data) window.dispatchEvent(new CustomEvent('kuliahku:streak', { detail: q.data.streak }))
  }, [q.data])
  if (q.isPending) return <Loading />
  if (q.error) return <Alert>{q.error.message}</Alert>
  const d = q.data,
    today = day(now),
    hour = Number(time(now).slice(0, 2)),
    classes = d.today.filter((s) => s.status === 'normal'),
    active = classes.some((s) => classStatus(s, now) === 'Sedang berlangsung')
  const next = d.next,
    course = (s: Meeting) => w.courses.find((c) => c.id === s.courseId),
    nextCourse = next ? course(next) : undefined
  const catState = cheering
    ? 'celebrate'
    : d.urgent.some((t) => Date.parse(t.dueAt) - +now <= 86400000)
      ? 'alert'
      : active
        ? 'read'
        : !classes.some((s) => classStatus(s, now) !== 'Selesai')
          ? 'sleep'
          : 'idle'
  return (
    <>
      <div className="page-overline">
        <span className="eyebrow">
          <i className="status-dot" /> AGENDA HARIAN
        </span>
        <span>{w.semester?.name}</span>
      </div>
      <section className="dash-hero">
        <div className="hero-grain" />
        <div className="dash-copy">
          <Chip>
            <CalendarDays size={14} />
            {formatDay(today, true)}
          </Chip>
          <h1>
            Selamat {hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam'},<br />
            {user.name.split(' ')[0]}
            <span className="coral-dot">.</span>
          </h1>
          <p>
            {classes.length
              ? 'Ada ' + classes.length + ' kelas di agendamu hari ini. Yuk, siap-siap!'
              : 'Hari bebas kuliah! Yuk, cicil PR atau rapikan catatan.'}
          </p>
          <span className="streak-chip">
            <Flame size={16} /> Streak {d.streak} hari kuliah
          </span>
          {weekday(today) === 1 && classes.length > 1 && (
            <span className="streak-chip">
              <CalendarDays size={14} /> Hari padat
            </span>
          )}
        </div>
        {p.mascotEnabled && (
          <div className="dash-art">
            <Spark className="dash-spark" />
            <span className="mascot-label">
              {p.mascotName} <span>↘</span>
            </span>
            <MascotCat
              name={p.mascotName}
              state={catState}
              level={p.animationLevel}
              tip={
                next && nextCourse
                  ? 'Kelas berikutnya ' + nextCourse.code + ' di ' + next.room + '.'
                  : 'Coba buka rekap minggu ini.'
              }
            />
          </div>
        )}
      </section>
      {w.semester && w.semester.endDate < today && (
        <div className="archive-banner">
          Semester ini sudah selesai.{' '}
          <Link to="/onboarding">
            Buat semester baru <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <div className={'dash-columns' + (!classes.length ? ' free-day' : '')}>
        <div className="dash-primary">
          <Panel
            title="Kelas hari ini"
            icon={
              <span className="section-ico bg-violet">
                <CalendarDays />
              </span>
            }
            to="/jadwal"
            linkText="Jadwal"
          >
            {d.today.length ? (
              d.today.map((s) => {
                const c = course(s)
                if (!c) return null
                return (
                  <div
                    className={
                      'class-row ' + (classStatus(s, now) === 'Sedang berlangsung' ? 'live' : '')
                    }
                    key={s.id}
                  >
                    <div className={'class-rail bg-' + c.color} />
                    <div className="class-details">
                      <div className="row-meta">
                        <Badge course={c} />
                        <span>{sessionLabel(s)}</span>
                        <Chip
                          color={
                            active && classStatus(s, now) === 'Sedang berlangsung'
                              ? 'teal'
                              : 'cream'
                          }
                        >
                          {classStatus(s, now)}
                        </Chip>
                      </div>
                      <h3>{c.name}</h3>
                      <small>
                        <Clock3 size={14} />
                        {time(s.startAt)}–{time(s.endAt)} <MapPin size={14} /> {s.room}
                      </small>
                      <small>
                        <GraduationCap size={15} /> {c.lecturerName}
                      </small>
                      <div className="actions">
                        <Link className="text-link" to={meetingLink(s)}>
                          {isRoutine(s) ? 'Buka mata kuliah' : 'Buka pertemuan'}{' '}
                          <ArrowUpRight size={15} />
                        </Link>
                        <Button
                          onClick={() =>
                            capture({ courseId: s.courseId, sessionId: isRoutine(s) ? null : s.id })
                          }
                        >
                          <NotebookPen size={15} /> Catat
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <Empty
                title="Tidak ada kuliah hari ini."
                action={
                  next && nextCourse ? (
                    <Link className="text-link" to={meetingLink(next)}>
                      Berikutnya {days[weekday(next.date) - 1]}, {formatDay(next.date)} ·{' '}
                      {time(next.startAt)} · {nextCourse.name} · {next.room}{' '}
                      <ArrowRight size={15} />
                    </Link>
                  ) : (
                    <Link className="text-link" to="/jadwal">
                      Buka jadwal
                    </Link>
                  )
                }
              />
            )}
          </Panel>
          <Panel
            title="Besok"
            icon={
              <span className="section-ico bg-sky">
                <Sun />
              </span>
            }
          >
            {d.tomorrow.length ? (
              d.tomorrow.map((s) => {
                const c = course(s)
                if (!c) return null
                return (
                  <Link key={s.id} className="list-item" to={meetingLink(s)}>
                    <Badge course={c} />
                    <div className="grow">
                      <strong>{c.name}</strong>
                      <small>
                        {time(s.startAt)} · {s.room}
                        {s.status === 'libur' ? ' · Libur' : ''}
                      </small>
                    </div>
                    <ChevronRight size={17} />
                  </Link>
                )
              })
            ) : (
              <Empty title="Besok bebas kuliah. Kamu bisa lihat agenda minggu ini." />
            )}
          </Panel>
        </div>
        <div className="dash-secondary">
          <Panel
            title="PR mendesak"
            icon={
              <span className="section-ico bg-coral">
                <SquareCheckBig />
              </span>
            }
            to="/pr"
          >
            {d.urgent.length ? (
              d.urgent.map((t) => <TaskRow key={t.id} t={t} />)
            ) : (
              <Empty
                title="Belum ada PR aktif."
                action={
                  <button className="text-link" onClick={() => capture({ tab: 'PR' })}>
                    Tambah PR <Plus size={14} />
                  </button>
                }
              />
            )}
          </Panel>
          <Panel
            title="Belum dicatat"
            icon={
              <span className="section-ico bg-teal">
                <NotebookPen />
              </span>
            }
          >
            {d.missing.length ? (
              d.missing.map((s) => (
                <div className="list-item" key={s.id}>
                  <div className="grow">
                    <Badge course={course(s)} />
                    <strong>
                      {sessionLabel(s)} · {formatDay(s.date)}
                    </strong>
                  </div>
                  <button
                    className="text-link"
                    onClick={() =>
                      capture({ courseId: s.courseId, sessionId: isRoutine(s) ? null : s.id })
                    }
                  >
                    Catat sekarang
                  </button>
                </div>
              ))
            ) : (
              <Empty title="Kelas tiga hari terakhir sudah beres atau belum perlu dicatat." />
            )}
          </Panel>
          {!classes.length && (
            <Link to="/rekap" className="recap-callout">
              <BookOpen />
              <span>
                <strong>Lihat rekap minggu ini</strong>
                <small>Catatan dan progres per mata kuliah.</small>
              </span>
              <ArrowRight />
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
export function ExtraSession({ courseId, onClose }: { courseId?: string; onClose: () => void }) {
  const { w, toast } = useApp(),
    save = useSubmit(),
    nextNo = (id: string) =>
      String(
        Math.max(0, ...w.sessions.filter((s) => s.courseId === id).map((s) => s.meetingNo ?? 0)) +
          1,
      ),
    defaults = (id: string, date: string) => {
      const slots = w.courses.find((c) => c.id === id)?.schedules ?? []
      const slot = slots.find((s) => s.dayOfWeek === weekday(date)) ?? slots[0]
      return {
        startTime: slot?.startTime ?? '08:00',
        endTime: slot?.endTime ?? '09:40',
        room: slot?.room ?? '',
      }
    },
    initialCourse = courseId ?? w.courses[0]?.id ?? '',
    [v, set] = useState(() => ({
      courseId: initialCourse,
      meetingNo: nextNo(initialCourse),
      date: day(),
      ...defaults(initialCourse, day()),
    }))
  return (
    <Modal title="Tambah pertemuan" onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={(e) =>
          save.run(async () => {
            await api('/sessions', 'POST', { ...v, meetingNo: Number(v.meetingNo) })
            await refresh()
            toast('Pertemuan tersimpan.')
            onClose()
          }, e)
        }
      >
        <Field label="Mata kuliah">
          <select
            value={v.courseId}
            onChange={(e) =>
              set({
                ...v,
                courseId: e.target.value,
                ...defaults(e.target.value, v.date),
                meetingNo: nextNo(e.target.value),
              })
            }
          >
            {w.courses.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pertemuan ke" hint="Isi nomor sesuai kelas yang sedang berjalan, misalnya 6.">
          <input
            type="number"
            min="1"
            max="9999"
            required
            value={v.meetingNo}
            onChange={(e) => set({ ...v, meetingNo: e.target.value })}
          />
        </Field>
        <Field label="Tanggal">
          <input
            type="date"
            required
            min={w.semester?.startDate}
            max={w.semester?.endDate}
            value={v.date}
            onChange={(e) =>
              set({ ...v, ...defaults(v.courseId, e.target.value || v.date), date: e.target.value })
            }
          />
        </Field>
        <div className="form-grid">
          {(['startTime', 'endTime'] as const).map((k, i) => (
            <Field key={k} label={i ? 'Jam selesai' : 'Jam mulai'}>
              <input
                type="time"
                required
                value={v[k]}
                onChange={(e) => set({ ...v, [k]: e.target.value })}
              />
            </Field>
          ))}
        </div>
        <Field label="Ruang">
          <input required value={v.room} onChange={(e) => set({ ...v, room: e.target.value })} />
        </Field>
        {save.error && <Alert>{save.error}</Alert>}
        <Button type="submit" color="sunny" disabled={save.busy}>
          Simpan pertemuan
        </Button>
      </form>
    </Modal>
  )
}
export function Schedule() {
  const { w, now } = useApp(),
    today = day(now),
    [start, setStart] = useState(monday(today)),
    [extra, setExtra] = useState(false),
    dates = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const mins = (at: string) => Number(time(at).slice(0, 2)) * 60 + Number(time(at).slice(3))
  const tasks = weeklyTasks(w, start),
    week = agenda(w, start, dates[6]),
    begin = Math.min(7, ...week.map((s) => Math.floor(mins(s.startAt) / 60))),
    end = Math.max(17, ...week.map((s) => Math.ceil(mins(s.endAt) / 60))),
    hours = Array.from({ length: end - begin + 1 }, (_, i) => i + begin)
  useEffect(() => {
    if (matchMedia('(max-width: 760px)').matches && start === monday(today))
      if (!weeklyTasks(w, start).length)
        document.getElementById('day-' + today)?.scrollIntoView({ block: 'nearest' })
  }, [start, today])
  function cards(date: string, grid: boolean) {
    const list = week.filter((s) => s.date === date)
    return list.map((s, i) => {
      const c = w.courses.find((c) => c.id === s.courseId)
      if (!c) return null
      const joined = i > 0 && list[i - 1].endAt === s.startAt && list[i - 1].room === s.room
      return (
        <Link
          key={s.id}
          className={
            'schedule-block bg-' +
            c.color +
            (s.status === 'libur' ? ' holiday' : '') +
            (joined ? ' joined' : '')
          }
          to={meetingLink(s)}
          style={
            grid
              ? {
                  top: ((mins(s.startAt) - begin * 60) / ((end - begin) * 60)) * 100 + '%',
                  height: ((mins(s.endAt) - mins(s.startAt)) / ((end - begin) * 60)) * 100 + '%',
                }
              : undefined
          }
        >
          <small>
            {time(s.startAt)}–{time(s.endAt)}
          </small>
          <b>{grid ? c.code : c.name}</b>
          <span>
            {sessionLabel(s)} · {s.room}
          </span>
          {tasks.some((t) => t.courseId === s.courseId) && (
            <strong className="pr-marker">
              {tasks.filter((t) => t.courseId === s.courseId).length} PR minggu ini
            </strong>
          )}
          {joined && !grid && (
            <small>
              <ChevronsRight size={12} /> Kelas bersambung
            </small>
          )}
        </Link>
      )
    })
  }
  return (
    <>
      <Header
        eyebrow="AGENDA SEMESTER"
        title="Jadwal kuliah."
        sub="Lihat jam, ruang, dan pertemuanmu dalam satu minggu."
        action={
          <Button color="sunny" onClick={() => setExtra(true)}>
            <CalendarPlus size={17} /> Tambah pertemuan
          </Button>
        }
      />
      <div className="week-tools">
        <div>
          <CalendarDays size={21} />
          <h2>
            {formatDay(start)} – {formatDay(dates[6])} {dates[6].slice(0, 4)}
          </h2>
        </div>
        <div className="actions">
          <Button aria-label="Minggu sebelumnya" onClick={() => setStart(addDays(start, -7))}>
            <ChevronLeft size={17} />
          </Button>
          <Button onClick={() => setStart(monday(today))}>Minggu ini</Button>
          <Button aria-label="Minggu berikutnya" onClick={() => setStart(addDays(start, 7))}>
            <ChevronRight size={17} />
          </Button>
        </div>
      </div>
      <Panel title="PR minggu ini" icon={<SquareCheckBig size={18} />}>
        {tasks.length ? (
          tasks.map((t) => (
            <Link className="list-item" key={t.id} to={'/pr?item=' + t.id}>
              <Badge course={w.courses.find((c) => c.id === t.courseId)} />
              <div className="grow">
                <strong>{t.title}</strong>
                <small>
                  Deadline {formatDay(day(t.dueAt), true)}
                  {t.dueHasTime ? ' · ' + time(t.dueAt) + ' WIB' : ''}
                </small>
              </div>
              <ChevronRight size={16} />
            </Link>
          ))
        ) : (
          <p>Belum ada PR aktif dengan deadline minggu ini.</p>
        )}
      </Panel>
      <div className="week-grid">
        <div className="axis">
          <div className="day-head">WIB</div>
          <div className="time-track">
            {hours.map((h) => (
              <span key={h} style={{ top: ((h - begin) / (end - begin)) * 100 + '%' }}>
                {String(h).padStart(2, '0')}.00
              </span>
            ))}
          </div>
        </div>
        {dates.map((d, i) => (
          <div key={d} className={'day-col ' + (d === today ? 'is-today' : '')}>
            <div className="day-head">
              <b>{days[i].slice(0, 3)}</b>
              <span>{formatDay(d)}</span>
              {tasks.some((t) => day(t.dueAt) === d) && (
                <small className="pr-marker">Deadline PR</small>
              )}
            </div>
            <div
              className="time-track"
              style={{ backgroundSize: '100% ' + 100 / (end - begin) + '%' }}
            >
              {cards(d, true)}
              {!week.some((s) => s.date === d) && <small className="free-label">Bebas</small>}
            </div>
          </div>
        ))}
      </div>
      <div className="week-mobile">
        {dates.map((d, i) => (
          <section
            key={d}
            id={'day-' + d}
            className={'day-card ' + (d === today ? 'is-today' : '')}
          >
            <div className="day-head">
              <strong>
                {days[i]} · {formatDay(d)}
              </strong>
              {tasks.some((t) => day(t.dueAt) === d) && <Chip color="blush">Deadline PR</Chip>}
              {d === today && <Chip color="sunny">Hari ini</Chip>}
              {i === 0 && week.filter((s) => s.date === d && s.status === 'normal').length > 1 && (
                <Chip color="blush">Hari padat</Chip>
              )}
            </div>
            {cards(d, false)}
            {!week.some((s) => s.date === d) && <small>Bebas</small>}
          </section>
        ))}
      </div>
      {week.some((s) => s.date === start) && (
        <p className="help">
          {week.filter((s) => s.date === start && s.status === 'normal').length > 1
            ? 'Senin · Hari padat. '
            : ''}
          Klik blok kelas untuk membuka pertemuan.
        </p>
      )}
      {extra && <ExtraSession onClose={() => setExtra(false)} />}
    </>
  )
}
export function Tasks() {
  const { w, now, task } = useApp(),
    [params] = useSearchParams(),
    id = params.get('item'),
    target = w.tasks.find((t) => t.id === id),
    [tab, setTab] = useState(target?.status === 'done' ? 'Selesai' : 'Aktif'),
    [course, setCourse] = useState('')
  const list = w.tasks
    .filter(
      (t) =>
        (!course || t.courseId === course) &&
        (tab === 'Aktif' ? t.status === 'todo' : t.status === 'done'),
    )
    .sort((a, b) =>
      tab === 'Aktif'
        ? a.dueAt.localeCompare(b.dueAt)
        : (b.completedAt ?? '').localeCompare(a.completedAt ?? ''),
    )
  useEffect(() => {
    if (target) setTab(target.status === 'done' ? 'Selesai' : 'Aktif')
  }, [id, target?.status])
  useEffect(() => {
    if (id) document.getElementById('item-' + id)?.scrollIntoView({ block: 'center' })
  }, [id, tab])
  return (
    <>
      <Header
        eyebrow="BUKU TUGAS"
        title="Daftar PR."
        sub="Cicil satu per satu, mulai dari deadline terdekat."
        action={
          <Button color="sunny" onClick={() => task()}>
            <Plus size={18} /> Tambah PR
          </Button>
        }
      />
      <div className="filter-bar">
        <Tabs items={['Aktif', 'Selesai']} value={tab} onChange={setTab} />
        <select
          aria-label="Filter mata kuliah"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          <option value="">Semua mata kuliah</option>
          {w.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </select>
      </div>
      {!list.length && (
        <Panel title={tab === 'Aktif' ? 'PR aktif' : 'PR selesai'}>
          <Empty
            title={tab === 'Aktif' ? 'Daftar PR kamu kosong.' : 'Belum ada PR selesai di sini.'}
            action={<Button onClick={() => task()}>Tambah PR</Button>}
          />
        </Panel>
      )}
      {(tab === 'Aktif'
        ? ['Terlambat', 'Hari ini', 'Besok', 'Minggu ini', 'Nanti']
        : ['Selesai']
      ).map((g) => {
        const group = list.filter((t) => tab === 'Selesai' || taskGroup(t, now) === g)
        return group.length ? (
          <Panel key={g} title={g + ' · ' + group.length} icon={<AlarmClock size={20} />}>
            {group.map((t) => (
              <TaskRow key={t.id} t={t} editable />
            ))}
          </Panel>
        ) : null
      })}
    </>
  )
}
