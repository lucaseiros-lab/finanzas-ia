import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const svc = createServiceClient()
  const { data: profile } = await svc.from('profiles').select('role,id').eq('id', user.id).single()
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) return null
  return { ...user, profileId: profile.id }
}

// GET — list invitations
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('invitations')
    .select('*, invited_by_profile:invited_by(email), used_by_profile:used_by(email)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invitations: data })
}

// POST — create invitation
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { email, plan, expires_days } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  const svc = createServiceClient()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + (expires_days || 30))

  const { data, error } = await svc
    .from('invitations')
    .insert({
      email,
      plan: plan || 'free',
      invited_by: admin.id,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invitation: data })
}

// DELETE — revoke invitation
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id } = await req.json()
  const svc = createServiceClient()
  await svc.from('invitations').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
