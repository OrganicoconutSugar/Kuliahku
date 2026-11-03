import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { day, addDays, monday } from '../shared/model'
test('akun pertama → semester → catatan cepat → PR selesai → rekap, desktop dan 360 px', async ({
  page,
  request,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const origin = 'http://localhost:5291',
    password = randomBytes(20).toString('base64url'),
    today = day(),
    start = addDays(monday(today), -14)
  expect((await request.get('/api/courses')).status()).toBe(401)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/setup')
  await page.getByLabel('Nama panggilan').fill('Dara')
  await page.getByLabel('Email', { exact: true }).fill('mahasiswa@example.test')
  await page.getByLabel('Kata sandi', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Buat akun & lanjut' }).click()
  await page.getByLabel('Nama semester').fill('Semester uji')
  await page.getByLabel('Tanggal mulai kuliah').fill(start)
  await page.getByLabel('Tanggal selesai', { exact: true }).fill(addDays(start, 115))
  await page.getByLabel('Mulai lacak dari tanggal').fill(start)
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click()
  await page.getByRole('button', { name: 'Pakai jadwal contoh' }).click()
  await expect(page.getByText('Technopreneurship', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click()
  await page.getByRole('button', { name: 'Lanjut ke ringkasan' }).click()
  await page.getByRole('button', { name: 'Buka dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Kelas hari ini' })).toBeVisible()
  expect((await request.get('/setup')).status()).toBe(404)
  const cookie = (await page.context().cookies()).find((c) => c.name === 'kuliahku_session')
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax' })
  expect(
    (
      await page.request.patch('/api/auth/profile', {
        headers: { Origin: 'https://origin.example.test' },
        data: { name: 'Asing' },
      })
    ).status(),
  ).toBe(403)
  await page.goto('/matkul')
  await page.locator('.course-cover').first().click()
  await expect(page.getByText(/Belum ada pertemuan/)).toBeVisible()
  await page.getByRole('button', { name: 'Tambah pertemuan' }).click()
  await page.getByLabel('Pertemuan ke').fill('6')
  await page.getByLabel('Ruang', { exact: true }).fill('R.4.6')
  await page.getByRole('button', { name: 'Simpan pertemuan' }).click()
  await expect(page.getByText('P6', { exact: true })).toBeVisible()
  await page.goto('/hari-ini')
  const saveNote = async (body: string) => {
    await page.getByRole('button', { name: /Quick Capture/ }).click()
    await page.getByRole('button', { name: 'Catatan', exact: true }).click()
    await page.getByLabel('Catatan cepat').fill(body)
    await page.getByRole('button', { name: 'Simpan catatan', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
  await saveNote('Normalisasi menyusun data supaya ketergantungan menjadi jelas.')
  await saveNote('Tambahkan contoh relasi dari pembahasan pertemuan.')
  const notes = await (await page.request.get('/api/notes')).json()
  expect(notes).toHaveLength(1)
  expect(notes[0].body).toContain('contoh relasi')
  await page.getByRole('button', { name: /Quick Capture/ }).click()
  await page.getByRole('button', { name: 'PR', exact: true }).click()
  await page.getByLabel('Judul PR').fill('Buat diagram kelas')
  await page.getByRole('button', { name: 'Besok', exact: true }).click()
  await page.getByRole('button', { name: 'Simpan PR' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto('/jadwal')
  if (monday(addDays(today, 1)) !== monday(today))
    await page.getByRole('button', { name: 'Minggu berikutnya' }).click()
  await expect(page.getByRole('link', { name: /Buat diagram kelas/ })).toBeVisible()
  await page.goto('/hari-ini')
  await page.getByRole('checkbox', { name: 'Selesaikan Buat diagram kelas' }).click()
  await page.getByRole('button', { name: 'Batalkan', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Selesaikan Buat diagram kelas' }).click()
  await page.goto('/rekap')
  await expect(page.getByRole('heading', { name: 'Rekap mingguan.' })).toBeVisible()
  await expect(page.getByText('Belum ada catatan', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: '5 hari kuliah terakhir' }).click()
  await page.goto('/cari')
  await page.getByLabel('Kata kunci').fill('normalisasi')
  await page.locator('.note-entry').first().click()
  await page
    .getByLabel('Isi catatan')
    .fill('Normalisasi tersimpan dari editor dengan lebih dari tiga puluh karakter.')
  await expect(page.getByText('Tersimpan', { exact: true })).toBeVisible()
  await page.context().setOffline(true)
  await page
    .getByLabel('Isi catatan')
    .fill('Draft offline setelah kelas akan dipulihkan ketika koneksi kembali tersedia.')
  await expect(page.getByText('Draft lokal', { exact: true })).toBeVisible()
  const editorUrl = page.url()
  await page.context().setOffline(false)
  await page.goto(editorUrl)
  await expect(page.getByLabel('Isi catatan')).toHaveValue(/Draft offline/)
  await expect(page.getByText('Tersimpan', { exact: true })).toBeVisible()
  const file = await page.request.post('/api/attachments', {
    headers: { Origin: origin },
    multipart: {
      courseId: notes[0].courseId,
      title: 'Modul uji',
      file: {
        name: 'materi.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(5 * 1024 * 1024)]),
      },
    },
  })
  expect(file.status()).toBe(201)
  const attachment = await file.json()
  expect((await request.get('/api/files/' + attachment.id)).status()).toBe(401)
  expect((await page.request.get('/api/files/' + attachment.id)).status()).toBe(200)
  expect(
    (
      await page.request.post('/api/attachments', {
        headers: { Origin: origin },
        multipart: {
          courseId: notes[0].courseId,
          title: 'Palsu',
          file: { name: 'materi.pdf', mimeType: 'application/pdf', buffer: Buffer.from('MZ file') },
        },
      })
    ).status(),
  ).toBe(415)
  const ics = await page.request.get('/api/export/ics?tasks=1&alarm=30')
  expect(await ics.text()).toContain('RRULE:FREQ=WEEKLY')
  const backup = await (await page.request.get('/api/export/json')).json()
  expect(backup.semesters[0].courses).toHaveLength(6)
  expect(JSON.stringify(backup)).not.toContain('passwordHash')
  const deleted = await page.request.delete('/api/attachments/' + attachment.id, {
    headers: { Origin: origin },
  })
  expect(deleted.ok()).toBe(true)
  expect((await page.request.get('/api/files/' + attachment.id)).status()).toBe(404)
  const currentNote = await (await page.request.get('/api/notes/' + notes[0].id)).json()
  const write = (body: string) =>
    page.request.patch('/api/notes/' + notes[0].id, {
      headers: { Origin: origin },
      data: { body, expectedUpdatedAt: currentNote.updatedAt },
    })
  expect(
    (await write('Edit dari tab kedua, materi ini mencakup cukup banyak karakter.')).status(),
  ).toBe(200)
  expect((await write('Edit basi yang bisa menimpa tulisan dari tab kedua.')).status()).toBe(409)
  const image = await page.request.post('/api/attachments', {
    headers: { Origin: origin },
    multipart: {
      courseId: notes[0].courseId,
      ...(notes[0].sessionId ? { sessionId: notes[0].sessionId } : {}),
      noteId: notes[0].id,
      kind: 'note_image',
      title: 'Papan tulis',
      file: {
        name: 'foto.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRxcAAAAASUVORK5CYII=',
          'base64',
        ),
      },
    },
  })
  expect(image.status()).toBe(201)
  const imageId = (await image.json()).id
  expect((await (await page.request.get('/api/notes/' + notes[0].id)).json()).body).toContain(
    '![](/api/files/' + imageId + ')',
  )
  await page.goto('/hari-ini')
  await expect(page.getByRole('heading', { name: 'Kelas hari ini' })).toBeVisible()
  await page.screenshot({
    path: test.info().outputPath('dashboard-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 360, height: 800 })
  for (const path of [
    '/hari-ini',
    '/jadwal',
    '/matkul',
    '/catatan',
    '/pr',
    '/rekap',
    '/statistik',
    '/pengaturan',
    '/notifikasi',
    '/kuis',
  ]) {
    await page.goto(path)
    await expect(page.locator('main h1')).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      path,
    ).toBeLessThanOrEqual(360)
  }
  await page.goto('/hari-ini')
  await expect(page.getByRole('heading', { name: 'Kelas hari ini' })).toBeVisible()
  await page.screenshot({
    path: test.info().outputPath('dashboard-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('link', { name: 'Pengaturan' }).click()
  await page.getByRole('button', { name: 'Keluar dari akun' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect((await page.request.get('/api/notes')).status()).toBe(401)
  await page.getByLabel('Email', { exact: true }).fill('mahasiswa@example.test')
  await page.getByLabel('Kata sandi', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Masuk ke KuliahKu' }).click()
  await expect(page.getByRole('heading', { name: 'Kelas hari ini' })).toBeVisible()
  for (let i = 0; i < 5; i++)
    expect(
      (
        await request.post('/api/auth/login', {
          headers: { Origin: origin },
          data: { email: 'mahasiswa@example.test', password: 'bukan-kata-sandi' },
        })
      ).status(),
    ).toBe(401)
  expect(
    (
      await request.post('/api/auth/login', {
        headers: { Origin: origin },
        data: { email: 'mahasiswa@example.test', password: 'bukan-kata-sandi' },
      })
    ).status(),
  ).toBe(429)
  expect(errors).toEqual([])
})

test('service worker membedakan tab fokus dan tab tertutup', async ({ page, context, browser }) => {
  await context.grantPermissions(['notifications'], { origin: 'http://localhost:5291' })
  await page.goto('/login')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await page.bringToFront()
  const worker = context.serviceWorkers()[0]
  // Use Chromium's push receiver without sending this temporary account to a public push service.
  const cdp = await browser.newBrowserCDPSession(),
    target = (await cdp.send('Target.getTargets')).targetInfos.find(
      (t) => t.type === 'service_worker' && t.url.endsWith('/sw.js'),
    )!
  expect(target).toBeTruthy()
  const control = await context.newPage()
  await control.goto('about:blank')
  const dev = await context.newCDPSession(control)
  let registrationId = ''
  dev.on('ServiceWorker.workerRegistrationUpdated', (e) => {
    const reg = e.registrations.find((r) => r.scopeURL === 'http://localhost:5291/')
    if (reg) registrationId = reg.registrationId
  })
  await dev.send('ServiceWorker.enable')
  await expect.poll(() => registrationId).not.toBe('')
  await page.bringToFront()
  await page.evaluate(() => {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'push') document.body.dataset.pushTitle = e.data.title
    })
  })
  const send = (label: string) =>
    dev.send('ServiceWorker.deliverPushMessage', {
      origin: 'http://localhost:5291',
      registrationId,
      data: JSON.stringify({
        title: label,
        body: 'Pengingat pengujian',
        url: '/rekap',
        tag: 'pengingat-uji',
      }),
    })
  await send('Tab fokus')
  await expect.poll(() => page.evaluate(() => document.body.dataset.pushTitle)).toBe('Tab fokus')
  await page.close()
  await send('Tab tertutup')
  await expect
    .poll(() =>
      worker.evaluate(async () => {
        const sw = self as unknown as { registration: ServiceWorkerRegistration }
        return (await sw.registration.getNotifications()).map((n) => n.title)
      }),
    )
    .toContain('Tab tertutup')
  await dev.detach()
  await cdp.detach()
})
