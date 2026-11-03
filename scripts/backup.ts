import { backup } from '../server/src/backup'
import { db } from '../server/src/core'
try {
  console.log((await backup(true)) ?? 'Belum ada akun untuk dicadangkan.')
} finally {
  await db.$disconnect()
}
