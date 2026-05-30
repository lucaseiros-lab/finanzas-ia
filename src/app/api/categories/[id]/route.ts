import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const allowed: Record<string, unknown> = {}
  if (body.name !== undefined) allowed.name = body.name.trim()
  if (body.color !== undefined) allowed.color = body.color
  if (body.active !== undefined) allowed.active = body.active

  const service = createServiceClient()
  const { data, error } = await service
    .from('user_categories')
    .update(allowed)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ category: data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const service = createServiceClient()

  // Only allow deleting non-default categories
  const { data: cat } = await service.from('user_categories').select('is_default').eq('id', params.id).single()
  if (cat?.is_default) return NextResponse.json({ error: 'No se pueden eliminar categorías base' }, { status: 403 })

  const { error } = await service
    .from('user_categories')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
