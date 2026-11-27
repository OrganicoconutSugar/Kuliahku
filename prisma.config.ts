import 'dotenv/config'
import { defineConfig } from 'prisma/config'
const isPostgres = /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL || '')
export default defineConfig({
  schema: isPostgres ? 'server/prisma/schema.postgres.prisma' : 'server/prisma/schema.prisma',
  migrations: {
    path: isPostgres ? 'server/prisma/migrations-postgres' : 'server/prisma/migrations',
  },
})
