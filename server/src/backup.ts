import { mkdir, mkdtemp, copyFile, chmod, rename, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import cron from 'node-cron'
import { db, uploadDir, log } from './core'
import { day, time } from '../../shared/model'
export async function backup(manual = false) {
  if (!(await db.user.count())) return null
  const root = resolve(process.env.BACKUP_DIR || 'data/backups'),
    now = new Date()
  const name = manual ? day(now) + '-' + time(now).replace(':', '') + '-' + Date.now() : day(now)
  const target = join(root, name)
  if (await stat(target).catch(() => null)) return target
  await mkdir(root, { recursive: true, mode: 0o700 })
  const stage = await mkdtemp(join(root, '.partial-')),
    file = join(stage, 'kuliahku.db')
  try {
    await db.$executeRaw`VACUUM INTO ${file}`
    await chmod(file, 0o600)
    const snapshot = new PrismaClient({ datasourceUrl: 'file:' + file })
    try {
      const files = await snapshot.attachment.findMany({
        where: { source: 'upload' },
        select: { storageKey: true },
      })
      await mkdir(join(stage, 'uploads'), { mode: 0o700 })
      for (const { storageKey } of files)
        if (storageKey)
          await copyFile(join(uploadDir, storageKey), join(stage, 'uploads', storageKey))
    } finally {
      await snapshot.$disconnect()
    }
    await rename(stage, target)
    return target
  } finally {
    await rm(stage, { recursive: true, force: true })
  }
}
export function startBackups() {
  const run = () => backup().catch((err) => log.error({ err }, 'Cadangan harian belum berhasil'))
  void run()
  return cron.schedule('15 2 * * *', run, { timezone: 'Asia/Jakarta', noOverlap: true })
}
