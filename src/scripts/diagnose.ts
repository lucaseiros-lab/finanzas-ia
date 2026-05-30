/**
 * Global deduplication: keeps the most recently imported copy of each transaction.
 * Duplicates = same (user_id, date, amount, currency, description first 60 chars).
 * Preserves category/category_confirmed from the most recently confirmed copy.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

async function main() {
  const s = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  console.log('Loading all transactions...')
  const all: any[] = []
  let page = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await s
      .from('transactions')
      .select('id, user_id, date, amount, currency, description, file_id, created_at, category, category_confirmed, needs_review')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)
    if (error) { console.error(error.message); break }
    if (!data?.length) break
    all.push(...data)
    if (data.length < pageSize) break
    page++
  }
  console.log(`Loaded ${all.length} transactions`)

  // Dedup: key = user_id + date + amount + currency + first 60 chars of description
  const seen = new Map<string, any>() // key -> best tx to keep
  const toDelete: string[] = []

  for (const tx of all) {
    const key = `${tx.user_id}|${tx.date}|${tx.amount}|${tx.currency}|${tx.description.slice(0, 60).toLowerCase().trim()}`
    if (!seen.has(key)) {
      seen.set(key, tx)
    } else {
      const existing = seen.get(key)!
      // Prefer the one with category_confirmed, otherwise keep more recent
      if (!existing.category_confirmed && tx.category_confirmed) {
        toDelete.push(existing.id)
        seen.set(key, tx)
      } else {
        toDelete.push(tx.id)
      }
    }
  }

  console.log(`Unique transactions: ${seen.size}`)
  console.log(`Duplicates to delete: ${toDelete.length}`)

  if (toDelete.length === 0) {
    console.log('Nothing to delete!')
    return
  }

  // Delete in batches of 200
  let deleted = 0
  for (let i = 0; i < toDelete.length; i += 200) {
    const batch = toDelete.slice(i, i + 200)
    const { error } = await s.from('transactions').delete().in('id', batch)
    if (error) { console.error('Delete error:', error.message); break }
    deleted += batch.length
    process.stdout.write(`\rDeleted ${deleted}/${toDelete.length}...`)
  }

  console.log(`\nDone! Deleted ${deleted} duplicate transactions.`)

  // Verify
  const { count } = await s.from('transactions').select('*', { count: 'exact', head: true })
  console.log(`Remaining: ${count} transactions`)

  const { data: income } = await s
    .from('transactions')
    .select('amount')
    .eq('type', 'income')
    .gte('date', '2026-04-30')
  const total = (income || []).reduce((s: number, t: any) => s + t.amount, 0)
  console.log(`Income last 30d: $${total.toLocaleString()} (${income?.length} txs)`)
}

main().catch(console.error)
