// Smoke test: connect to Turso via the same adapter setup as the app and
// run a few read-only queries to verify the migration worked.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})
const adapter = new PrismaLibSQL(libsql)
const prisma = new PrismaClient({ adapter })

const counts = {
  tasks:           await prisma.task.count(),
  taskCompletions: await prisma.taskCompletion.count(),
  taskSkips:       await prisma.taskSkip.count(),
  habits:          await prisma.habit.count(),
  habitCompletions:await prisma.habitCompletion.count(),
  habitSkips:      await prisma.habitSkip.count(),
  scratchpad:      await prisma.scratchpad.count(),
  dayNotes:        await prisma.dayNote.count(),
  liftEntries:     await prisma.liftEntry.count(),
  liftGroups:      await prisma.liftGroup.count(),
  projects:        await prisma.project.count(),
}
console.log(counts)

// Sample a write + delete to verify writeability
const probe = await prisma.dayNote.create({ data: { date: '2099-12-31', content: 'smoke-test' } })
await prisma.dayNote.delete({ where: { id: probe.id } })
console.log('write probe: ok')

await prisma.$disconnect()
