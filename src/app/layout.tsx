import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'
import './globals.css'
import PWASetup from '@/components/PWASetup'

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Productivity" />
        <link rel="apple-touch-icon" href="/api/pwa-icon?size=192" />
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');var p=window.matchMedia('(prefers-color-scheme:dark)').matches;if(t==='dark'||(t===null&&p))document.documentElement.classList.add('dark')}catch(e){}` }} />
        <script dangerouslySetInnerHTML={{ __html: `var _zt;document.addEventListener('touchend',function(){clearTimeout(_zt);_zt=setTimeout(function(){if(window.visualViewport&&window.visualViewport.scale<=1.05)return;var v=document.querySelector('meta[name=viewport]');if(!v)return;v.content='width=device-width,initial-scale=1,maximum-scale=1';setTimeout(function(){v.content='width=device-width,initial-scale=1'},50)},400)})` }} />
      </head>
      <body className="bg-[#f3f0ff] dark:bg-[#0c0c14] text-slate-900 dark:text-slate-100 antialiased">
        <PWASetup />
        {children}
      </body>
    </html>
  )
}
