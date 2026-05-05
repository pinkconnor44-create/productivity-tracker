import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'
import { Space_Grotesk, Manrope } from 'next/font/google'
import './globals.css'
import PWASetup from '@/components/PWASetup'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Productivity Tracker',
  description: 'Track your tasks, habits, and daily score',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0b1326" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Productivity" />
        <link rel="apple-touch-icon" href="/api/pwa-icon?size=192" />
        <script dangerouslySetInnerHTML={{ __html: `var _zt;document.addEventListener('touchend',function(){clearTimeout(_zt);_zt=setTimeout(function(){if(window.visualViewport&&window.visualViewport.scale<=1.05)return;var v=document.querySelector('meta[name=viewport]');if(!v)return;v.content='width=device-width,initial-scale=1,maximum-scale=1';setTimeout(function(){v.content='width=device-width,initial-scale=1'},50)},400)})` }} />
      </head>
      <body className="bg-surface text-on-surface antialiased font-body">
        <PWASetup />
        {children}
      </body>
    </html>
  )
}
