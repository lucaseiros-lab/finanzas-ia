import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePattern } from '@/lib/utils'
import { Category } from '@/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { category, needs_review, category_confirmed } = body

  const serviceClient = createServiceClient()

  // Get the transaction first
  const { data: tx, error: txError } = await serviceClient
    .from('transactions')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (txError || !tx) {
    return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
  }

  // Update transaction
  const updateData: Record<string, unknown> = {}
  if (category !== undefined) {
    updateData.category = category
    updateData.category_confirmed = true
    updateData.needs_review = false
  }
  if (needs_review !== undefined) updateData.needs_review = needs_review
  if (category_confirmed !== undefined) updateData.category_confirmed = category_confirmed

  const { data: updated, error: updateError } = await serviceClient
    .from('transactions')
    .update(updateData)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Save to AI learning whenever user explicitly confirms a category
  if (category && (category_confirmed || category !== tx.category)) {
    const normalized = normalizePattern(tx.description)

    await serviceClient
      .from('ai_learning')
      .upsert(
        {
          user_id: user.id,
          pattern: tx.description,
          normalized_pattern: normalized,
          category: category as Category,
          confidence: 1.0,
          occurrences: 1,
          last_seen: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,normalized_pattern',
          ignoreDuplicates: false,
        }
      )

    // Also update similar transactions (same merchant, not yet confirmed)
    if (tx.merchant) {
      await serviceClient
        .from('transactions')
        .update({ category, needs_review: false })
        .eq('user_id', user.id)
        .eq('merchant', tx.merchant)
        .eq('category_confirmed', false)
        .neq('id', params.id)
    }
  }

  return NextResponse.json({ transaction: updated })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('transactions')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
