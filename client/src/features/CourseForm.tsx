import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { colors, days } from '../../../shared/model'
import { courseInput, type CourseInput } from '../../../shared/validation'
import { Alert, Button, Field, Modal, useSubmit } from '../components/ui'
export const blankCourse = (used: string[]): CourseInput => ({
  code: '',
  name: '',
  sks: 2,
  lecturerName: '',
  lecturerPhone: '',
  color: colors.find((c) => !used.includes(c)) ?? 'violet',
  schedules: [{ dayOfWeek: 1, startTime: '08:00', endTime: '09:40', room: '' }],
})
export function CourseForm({
  initial,
  used,
  onSave,
  onClose,
}: {
  initial: CourseInput
  used: string[]
  onSave: (v: CourseInput) => Promise<void> | void
  onClose: () => void
}) {
  const [v, set] = useState(initial),
    save = useSubmit()
  function field<K extends keyof CourseInput>(k: K, value: CourseInput[K]) {
    set((old) => ({ ...old, [k]: value }))
  }
  return (
    <Modal title={initial.name ? 'Ubah mata kuliah' : 'Tambah mata kuliah'} onClose={onClose} wide>
      <form
        className="form-stack"
        onSubmit={(e) =>
          save.run(async () => {
            const input = courseInput.safeParse(v)
            if (!input.success) {
              const first = input.error.issues[0]?.message
              throw new Error(
                first && !/^(Invalid|Expected|Required|String must|Number must)/.test(first)
                  ? first
                  : 'Periksa isian dan pastikan jam selesai sesudah jam mulai.',
              )
            }
            await onSave(input.data)
            onClose()
          }, e)
        }
      >
        <div className="form-grid">
          <Field label="Kode MK">
            <input
              value={v.code}
              onChange={(e) => field('code', e.target.value.toUpperCase())}
              required
            />
          </Field>
          <Field label="SKS">
            <input
              type="number"
              min="1"
              max="24"
              value={v.sks}
              onChange={(e) => field('sks', Number(e.target.value))}
              required
            />
          </Field>
        </div>
        <Field label="Nama mata kuliah">
          <input value={v.name} onChange={(e) => field('name', e.target.value)} required />
        </Field>
        <div className="form-grid">
          <Field label="Nama dosen">
            <input value={v.lecturerName} onChange={(e) => field('lecturerName', e.target.value)} />
          </Field>
          <Field label="Kontak dosen">
            <input
              type="tel"
              value={v.lecturerPhone}
              onChange={(e) => field('lecturerPhone', e.target.value)}
            />
          </Field>
        </div>
        <fieldset>
          <legend>Warna mata kuliah</legend>
          <div className="colors">
            {colors.map((c) => (
              <label
                className={'swatch bg-' + c + (v.color === c ? ' chosen' : '')}
                key={c}
                title={c}
              >
                <input
                  type="radio"
                  name="warna"
                  checked={v.color === c}
                  onChange={() => field('color', c)}
                  disabled={used.includes(c)}
                  aria-label={c}
                />
                {v.color === c ? '✓' : ''}
              </label>
            ))}
          </div>
        </fieldset>
        <h3>Slot jadwal</h3>
        {v.schedules.map((s, i) => {
          const change = (key: keyof typeof s, value: string | number) =>
            field(
              'schedules',
              v.schedules.map((old, j) => (j === i ? { ...old, [key]: value } : old)),
            )
          return (
            <div className="slot-form" key={s.id ?? i}>
              <Field label="Hari">
                <select
                  value={s.dayOfWeek}
                  onChange={(e) => change('dayOfWeek', Number(e.target.value))}
                >
                  {days.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Mulai">
                <input
                  type="time"
                  value={s.startTime}
                  onChange={(e) => change('startTime', e.target.value)}
                  required
                />
              </Field>
              <Field label="Selesai">
                <input
                  type="time"
                  value={s.endTime}
                  onChange={(e) => change('endTime', e.target.value)}
                  required
                />
              </Field>
              <Field label="Ruang">
                <input value={s.room} onChange={(e) => change('room', e.target.value)} required />
              </Field>
              <Button
                aria-label="Hapus slot"
                onClick={() =>
                  field(
                    'schedules',
                    v.schedules.filter((_, j) => j !== i),
                  )
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
          )
        })}
        <Button
          onClick={() =>
            field('schedules', [
              ...v.schedules,
              { dayOfWeek: 1, startTime: '08:00', endTime: '09:40', room: '' },
            ])
          }
        >
          <Plus size={16} /> Tambah slot
        </Button>
        {save.error && <Alert>{save.error}</Alert>}
        <Button className="full" color="sunny" type="submit" disabled={save.busy}>
          Simpan mata kuliah
        </Button>
      </form>
    </Modal>
  )
}
