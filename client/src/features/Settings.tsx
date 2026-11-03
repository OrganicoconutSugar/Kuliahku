import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  Archive,
  Bell,
  CalendarDays,
  Download,
  FileDown,
  KeyRound,
  LogOut,
  MonitorSmartphone,
  Palette,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react'
import { days, day, formatDay, type Settings } from '../../../shared/model'
import { useApp } from '../app/context'
import { api, qc, refresh, termQuery } from '../lib/api'
import { enablePush, needsHome, permission } from '../lib/push'
import { Alert, Button, Chip, Field, Header, Modal, Panel, Tabs, useSubmit } from '../components/ui'
function Toggle({
  label,
  value,
  set,
}: {
  label: string
  value: boolean
  set: (v: boolean) => void
}) {
  return (
    <label className="toggle-field">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  )
}
export function Preferences() {
  const { user, w, p, term, setTerm, toast } = useApp(),
    nav = useNavigate(),
    save = useSubmit(),
    [tab, setTab] = useState('Profil'),
    [name, setName] = useState(user.name),
    [pwd, setPwd] = useState({ current: '', password: '' }),
    [v, set] = useState<Settings>(p),
    [archive, setArchive] = useState(false),
    [exporter, setExporter] = useState(false)
  const [sem, S] = useState(() =>
    w.semester
      ? {
          name: w.semester.name,
          startDate: w.semester.startDate,
          endDate: w.semester.endDate,
          totalMeetings: w.semester.totalMeetings,
          trackingStart: w.semester.trackingStart,
        }
      : null,
  )
  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => api<{ id: string; userAgent: string; createdAt: string }[]>('/push/devices'),
    enabled: tab === 'Notifikasi',
  })
  const [perm, setPerm] = useState(permission()),
    [opts, setOpts] = useState({ schedule: true, tasks: false, alarm: '30' })
  const updateSettings = async () => {
    const { userId: _userId, ...data } = v
    await api('/settings', 'PATCH', data)
    await refresh()
    toast('Pengaturan tersimpan.')
  }
  const pushOn = async () => {
    try {
      await enablePush()
      toast('Perangkat ini siap menerima pengingat.')
      await devices.refetch()
    } finally {
      setPerm(permission())
    }
  }
  return (
    <>
      <Header
        eyebrow="RUANG PRIBADI"
        title="Pengaturan."
        sub="Sesuaikan akun, semester, dan cara KuliahKu menemanimu."
      />
      <Tabs
        items={['Profil', 'Semester', 'Notifikasi', 'Tampilan', 'Data']}
        value={tab}
        onChange={(t) => {
          save.setError('')
          setTab(t)
        }}
      />
      {save.error && <Alert>{save.error}</Alert>}
      {tab === 'Profil' && (
        <div className="settings-grid">
          <Panel title="Profil pemilik" icon={<UserRound size={19} />}>
            <form
              className="form-stack"
              onSubmit={(e) =>
                save.run(async () => {
                  await api('/auth/profile', 'PATCH', { name })
                  await qc.invalidateQueries({ queryKey: ['me'] })
                  toast('Nama panggilan diperbarui.')
                }, e)
              }
            >
              <Field label="Nama panggilan">
                <input
                  value={name}
                  required
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Email">
                <input readOnly value={user.email} />
              </Field>
              <Button type="submit" color="sunny" disabled={save.busy}>
                Simpan profil
              </Button>
            </form>
          </Panel>
          <Panel title="Ganti kata sandi" icon={<KeyRound size={19} />}>
            <form
              className="form-stack"
              onSubmit={(e) =>
                save.run(async () => {
                  await api('/auth/password', 'POST', pwd)
                  setPwd({ current: '', password: '' })
                  toast('Kata sandi diperbarui.')
                }, e)
              }
            >
              <Field label="Kata sandi saat ini">
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={pwd.current}
                  onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
                />
              </Field>
              <Field label="Kata sandi baru">
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={pwd.password}
                  onChange={(e) => setPwd({ ...pwd, password: e.target.value })}
                />
              </Field>
              <Button type="submit" disabled={save.busy}>
                Ganti kata sandi
              </Button>
            </form>
          </Panel>
          <Button
            onClick={() =>
              save.run(async () => {
                await api('/auth/logout', 'POST')
                sessionStorage.removeItem('kuliahku:semester')
                qc.clear()
                nav('/login', { replace: true })
              })
            }
          >
            <LogOut size={16} /> Keluar dari akun
          </Button>
        </div>
      )}
      {tab === 'Semester' && (
        <div className="settings-grid">
          <Panel title="Semester yang dibuka" icon={<CalendarDays size={19} />}>
            <div className="form-stack">
              <Field label="Pilih semester atau arsip">
                <select
                  value={w.semester?.id ?? ''}
                  onChange={(e) => {
                    setTerm(e.target.value)
                    nav('/hari-ini')
                  }}
                >
                  <option value="" disabled>
                    Pilih semester
                  </option>
                  {w.semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.isActive ? 'Aktif' : 'Arsip'}
                    </option>
                  ))}
                </select>
              </Field>
              <Link className="brut-btn bg-sunny" to="/onboarding">
                <Plus size={16} /> Buat semester baru
              </Link>
              {w.semester?.isActive && (
                <Button onClick={() => setArchive(true)}>
                  <Archive size={16} /> Arsipkan semester
                </Button>
              )}
            </div>
          </Panel>
          {sem && (
            <Panel title="Tanggal dan pelacakan">
              <form
                className="form-stack"
                onSubmit={(e) =>
                  save.run(async () => {
                    await api('/semesters/' + w.semester!.id, 'PATCH', sem)
                    await refresh()
                    toast('Semester diperbarui.')
                  }, e)
                }
              >
                <Field label="Nama semester">
                  <input
                    required
                    value={sem.name}
                    onChange={(e) => S({ ...sem, name: e.target.value })}
                  />
                </Field>
                <div className="form-grid">
                  {(['startDate', 'endDate'] as const).map((k, i) => (
                    <Field key={k} label={i ? 'Tanggal selesai' : 'Tanggal mulai'}>
                      <input
                        type="date"
                        required
                        value={sem[k]}
                        onChange={(e) => S({ ...sem, [k]: e.target.value })}
                      />
                    </Field>
                  ))}
                </div>
                <Field label="Mulai lacak dari tanggal">
                  <input
                    type="date"
                    required
                    value={sem.trackingStart}
                    onChange={(e) => S({ ...sem, trackingStart: e.target.value })}
                  />
                </Field>
                {sem.trackingStart < w.semester!.trackingStart && (
                  <p className="notice-box">
                    Memundurkan tanggal pelacakan akan memasukkan pertemuan lama ke statistik dan
                    streak.
                  </p>
                )}
                <Field label="Jumlah pertemuan">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={sem.totalMeetings}
                    onChange={(e) => S({ ...sem, totalMeetings: Number(e.target.value) })}
                  />
                </Field>
                <Button type="submit" color="sunny" disabled={save.busy}>
                  Simpan semester
                </Button>
              </form>
            </Panel>
          )}
        </div>
      )}
      {tab === 'Notifikasi' && (
        <div className="settings-grid">
          <div>
            <Panel title="Izin dan perangkat" icon={<MonitorSmartphone size={19} />}>
              <Chip color="sunny">{perm}</Chip>
              <p>
                {needsHome()
                  ? 'iPhone/iPad: di Safari pilih Bagikan → Tambah ke Layar Utama, lalu buka aplikasi dari ikonnya.'
                  : perm === 'Ditolak'
                    ? 'Buka pengaturan situs di browser, izinkan notifikasi, lalu aktifkan perangkat ini.'
                    : 'Aktifkan pengingat pada setiap perangkat yang ingin kamu pakai.'}
              </p>
              <div className="actions">
                <Button color="teal" disabled={save.busy} onClick={() => save.run(pushOn)}>
                  Aktifkan notifikasi
                </Button>
                <Button
                  disabled={save.busy}
                  onClick={() =>
                    save.run(async () => {
                      const r = await api<{ delivered: number }>('/push/test', 'POST')
                      await refresh()
                      toast(
                        r.delivered
                          ? 'Layanan push menerima notifikasi uji.'
                          : 'Uji tercatat di Pusat Notifikasi. Belum ada perangkat yang menerima push.',
                      )
                    })
                  }
                >
                  Kirim notifikasi uji
                </Button>
              </div>
              {devices.error && <Alert>{devices.error.message}</Alert>}
              {devices.data?.map((d) => (
                <div className="list-item" key={d.id}>
                  <div className="grow">
                    <strong>Perangkat · {formatDay(day(d.createdAt))}</strong>
                    <small>{d.userAgent}</small>
                  </div>
                  <button
                    className="icon-btn"
                    aria-label="Hapus perangkat"
                    onClick={() =>
                      save.run(async () => {
                        await api('/push/subscribe', 'DELETE', { id: d.id })
                        await devices.refetch()
                        toast('Perangkat dihapus.')
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </Panel>
          </div>
          <Panel title="Aturan pengingat" icon={<Bell size={19} />}>
            <form className="form-stack" onSubmit={(e) => save.run(updateSettings, e)}>
              <Field label="Sebelum kelas mulai">
                <select
                  value={v.classReminderMin}
                  onChange={(e) => set({ ...v, classReminderMin: Number(e.target.value) })}
                >
                  {[0, 15, 30, 60].map((n) => (
                    <option key={n} value={n}>
                      {n ? n + ' menit' : 'Mati'}
                    </option>
                  ))}
                </select>
              </Field>
              <Toggle
                label="Pengingat PR"
                value={v.taskRemindersOn}
                set={(b) => set({ ...v, taskRemindersOn: b })}
              />
              {(
                [
                  ['briefEnabled', 'briefTime', 'Jadwal besok'],
                  ['d3Enabled', 'd3Time', 'PR H-3'],
                  ['d1Enabled', 'd1Time', 'PR H-1'],
                  ['d0Enabled', 'd0Time', 'PR hari-H'],
                  ['lateEnabled', 'lateTime', 'PR terlambat'],
                  ['recapEnabled', 'recapTime', 'Rekap mingguan'],
                ] as const
              ).map(([on, clock, label]) => (
                <div className="rule-row" key={on}>
                  <Toggle label={label} value={v[on]} set={(b) => set({ ...v, [on]: b })} />
                  <input
                    type="time"
                    aria-label={'Jam ' + label}
                    required
                    value={v[clock]}
                    onChange={(e) => set({ ...v, [clock]: e.target.value })}
                  />
                </div>
              ))}
              <Field label="Hari rekap">
                <select
                  value={v.recapDow}
                  onChange={(e) => set({ ...v, recapDow: Number(e.target.value) })}
                >
                  {days.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Toggle
                label="Ingat mencatat"
                value={v.nudgeEnabled}
                set={(b) => set({ ...v, nudgeEnabled: b })}
              />
              <Field label="Menit setelah kelas terakhir">
                <input
                  type="number"
                  min="0"
                  max="180"
                  required
                  value={v.nudgeDelay}
                  onChange={(e) => set({ ...v, nudgeDelay: Number(e.target.value) })}
                />
              </Field>
              <Button type="submit" color="sunny" disabled={save.busy}>
                Simpan pengingat
              </Button>
            </form>
          </Panel>
        </div>
      )}
      {tab === 'Tampilan' && (
        <Panel title="Tampilan ruang belajar" icon={<Palette size={19} />}>
          <form className="form-stack narrow" onSubmit={(e) => save.run(updateSettings, e)}>
            <Field label="Tingkat animasi">
              <select
                value={v.animationLevel}
                onChange={(e) => set({ ...v, animationLevel: e.target.value })}
              >
                {[
                  ['auto', 'Ikuti perangkat'],
                  ['full', 'Penuh'],
                  ['reduced', 'Hemat'],
                  ['off', 'Mati'],
                ].map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Toggle
              label="Tampilkan maskot"
              value={v.mascotEnabled}
              set={(b) => set({ ...v, mascotEnabled: b })}
            />
            <Field label="Nama maskot">
              <input
                required
                maxLength={30}
                value={v.mascotName}
                onChange={(e) => set({ ...v, mascotName: e.target.value })}
              />
            </Field>
            <Field label="Ukuran teks catatan">
              <select
                value={v.noteSize}
                onChange={(e) => set({ ...v, noteSize: Number(e.target.value) })}
              >
                {[14, 16, 18, 20, 22, 24].map((n) => (
                  <option key={n} value={n}>
                    {n} px
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit" color="sunny" disabled={save.busy}>
              Simpan tampilan
            </Button>
          </form>
        </Panel>
      )}
      {tab === 'Data' && (
        <div className="settings-grid">
          <Panel title="Ekspor ke kalender" icon={<CalendarDays size={19} />}>
            <p>Unduh jadwal semester sebagai file .ics untuk aplikasi kalender kamu.</p>
            <Button color="sunny" onClick={() => setExporter(true)}>
              <Download size={16} /> Ekspor ke Kalender
            </Button>
          </Panel>
          <Panel title="Cadangan data" icon={<FileDown size={19} />}>
            <p>
              Unduh semua semester, catatan, PR, dan metadata lampiran. File asli tersimpan di
              folder unggahan.
            </p>
            <a className="brut-btn bg-teal" download href="/api/export/json">
              <Download size={16} /> Unduh JSON
            </a>
          </Panel>
        </div>
      )}
      {archive && (
        <Modal title="Arsipkan semester ini?" onClose={() => setArchive(false)}>
          <p>
            Data tetap bisa dibuka dari daftar arsip. Kamu bisa memulai semester baru lewat
            onboarding.
          </p>
          <div className="actions">
            <Button onClick={() => setArchive(false)}>Batal</Button>
            <Button
              color="sunny"
              onClick={() =>
                save.run(async () => {
                  const id = w.semester!.id
                  await api('/semesters/' + id, 'PATCH', { isActive: false })
                  setTerm(id)
                  await refresh()
                  setArchive(false)
                  toast('Semester diarsipkan.')
                })
              }
            >
              Arsipkan
            </Button>
          </div>
        </Modal>
      )}
      {exporter && (
        <Modal title="Ekspor ke Kalender" onClose={() => setExporter(false)}>
          <div className="form-stack">
            <Toggle
              label="Sertakan jadwal"
              value={opts.schedule}
              set={(b) => setOpts({ ...opts, schedule: b })}
            />
            <Toggle
              label="Sertakan PR aktif"
              value={opts.tasks}
              set={(b) => setOpts({ ...opts, tasks: b })}
            />
            <Field label="Pengingat acara">
              <select
                value={opts.alarm}
                onChange={(e) => setOpts({ ...opts, alarm: e.target.value })}
              >
                {[0, 15, 30, 60].map((n) => (
                  <option key={n} value={n}>
                    {n ? n + ' menit' : 'Tanpa pengingat'}
                  </option>
                ))}
              </select>
            </Field>
            <p className="help">
              Di Google Calendar buka Setelan → Impor &amp; ekspor → Impor, lalu pilih file
              jadwal-kuliah.ics.
            </p>
            {(opts.schedule || opts.tasks) && (
              <a
                className="brut-btn bg-sunny"
                href={
                  '/api' +
                  termQuery(
                    '/export/ics?schedule=' +
                      Number(opts.schedule) +
                      '&tasks=' +
                      Number(opts.tasks) +
                      '&alarm=' +
                      opts.alarm,
                    term,
                  )
                }
                download
              >
                <Download size={16} /> Unduh .ics
              </a>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
