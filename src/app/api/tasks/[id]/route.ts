import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ⚠️ This is the SERVER's day — UTC on Vercel, where it disagrees with the
// user's local day between 00:00 and 08:00 Central. It exists only as a
// last-resort fallback; every caller should pass a browser-local date
// explicitly (item 21 — the old name, `localDateString`, actively invited
// trusting it).
function serverUtcDay() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

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
    // Prefer the caller's browser-local day — the server fallback is the UTC
    // day, wrong for late-evening completions (item 21). completedAt is what
    // /api/scores credits the completion to (item 22).
    const clientDay = typeof body.completedAt === 'string' && DAY_RE.test(body.completedAt) ? body.completedAt : null
    updateData.completedAt = body.completed ? (clientDay ?? serverUtcDay()) : null
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
  if ('kind' in body) {
    const k = body.kind
    updateData.kind = k && ['meeting','focus','personal','admin','planning'].includes(k) ? k : null
  }

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
  // Callers pass ?date= (browser-local); the UTC fallback is a safety net.
  const date = req.nextUrl.searchParams.get('date') || serverUtcDay()
  await prisma.task.update({
    where: { id },
    data: { active: false, deletedAt: date },
  })
  return NextResponse.json({ success: true })
}
