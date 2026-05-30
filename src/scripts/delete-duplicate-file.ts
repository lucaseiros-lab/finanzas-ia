import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hqvabrpginyfnrmpqzjb.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxdmFicnBnaW55Zm5ybXBxempiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDAxMTEwNiwiZXhwIjoyMDk1NTg3MTA2fQ.MCXDTul5DHNzuHSLKfv8D_IGTONnMfZHr0h1usodt8U'

// Transaction IDs known to be duplicates (from old file c33486a8)
const DUPLICATE_TX_IDS = [
  '7ba334db-2599-481a-9bdf-064b967ec02b',
  'e24ffe57-fbe5-4a6f-a76d-92019485ce0a',
]

const OLD_FILE_ID = 'c33486a8-28e1-4542-bc2d-a46b85a6b82b'

async function main() {
  const s = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
  })

  // Check if the known duplicate txs still exist
  const { data: check } = await s
    .from('transactions')
    .select('id, file_id, date, amount, description')
    .in('id', DUPLICATE_TX_IDS)

  console.log('Known duplicate txs still in DB:', check?.length ?? 0)
  if (check?.length) console.log(JSON.stringify(check, null, 2))

  // Count all transactions by the old file
  const { count: oldFileCount } = await s
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('file_id', OLD_FILE_ID)
  console.log('Transactions with old file_id:', oldFileCount)

  // Find ALL duplicate $3M income transactions (the ones causing $12M)
  const { data: bigIncome } = await s
    .from('transactions')
    .select('id, file_id, date, amount, description, created_at')
    .eq('amount', 3000000)
    .order('date', { ascending: false })
    .limit(20)

  console.log('$3M income transactions:', bigIncome?.length)
  console.log(JSON.stringify(bigIncome, null, 2))
}

main().catch(console.error)
