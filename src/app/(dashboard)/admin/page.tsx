'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Users, UserPlus, Mail, Shield, Trash2, Edit2, X, Check,
  RefreshCw, Copy, ChevronDown, ChevronUp, Send, Tag, Plus, GripVertical,
} from 'lucide-react'
import { CATEGORIES, CATEGORY_COLORS, Category } from '@/types'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: 'super_admin' | 'admin' | 'user'
  status: 'active' | 'suspended' | 'pending'
  plan: 'free' | 'basic' | 'pro' | 'enterprise'
  plan_expires_at: string | null
  notes: string | null
  created_at: string
}

interface Invitation {
  id: string
  email: string
  code: string
  plan: string
  used_at: string | null
  expires_at: string
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', user: 'Usuario',
}
const PLAN_LABELS: Record<string, string> = {
  free: 'Free', basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise',
}
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400',
  suspended: 'bg-red-500/15 text-red-400',
  pending: 'bg-amber-500/15 text-amber-400',
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<'users' | 'invitations' | 'categories'>('users')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-in">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-card border border-border shadow-lg rounded-lg px-4 py-3 text-sm font-medium">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administración</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gestión de usuarios, accesos y suscripciones</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([['users', 'Usuarios', Users], ['invitations', 'Invitaciones', Mail], ['categories', 'Categorías', Tag]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab onToast={showToast} />}
      {tab === 'invitations' && <InvitationsTab onToast={showToast} />}
      {tab === 'categories' && <CategoriesTab onToast={showToast} />}
    </div>
  )
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab({ onToast }: { onToast: (m: string) => void }) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const updateUser = async (id: string, patch: Partial<UserProfile & { password: string }>) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      onToast('Usuario actualizado ✓')
      load()
      setEditingId(null)
    } else {
      const d = await res.json()
      onToast(`Error: ${d.error}`)
    }
  }

  const suspendUser = async (id: string, suspend: boolean) => {
    await updateUser(id, { status: suspend ? 'suspended' : 'active' })
  }

  return (
    <div className="space-y-4">
      {/* New user button */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{users.length} usuarios registrados</p>
        <Button size="sm" className="gap-2" onClick={() => setShowForm(f => !f)}>
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      {/* New user form */}
      {showForm && (
        <NewUserForm
          onSuccess={() => { setShowForm(false); load(); onToast('Usuario creado ✓') }}
          onCancel={() => setShowForm(false)}
          onToast={onToast}
        />
      )}

      {/* Users list */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <UserRow
              key={u.id}
              user={u}
              editing={editingId === u.id}
              onEdit={() => setEditingId(editingId === u.id ? null : u.id)}
              onCancelEdit={() => setEditingId(null)}
              onUpdate={(patch) => updateUser(u.id, patch)}
              onSuspend={(s) => suspendUser(u.id, s)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NewUserForm({
  onSuccess, onCancel, onToast,
}: { onSuccess: () => void; onCancel: () => void; onToast: (m: string) => void }) {
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'user', plan: 'free' })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.email || !form.password) { onToast('Email y contraseña son requeridos'); return }
    setLoading(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (res.ok) { onSuccess() }
    else { const d = await res.json(); onToast(`Error: ${d.error}`) }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Nuevo usuario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Email *" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <Input placeholder="Nombre completo" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          <Input placeholder="Contraseña *" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          <div className="flex gap-2">
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuario</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.plan} onValueChange={v => setForm(f => ({ ...f, plan: v }))}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={loading}>
            {loading ? 'Creando...' : 'Crear usuario'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function UserRow({
  user, editing, onEdit, onCancelEdit, onUpdate, onSuspend,
}: {
  user: UserProfile
  editing: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onUpdate: (patch: Record<string, unknown>) => void
  onSuspend: (suspend: boolean) => void
}) {
  const [patch, setPatch] = useState<Record<string, string>>({})

  const handleSave = () => {
    if (Object.keys(patch).length > 0) onUpdate(patch)
    else onCancelEdit()
  }

  return (
    <div className={cn('rounded-xl border border-border/60 overflow-hidden', editing && 'border-primary/40')}>
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer"
        onClick={onEdit}
      >
        <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">
            {(user.full_name || user.email).slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[user.status])}>
            {user.status === 'active' ? 'Activo' : user.status === 'suspended' ? 'Suspendido' : 'Pendiente'}
          </span>
          <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[user.role]}</Badge>
          <Badge variant="secondary" className="text-[10px]">{PLAN_LABELS[user.plan]}</Badge>
        </div>
        <span className="text-muted-foreground ml-1">{editing ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="px-4 pb-4 pt-2 border-t border-border/40 bg-muted/10 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Nombre</p>
              <Input className="h-8 text-xs" defaultValue={user.full_name || ''} onChange={e => setPatch(p => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Rol</p>
              <Select defaultValue={user.role} onValueChange={v => setPatch(p => ({ ...p, role: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuario</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Plan</p>
              <Select defaultValue={user.plan} onValueChange={v => setPatch(p => ({ ...p, plan: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Venc. plan</p>
              <Input type="date" className="h-8 text-xs"
                defaultValue={user.plan_expires_at?.slice(0, 10) || ''}
                onChange={e => setPatch(p => ({ ...p, plan_expires_at: e.target.value }))} />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Nueva contraseña (opcional)</p>
            <Input type="password" className="h-8 text-xs" placeholder="Dejar vacío para no cambiar"
              onChange={e => setPatch(p => ({ ...p, password: e.target.value }))} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Notas internas</p>
            <Input className="h-8 text-xs" defaultValue={user.notes || ''}
              onChange={e => setPatch(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-between">
            <Button
              variant="outline"
              size="sm"
              className={cn('text-xs h-7', user.status === 'active' ? 'text-red-400 border-red-400/30 hover:bg-red-500/10' : 'text-emerald-400 border-emerald-400/30 hover:bg-emerald-500/10')}
              onClick={() => onSuspend(user.status === 'active')}
            >
              {user.status === 'active' ? 'Suspender acceso' : 'Reactivar acceso'}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancelEdit}>Cancelar</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
                <Check className="h-3 w-3 mr-1" /> Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Invitations tab ───────────────────────────────────────────────────────────

function InvitationsTab({ onToast }: { onToast: (m: string) => void }) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ email: '', plan: 'free', expires_days: '30' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/invitations')
    if (res.ok) {
      const data = await res.json()
      setInvitations(data.invitations || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.email) { onToast('Email requerido'); return }
    setCreating(true)
    const res = await fetch('/api/admin/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, expires_days: parseInt(form.expires_days) }),
    })
    setCreating(false)
    if (res.ok) { onToast('Invitación creada ✓'); setForm({ email: '', plan: 'free', expires_days: '30' }); load() }
    else { const d = await res.json(); onToast(`Error: ${d.error}`) }
  }

  const revoke = async (id: string) => {
    await fetch('/api/admin/invitations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    onToast('Invitación eliminada')
    load()
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    onToast(`Código copiado: ${code}`)
  }

  const isExpired = (d: string) => new Date(d) < new Date()

  return (
    <div className="space-y-6">
      {/* Create invitation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Crear invitación</CardTitle>
          <CardDescription className="text-xs">
            Se genera un código único. El usuario lo usa al registrarse para acceder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="email@ejemplo.com"
              className="h-9 flex-1 min-w-[200px]"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
            <Select value={form.plan} onValueChange={v => setForm(f => ({ ...f, plan: v }))}>
              <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.expires_days} onValueChange={v => setForm(f => ({ ...f, expires_days: v }))}>
              <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 días</SelectItem>
                <SelectItem value="30">30 días</SelectItem>
                <SelectItem value="90">90 días</SelectItem>
                <SelectItem value="365">1 año</SelectItem>
              </SelectContent>
            </Select>
            <Button className="h-9 gap-2" onClick={create} disabled={creating}>
              <Send className="h-4 w-4" />
              {creating ? 'Creando...' : 'Generar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invitations list */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : invitations.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No hay invitaciones aún</p>
      ) : (
        <div className="space-y-2">
          {invitations.map(inv => (
            <div key={inv.id} className={cn(
              'flex items-center gap-3 rounded-xl border px-4 py-3',
              inv.used_at ? 'border-border/40 opacity-60' : isExpired(inv.expires_at) ? 'border-red-500/30' : 'border-border/60'
            )}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{inv.email}</p>
                <p className="text-xs text-muted-foreground">
                  Plan: <span className="text-foreground">{PLAN_LABELS[inv.plan]}</span>
                  {' · '}
                  {inv.used_at
                    ? <span className="text-emerald-400">Usado {new Date(inv.used_at).toLocaleDateString('es-AR')}</span>
                    : isExpired(inv.expires_at)
                      ? <span className="text-red-400">Expirado</span>
                      : <span>Vence {new Date(inv.expires_at).toLocaleDateString('es-AR')}</span>
                  }
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!inv.used_at && (
                  <button
                    className="font-mono text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80 flex items-center gap-1"
                    onClick={() => copyCode(inv.code)}
                    title="Copiar código"
                  >
                    {inv.code}
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
                {!inv.used_at && (
                  <button onClick={() => revoke(inv.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <Card className="bg-muted/30 border-border/40">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Flujo actual:</span> creás la invitación → compartís el código por email o WhatsApp → el usuario se registra ingresando el código.<br />
            <span className="font-medium text-foreground mt-1 block">Próximamente:</span> integración con MercadoPago — al confirmar el pago, el sistema genera y envía automáticamente el código de acceso al usuario.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Categories tab ─────────────────────────────────────────────────────────────

const DEFAULT_COLORS = [
  '#f59e0b','#10b981','#ef4444','#ec4899','#f97316','#fb923c',
  '#dc2626','#6366f1','#8b5cf6','#7c3aed','#06b6d4','#0891b2',
  '#a855f7','#9333ea','#e879f9','#14b8a6','#0284c7','#2563eb',
  '#64748b','#334155','#6b7280','#16a34a','#737373','#22c55e',
  '#4ade80','#00b1ea','#84cc16','#f43f5e','#d97706','#f472b6',
]

interface CatItem {
  id: string
  name: string
  color: string
  is_default: boolean
  active: boolean
}

function CategoriesTab({ onToast }: { onToast: (m: string) => void }) {
  const [items, setItems] = useState<CatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/categories')
    if (res.ok) {
      const data = await res.json()
      // Show all (active + inactive) in admin
      const res2 = await fetch('/api/categories?all=true')
      // fallback: use normal endpoint but also fetch inactive
      setItems(data.categories || [])
    }
    setLoading(false)
  }, [])

  // Load ALL categories (including inactive) for admin
  useEffect(() => {
    fetch('/api/categories?all=true').then(r => r.json()).then(d => {
      setItems(d.categories || [])
      setLoading(false)
    })
  }, [])

  const addCategory = async () => {
    const name = newName.trim()
    if (!name) return
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: newColor }),
    })
    const data = await res.json()
    if (!res.ok) { onToast(data.error || 'Error'); return }
    setItems(prev => [...prev, data.category].sort((a, b) => a.name.localeCompare(b.name, 'es')))
    setNewName('')
    onToast(`Categoría "${name}" creada`)
  }

  const toggleActive = async (item: CatItem) => {
    const res = await fetch(`/api/categories/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    })
    if (res.ok) setItems(prev => prev.map(i => i.id === item.id ? { ...i, active: !i.active } : i))
  }

  const startEdit = (item: CatItem) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditColor(item.color)
  }

  const saveEdit = async (item: CatItem) => {
    const name = editName.trim()
    if (!name) return
    const res = await fetch(`/api/categories/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: editColor }),
    })
    if (res.ok) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, name, color: editColor } : i))
      setEditingId(null)
      onToast('Categoría actualizada')
    }
  }

  const deleteCategory = async (item: CatItem) => {
    const res = await fetch(`/api/categories/${item.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { onToast(data.error || 'Error'); return }
    setItems(prev => prev.filter(i => i.id !== item.id))
    onToast(`Categoría "${item.name}" eliminada`)
  }

  const active = items.filter(i => i.active)
  const inactive = items.filter(i => !i.active)

  if (loading) return <div className="space-y-2">{Array.from({length:6}).map((_,i)=><div key={i} className="h-10 bg-muted rounded-lg animate-pulse"/>)}</div>

  return (
    <div className="space-y-6">
      {/* Add new */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Plus className="h-4 w-4" />Nueva categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
              className="h-9 w-10 rounded-md border border-input cursor-pointer bg-transparent p-0.5" title="Color" />
            <Input placeholder="Nombre de la categoría..." value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()} className="h-9" />
            <Button size="sm" onClick={addCategory} className="h-9 shrink-0">
              <Plus className="h-4 w-4 mr-1" />Agregar
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {DEFAULT_COLORS.map(c => (
              <button key={c} onClick={() => setNewColor(c)}
                className={cn('h-5 w-5 rounded-full border-2 transition-transform hover:scale-110', newColor === c ? 'border-white scale-110' : 'border-transparent')}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Categorías activas ({active.length})</CardTitle>
          <CardDescription className="text-xs">Las base no se pueden eliminar, pero sí desactivar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {active.map(item => {
            const isEditing = editingId === item.id
            return (
              <div key={item.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 group hover:bg-muted/40 transition-colors', isEditing && 'bg-muted/60')}>
                {isEditing ? (
                  <>
                    <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
                      className="h-7 w-8 rounded border border-input cursor-pointer bg-transparent p-0.5" />
                    <Input value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit(item)}
                      className="h-7 text-sm flex-1" autoFocus />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-500" onClick={() => saveEdit(item)}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-sm flex-1">{item.name}</span>
                    {item.is_default && <span className="text-[10px] text-muted-foreground">base</span>}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(item)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-amber-500" onClick={() => toggleActive(item)} title="Desactivar">
                        <X className="h-3 w-3" />
                      </Button>
                      {!item.is_default && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteCategory(item)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Inactive */}
      {inactive.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Desactivadas ({inactive.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {inactive.map(item => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 opacity-50 hover:opacity-100 group hover:bg-muted/40 transition-all">
                <span className="h-3 w-3 rounded-full shrink-0 grayscale" style={{ backgroundColor: item.color }} />
                <span className="text-sm flex-1 line-through">{item.name}</span>
                <Button size="sm" variant="ghost" className="h-6 text-xs opacity-0 group-hover:opacity-100" onClick={() => toggleActive(item)}>
                  Reactivar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
