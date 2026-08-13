import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  const body = await req.json()
  const { name, description, recurringDays, weight } = body

  const habit = await prisma.habit.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(recurringDays !== undefined && { recurringDays: recurringDays || null }),
      ...(weight !== undefined && { weight: [1,2,3].includes(weight) ? weight : 1 }),
    },
    include: { completions: { orderBy: { date: 'desc' }, take: 60 } },
  })
  return NextResponse.json(habit)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  // Browser-local day from the caller, like the Task DELETE. The fallback is
  // the server's (UTC) day — callers must pass ?date= or an evening delete
  // can land on tomorrow. Without a date at all, deleting a habit removed it
  // from every PAST day's denominator too (item 08).
  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10)
  await prisma.habit.update({
    where: { id },
    data: { active: false, deletedAt: date },
  })
  return NextResponse.json({ success: true })
}
