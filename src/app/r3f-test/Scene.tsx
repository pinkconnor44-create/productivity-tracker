'use client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import * as THREE from 'three'

function ForceSize({ w, h }: { w: number; h: number }) {
  const setSize = useThree(s => s.setSize)
  useEffect(() => { setSize(w, h) }, [w, h, setSize])
  return null
}

function Box() {
  const r = useRef<THREE.Mesh>(null)
  useFrame((_, d) => { if (r.current) r.current.rotation.y += d })
  return (
    <mesh ref={r}>
      <torusGeometry args={[1.2, 0.12, 20, 120]} />
      <meshStandardMaterial color="#8052ff" emissive="#8052ff" emissiveIntensity={0.6} />
    </mesh>
  )
}

export default function Scene() {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <ForceSize w={800} h={400} />
      <ambientLight intensity={1.2} />
      <pointLight position={[3, 3, 3]} intensity={30} />
      <Box />
    </Canvas>
  )
}
