import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'FinanzasIA — Análisis inteligente de extractos bancarios',
  description: 'Importá tus extractos bancarios y analizalos automáticamente con IA. Compatible con todos los bancos argentinos.',
  keywords: 'finanzas personales, extractos bancarios, análisis financiero, IA, Argentina',
  openGraph: {
    title: 'FinanzasIA',
    description: 'Análisis inteligente de extractos bancarios con IA',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
