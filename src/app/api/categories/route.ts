import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CATEGORIES, CATEGORY_COLORS } from '@/types'

// Seed defaults for a new user
async function seedDefaults(userId: string, service: ReturnType<typeof createServiceClient>) {
  const rows = CATEGORIES.map((name, i) => ({
    user_id: userId,
    name,
    color: CATEGORY_COLORS[name] || '#9ca3af',
    active: true,
    is_default: true,
    sort_order: i,
  }))
  await service.from('user_categories').insert(rows)
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const showAll = new URL(request.url).searchParams.get('all') === 'true'
  const service = createServiceClient()

  let query = service
    .from('user_categories')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (!showAll) query = query.eq('active', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Seed defaults on first use
  if (!data || data.length === 0) {
    await seedDefaults(user.id, service)
    const { data: seeded } = await service
      .from('user_categories').select('*').eq('user_id', user.id)
      .order('sort_order', { ascending: true })
    return NextResponse.json({ categories: seeded || [] })
  }

  return NextResponse.json({ categories: data })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { name, color } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('user_categories')
    .insert({ user_id: user.id, name: name.trim(), color: color || '#9ca3af', active: true, is_default: false, sort_order: 999 })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Esa categoría ya existe' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ category: data })
}
