import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const svc = createServiceClient()
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['super_admin', 'admin'].includes(profile.role)) return null
  return user
}

// PATCH /api/admin/users/[id] — update user
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json()
  const svc = createServiceClient()

  // Update profile fields
  const profileFields: Record<string, unknown> = {}
  if (body.full_name !== undefined) profileFields.full_name = body.full_name
  if (body.role !== undefined) profileFields.role = body.role
  if (body.status !== undefined) profileFields.status = body.status
  if (body.plan !== undefined) profileFields.plan = body.plan
  if (body.plan_expires_at !== undefined) profileFields.plan_expires_at = body.plan_expires_at
  if (body.notes !== undefined) profileFields.notes = body.notes

  const { data, error } = await svc
    .from('profiles')
    .update(profileFields)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update password if provided
  if (body.password) {
    const { error: pwErr } = await svc.auth.admin.updateUserById(params.id, { password: body.password })
    if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 400 })
  }

  return NextResponse.json({ user: data })
}

// DELETE /api/admin/users/[id] — suspend or delete
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { hard } = await req.json().catch(() => ({ hard: false }))
  const svc = createServiceClient()

  if (hard) {
    await svc.auth.admin.deleteUser(params.id)
  } else {
    await svc.from('profiles').update({ status: 'suspended' }).eq('id', params.id)
  }

  return NextResponse.json({ ok: true })
}
