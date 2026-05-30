/**
 * Script: borrar todas las transacciones del usuario y reimportar el PDF con el parser actual
 * Uso: npx tsx src/scripts/reimport-clean.ts
 */
import { createClient } from '@supabase/supabase-js'
import { parseSantanderPDF } from '../lib/parsers/santander'
import pdfParse from 'pdf-parse'
import fs from 'fs'

const SUPABASE_URL = 'https://hqvabrpginyfnrmpqzjb.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxdmFicnBnaW55Zm5ybXBxempiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDAxMTEwNiwiZXhwIjoyMDk1NTg3MTA2fQ.MCXDTul5DHNzuHSLKfv8D_IGTONnMfZHr0h1usodt8U'
const USER_EMAIL = 'lucaseiros@gmail.com'
const PDF_PATH = 'C:/Users/lucas/Downloads/Santander Abril 2026.pdf'

function normalizePattern(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .split(' ').filter(w => w.length > 2).slice(0, 4).join(' ')
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Supermercado': ['coto', 'dia', 'carrefour', 'walmart', 'jumbo', 'disco', 'vea', 'super', 'mercado'],
  'Delivery': ['pedidosya', 'rappi', 'uber eats', 'glovo', 'delivery', 'pedidos'],
  'Restaurantes': ['restaurant', 'resto', 'burger', 'mcdonalds', 'wendys', 'pizza', 'sushi', 'cafe', 'cafeteria', 'parrilla'],
  'Servicios': ['edesur', 'edenor', 'aysa', 'metrogas', 'movistar', 'claro', 'personal', 'telecentro', 'fibertel', 'cablevision', 'flow', 'personalcable'],
  'Impuestos': ['arba', 'agip', 'afip', 'iva', 'ingresos brutos', 'abl', 'agip inm'],
  'Expensas': ['expensas', 'administrac', 'consorcio', 'cons prop'],
  'Hogar': ['ikea', 'easy', 'sodimac', 'home', 'boulanger', 'falabella'],
  'Salud': ['farmacity', 'drogueria', 'clinica', 'hospital', 'medico', 'doctor', 'laboratorio', 'osde', 'swiss', 'galeno'],
  'Farmacia': ['farmacia', 'farma'],
  'Seguros': ['seguros', 'seguro', 'allianz', 'zurich', 'sancor', 'federacion patro', 'federation'],
  'Gastos Papá': ['netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'apple tv', 'paramount', 'youtube premium'],
  'Suscripciones': ['suscripcion', 'subscription', 'adobe', 'microsoft', 'google one', 'icloud'],
  'Transporte': ['uber', 'cabify', 'taxi', 'remis', 'sube', 'colectivo', 'subte', 'tren', 'trenes', 'aeropuerto'],
  'Combustible': ['ypf', 'shell', 'axion', 'petrobras', 'nafta', 'combustible', 'estacion'],
  'Mercado Pago': ['mercado pago', 'mercadopago', 'debito debin', 'id debin'],
  'Efectivo': ['extraccion', 'cajero', 'atm', 'autoservicio'],
  'Ropa': ['zara', 'h&m', 'hm', 'forever 21', 'adidas', 'nike', 'lacoste', 'indumentaria', 'ropa', 'vestimenta'],
  'Inversiones': ['fondo', 'cedear', 'bono', 'plazo fijo', 'inversion'],
  'Bancos': ['comision', 'mantenimiento', 'costo tarjeta'],
  'Educación': ['escuela', 'colegio', 'universidad', 'instituto', 'curso', 'academia'],
  'Tecnología': ['apple', 'samsung', 'lenovo', 'dell', 'computo', 'tech'],
  'Ocio': ['cine', 'teatro', 'casino', 'entradas', 'ticket'],
  'Viajes': ['aerol', 'aerolineas', 'hotel', 'booking', 'airbnb', 'despegar', 'pasaje'],
  'Ingresos': ['sueldo', 'salario', 'haberes', 'honorarios', 'ingreso', 'pago a proveedores recibido', 'acreditacion'],
  'Transferencias': ['transferencia', 'transfer'],
}

function autoCategory(description: string, type: string, learned: Map<string, string>): string {
  if (type === 'transfer') return 'Transferencias'
  if (type === 'income') return 'Ingresos'
  // Check learned patterns first
  const norm = normalizePattern(description)
  if (learned.has(norm)) return learned.get(norm)!
  // Partial match: if any learned key is contained in norm or vice versa
  for (const [key, cat] of learned.entries()) {
    if (norm.includes(key) || key.includes(norm)) return cat
  }
  const desc = description.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => desc.includes(k))) return cat
  }
  return 'Otros'
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // 1. Get user ID
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers()
  if (userErr) throw userErr
  const user = users.users.find(u => u.email === USER_EMAIL)
  if (!user) throw new Error(`Usuario ${USER_EMAIL} no encontrado`)
  console.log(`✓ Usuario: ${user.id}`)

  // 2. Delete all transactions
  const { error: delErr } = await supabase.from('transactions').delete().eq('user_id', user.id)
  if (delErr) throw delErr
  console.log('✓ Transacciones eliminadas')

  // 3. Delete all files records
  const { error: delFilesErr } = await supabase.from('files').delete().eq('user_id', user.id)
  if (delFilesErr) console.warn('⚠ files delete:', delFilesErr.message)
  else console.log('✓ Archivos eliminados')

  // 3b. Load AI learning patterns
  const { data: learningData } = await supabase.from('ai_learning').select('normalized_pattern, category').eq('user_id', user.id)
  const learned = new Map<string, string>((learningData || []).map(l => [l.normalized_pattern, l.category]))
  console.log(`✓ Patrones aprendidos: ${learned.size}`)

  // 4. Parse PDF
  const buf = fs.readFileSync(PDF_PATH)
  const data = await pdfParse(buf)
  const txs = parseSantanderPDF(data.text)
  console.log(`✓ Parser: ${txs.length} transacciones (${txs.filter(t=>t.card==='Visa').length} Visa, ${txs.filter(t=>t.card==='American Express').length} Amex)`)

  // 5. Create file record
  const { data: fileRecord, error: fileErr } = await supabase.from('files').insert({
    user_id: user.id,
    filename: `reimport_${Date.now()}_Santander Abril 2026.pdf`,
    original_name: 'Santander Abril 2026.pdf',
    bank: 'Santander',
    status: 'done',
    transaction_count: txs.length,
  }).select().single()
  if (fileErr) throw fileErr
  console.log(`✓ File record: ${fileRecord.id}`)

  // 6. Build and insert records
  const records = txs.map(t => ({
    user_id: user.id,
    file_id: fileRecord.id,
    date: t.date.toISOString().slice(0, 10),
    description: t.description,
    merchant: t.merchant || null,
    amount: t.amount,
    type: t.type,
    category: autoCategory(t.description, t.type, learned),
    category_confirmed: false,
    needs_review: false,
    bank: t.bank || 'Santander',
    account: t.account || null,
    card: t.card || null,
    installments: t.installments || null,
    installment_number: t.installment_number || null,
    balance: t.balance || null,
    currency: t.currency || 'ARS',
    raw_data: t.raw_data || null,
  }))

  // Mark needs_review for Otros
  records.forEach(r => { if (r.category === 'Otros') r.needs_review = true })

  const { error: insertErr } = await supabase.from('transactions').insert(records)
  if (insertErr) throw insertErr

  // Stats
  const byCard: Record<string, number> = {}
  records.forEach(r => {
    const key = r.card || (r.currency === 'USD' ? 'Caja USD' : 'Caja ARS')
    byCard[key] = (byCard[key] || 0) + 1
  })
  const transfers = records.filter(r => r.type === 'transfer').length

  console.log('\n✅ IMPORTACIÓN COMPLETA')
  console.log(`   Total: ${records.length} transacciones`)
  Object.entries(byCard).forEach(([k, v]) => console.log(`   ${k}: ${v}`))
  console.log(`   Transferencias (ocultas por defecto): ${transfers}`)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
