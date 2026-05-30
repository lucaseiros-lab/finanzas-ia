'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import {
  LayoutDashboard, Upload, List, BarChart3, LogOut,
  Moon, Sun, ChevronRight, Menu, X, ShieldCheck, Layers,
} from 'lucide-react'

const APP_VERSION = 'V1.0.0'

function AppLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-7 w-7 text-base' : 'h-8 w-8 text-lg'
  return (
    <div title={`FinanzasIA ${APP_VERSION}`}
      className={`flex items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 shadow-lg shadow-orange-500/30 font-black text-white select-none cursor-default ${sz}`}
      style={{ fontFamily: 'Arial Black, Arial', letterSpacing: '-1px' }}>
      $
    </div>
  )
}
import { useTheme } from 'next-themes'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/import', label: 'Importar', icon: Upload },
  { href: '/transactions', label: 'Movimientos', icon: List },
  { href: '/review', label: 'Revisar', icon: Layers },
  { href: '/analytics', label: 'Análisis', icon: BarChart3 },
]

function NavContent({ pathname, onNavigate, onSignOut, theme, setTheme, isAdmin }: {
  pathname: string
  onNavigate?: () => void
  onSignOut: () => void
  theme: string | undefined
  setTheme: (t: string) => void
  isAdmin?: boolean
}) {
  return (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border/50 px-5 shrink-0">
        <AppLogo size="md" />
        <div>
          <span className="text-sm font-bold tracking-tight">FinanzasIA</span>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5 font-mono">{APP_VERSION}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3 pt-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-primary' : 'group-hover:text-foreground')} />
              {label}
              {active && <ChevronRight className="ml-auto h-3 w-3 text-primary/60" />}
            </Link>
          )
        })}
        {isAdmin && (
          <Link
            href="/admin"
            onClick={onNavigate}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 mt-2 border-t border-border/30 pt-3',
              pathname.startsWith('/admin')
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <ShieldCheck className={cn('h-4 w-4 shrink-0', pathname.startsWith('/admin') ? 'text-primary' : 'group-hover:text-foreground')} />
            Administración
            {pathname.startsWith('/admin') && <ChevronRight className="ml-auto h-3 w-3 text-primary/60" />}
          </Link>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-border/50 p-3 space-y-1 shrink-0">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-150"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => {
          if (data && ['super_admin', 'admin'].includes(data.role)) setIsAdmin(true)
        })
    })
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    toast({ title: 'Sesión cerrada' })
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-60 flex-col border-r border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <NavContent
          pathname={pathname}
          onSignOut={handleSignOut}
          theme={theme}
          setTheme={setTheme}
          isAdmin={isAdmin}
        />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 border-b border-border/50 bg-background/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <AppLogo size="sm" />
          <span className="text-sm font-bold tracking-tight">FinanzasIA</span>
        </div>
        <button
          onClick={() => setMobileOpen(o => !o)}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="w-64 flex flex-col bg-card border-r border-border/50 h-full pt-14">
            <NavContent
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
              onSignOut={handleSignOut}
              theme={theme}
              setTheme={setTheme}
              isAdmin={isAdmin}
            />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}
