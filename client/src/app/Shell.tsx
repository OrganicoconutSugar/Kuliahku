import { Component, useState, useEffect, useRef, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  Layers3,
  NotebookPen,
  ListTodo,
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  LockKeyhole,
  Settings as Gear,
  Search,
  Bell,
  Plus,
  Menu,
  ChevronRight,
  GraduationCap,
  Check,
  X,
  Command,
  PanelLeft,
  TriangleAlert,
} from 'lucide-react'
import type { Settings, Workspace, Owner, Task, Notice } from '../../../shared/model'
import { AppContext, type CaptureContext } from './context'
import { api, ApiError, qc } from '../lib/api'
import { Loading, Alert, Brand, Modal, Button } from '../components/ui'
import { Capture, TaskForm } from '../features/Capture'
import { Onboarding } from '../features/Onboarding'
import { Dashboard, Schedule, Tasks } from '../features/Agenda'
import { Courses, CourseDetail, SessionDetail } from '../features/Courses'
import { Notes, Editor } from '../features/Notes'
import { RecapPage, StatsPage, SearchPage, Notifications, Quiz } from '../features/Reports'
import { Preferences } from '../features/Settings'
const navGroups = [
  {
    name: 'RUANG BELAJAR',
    items: [
      ['/hari-ini', 'Hari ini', LayoutDashboard],
      ['/jadwal', 'Jadwal', CalendarDays],
      ['/matkul', 'Mata kuliah', Layers3],
      ['/catatan', 'Catatan', NotebookPen],
      ['/pr', 'Daftar PR', ListTodo],
    ],
  },
  {
    name: 'PROGRES',
    items: [
      ['/rekap', 'Rekap mingguan', ClipboardList],
      ['/statistik', 'Statistik', ChartNoAxesColumnIncreasing],
      ['/kuis', 'Kuis belajar', LockKeyhole],
    ],
  },
  {
    name: 'PREFERENSI',
    items: [
      ['/notifikasi', 'Notifikasi', Bell],
      ['/pengaturan', 'Pengaturan', Gear],
    ],
  },
] as const
function Navigation({ close }: { close?: () => void }) {
  const path = useLocation().pathname
  return (
    <nav aria-label="Navigasi utama" className="nav-groups">
      {navGroups.map((g) => (
        <div key={g.name}>
          <p className="eyebrow">{g.name}</p>
          {g.items.map(([url, label, Icon]) => (
            <NavLink
              key={url}
              to={url}
              className={({ isActive }) =>
                'nav-item' + (isActive || (url === '/hari-ini' && path === '/') ? ' active' : '')
              }
              onClick={close}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}
class ErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }
  render() {
    if (this.state.error)
      return (
        <div className="panel">
          <Alert>Terjadi kendala saat menampilkan halaman ini.</Alert>
          <Button onClick={() => this.setState({ error: null })}>Coba lagi</Button>
        </div>
      )
    return this.props.children
  }
}
function Frame({
  children,
  openCapture,
  user,
  w,
}: {
  children: ReactNode
  openCapture: () => void
  user: Owner
  w: Workspace
}) {
  const [menu, showMenu] = useState(false),
    nav = useNavigate(),
    { pathname } = useLocation()
  const unread = useQuery({
    queryKey: ['notices'],
    queryFn: () => api<Notice[]>('/notifications'),
    refetchInterval: 60000,
  })
  const page =
    navGroups.flatMap((g) => [...g.items]).find(([p]) => pathname.startsWith(p))?.[1] ??
    (pathname.startsWith('/pertemuan')
      ? 'Pertemuan'
      : pathname === '/cari'
        ? 'Pencarian'
        : 'Hari ini')
  useEffect(() => {
    showMenu(false)
    window.scrollTo({ top: 0 })
  }, [pathname])
  return (
    <div className="app-shell">
      <a className="skip-link" href="#isi">
        Langsung ke isi
      </a>
      <aside className="sidebar">
        <Link to="/" className="side-brand">
          <Brand />
        </Link>
        <Navigation />
        <div className="side-bottom">
          <span className="stamp bg-violet">
            <GraduationCap size={19} />
          </span>
          <div>
            <small>
              SEMESTER {w.semester ? (w.semester.isActive ? 'AKTIF' : 'ARSIP') : 'BELUM DIPILIH'}
            </small>
            <strong>{w.semester?.name ?? 'Belum ada semester aktif'}</strong>
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="app-header">
          <div className="crumb">
            <PanelLeft size={17} />
            <span>Ruang belajar</span>
            <ChevronRight size={15} />
            <strong>{page}</strong>
          </div>
          <Link to="/" className="mobile-brand">
            <Brand />
          </Link>
          <div className="header-tools">
            <button
              className="search-button"
              aria-label="Cari di ruang belajar"
              onClick={() => nav('/cari')}
            >
              <Search size={17} />
              <span>Cari apa saja…</span>
              <kbd>
                <Command size={11} /> K
              </kbd>
            </button>
            <Link className="bell-btn" to="/notifikasi" aria-label="Pusat notifikasi">
              <Bell size={19} />
              {unread.data?.some((n) => !n.readAt) && <i />}
            </Link>
            <Link className="avatar" aria-label="Profil dan pengaturan" to="/pengaturan">
              {user.name.slice(0, 1).toUpperCase()}
            </Link>
          </div>
        </header>
        <main id="isi" className="page-content" key={pathname}>
          {w.semester && !w.semester.isActive && (
            <p className="archive-banner">
              Kamu sedang melihat arsip {w.semester.name}.{' '}
              <Link to="/pengaturan">Pilih semester</Link>
            </p>
          )}
          <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
        </main>
      </div>
      {w.semester && w.courses.length > 0 && (
        <Button
          color="sunny"
          className={
            'capture-fab ' + (pathname === '/' || pathname === '/hari-ini' ? 'wiggle' : '')
          }
          onClick={openCapture}
        >
          <Plus size={21} /> Quick Capture <kbd>C</kbd>
        </Button>
      )}
      <nav className="bottom-nav" aria-label="Navigasi ponsel">
        <NavLink
          to="/hari-ini"
          className={({ isActive }) => (isActive || pathname === '/' ? 'active' : '')}
        >
          <LayoutDashboard />
          Hari ini
        </NavLink>
        <NavLink to="/jadwal">
          <CalendarDays />
          Jadwal
        </NavLink>
        <button
          className="nav-capture"
          onClick={openCapture}
          disabled={!w.semester || !w.courses.length}
          aria-label="Quick Capture"
        >
          <Plus />
        </button>
        <NavLink to="/pr">
          <ListTodo />
          PR
        </NavLink>
        <button onClick={() => showMenu(true)}>
          <Menu />
          Menu
        </button>
      </nav>
      {menu && (
        <Modal title="Menu ruang belajar" onClose={() => showMenu(false)}>
          <Navigation close={() => showMenu(false)} />
        </Modal>
      )}
    </div>
  )
}
export function Protected() {
  const nav = useNavigate(),
    { pathname } = useLocation(),
    [term, choose] = useState<string | undefined>(
      () => sessionStorage.getItem('kuliahku:semester') || undefined,
    )
  const [capture, setCapture] = useState<CaptureContext | null>(null),
    [task, setTask] = useState<{ initial?: CaptureContext; existing?: Task } | null>(null),
    [now, setNow] = useState(new Date()),
    [cheering, cheer] = useState(false)
  const [toast, setToast] = useState<{ text: string; undo?: () => void; error?: boolean } | null>(
    null,
  )
  const prevStreak = useRef<number | undefined>(undefined)
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Owner>('/auth/me') })
  const w = useQuery({
    queryKey: ['work', term],
    queryFn: () =>
      api<Workspace>('/workspace' + (term ? '?semesterId=' + encodeURIComponent(term) : '')),
    enabled: !!me.data,
  })
  const p = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<Settings>('/settings'),
    enabled: !!me.data,
  })
  const setTerm = (id?: string) => {
    if (id) sessionStorage.setItem('kuliahku:semester', id)
    else sessionStorage.removeItem('kuliahku:semester')
    choose(id)
  }
  useEffect(() => {
    if (w.error instanceof ApiError && w.error.status === 404 && term) setTerm(undefined)
  }, [w.error, term])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.undo ? 5000 : 3300)
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => {
    if (!cheering) return
    const t = setTimeout(() => cheer(false), 1100)
    return () => clearTimeout(t)
  }, [cheering])
  useEffect(() => {
    const tick = () => setNow(new Date()),
      t = setInterval(tick, 30000)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  useEffect(() => {
    if (!p.data) return
    document.documentElement.dataset.motion = p.data.animationLevel
    return () => {
      delete document.documentElement.dataset.motion
    }
  }, [p.data])
  useEffect(() => {
    const cb = (e: KeyboardEvent) => {
      if (!w.data?.semester || pathname === '/onboarding' || document.querySelector('dialog[open]'))
        return
      const edit = (e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (!edit && e.key === '/')) {
        e.preventDefault()
        nav('/cari')
        document.getElementById('global-query')?.focus()
      } else if (
        w.data.courses.length &&
        !edit &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.toLowerCase() === 'c'
      ) {
        e.preventDefault()
        setCapture({})
      }
    }
    window.addEventListener('keydown', cb)
    return () => window.removeEventListener('keydown', cb)
  }, [nav, pathname, w.data?.semester])
  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.data?.type === 'push') {
        setToast({ text: e.data.title + ' · ' + e.data.body })
        void qc.invalidateQueries({ queryKey: ['notices'] })
      }
    }
    navigator.serviceWorker?.addEventListener('message', listener)
    return () => navigator.serviceWorker?.removeEventListener('message', listener)
  }, [])
  useEffect(() => {
    prevStreak.current = undefined
    const listener = (e: Event) => {
      const n = (e as CustomEvent<number>).detail
      if (prevStreak.current !== undefined && n > prevStreak.current) cheer(true)
      prevStreak.current = n
    }
    window.addEventListener('kuliahku:streak', listener)
    return () => window.removeEventListener('kuliahku:streak', listener)
  }, [term])
  if (me.error instanceof ApiError && me.error.status === 401)
    return <Navigate to="/login" replace />
  const err = me.error || w.error || p.error
  if (err)
    return (
      <div className="standalone">
        <Alert>{err.message}</Alert>
        <Button
          onClick={() => {
            void me.refetch()
            void w.refetch()
            void p.refetch()
          }}
        >
          Coba lagi
        </Button>
      </div>
    )
  if (!me.data || !w.data || !p.data) return <Loading />
  if (
    !w.data.semester &&
    pathname !== '/onboarding' &&
    !(pathname === '/pengaturan' && w.data.semesters.length)
  )
    return <Navigate to="/onboarding" replace />
  return (
    <AppContext.Provider
      value={{
        user: me.data,
        w: w.data,
        p: p.data,
        term,
        setTerm,
        toast: (text, undo, error) => setToast({ text, undo, error }),
        capture: (v = {}) => setCapture(v),
        task: (initial, existing) => setTask({ initial, existing }),
        celebrate: () => cheer(true),
        cheering,
        now,
      }}
    >
      {pathname === '/onboarding' ? (
        <Onboarding />
      ) : (
        <Frame user={me.data} w={w.data} openCapture={() => setCapture({})}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/hari-ini" element={<Dashboard />} />
            <Route path="/jadwal" element={<Schedule />} />
            <Route path="/matkul" element={<Courses />} />
            <Route path="/matkul/:id" element={<CourseDetail />} />
            <Route path="/pertemuan/:id" element={<SessionDetail />} />
            <Route path="/catatan" element={<Notes />} />
            <Route path="/catatan/:id" element={<Editor />} />
            <Route path="/pr" element={<Tasks />} />
            <Route path="/statistik" element={<StatsPage />} />
            <Route path="/rekap" element={<RecapPage />} />
            <Route path="/kuis" element={<Quiz />} />
            <Route path="/cari" element={<SearchPage />} />
            <Route path="/notifikasi" element={<Notifications />} />
            <Route path="/pengaturan" element={<Preferences />} />
            <Route
              path="*"
              element={
                <div className="panel">
                  <h1>Halaman tidak ditemukan.</h1>
                  <Link to="/">Kembali ke hari ini</Link>
                </div>
              }
            />
          </Routes>
        </Frame>
      )}
      {capture && <Capture initial={capture} onClose={() => setCapture(null)} />}{' '}
      {task && <TaskForm {...task} onClose={() => setTask(null)} />}
      {cheering && !pathname.startsWith('/catatan/') && (
        <div className="celebration" aria-hidden="true">
          {['coral', 'teal', 'sunny', 'violet', 'sky', 'tangerine'].map((c, i) => (
            <i
              className={'bg-' + c}
              key={c}
              style={{ '--angle': i * 60 - 75 + 'deg' } as React.CSSProperties}
            />
          ))}
        </div>
      )}
      {toast && (
        <div role="status" className={'toast ' + (toast.error ? 'bg-coral' : 'bg-teal')}>
          {toast.error ? <TriangleAlert size={18} /> : <Check size={18} />}
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo?.()
                setToast(null)
              }}
            >
              Batalkan
            </button>
          )}
          <button aria-label="Tutup pesan" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  )
}
