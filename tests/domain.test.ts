import { describe, it, expect } from 'vitest'
import AdmZip from 'adm-zip'
import { addDays, classStatus, instant } from '../shared/model'
import { agenda, weeklyTasks } from '../shared/agenda'
import { stats, RecapService, validBody, todayData } from '../server/src/insights'
import { batchRules, dueRules } from '../server/src/notifications'
import { calendar, fold } from '../server/src/calendar'
import { identify } from '../server/src/materials'
import { meeting, note, task, work, course, prefs, at } from './fixtures'
const mon = '2026-09-07',
  tue = addDays(mon, 1),
  wed = addDays(mon, 2)
describe('Pertemuan dan status WIB', () => {
  it('menampilkan slot mingguan tanpa membuat riwayat; P6 manual menggantikan blok yang sama', () => {
    const w = work()
    expect(agenda(w, mon, mon)).toHaveLength(1)
    expect(w.sessions).toHaveLength(0)
    w.sessions = [meeting(mon, 'manual', { meetingNo: 6, scheduleId: null })]
    expect(agenda(w, mon, mon).map((s) => s.meetingNo)).toEqual([6])
  })
  it('memilih PR aktif berdasarkan minggu deadline WIB termasuk hari tanpa kelas', () => {
    const w = work(
      [],
      [],
      [
        task('weekend', addDays(mon, 6)),
        task('depan', addDays(mon, 7)),
        task('beres', mon, { status: 'done' }),
      ],
    )
    expect(weeklyTasks(w, mon).map((t) => t.id)).toEqual(['weekend'])
  })
  it('beralih tepat pada jam mulai dan selesai', () => {
    const s = meeting(mon)
    expect(
      ['07:59', '08:00', '11:19', '11:20'].map((t) => classStatus(s, instant(mon, t))),
    ).toEqual(['Akan datang', 'Sedang berlangsung', 'Sedang berlangsung', 'Selesai'])
    expect(classStatus({ ...s, status: 'libur' })).toBe('Libur')
  })
})
describe('Streak, cakupan dan rekap', () => {
  const a = meeting(mon),
    b = meeting(mon, 'kelas2', { startAt: at(mon, '11:30'), endAt: at(mon, '14:50') }),
    c = meeting(tue)
  it('Senin lengkap dan Selasa dirapikan Rabu memberi dua hari', () => {
    const w = work([a, b, c], [note(a), note(b), note(c, at(wed))])
    const date = instant(wed, '12:00')
    expect(stats(w, date).current).toBe(2)
    expect(todayData(w, date).streak).toBe(2)
  })
  it('satu dari dua kelas tertunda lalu terlewat setelah tenggang', () => {
    const w = work([a, b], [note(a)])
    expect(stats(w, instant(tue, '09:00')).history[0].state).toBe('Tertunda')
    expect(stats(w, instant(addDays(mon, 3), '00:00')).history[0].state).toBe('Terlewat')
    expect(stats(w, instant(addDays(mon, 3), '00:00')).current).toBe(0)
  })
  it('mengabaikan libur, belum dilacak, dan catatan sebelum kelas atau sesudah tenggang', () => {
    const pre = meeting(addDays(mon, -3), 'pre', { tracked: false }),
      holiday = meeting(tue, 'h', { status: 'libur' }),
      w = work([pre, a, holiday], [note(a, at(mon, '07:59'))])
    expect(stats(w, instant(tue, '13:00')).coverage[0].total).toBe(1)
    expect(stats(w, instant(tue, '13:00')).current).toBe(0)
    w.notes = [note(a, at(addDays(mon, 3), '00:00'))]
    expect(stats(w, instant(addDays(mon, 4), '00:00')).current).toBe(0)
  })
  it('menjaga bukti catat tepat waktu setelah edit berikutnya', () => {
    const w = work([a], [note(a, a.startAt, { updatedAt: at(addDays(mon, 7)) })])
    expect(stats(w, instant(addDays(mon, 8), '12:00')).current).toBe(1)
  })
  it('menerapkan batas 30 karakter atau gambar', () => {
    expect(validBody('a'.repeat(25), 0)).toBe(false)
    expect(validBody('a'.repeat(30), 0)).toBe(true)
    expect(validBody('', 1)).toBe(true)
  })
  it('rekap 5 hari kuliah pada Sabtu melintasi akhir pekan dan melewati kelas tak dilacak', () => {
    const dates = ['2026-09-02', '2026-09-03', mon, tue, wed, '2026-09-10']
    const ss = dates.map((d) => meeting(d))
    const w = work([...ss, meeting('2026-09-11', 'x', { tracked: false })])
    const r = RecapService.getRecapData(w, {
      mode: '5class',
      to: '2026-09-12',
      now: instant('2026-09-12', '12:00'),
    })
    expect(r.dates).toEqual(dates.slice(-5))
    expect(r.groups[0].hasValid).toBe(false)
  })
})
describe('Mesin pengingat', () => {
  it('menggabungkan PR satu slot dan melewatkan tugas yang dibuat setelah slot', () => {
    const w = work(
      [],
      [],
      [task('1', tue), task('2', tue), task('baru', tue, { createdAt: at(mon, '18:05') })],
    )
    const items = dueRules(w, prefs, instant(mon, '18:10')).filter((r) => r.type === 'task')
    expect(items.map((i) => i.key)).toEqual(['task:1:d1:' + tue, 'task:2:d1:' + tue])
    expect(batchRules(items)).toHaveLength(1)
    expect(dueRules(w, prefs, instant(mon, '21:00'))).toHaveLength(0)
  })
  it('menonaktifkan aturan, membatalkan deadline lama, melewati PR selesai', () => {
    const w = work([], [], [task('1', tue, { status: 'done' }), task('2', wed)])
    expect(dueRules(w, prefs, instant(mon, '18:03')).filter((r) => r.type === 'task')).toHaveLength(
      0,
    )
    w.tasks = [task('2', tue)]
    expect(
      dueRules(w, { ...prefs, d1Enabled: false }, instant(mon, '18:03')).filter(
        (r) => r.type === 'task',
      ),
    ).toHaveLength(0)
  })
  it('melewati kelas bersambung di ruang sama dan mewajibkan tracked untuk nudge', () => {
    const a = meeting(wed, '1', { endAt: at(wed, '09:40'), tracked: false }),
      b = meeting(wed, '2', { startAt: at(wed, '09:40'), tracked: false })
    const w = work([a, b])
    expect(
      dueRules(w, prefs, instant(wed, '09:10')).filter((r) => r.type === 'class'),
    ).toHaveLength(0)
    expect(
      dueRules(w, prefs, instant(wed, '11:35')).filter((r) => r.type === 'nudge'),
    ).toHaveLength(0)
    expect(dueRules(w, prefs, instant(wed, '07:35')).map((r) => r.key)).toEqual(['class:1'])
    expect(dueRules(w, prefs, instant(wed, '07:40'))).toHaveLength(0)
  })
  it('tidak mengingatkan kelas libur; jadwal besok bisa dimatikan', () => {
    const w = work([meeting(tue, 'h', { status: 'libur' })])
    expect(dueRules(w, prefs, instant(mon, '20:00'))).toHaveLength(0)
    w.sessions = [meeting(tue)]
    expect(dueRules(w, { ...prefs, briefEnabled: false }, instant(mon, '20:05'))).toHaveLength(0)
  })
})
describe('Ekspor dan lampiran', () => {
  it('ICS memakai UID stabil, VTIMEZONE, EXDATE, CRLF, alarm dan escape', () => {
    const w = work(
      [meeting(mon), meeting(addDays(mon, 7), 'h', { status: 'libur' })],
      [],
      [task('1', tue)],
    )
    const ics = calendar(w, true, true, 30, instant(mon, '09:00'))
    expect(ics).toContain('UID:schedule-senin@kuliahku')
    expect(ics).toContain('EXDATE;TZID=Asia/Jakarta:20260914T080000')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260908')
    expect(ics).toContain('BEGIN:VTIMEZONE')
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('Analisis\\, Sistem\\;')
    expect(ics.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/)
    expect(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true)
    expect(calendar(w, true, true, 0)).toContain('UID:task-1@kuliahku')
  })
  it('melipat UTF-8 pada batas oktet tanpa memotong karakter', () => {
    const input = 'SUMMARY:' + 'kuliah 🎓'.repeat(18),
      out = fold(input)
    expect(out.replaceAll('\r\n ', '')).toBe(input)
    expect(out.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true)
  })
  it('memeriksa magic bytes, ukuran, dan isi paket Office', () => {
    expect(identify(Buffer.from('%PDF-1.7'))).toBe('application/pdf')
    expect(() => identify(Buffer.from('MZ renamed.pdf'))).toThrow()
    expect(() => identify(Buffer.alloc(12), 10)).toThrow()
    const zip = new AdmZip()
    zip.addFile('word/document.xml', Buffer.from('<x/>'))
    expect(() => identify(zip.toBuffer())).toThrow()
    zip.addFile(
      '[Content_Types].xml',
      Buffer.from(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
      ),
    )
    expect(identify(zip.toBuffer())).toMatch(/wordprocessingml/)
  })
})
