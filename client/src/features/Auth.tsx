import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowUpRight,
  NotebookTabs,
  CalendarDays,
  SquareCheckBig,
  KeyRound,
  Star,
  Mail,
  UserRound,
  BookOpenText,
} from 'lucide-react'
import { setupInput, loginInput } from '../../../shared/validation'
import { day, formatDay, type Owner } from '../../../shared/model'
import { Brand, Button, Field, Alert, Loading, useSubmit } from '../components/ui'
import { MascotCat, Spark } from '../components/Mascot'
import { api, qc } from '../lib/api'
function Cover() {
  return (
    <div className="cover-wrap">
      <article className="cover">
        <div className="cover-hatch" aria-hidden="true" />
        <div className="cover-binding" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <i key={i} />
          ))}
        </div>
        <div className="cover-print">
          <div className="cover-top">
            <span className="cover-stamp">
              <Star size={13} fill="currentColor" /> EDISI MAHASISWA
            </span>
            <span className="mono">VOL. 01</span>
          </div>
          <h1>
            Kuliahmu,
            <br />
            <em>lebih rapi.</em>
          </h1>
          <p>
            Satu tempat buat jadwal, catatan,
            <br className="desktop-only" /> dan PR kamu.
          </p>
          <div className="cover-art">
            <Spark className="sp-one" />
            <Spark className="sp-two" />
            <span className="pixel-dot" />
            <div className="cat-caption">
              ini Mochi!
              <svg viewBox="0 0 54 25" fill="none" aria-hidden="true">
                <path
                  d="M2 4q29 25 49 4m-10 0 11-2-2 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <MascotCat />
          </div>
          <div className="cover-bottom">
            <span className="mono">BUKU AGENDA / KULIAHKU</span>
            <span className="swatches" aria-hidden="true">
              {['coral', 'violet', 'teal', 'sunny', 'sky', 'tangerine'].map((c) => (
                <i key={c} className={'bg-' + c} />
              ))}
            </span>
          </div>
        </div>
      </article>
      <span className="cover-tab tab-a" aria-hidden="true" />
      <span className="cover-tab tab-b" aria-hidden="true" />
    </div>
  )
}
export function Auth({ setupRoute = false }: { setupRoute?: boolean }) {
  const status = useQuery({
    queryKey: ['status'],
    queryFn: () => api<{ setupAvailable: boolean }>('/auth/status'),
  })
  if (status.isPending) return <Loading />
  if (status.error)
    return (
      <div className="standalone">
        <Alert>{status.error.message}</Alert>
        <Button onClick={() => status.refetch()}>Coba lagi</Button>
      </div>
    )
  if (setupRoute && !status.data.setupAvailable)
    return (
      <div className="standalone">
        <Brand />
        <h1>Setup sudah ditutup.</h1>
        <Link className="brut-btn bg-sunny" to="/login">
          Masuk ke KuliahKu <ArrowRight />
        </Link>
      </div>
    )
  return (
    <Entry key={String(setupRoute)} setup={setupRoute} available={status.data.setupAvailable} />
  )
}
function Entry({ setup, available }: { setup: boolean; available: boolean }) {
  const nav = useNavigate(),
    [visible, show] = useState(false),
    save = useSubmit(),
    firstRun = available && !setup
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ name?: string; email: string; password: string }>({
    resolver: zodResolver(setup ? setupInput : loginInput),
  })
  return (
    <div className="auth-page">
      <header className="public-header">
        <div className="public-bar">
          <div className="brand-line">
            <Brand />
            <span className="brand-descriptor">Agenda mahasiswa</span>
          </div>
          <span className="private-pill">
            <i /> Ruang pribadi <LockKeyhole size={13} />
          </span>
        </div>
      </header>
      <main className="welcome">
        <div className="welcome-meta">
          <span>
            <span className="mini-cross">✳</span> RUANG BELAJAR
          </span>
          <span>
            {formatDay(day(), true)} <i /> WIB
          </span>
        </div>
        <div className="welcome-grid">
          <Cover />
          <section className="entry-card">
            <div className="entry-accent" />
            <div className="entry-kicker">
              <span className="stamp bg-violet">
                <KeyRound size={23} />
              </span>
              <span className="mono">{setup ? 'AKSES PEMILIK' : 'AKSES PRIBADI'}</span>
            </div>
            <h2>{setup ? 'Buat akunmu.' : firstRun ? 'Mulai di sini.' : 'Selamat datang!'}</h2>
            <p>
              {setup
                ? 'Siapkan akun pribadi untuk mulai menyusun semester kamu.'
                : firstRun
                  ? 'Siapkan buku agenda pribadimu dalam tiga langkah.'
                  : 'Masuk ke ruang belajarmu dan lanjutkan agenda hari ini.'}
            </p>
            {firstRun ? (
              <div className="first-steps">
                <ol>
                  {[
                    ['Akun pemilik', 'Pilih nama, email, dan kata sandi.'],
                    ['Semester kamu', 'Isi tanggal dan pilih mata kuliah.'],
                    ['Pengingat kelas', 'Aktifkan notifikasi saat kamu siap.'],
                  ].map(([t, d], i) => (
                    <li key={t}>
                      <span className={'stamp bg-' + ['violet', 'teal', 'blush'][i]}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <strong>{t}</strong>
                        <small>{d}</small>
                      </div>
                    </li>
                  ))}
                </ol>
                <Link className="brut-btn bg-sunny submit-main" to="/setup">
                  Buat akun pertama <ArrowRight size={18} />
                </Link>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit((v) =>
                  save.run(async () => {
                    const user = await api<Owner>(setup ? '/auth/setup' : '/auth/login', 'POST', v)
                    qc.clear()
                    qc.setQueryData(['me'], user)
                    nav(setup ? '/onboarding' : '/', { replace: true })
                  }),
                )}
              >
                {setup && (
                  <Field label="Nama panggilan">
                    <div className="input-icon">
                      <UserRound />
                      <input
                        {...register('name')}
                        autoComplete="given-name"
                        placeholder="Kamu biasa dipanggil apa?"
                        required
                        maxLength={80}
                      />
                    </div>
                  </Field>
                )}
                <Field label="Email">
                  <div className="input-icon">
                    <Mail />
                    <input
                      {...register('email')}
                      type="email"
                      autoComplete="email"
                      placeholder="nama@email.com"
                      required
                    />
                  </div>
                </Field>
                <Field label="Kata sandi">
                  <div className="input-icon">
                    <LockKeyhole />
                    <input
                      {...register('password')}
                      type={visible ? 'text' : 'password'}
                      placeholder={setup ? 'Minimal 8 karakter' : 'Masukkan kata sandi'}
                      autoComplete={setup ? 'new-password' : 'current-password'}
                      required
                      minLength={setup ? 8 : 1}
                    />
                    <button
                      type="button"
                      aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                      onClick={() => show(!visible)}
                    >
                      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </Field>
                {(save.error || Object.values(errors)[0]?.message) && (
                  <Alert>{save.error || Object.values(errors)[0]?.message}</Alert>
                )}
                <Button type="submit" color="sunny" className="submit-main" disabled={save.busy}>
                  {save.busy ? 'Sebentar…' : setup ? 'Buat akun & lanjut' : 'Masuk ke KuliahKu'}
                  <ArrowRight size={19} />
                </Button>
              </form>
            )}
            <div className="entry-foot">
              <LockKeyhole size={14} />
              <span>Hanya kamu yang bisa mengakses data kuliahmu.</span>
            </div>
          </section>
        </div>
        <div className="feature-strip">
          {[
            [CalendarDays, 'violet', 'Jadwal kuliah', 'Jam dan ruang kelas.'],
            [BookOpenText, 'teal', 'Catatan pertemuan', 'Materi dalam satu tempat.'],
            [SquareCheckBig, 'coral', 'Pengingat PR', 'Pantau tugas dan deadline.'],
          ].map(([Icon, color, title, desc]) => {
            const I = Icon as typeof NotebookTabs
            return (
              <div key={String(title)}>
                <span className={'stamp bg-' + String(color)}>
                  <I size={22} />
                </span>
                <span>
                  <strong>{String(title)}</strong>
                  <small>{String(desc)}</small>
                </span>
              </div>
            )
          })}
        </div>
      </main>
      <footer className="public-footer">
        <span>
          <NotebookTabs size={14} /> KuliahKu · Agenda pribadi
        </span>
        <span>
          Dibuat untuk ritme kuliahmu <ArrowUpRight size={14} />
        </span>
      </footer>
    </div>
  )
}
