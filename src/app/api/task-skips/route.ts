import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST { taskId, date } — toggles skip on/off
export async function POST(req: NextRequest) {
  const { taskId, date } = await req.json()
  const existing = await prisma.taskSkip.findUnique({ where: { taskId_date: { taskId, date } } })
  if (existing) {
    await prisma.taskSkip.delete({ where: { id: existing.id } })
    return NextResponse.json({ skipped: false })
  }
  await prisma.taskSkip.create({ data: { taskId, date } })
  return NextResponse.json({ skipped: true })
}
