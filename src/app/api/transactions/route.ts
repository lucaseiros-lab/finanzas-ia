import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const category = searchParams.get('category')
  const type = searchParams.get('type')
  const bank = searchParams.get('bank')
  const needs_review = searchParams.get('needs_review')
  const search = searchParams.get('search')
  const date_from = searchParams.get('date_from')
  const date_to = searchParams.get('date_to')
  const sort_by = searchParams.get('sort_by') || 'date'
  const sort_order = searchParams.get('sort_order') || 'desc'

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)

  if (category) query = query.eq('category', category)
  if (type) query = query.eq('type', type)
  if (bank) query = query.eq('bank', bank)
  if (needs_review === 'true') query = query.eq('needs_review', true)
  if (date_from) query = query.gte('date', date_from)
  if (date_to) query = query.lte('date', date_to)
  if (search) {
    query = query.or(`description.ilike.%${search}%,merchant.ilike.%${search}%`)
  }

  const validSortColumns = ['date', 'amount', 'category', 'description', 'created_at']
  const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'date'
  query = query.order(sortColumn, { ascending: sort_order === 'asc' })

  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    transactions: data || [],
    total: count || 0,
    page,
    limit,
    pages: Math.ceil((count || 0) / limit),
  })
}
