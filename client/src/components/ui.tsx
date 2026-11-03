import {
  useContext,
  useEffect,
  useRef,
  useState,
  useId,
  type ReactNode,
  type ButtonHTMLAttributes,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  ArrowUpRight,
  X,
  Inbox,
  AlertTriangle,
  LoaderCircle,
  NotebookPen,
  Shapes,
} from 'lucide-react'
import type { Course } from '../../../shared/model'
import { AppContext } from '../app/context'
import { MascotCat } from './Mascot'
import { msg } from '../lib/api'
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <NotebookPen size={24} strokeWidth={2.5} />
      </span>
      Kuliah<span className="brand-ku">Ku</span>
      <i>.</i>
    </span>
  )
}
export function Button({
  color = 'paper',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { color?: string }) {
  return (
    <button type="button" className={'brut-btn bg-' + color + ' ' + className} {...props}>
      {children}
    </button>
  )
}
export function Chip({ children, color = 'paper' }: { children: ReactNode; color?: string }) {
  return <span className={'chip bg-' + color}>{children}</span>
}
export function Badge({ course }: { course?: Course }) {
  return course ? <Chip color={course.color}>{course.code}</Chip> : null
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}
export function Alert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="alert">
      <AlertTriangle size={17} />
      <span>{children}</span>
    </div>
  )
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Memuat ruang belajarmu…
    </div>
  )
}
export function Empty({ title, action }: { title: string; action?: ReactNode }) {
  const app = useContext(AppContext)
  return (
    <div className="empty">
      {app?.p.mascotEnabled ? (
        <MascotCat small state="peek" name={app.p.mascotName} level={app.p.animationLevel} />
      ) : (
        <span className="empty-icon">
          <Inbox size={22} />
        </span>
      )}
      <p>{title}</p>
      {action}
    </div>
  )
}
export function Header({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string
  title: string
  sub?: string
  action?: ReactNode
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && (
          <div className="eyebrow">
            <span className="line" />
            {eyebrow}
          </div>
        )}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  )
}
export function Panel({
  title,
  to,
  icon,
  children,
  className = '',
  linkText = 'Lihat semua',
}: {
  title: string
  to?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  linkText?: string
}) {
  return (
    <section className={'panel ' + className}>
      <div className="panel-heading">
        <h2>
          {icon || <BookOpen size={20} />} {title}
        </h2>
        {to && (
          <Link className="text-link" to={to}>
            {linkText} <ArrowUpRight size={15} />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="tabs" aria-label="Pilihan tampilan">
      {items.map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={value === t}
          className={t === value ? 'selected' : ''}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId()
  useEffect(() => {
    const d = ref.current!
    d.showModal()
    const focused = document.activeElement
    return () => {
      d.close()
      if (focused instanceof HTMLElement) focused.blur()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={'modal' + (wide ? ' wide' : '')}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current!.getBoundingClientRect()
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose()
        }
      }}
    >
      <div className="modal-head">
        <h2 id={id}>{title}</h2>
        <button type="button" className="icon-btn" aria-label="Tutup" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function useSubmit() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const lock = useRef(false)
  async function run(fn: () => Promise<unknown>, e?: FormEvent) {
    e?.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(msg(err))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return { busy, error, run, setError }
}
export function Locked({ title, children }: { title: string; children: ReactNode }) {
  const app = useContext(AppContext)
  return (
    <div className="locked">
      {app?.p.mascotEnabled ? (
        <MascotCat small state="read" name={app.p.mascotName} level={app.p.animationLevel} />
      ) : (
        <span className="stamp bg-violet">
          <Shapes />
        </span>
      )}
      <div>
        <span className="eyebrow">FASE 2 · TERKUNCI</span>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  )
}
