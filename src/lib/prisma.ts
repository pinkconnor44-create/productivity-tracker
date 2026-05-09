import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

// Runtime queries go through Turso (libSQL) via the Prisma driver adapter.
// The `DATABASE_URL` in .env is only consulted by Prisma CLI commands for
// schema/typegen — actual reads/writes use the libSQL connection below.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function makeClient() {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url) throw new Error('TURSO_DATABASE_URL is not set')
  const libsql = createClient({ url, authToken })
  const adapter = new PrismaLibSQL(libsql)
  return new PrismaClient({ adapter, log: ['error'] })
}

export const prisma = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
