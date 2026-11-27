import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarCheck,
  Check,
  ClipboardList,
  Copy,
  Flame,
  LockKeyhole,
  Search,
  SquareCheckBig,
  Star,
} from 'lucide-react'
import { day, formatDay, sessionLabel, time, type Notice } from '../../../shared/model'
import type { Insights, Recap } from '../../../server/src/insights'
import { useApp } from '../app/context'
import { api, refresh, termQuery, msg } from '../lib/api'
import { needsHome, permission } from '../lib/push'
import {
  Alert,
  Badge,
  Button,
  Chip,
  Empty,
  Header,
  Loading,
  Locked,
  Panel,
  Tabs,
  useSubmit,
} from '../components/ui'
import { MascotCat } from '../components/Mascot'
function Metric({
  title,
  value,
  color,
  icon,
}: {
  title: string
  value: number
  color: string
  icon: React.ReactNode
}) {
  const number = useRef<HTMLElement>(null)
  const { p } = useApp()
  useGSAP(
    () => {
      const media = gsap.matchMedia()
      if (p.animationLevel === 'auto' || p.animationLevel === 'full') {
        media.add('(prefers-reduced-motion: no-preference)', () => {
          const count = { value: 0 }
          gsap.to(count, {
            value,
            duration: 0.8,
            ease: 'power3.out',
            onUpdate: () => {
              if (number.current) number.current.textContent = String(Math.round(count.value))
            },
          })
          return () => {
            if (number.current) number.current.textContent = String(value)
          }
        })
      }
      return () => media.revert()
    },
    { dependencies: [value, p.animationLevel], revertOnUpdate: true },
  )
  return (
    <div className={'metric bg-' + color}>
      {icon}
      <strong ref={number} aria-label={String(value)}>
        {value}
      </strong>
      <small>{title}</small>
    </div>
  )
}
export function StatsPage() {
  const { w, term } = useApp(),
    q = useQuery({
      queryKey: ['stats', term],
      queryFn: () => api<Insights>(termQuery('/stats', term)),
    }),
    [show, setShow] = useState(false)
  if (q.isPending) return <Loading />
  if (q.error) return <Alert>{q.error.message}</Alert>
  const d = q.data,
    lowest = w.courses.find((c) => c.id === d.lowest),
    max = Math.max(1, ...d.weeks.map((v) => v.count))
  return (
    <>
      <Header
        eyebrow="RITME BELAJAR"
        title="Statistik mencatat."
        sub="Lihat kebiasaanmu tumbuh dari satu hari kuliah ke hari berikutnya."
      />
      <div className="metrics">
        <Metric title="Streak sekarang" value={d.current} color="sunny" icon={<Flame />} />
        <Metric title="Streak terpanjang" value={d.longest} color="violet" icon={<Star />} />
        <Metric title="PR tepat waktu" value={d.onTime} color="teal" icon={<CalendarCheck />} />
        <Metric title="PR aktif" value={d.active} color="blush" icon={<ClipboardList />} />
      </div>
      <div className="reports-grid">
        <Panel title="10 hari kuliah terakhir" icon={<Flame size={19} />}>
          <div className="streak-days">
            {d.history.map((s) => (
              <span
                key={s.date}
                className={
                  'streak-day bg-' +
                  { Terpenuhi: 'teal', Berjalan: 'sunny', Tertunda: 'cream', Terlewat: 'coral' }[
                    s.state
                  ]
                }
              >
                <b>{formatDay(s.date)}</b>
                <small>{s.state}</small>
              </span>
            ))}
          </div>
          {!d.history.length && (
            <Empty title="Statistik dimulai pada hari kuliah yang kamu lacak." />
          )}
          <p className="help">
            Catat semua kelas pada hari itu, paling lambat dua hari sesudahnya.
          </p>
        </Panel>
        <Panel title="Cakupan catatan per MK">
          {d.coverage.map((v) => {
            const c = w.courses.find((c) => c.id === v.courseId)
            if (!c) return null
            return (
              <div className="coverage" key={c.id}>
                <div>
                  <Badge course={c} />
                  <small>
                    {v.count}/{v.total} pertemuan · {v.percent}%
                  </small>
                </div>
                <div className="progress">
                  <i className={'bg-' + c.color} style={{ width: v.percent + '%' }} />
                </div>
              </div>
            )
          })}
        </Panel>
        <Panel title="Catatan per minggu" icon={<BookOpen size={19} />}>
          <div className="bars">
            {d.weeks.map((v) => (
              <div key={v.start}>
                <span>{v.count}</span>
                <i style={{ height: (v.count / max) * 90 + 3 + 'px' }} />
                <small>{formatDay(v.start)}</small>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Progres PR" icon={<SquareCheckBig size={19} />}>
          <p>
            <strong>{d.onTime}</strong> selesai tepat waktu
          </p>
          <p>
            <strong>{d.late}</strong> selesai melewati deadline
          </p>
          <Link className="text-link" to="/pr">
            {d.active} PR masih aktif <ArrowRight size={15} />
          </Link>
        </Panel>
      </div>
      {lowest && (
        <Panel title="Mata kuliah paling jarang dicatat">
          <Badge course={lowest} />
          <h3>{lowest.name}</h3>
          <Button onClick={() => setShow(!show)}>Lihat pertemuan belum dicatat</Button>
          {show && (
            <div className="list">
              {w.sessions
                .filter(
                  (s) =>
                    s.courseId === lowest.id &&
                    s.status === 'normal' &&
                    s.tracked &&
                    Date.parse(s.startAt) <= Date.now() &&
                    !w.notes.some((n) => n.sessionId === s.id && n.isValid),
                )
                .map((s) => (
                  <Link key={s.id} className="list-item" to={'/pertemuan/' + s.id}>
                    {sessionLabel(s)} · {formatDay(s.date)} <ArrowRight size={15} />
                  </Link>
                ))}
            </div>
          )}
        </Panel>
      )}
    </>
  )
}
export function RecapPage() {
  const { w, term, toast } = useApp(),
    [mode, set] = useState('7d'),
    q = useQuery({
      queryKey: ['recap', term, mode],
      queryFn: () => api<Recap>(termQuery('/recap?mode=' + mode, term)),
    })
  const labels = ['7 hari terakhir', '5 hari kuliah terakhir']
  const d = q.data
  function recapText() {
    if (!d) return ''
    return [
      'Rekap KuliahKu · ' + formatDay(d.from) + ' – ' + formatDay(d.to),
      ...d.groups.flatMap((g) => {
        const c = w.courses.find((c) => c.id === g.courseId)
        if (!c) return []
        return [
          '',
          '' + c.code + ' · ' + c.name,
          g.recorded + '/' + g.sessions + ' pertemuan tercatat',
          ...(!g.hasValid ? ['Belum ada catatan'] : []),
          ...g.notes.map((n) => {
            const s = n.sessionId ? w.sessions.find((s) => s.id === n.sessionId) : undefined
            return (
              '• ' +
              n.title +
              ' · ' +
              (s ? sessionLabel(s) : 'Umum') +
              '\n  ' +
              n.body.split('\n').slice(0, 2).join(' ').slice(0, 180)
            )
          }),
          'PR selesai ' + g.done + ' · aktif ' + g.active + ' · terlambat ' + g.late,
        ]
      }),
    ].join('\n')
  }
  return (
    <>
      <Header
        eyebrow="TINJAU ULANG"
        title="Rekap mingguan."
        sub="Lihat apa yang sudah kamu catat dan selesaikan."
        action={
          <Button
            color="sunny"
            disabled={!d}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(recapText())
                toast('Rekap teks disalin.')
              } catch (e) {
                toast(msg(e), undefined, true)
              }
            }}
          >
            <Copy size={17} /> Salin rekap (teks)
          </Button>
        }
      />
      <Tabs
        items={labels}
        value={mode === '7d' ? labels[0] : labels[1]}
        onChange={(v) => set(v === labels[0] ? '7d' : '5class')}
      />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Alert>{q.error.message}</Alert>
      ) : (
        d && (
          <>
            <p className="range-label">
              {formatDay(d.from)} – {formatDay(d.to)}
              {mode === '5class' ? ' · ' + (d.dates?.length ?? 0) + ' hari kuliah' : ''}
            </p>
            <div className="metrics">
              <Metric
                title="Total catatan"
                value={d.groups.reduce((a, g) => a + g.notes.length, 0)}
                color="violet"
                icon={<BookOpen />}
              />
              <Metric
                title="Pertemuan tercatat"
                value={d.groups.reduce((a, g) => a + g.recorded, 0)}
                color="sky"
                icon={<CalendarCheck />}
              />
              <Metric
                title="PR selesai"
                value={d.groups.reduce((a, g) => a + g.done, 0)}
                color="teal"
                icon={<SquareCheckBig />}
              />
              <Metric title="Streak saat ini" value={d.streak} color="sunny" icon={<Flame />} />
            </div>
            <div className="reports-grid">
              {d.groups.map((g) => {
                const c = w.courses.find((c) => c.id === g.courseId)
                if (!c) return null
                return (
                  <Panel key={c.id} title={c.name} icon={<Badge course={c} />}>
                    <p>
                      {g.recorded} dari {g.sessions} pertemuan tercatat
                    </p>
                    {!g.hasValid && <Chip color="cream">Belum ada catatan</Chip>}
                    {g.notes.map((n) => {
                      const s = w.sessions.find((s) => s.id === n.sessionId)
                      return (
                        <Link className="note-entry" key={n.id} to={'/catatan/' + n.id}>
                          <strong>{n.title}</strong>
                          <small>
                            {s
                              ? sessionLabel(s) + ' · ' + formatDay(s.date)
                              : formatDay(day(n.updatedAt))}
                          </small>
                          <p>{n.body.split('\n').slice(0, 2).join(' ')}</p>
                          <small>
                            {JSON.parse(n.tagsJson)
                              .map((t: string) => '#' + t)
                              .join(' ')}
                          </small>
                        </Link>
                      )
                    })}
                    <p className="help">
                      PR · {g.done} selesai · {g.active} aktif · {g.late} terlambat
                    </p>
                  </Panel>
                )
              })}
            </div>
          </>
        )
      )}
      <Locked title="Rangkuman AI">Rangkuman dari isi catatanmu akan hadir di Fase 2.</Locked>
    </>
  )
}
type Hit = {
  type: string
  title: string
  text: string
  date: string
  meeting: string
  url: string
  courseId: string
}
function Mark({ s, q }: { s: string; q: string }) {
  const at = s.toLowerCase().indexOf(q.toLowerCase())
  return at < 0 || !q ? (
    <>{s}</>
  ) : (
    <>
      {s.slice(0, at)}
      <mark>{s.slice(at, at + q.length)}</mark>
      <Mark s={s.slice(at + q.length)} q={q} />
    </>
  )
}
export function SearchPage() {
  const { w, term } = useApp(),
    [input, set] = useState(''),
    [q, setQ] = useState(''),
    [type, setType] = useState(''),
    [course, setCourse] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 250)
    return () => clearTimeout(t)
  }, [input])
  const result = useQuery({
    queryKey: ['search', term, q, type, course],
    queryFn: () =>
      api<Hit[]>(termQuery('/search?' + new URLSearchParams({ q, type, courseId: course }), term)),
    enabled: !!q,
  })
  return (
    <>
      <Header
        eyebrow="INDEKS BELAJAR"
        title="Pencarian."
        sub="Temukan catatan, modul, PR, dan mata kuliah dari satu tempat."
      />
      <div className="search-field">
        <Search />
        <input
          id="global-query"
          autoFocus
          aria-label="Kata kunci"
          placeholder="Ketik kata kunci, mis. normalisasi…"
          value={input}
          onChange={(e) => set(e.target.value)}
        />
      </div>
      <div className="filter-bar">
        <select aria-label="Jenis hasil" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Semua jenis</option>
          {['Catatan', 'PR', 'Modul', 'Mata kuliah'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select aria-label="Mata kuliah" value={course} onChange={(e) => setCourse(e.target.value)}>
          <option value="">Semua mata kuliah</option>
          {w.courses.map((c) => (
            <option value={c.id} key={c.id}>
              {c.code}
            </option>
          ))}
        </select>
      </div>
      {!q ? (
        <Empty title="Mulai ketik untuk mencari di semester ini." />
      ) : result.isPending ? (
        <Loading />
      ) : result.error ? (
        <Alert>{result.error.message}</Alert>
      ) : !result.data.length ? (
        <Empty title={'Tidak ada hasil untuk “' + q + '”.'} />
      ) : (
        ['Catatan', 'PR', 'Modul', 'Mata kuliah'].map((t) => {
          const hits = result.data.filter((r) => r.type === t)
          return hits.length ? (
            <Panel title={t + ' · ' + hits.length} key={t}>
              {hits.map((h) => (
                <Link key={h.url} className="note-entry" to={h.url}>
                  <div className="row-meta">
                    <Badge course={w.courses.find((c) => c.id === h.courseId)} />
                    <small>
                      {h.meeting} {h.date && formatDay(h.date)}
                    </small>
                  </div>
                  <strong>
                    <Mark s={h.title} q={q} />
                  </strong>
                  <p>
                    <Mark s={h.text} q={q} />
                  </p>
                </Link>
              ))}
            </Panel>
          ) : null
        })
      )}
    </>
  )
}
export function Notifications() {
  const q = useQuery({
      queryKey: ['notices'],
      queryFn: () => api<Notice[]>('/notifications'),
      refetchInterval: 30000,
    }),
    nav = useNavigate(),
    save = useSubmit()
  return (
    <>
      <Header
        eyebrow="KOTAK MASUK"
        title="Pusat notifikasi."
        sub="Semua pengingat kelas, catatan, dan deadline kamu."
        action={
          <Button
            onClick={() =>
              save.run(async () => {
                await api('/notifications/read-all', 'POST')
                await refresh()
              })
            }
          >
            <Check size={16} /> Tandai semua dibaca
          </Button>
        }
      />
      {permission() !== 'Diizinkan' && (
        <div className="archive-banner">
          <span>
            {needsHome()
              ? 'Pasang ke Layar Utama melalui menu Bagikan Safari.'
              : 'Izin notifikasi browser · ' + permission() + '.'}
          </span>{' '}
          <Link to="/pengaturan">Atur notifikasi</Link>
        </div>
      )}
      <Panel title="Riwayat pengingat" icon={<Bell size={18} />}>
        {q.isPending ? (
          <Loading />
        ) : q.error ? (
          <Alert>{q.error.message}</Alert>
        ) : q.data.length ? (
          q.data.map((n) => (
            <button
              className={'notice-row ' + (!n.readAt ? 'unread' : '')}
              key={n.id}
              onClick={() =>
                save.run(async () => {
                  await api('/notifications/' + n.id + '/read', 'POST')
                  await refresh()
                  nav(n.url)
                })
              }
            >
              <span className="stamp bg-sunny">
                <Bell size={16} />
              </span>
              <span className="grow">
                <strong>{n.title}</strong>
                <span>{n.body}</span>
                <small>
                  {formatDay(day(n.firedAt))} · {time(n.firedAt)} WIB ·{' '}
                  {n.readAt ? 'Sudah dibaca' : 'Belum dibaca'}
                </small>
              </span>
              <ArrowRight size={16} />
            </button>
          ))
        ) : (
          <Empty title="Belum ada pengingat. Notifikasi baru akan muncul di sini." />
        )}
        {save.error && <Alert>{save.error}</Alert>}
      </Panel>
    </>
  )
}
export function Quiz() {
  const { p } = useApp()
  return (
    <>
      <Header eyebrow="LATIHAN BELAJAR" title="Kuis belajar." />
      <div className="quiz-cover">
        {p.mascotEnabled && <MascotCat state="read" level={p.animationLevel} name={p.mascotName} />}
        <Chip color="violet">
          <LockKeyhole size={14} /> Fase 2 · terkunci
        </Chip>
        <h2>Segera hadir</h2>
        <p>Kuis 10 soal otomatis dari catatanmu.</p>
      </div>
    </>
  )
}
