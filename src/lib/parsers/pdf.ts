import { ParsedTransaction } from '@/types'
import { parseDateArgentine, cleanAmount, detectBank, normalizePattern } from '@/lib/utils'
import { isSantanderPDF, parseSantanderPDF } from './santander'

interface RawRow {
  date?: string
  description?: string
  amount?: string
  debit?: string
  credit?: string
  balance?: string
  [key: string]: string | undefined
}

// Extract text from PDF buffer using pdf-parse (server-side only)
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid issues with edge runtime
  const pdfParse = (await import('pdf-parse')).default
  try {
    const data = await pdfParse(buffer, {
      // Don't load test files
      max: 0,
    })
    return data.text || ''
  } catch {
    return ''
  }
}

// Detect if PDF is image-based (no text)
export function isImagePDF(text: string): boolean {
  return text.trim().length < 100
}

// Main parser: takes raw text, returns transactions
export function parsePDFText(text: string, filename: string): ParsedTransaction[] {
  // Santander has a unique multi-line format — use dedicated parser
  if (isSantanderPDF(text)) {
    return parseSantanderPDF(text)
  }

  const bank = detectBank(text) || detectBank(filename) || undefined

  // Try multiple parsing strategies in order of confidence
  const strategies = [
    parseTabularFormat,
    parseLineByLine,
    parseColumnFormat,
  ]

  for (const strategy of strategies) {
    const result = strategy(text, bank)
    if (result.length > 0) return result
  }

  return []
}

// Strategy 1: Parse when text has clear tabular rows (most bank PDFs)
function parseTabularFormat(text: string, bank?: string): ParsedTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const transactions: ParsedTransaction[] = []

  // Regex patterns for Argentine dates
  const datePattern = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/
  // Amount pattern: handles 1.234,56 or 1234,56 or -1234.56
  const amountPattern = /(-?\$?\s*[\d\.]+,\d{2}|-?\$?\s*\d+\.\d{2})/g

  for (const line of lines) {
    // Skip obvious headers/footers
    if (isHeaderOrFooter(line)) continue

    const dateMatch = line.match(datePattern)
    if (!dateMatch) continue

    const date = parseDateArgentine(dateMatch[1])
    if (!date || date.getFullYear() < 2000) continue

    const amounts = [...line.matchAll(amountPattern)].map(m => cleanAmount(m[1]))
    if (amounts.length === 0) continue

    // Remove date and amounts from description
    const desc = line
      .replace(datePattern, '')
      .replace(amountPattern, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (desc.length < 2) continue

    const amount = Math.abs(amounts[0])
    if (amount === 0) continue

    // Detect income vs expense from context
    const type = detectTransactionType(line, desc, amounts)
    const merchant = extractMerchant(desc)

    // Detect installments: "2/6", "cuota 2 de 6"
    const installMatch = desc.match(/(\d+)[\/\s]de[\/\s]?(\d+)|cuota\s+(\d+)\s+de\s+(\d+)/i)

    transactions.push({
      date,
      description: cleanDescription(desc),
      merchant,
      amount,
      type,
      bank,
      installments: installMatch ? parseInt(installMatch[2] || installMatch[4]) : undefined,
      installment_number: installMatch ? parseInt(installMatch[1] || installMatch[3]) : undefined,
      balance: amounts.length >= 2 ? Math.abs(amounts[amounts.length - 1]) : undefined,
      currency: detectCurrency(line),
      raw_data: { raw_line: line },
    })
  }

  return deduplicate(transactions)
}

// Strategy 2: Line-by-line with context from adjacent lines
function parseLineByLine(text: string, bank?: string): ParsedTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const transactions: ParsedTransaction[] = []

  const amountLinePattern = /^-?\$?\s*[\d\.,]+$/
  const datePattern = /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (isHeaderOrFooter(line)) { i++; continue }

    const dateMatch = line.match(datePattern)
    if (!dateMatch) { i++; continue }

    const date = parseDateArgentine(dateMatch[1])
    if (!date) { i++; continue }

    // Collect next lines as description + amount
    let desc = line.replace(datePattern, '').trim()
    let amountStr = ''
    let j = i + 1

    while (j < lines.length && j < i + 4) {
      const next = lines[j]
      if (amountLinePattern.test(next)) {
        amountStr = next
        break
      }
      if (next.match(datePattern)) break
      desc += ' ' + next
      j++
    }

    if (!amountStr) { i++; continue }

    const amount = Math.abs(cleanAmount(amountStr))
    if (amount === 0) { i++; continue }

    const type = detectTransactionType(desc, desc, [parseFloat(amountStr)])
    transactions.push({
      date,
      description: cleanDescription(desc),
      merchant: extractMerchant(desc),
      amount,
      type,
      bank,
      currency: 'ARS',
      raw_data: { raw_line: line + ' ' + amountStr },
    })

    i = j + 1
  }

  return deduplicate(transactions)
}

// Strategy 3: Column detection
function parseColumnFormat(text: string, bank?: string): ParsedTransaction[] {
  const lines = text.split('\n')
  const transactions: ParsedTransaction[] = []

  // Find lines that look like transactions (date + text + numbers)
  const txPattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([\d\.,]+)\s*([\d\.,]+)?/

  for (const line of lines) {
    if (isHeaderOrFooter(line)) continue
    const match = line.match(txPattern)
    if (!match) continue

    const date = parseDateArgentine(match[1])
    if (!date) continue

    const desc = match[2].trim()
    const amount = Math.abs(cleanAmount(match[3]))
    if (amount === 0) continue

    transactions.push({
      date,
      description: cleanDescription(desc),
      merchant: extractMerchant(desc),
      amount,
      type: detectTransactionType(line, desc, [amount]),
      bank,
      balance: match[4] ? Math.abs(cleanAmount(match[4])) : undefined,
      currency: 'ARS',
      raw_data: { raw_line: line },
    })
  }

  return deduplicate(transactions)
}

// Helpers

function isHeaderOrFooter(line: string): boolean {
  const lc = line.toLowerCase()
  const keywords = [
    'página', 'page', 'saldo anterior', 'saldo inicial', 'total', 'subtotal',
    'fecha de emisión', 'fecha emisión', 'período', 'periodo', 'vencimiento',
    'titular', 'número de cuenta', 'nro. cuenta', 'extracto', 'resumen',
    'haber', 'debe', 'importe', 'descripción', 'detalle', 'fecha',
    'www.', 'http', '@', 'tel:', 'telefono', 'sucursal', 'cuit',
    'atte.', 'atentamente', 'contacto', 'consultas',
  ]
  return keywords.some(k => lc.includes(k)) && line.split(/\s+/).length < 6
}

function detectTransactionType(
  rawLine: string,
  desc: string,
  amounts: number[]
): 'income' | 'expense' | 'transfer' {
  const lc = (rawLine + ' ' + desc).toLowerCase()

  // Income signals
  const incomeSignals = [
    'acreditacion', 'acreditación', 'credito', 'crédito', 'haber',
    'transferencia recibida', 'pago recibido', 'deposito', 'depósito',
    'sueldo', 'salario', 'honorarios', 'reintegro', 'devolucion', 'devolución',
    'ingreso', 'cobro', 'percibido', 'rem.', 'remuneracion',
  ]

  // Transfer signals
  const transferSignals = [
    'transferencia', 'traspaso', 'movimiento entre cuentas',
    'débito automático', 'debito automatico',
  ]

  if (amounts[0] < 0 || rawLine.match(/\([\d\.,]+\)/)) return 'expense'
  if (incomeSignals.some(s => lc.includes(s))) return 'income'
  if (transferSignals.some(s => lc.includes(s))) return 'transfer'

  return 'expense'
}

function extractMerchant(description: string): string | undefined {
  // Remove common prefixes
  const cleaned = description
    .replace(/^(compra\s+|pago\s+|débito\s+|debito\s+|transferencia\s+)/i, '')
    .replace(/\s+(S\.?A\.?|SRL|S\.R\.L\.?|SA)\.?$/i, '')
    .trim()

  // First significant word cluster (up to 3 words)
  const words = cleaned.split(/\s+/).filter(w => w.length > 1)
  if (words.length === 0) return undefined

  return words.slice(0, 3).join(' ')
}

function cleanDescription(desc: string): string {
  return desc
    .replace(/\s+/g, ' ')
    .replace(/^[^a-záéíóúüñA-Z0-9]+/, '')
    .replace(/[^a-záéíóúüñA-Z0-9\s\.\,\-\/\(\)]+$/, '')
    .trim()
    .slice(0, 200)
}

function detectCurrency(line: string): string {
  if (line.includes('USD') || line.includes('U$S') || line.includes('US$')) return 'USD'
  if (line.includes('EUR') || line.includes('€')) return 'EUR'
  return 'ARS'
}

function deduplicate(transactions: ParsedTransaction[]): ParsedTransaction[] {
  const seen = new Set<string>()
  return transactions.filter(t => {
    const key = `${t.date.toISOString().slice(0, 10)}_${t.amount}_${normalizePattern(t.description).slice(0, 20)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
