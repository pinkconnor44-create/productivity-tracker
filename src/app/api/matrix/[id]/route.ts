import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const item = await prisma.matrixItem.update({
    where: { id: Number(params.id) },
    data: {
      ...(body.quadrant !== undefined && { quadrant: body.quadrant }),
      ...(body.done     !== undefined && { done: body.done }),
      ...(body.title    !== undefined && { title: body.title }),
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.matrixItem.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
