import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Layers3,
  Plus,
  Trash2,
  Pencil,
  Bell,
  Check,
  BookOpen,
} from 'lucide-react'
import { day, days } from '../../../shared/model'
import { validSemester, type CourseInput } from '../../../shared/validation'
import { api, refresh } from '../lib/api'
import { enablePush, permission } from '../lib/push'
import { useApp } from '../app/context'
import { Brand, Button, Field, Alert, Chip, useSubmit } from '../components/ui'
import { MascotCat } from '../components/Mascot'
import { CourseForm, blankCourse } from './CourseForm'
export function Onboarding() {
  const { user, w, p, setTerm } = useApp(),
    nav = useNavigate(),
    [step, setStep] = useState(0),
    [form, setForm] = useState({
      name: '',
      startDate: '',
      endDate: '',
      trackingStart: day(),
      totalMeetings: 16,
    }),
    [courses, setCourses] = useState<CourseInput[]>([]),
    [editing, setEditing] = useState<number | null>(null),
    [perm, setPerm] = useState(permission()),
    save = useSubmit()
  const steps = ['Semester', 'Mata kuliah', 'Notifikasi', 'Siap mulai']
  const next = async () => {
    if (step === 0 && !form.name.trim()) throw new Error('Nama semester wajib diisi.')
    if (step === 0 && !validSemester(form))
      throw new Error(
        'Tanggal selesai harus sesudah tanggal mulai dan rentang maksimal tiga tahun.',
      )
    if (step === 1 && !courses.length) throw new Error('Tambahkan minimal satu mata kuliah dulu.')
    if (step === 3) {
      await api('/semesters', 'POST', { ...form, courses })
      setTerm(undefined)
      await refresh()
      nav('/', { replace: true })
    } else setStep(step + 1)
  }
  return (
    <div className="wizard-page">
      <header className="public-header">
        <div className="public-bar">
          <Brand />
          <span className="private-pill">
            <i /> Setup semester
          </span>
        </div>
      </header>
      <main className="wizard-wrap">
        <aside className="wizard-side">
          <div className="eyebrow">BUKU AGENDA</div>
          <h1>
            Semester
            <br />
            barumu.
          </h1>
          <p>Siapkan ruang belajar yang pas buat jadwal kamu.</p>
          <ol>
            {steps.map((s, i) => (
              <li key={s} className={i === step ? 'active' : ''}>
                <span>{i < step ? <Check size={16} /> : String(i + 1).padStart(2, '0')}</span>
                {s}
              </li>
            ))}
          </ol>
          {w.semesters.length > 0 && (
            <Link to="/pengaturan" className="text-link">
              <ArrowLeft size={15} /> Kembali ke pengaturan
            </Link>
          )}
        </aside>
        <section className="entry-card wizard-main">
          <Chip color="sunny">Langkah {step + 1} dari 4</Chip>
          <h2>
            {
              [
                'Kenali semestermu.',
                'Susun mata kuliah.',
                'Mau diingatkan?',
                'Siap belajar, ' + user.name + '!',
              ][step]
            }
          </h2>
          <p>
            {
              [
                'Isi tanggal sesuai kalender akademik kampusmu.',
                'Pakai jadwal contoh 6 mata kuliah (20 SKS), atau susun sendiri.',
                'Pengingat kelas dan PR bisa muncul meski tab ditutup.',
                'Periksa ringkasan ini, lalu buka agenda semester kamu.',
              ][step]
            }
          </p>
          <form className="form-stack" onSubmit={(e) => save.run(next, e)}>
            {step === 0 && (
              <>
                <Field label="Nama semester">
                  <input
                    autoFocus
                    required
                    maxLength={120}
                    placeholder="Mis. Semester Ganjil 2026/2027"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Tanggal mulai kuliah">
                    <input
                      type="date"
                      required
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    />
                  </Field>
                  <Field label="Tanggal selesai">
                    <input
                      type="date"
                      min={form.startDate}
                      required
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="form-grid">
                  <Field label="Pertemuan per MK">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={form.totalMeetings}
                      onChange={(e) => setForm({ ...form, totalMeetings: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Mulai lacak dari tanggal">
                    <input
                      type="date"
                      required
                      value={form.trackingStart}
                      onChange={(e) => setForm({ ...form, trackingStart: e.target.value })}
                    />
                  </Field>
                </div>
                <p className="help">
                  Kelas sebelumnya tetap ada di jadwal. Statistik dimulai dari tanggal pelacakan.
                </p>
              </>
            )}
            {step === 1 && (
              <>
                <div className="actions">
                  {!courses.length && (
                    <Button
                      color="teal"
                      disabled={save.busy}
                      onClick={() =>
                        save.run(async () =>
                          setCourses(await api<CourseInput[]>('/onboarding/example')),
                        )
                      }
                    >
                      <Layers3 size={17} /> Pakai jadwal contoh
                    </Button>
                  )}
                  <Button disabled={courses.length >= 6} onClick={() => setEditing(-1)}>
                    <Plus size={17} /> Tambah MK
                  </Button>
                </div>
                <div className="list">
                  {courses.map((c, i) => (
                    <div className="list-item" key={i}>
                      <span className={'course-dot bg-' + c.color} />
                      <div className="grow">
                        <strong>{c.name}</strong>
                        <small>
                          {c.code} · {c.sks} SKS ·{' '}
                          {c.schedules.map((s) => days[s.dayOfWeek - 1]).join(', ')}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={'Ubah ' + c.code}
                        onClick={() => setEditing(i)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={'Hapus ' + c.code}
                        onClick={() => setCourses(courses.filter((_, j) => i !== j))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {step === 2 && (
              <div className="notice-box">
                <Bell size={28} />
                <strong>Izin notifikasi · {perm}</strong>
                <p>
                  {perm === 'Tambahkan ke Layar Utama'
                    ? 'Di Safari, pilih Bagikan → Tambah ke Layar Utama, lalu buka dari ikonnya.'
                    : 'Kamu juga bisa mengaktifkannya nanti dari Pengaturan.'}
                </p>
                <Button
                  onClick={() =>
                    save.run(async () => {
                      await enablePush()
                      setPerm(permission())
                    })
                  }
                >
                  Aktifkan notifikasi
                </Button>
              </div>
            )}
            {step === 3 && (
              <div className="wizard-summary">
                {p.mascotEnabled && (
                  <MascotCat state="peek" name={p.mascotName} level={p.animationLevel} />
                )}
                <h3>{form.name}</h3>
                <p>
                  <CalendarDays size={16} /> {form.startDate} sampai {form.endDate}
                </p>
                <p>
                  <BookOpen size={16} /> {courses.length} mata kuliah ·{' '}
                  {courses.reduce((a, c) => a + c.sks, 0)} SKS
                </p>
                {w.semester && <p>Semester {w.semester.name} akan tersimpan di arsip.</p>}
              </div>
            )}
            {save.error && <Alert>{save.error}</Alert>}
            <div className="actions wizard-actions">
              {step > 0 && (
                <Button
                  onClick={() => {
                    save.setError('')
                    setStep(step - 1)
                  }}
                >
                  <ArrowLeft size={15} /> Kembali
                </Button>
              )}
              <Button type="submit" color="sunny" disabled={save.busy}>
                {save.busy
                  ? 'Sebentar…'
                  : step === 3
                    ? 'Buka dashboard'
                    : step === 2
                      ? 'Lanjut ke ringkasan'
                      : 'Lanjut'}
                <ArrowRight size={17} />
              </Button>
            </div>
          </form>
        </section>
      </main>
      {editing !== null && (
        <CourseForm
          initial={editing < 0 ? blankCourse(courses.map((c) => c.color)) : courses[editing]}
          used={courses.filter((_, i) => i !== editing).map((c) => c.color)}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            if (courses.some((c, i) => i !== editing && c.code === v.code))
              throw new Error('Kode MK sudah digunakan.')
            setCourses(
              editing < 0 ? [...courses, v] : courses.map((c, i) => (i === editing ? v : c)),
            )
          }}
        />
      )}
    </div>
  )
}
