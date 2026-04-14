import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function localDateString() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  const body = await req.json()

  const updateData: Record<string, unknown> = {}

  if ('completed' in body) {
    updateData.completed = body.completed
    updateData.completedAt = body.completed ? localDateString() : null
  }
  if ('title' in body) updateData.title = body.title.trim()
  if ('description' in body) updateData.description = body.description?.trim() || null
  if ('dueDate' in body) updateData.dueDate = body.dueDate || null
  if ('time' in body) updateData.time = body.time || null
  if ('endTime' in body) updateData.endTime = body.endTime || null
  if ('recurringType' in body) updateData.recurringType = body.recurringType || null
  if ('recurringDays' in body) updateData.recurringDays = body.recurringDays || null
  if ('recurringEnd' in body) updateData.recurringEnd = body.recurringEnd || null
  if ('weight' in body) updateData.weight = [1,2,3].includes(body.weight) ? body.weight : 1

  const task = await prisma.task.update({
    where: { id },
    data: updateData,
    include: { completions: true },
  })
  return NextResponse.json(task)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  const date = req.nextUrl.searchParams.get('date') || localDateString()
  await prisma.task.update({
    where: { id },
    data: { active: false, deletedAt: date },
  })
  return NextResponse.json({ success: true })
}
