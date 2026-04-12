import { NextResponse } from 'next/server'

export async function POST() {
  // Shutdown is only supported when self-hosting locally
  return NextResponse.json({ ok: false, message: 'Not supported in cloud mode' }, { status: 410 })
}
