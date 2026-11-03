<div align="center">
  <img src="client/public/icons/512.png" alt="Logo KuliahKu" width="112" height="112" />
  <h1>KuliahKu</h1>
  <p><strong>Agenda kuliah pribadi untuk mencatat kelas, materi, dan PR dalam satu tempat.</strong></p>
</div>

## Tentang KuliahKu

KuliahKu adalah aplikasi web berbahasa Indonesia untuk membantu mahasiswa mengelola kegiatan perkuliahan sehari-hari. Jadwal mata kuliah, catatan pertemuan, modul, dan PR saling terhubung sehingga informasi penting lebih mudah ditemukan saat dibutuhkan. Tampilannya menggunakan gaya neo-brutalism yang cerah dan dapat dipakai di desktop maupun ponsel.

Aplikasi ini ditujukan untuk mahasiswa yang ingin memiliki agenda pribadi, terutama saat mengikuti beberapa mata kuliah dengan jadwal, materi, dan tenggat yang berbeda. KuliahKu dirancang untuk satu pemilik akun dan dapat dijalankan secara lokal di Mac.

## Yang bisa dilakukan

- **Melihat agenda kuliah:** dashboard menampilkan kelas terdekat, jadwal mingguan, serta PR yang perlu diperhatikan.
- **Mengelola mata kuliah:** simpan jadwal, dosen, ruang, dan informasi semester. Pertemuan dicatat sendiri sesuai progres kelas; pengguna bisa mulai dari pertemuan ke-6 atau nomor lainnya.
- **Mencatat materi:** tulis catatan dengan format Markdown, lampirkan foto, dan kelompokkan dengan tag.
- **Menyimpan modul:** kumpulkan berkas atau tautan bahan kuliah pada mata kuliah terkait.
- **Mengatur PR:** catat tugas, prioritas, dan tenggat. PR yang dibuat untuk suatu mata kuliah muncul otomatis di Jadwal pada minggu tenggatnya.
- **Menjaga progres:** lihat statistik catatan, pencarian, dan rekap kegiatan kuliah.
- **Membawa agenda ke tempat lain:** ekspor jadwal dan PR aktif ke kalender, serta ekspor data sebagai JSON. Pengingat tersedia melalui pusat notifikasi dan Web Push jika diaktifkan.

Fitur kuis dan rangkuman AI masih ditandai sebagai rencana fase berikutnya.

## Teknologi

<div align="center">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg" alt="React" title="React" width="42" height="42" />&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vitejs/vitejs-original.svg" alt="Vite" title="Vite" width="42" height="42" />&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg" alt="Tailwind CSS" title="Tailwind CSS" width="42" height="42" />&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg" alt="TypeScript" title="TypeScript" width="42" height="42" />&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/express/express-original.svg" alt="Express" title="Express" width="42" height="42" />&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/prisma/prisma-original.svg" alt="Prisma" title="Prisma" width="42" height="42" />&nbsp;&nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/sqlite/sqlite-original.svg" alt="SQLite" title="SQLite" width="42" height="42" />
</div>

<p align="center">React · Vite · Tailwind CSS · TypeScript · Express · Prisma · SQLite</p>

## Menjalankan secara lokal

Memerlukan Node.js 22.12 atau lebih baru dan npm. Jalankan perintah berikut dari folder proyek:

```sh
npm ci
npm run setup
npm run build
npm start
```

Buka `http://localhost:5173/setup` untuk membuat akun pemilik saat pertama kali menjalankan aplikasi. Setelah itu, KuliahKu tersedia di `http://localhost:5173`. Data tersimpan pada SQLite lokal di folder `data/`, yang diabaikan oleh Git. Untuk mode pengembangan, gunakan `npm run dev` setelah setup.

Logo teknologi ditampilkan melalui [Devicon](https://github.com/devicons/devicon). Logo KuliahKu tersedia di `client/public/icons/`.
