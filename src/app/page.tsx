import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Coins, ArrowRight, Upload, Brain, BarChart3,
  Shield, RefreshCw, Zap,
} from 'lucide-react'

const BANKS = [
  'Santander', 'BBVA', 'Macro', 'Galicia', 'Nación',
  'ICBC', 'HSBC', 'Mercado Pago', 'Ualá', 'Naranja X', 'Brubank',
]

const FEATURES = [
  {
    icon: Upload,
    title: 'Importación universal',
    desc: 'PDF, CSV, XLS y XLSX. Drag & drop. OCR automático para PDFs imagen.',
  },
  {
    icon: Brain,
    title: 'IA que aprende',
    desc: 'Categoriza automáticamente. Aprende de tus correcciones. Mejora con cada archivo.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard premium',
    desc: 'Gráficos de evolución, categorías, comercios, gastos recurrentes y tendencias.',
  },
  {
    icon: Shield,
    title: 'Privacidad total',
    desc: 'Tus datos son solo tuyos. Cada usuario tiene su entorno aislado y cifrado.',
  },
  {
    icon: RefreshCw,
    title: 'Aprendizaje continuo',
    desc: 'El sistema mejora automáticamente sin intervención técnica.',
  },
  {
    icon: Zap,
    title: 'Procesamiento instantáneo',
    desc: 'Extractos de cientos de filas procesados en segundos.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/3 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full bg-brand-500/8 blur-3xl" />
        <div className="absolute bottom-0 -left-1/4 w-[600px] h-[400px] rounded-full bg-violet-500/6 blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-md bg-background/70">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Coins className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">FinanzasIA</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Iniciar sesión</Button>
            </Link>
            <Link href="/register">
              <Button variant="gradient" size="sm">
                Empezar gratis <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <Badge variant="info" className="mb-6 gap-1.5">
          <Coins className="h-3 w-3" /> Powered by Gemini AI
        </Badge>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          Analizá tus extractos
          <br />
          <span className="gradient-text">bancarios con IA</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Importá PDF, Excel o CSV de cualquier banco argentino. La IA categoriza cada
          movimiento automáticamente y aprende de tus correcciones.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/register">
            <Button variant="gradient" size="xl" className="shadow-2xl shadow-brand-500/25">
              Empezar gratis
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg">
              Ya tengo cuenta
            </Button>
          </Link>
        </div>

        {/* Banks */}
        <div className="mt-14">
          <p className="text-xs text-muted-foreground/60 uppercase tracking-widest mb-4">Compatible con</p>
          <div className="flex flex-wrap justify-center gap-2">
            {BANKS.map(b => (
              <Badge key={b} variant="outline" className="text-xs font-normal">{b}</Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold tracking-tight mb-3">Todo lo que necesitás</h2>
          <p className="text-muted-foreground">De la importación al análisis, completamente automatizado</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-border/50 bg-card/50 p-6 hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300"
            >
              <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-brand-400" />
              </div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold tracking-tight mb-3">Cómo funciona</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Importás el archivo', desc: 'Arrastrás tu extracto bancario. PDF, Excel o CSV. Cualquier banco.' },
            { step: '02', title: 'La IA procesa', desc: 'Extrae los datos, normaliza el formato y categoriza cada movimiento automáticamente.' },
            { step: '03', title: 'Analizás y corregís', desc: 'Revisás el dashboard, corregís categorías erróneas. El sistema aprende y mejora.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-4">
              <span className="text-4xl font-black text-brand-500/20 leading-none shrink-0">{step}</span>
              <div>
                <h3 className="font-semibold mb-1.5">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="rounded-2xl bg-gradient-to-br from-brand-500/10 via-violet-500/10 to-transparent border border-brand-500/20 p-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-3">
            Empezá hoy, gratis
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Sin tarjeta de crédito. Sin límite de archivos. Tus datos siempre privados.
          </p>
          <Link href="/register">
            <Button variant="gradient" size="xl">
              Crear cuenta gratis <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center">
              <Coins className="h-2.5 w-2.5 text-white" />
            </div>
            <span>FinanzasIA</span>
          </div>
          <p>Análisis inteligente de finanzas personales</p>
        </div>
      </footer>
    </div>
  )
}
