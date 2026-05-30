import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Category } from '@/types'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const months = parseInt(searchParams.get('months') || '12')
  const dateFrom = new Date()
  dateFrom.setMonth(dateFrom.getMonth() - months)

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('date, amount, type, category, merchant, description')
    .eq('user_id', user.id)
    .gte('date', dateFrom.toISOString().slice(0, 10))
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const txs = transactions || []

  // Totals
  const total_income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const total_expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const net = total_income - total_expenses

  // Pending review
  const { count: pending_review } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('needs_review', true)

  // Categories breakdown (expenses only)
  const categoryMap = new Map<Category, { total: number; count: number }>()
  for (const t of txs.filter(x => x.type === 'expense')) {
    const cat = t.category as Category
    const existing = categoryMap.get(cat) || { total: 0, count: 0 }
    categoryMap.set(cat, { total: existing.total + t.amount, count: existing.count + 1 })
  }
  const top_categories = Array.from(categoryMap.entries())
    .map(([category, { total, count }]) => ({ category, total, count }))
    .filter(({ category }) => category !== 'Otros')
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const expenses_by_category = top_categories.map(c => ({
    category: c.category,
    total: c.total,
    percentage: total_expenses > 0 ? (c.total / total_expenses) * 100 : 0,
  }))

  // Top merchants — clean display names
  function cleanMerchant(raw: string): string {
    return raw
      .replace(/^(debito\s+por\s+compra\s+(de\s+)?|por\s+online\s+banking\s+|debito\s+automatico\s+|debito\s+debin\s+|debito\s+transf\s+|pago\s+de\s+servicios\s+|pago\s+a\s+proveedores\s+|extraccion\s+autoservicio\s+|autoservicio\s+)/i, '')
      .replace(/\s+(s\.?a\.?|srl|s\.r\.l\.?)\.?\s*$/i, '')
      .replace(/\s*[-–]\s*\d[\d.\-/]{3,}\s*$/, '')
      .replace(/\s+\d{6,}\s*$/, '')
      .replace(/\s+id\s+\S+.*$/i, '')
      .replace(/\s+cuit\s+\S+.*$/i, '')
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase()) // Title case
  }

  const merchantMap = new Map<string, { total: number; count: number }>()
  for (const t of txs.filter(x => x.type === 'expense')) {
    const raw = t.merchant || t.description
    const m = cleanMerchant(raw)
    if (!m || m.length < 2) continue
    const existing = merchantMap.get(m) || { total: 0, count: 0 }
    merchantMap.set(m, { total: existing.total + t.amount, count: existing.count + 1 })
  }
  const top_merchants = Array.from(merchantMap.entries())
    .map(([merchant, { total, count }]) => ({ merchant, total, count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // Monthly evolution
  const monthMap = new Map<string, { income: number; expenses: number }>()
  for (const t of txs) {
    const month = t.date.slice(0, 7)
    const existing = monthMap.get(month) || { income: 0, expenses: 0 }
    if (t.type === 'income') existing.income += t.amount
    else if (t.type === 'expense') existing.expenses += t.amount
    monthMap.set(month, existing)
  }
  const monthly_evolution = Array.from(monthMap.entries())
    .map(([month, { income, expenses }]) => ({ month, income, expenses }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // Recurring expenses — clean descriptions server-side
  function cleanDesc(desc: string): string {
    return desc
      .replace(/\s+id\s+\S+.*$/i, '')
      .replace(/\s+cuit\s+\S+.*$/i, '')
      .replace(/\s*[-–]\s*\d[\d.\-/]{4,}\s*$/, '')
      .replace(/\s*:\s*\d[\d.\-/]{4,}\s*$/, '')
      .replace(/\s+\d{6,}\s*$/, '')
      .trim()
  }

  const descMap = new Map<string, { amounts: number[]; count: number; cleanLabel: string }>()
  for (const t of txs.filter(x => x.type === 'expense' && x.category !== 'Otros')) {
    const key = t.description.slice(0, 50)
    const existing = descMap.get(key) || { amounts: [], count: 0, cleanLabel: cleanDesc(t.description) }
    existing.amounts.push(t.amount)
    existing.count++
    descMap.set(key, existing)
  }
  const recurring_expenses = Array.from(descMap.values())
    .filter(v => v.count >= 2)
    .map(({ amounts, count, cleanLabel }) => ({
      description: cleanLabel,
      amount: amounts.reduce((a, b) => a + b, 0) / amounts.length,
      frequency: count >= 10 ? 'mensual' : count >= 5 ? 'bimestral' : 'ocasional',
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)

  return NextResponse.json({
    total_income,
    total_expenses,
    net,
    transaction_count: txs.length,
    pending_review: pending_review || 0,
    top_categories,
    top_merchants,
    monthly_evolution,
    expenses_by_category,
    recurring_expenses,
  })
}
