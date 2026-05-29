'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Sparkles, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleRegister = async (e: React.FormEvent) => {
    const supabase = createClient()
    e.preventDefault()

    if (password !== confirmPassword) {
      toast({ title: 'Las contraseñas no coinciden', variant: 'destructive' })
      return
    }
    if (password.length < 8) {
      toast({ title: 'La contraseña debe tener al menos 8 caracteres', variant: 'destructive' })
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/dashboard`,
      },
    })

    if (error) {
      toast({
        title: 'Error al registrarse',
        description: error.message,
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    // Try to auto-login
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (!loginError) {
      router.push('/dashboard')
      return
    }

    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md animate-fade-in">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">¡Cuenta creada!</h2>
          <p className="text-muted-foreground mb-6">
            Revisá tu email para confirmar tu cuenta y empezar a usar FinanzasIA.
          </p>
          <Link href="/login">
            <Button variant="outline">Ir al login</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-brand-500/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 shadow-2xl shadow-brand-500/30 mb-4">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Crear cuenta</h1>
          <p className="text-sm text-muted-foreground mt-1">Gratis, sin tarjeta de crédito</p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-8 shadow-xl shadow-black/5">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Contraseña</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Confirmar contraseña</label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Repetí tu contraseña"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              disabled={loading}
              className="w-full mt-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Crear cuenta gratis
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
