import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) return null
  return user
}

// GET /api/admin/users — list all users
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('profiles')
    .select('id, email, full_name, role, status, plan, plan_expires_at, notes, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}

// POST /api/admin/users — create or update user
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json()
  const { email, full_name, role, status, plan, plan_expires_at, notes, password } = body

  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  const svc = createServiceClient()

  // Create user in auth (if new)
  let userId: string | undefined
  if (password) {
    const { data: authData, error: authError } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
    userId = authData.user?.id
  } else {
    // Find existing
    const { data: existing } = await svc
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    userId = existing?.id
    if (!userId) return NextResponse.json({ error: 'Usuario no encontrado. Proporcioná una contraseña para crearlo.' }, { status: 404 })
  }

  // Upsert profile
  const { data: profile, error: profileError } = await svc
    .from('profiles')
    .upsert({
      id: userId,
      email,
      full_name: full_name || null,
      role: role || 'user',
      status: status || 'active',
      plan: plan || 'free',
      plan_expires_at: plan_expires_at || null,
      notes: notes || null,
    }, { onConflict: 'id' })
    .select()
    .single()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  return NextResponse.json({ user: profile })
}
