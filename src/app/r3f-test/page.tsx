'use client'
import dynamic from 'next/dynamic'
const Scene = dynamic(() => import('./Scene'), { ssr: false })
export default function Page() {
  return (
    <div style={{ width: 800, height: 400, background: '#111', margin: 40 }}>
      <Scene />
    </div>
  )
}
