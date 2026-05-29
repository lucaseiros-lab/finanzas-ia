import * as XLSX from 'xlsx'
import { ParsedTransaction } from '@/types'
import { parseDateArgentine, cleanAmount, detectBank, normalizePattern } from '@/lib/utils'

export function parseExcelBuffer(
  buffer: Buffer,
  filename: string
): ParsedTransaction[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const bank = detectBank(filename) || undefined

  const allTransactions: ParsedTransaction[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows: Record<string, unknown>[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      dateNF: 'dd/mm/yyyy',
    })

    if (rows.length < 2) continue

    const transactions = parseSheetRows(rows, bank)
    allTransactions.push(...transactions)
  }

  return deduplicate(allTransactions)
}

export function parseCSVBuffer(
  buffer: Buffer,
  filename: string
): ParsedTransaction[] {
  const bank = detectBank(filename) || undefined
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const allTransactions: ParsedTransaction[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows: Record<string, unknown>[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
    })
    if (rows.length < 2) continue
    allTransactions.push(...parseSheetRows(rows, bank))
  }

  return deduplicate(allTransactions)
}

function parseSheetRows(
  rows: unknown[][],
  bank?: string
): ParsedTransaction[] {
  if (rows.length === 0) return []

  // Find header row (first row with recognizable column names)
  let headerIdx = -1
  let colMap: ColMap = {}

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const map = detectColumns(rows[i] as string[])
    if (map.date !== undefined && (map.amount !== undefined || map.debit !== undefined)) {
      headerIdx = i
      colMap = map
      break
    }
  }

  // If no header found, try heuristic column detection on first data row
  if (headerIdx === -1) {
    colMap = guessColumnsFromData(rows)
    headerIdx = 0
  }

  const transactions: ParsedTransaction[] = []
  const startRow = headerIdx + 1

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i] as string[]
    if (!row || row.every(c => !c)) continue

    const dateStr = getString(row, colMap.date)
    if (!dateStr) continue

    const date = parseDateArgentine(dateStr)
    if (!date || date.getFullYear() < 2000 || date.getFullYear() > 2030) continue

    const description = getString(row, colMap.description) || getString(row, colMap.concept) || ''
    if (!description && !getString(row, colMap.merchant)) continue

    let amount = 0
    let type: 'income' | 'expense' | 'transfer' = 'expense'

    if (colMap.debit !== undefined && colMap.credit !== undefined) {
      const debit = Math.abs(cleanAmount(getString(row, colMap.debit) || '0'))
      const credit = Math.abs(cleanAmount(getString(row, colMap.credit) || '0'))
      if (credit > 0) {
        amount = credit
        type = 'income'
      } else {
        amount = debit
        type = 'expense'
      }
    } else if (colMap.amount !== undefined) {
      const raw = cleanAmount(getString(row, colMap.amount) || '0')
      amount = Math.abs(raw)
      type = raw < 0 ? 'income' : 'expense'

      // Check type column
      const typeStr = getString(row, colMap.type)?.toLowerCase() || ''
      if (typeStr.includes('cred') || typeStr.includes('hab') || typeStr.includes('ingr')) type = 'income'
      else if (typeStr.includes('deb') || typeStr.includes('egr')) type = 'expense'
    }

    if (amount === 0) continue

    const merchant = getString(row, colMap.merchant)
    const balance = colMap.balance !== undefined
      ? Math.abs(cleanAmount(getString(row, colMap.balance) || '0'))
      : undefined

    // Installment detection
    const fullDesc = [description, merchant].filter(Boolean).join(' ')
    const installMatch = fullDesc.match(/(\d+)[\/\s](\d+)|cuota\s+(\d+)\s+de\s+(\d+)/i)

    transactions.push({
      date,
      description: cleanDesc(fullDesc || 'Sin descripción'),
      merchant: merchant || extractMerchantFromDesc(description) || undefined,
      amount,
      type,
      bank,
      account: getString(row, colMap.account) || undefined,
      card: getString(row, colMap.card) || undefined,
      installments: installMatch ? parseInt(installMatch[2] || installMatch[4]) : undefined,
      installment_number: installMatch ? parseInt(installMatch[1] || installMatch[3]) : undefined,
      balance,
      currency: detectCurrency(description + (getString(row, colMap.currency) || '')),
      raw_data: { row_index: i },
    })
  }

  return transactions
}

interface ColMap {
  date?: number
  description?: number
  concept?: number
  merchant?: number
  amount?: number
  debit?: number
  credit?: number
  balance?: number
  type?: number
  account?: number
  card?: number
  currency?: number
}

const DATE_ALIASES = ['fecha', 'date', 'fec', 'día', 'dia', 'f.', 'fecha op', 'fecha ope']
const DESC_ALIASES = ['descripcion', 'descripción', 'detalle', 'concepto', 'movimiento', 'description', 'detail', 'glosa', 'referencia']
const MERCHANT_ALIASES = ['comercio', 'establecimiento', 'merchant', 'local', 'negocio', 'razón social']
const AMOUNT_ALIASES = ['importe', 'monto', 'amount', 'valor', 'total', 'imp.']
const DEBIT_ALIASES = ['débito', 'debito', 'egreso', 'cargo', 'debe', 'debit', 'gasto']
const CREDIT_ALIASES = ['crédito', 'credito', 'ingreso', 'abono', 'haber', 'credit', 'acred']
const BALANCE_ALIASES = ['saldo', 'balance', 'saldo final', 'sal.']
const TYPE_ALIASES = ['tipo', 'type', 't/c', 'clase']
const ACCOUNT_ALIASES = ['cuenta', 'account', 'nro cuenta']
const CARD_ALIASES = ['tarjeta', 'card', 'nro tarjeta', 'ultimos digitos']
const CURRENCY_ALIASES = ['moneda', 'currency', 'divisa']

function detectColumns(headerRow: string[]): ColMap {
  const map: ColMap = {}
  if (!headerRow) return map

  headerRow.forEach((cell, idx) => {
    if (!cell) return
    const normalized = String(cell).toLowerCase().trim()

    if (DATE_ALIASES.some(a => normalized.includes(a))) map.date = map.date ?? idx
    else if (MERCHANT_ALIASES.some(a => normalized.includes(a))) map.merchant = map.merchant ?? idx
    else if (DESC_ALIASES.some(a => normalized.includes(a))) map.description = map.description ?? idx
    else if (DEBIT_ALIASES.some(a => normalized.includes(a))) map.debit = map.debit ?? idx
    else if (CREDIT_ALIASES.some(a => normalized.includes(a))) map.credit = map.credit ?? idx
    else if (BALANCE_ALIASES.some(a => normalized.includes(a))) map.balance = map.balance ?? idx
    else if (AMOUNT_ALIASES.some(a => normalized.includes(a))) map.amount = map.amount ?? idx
    else if (TYPE_ALIASES.some(a => normalized.includes(a))) map.type = map.type ?? idx
    else if (ACCOUNT_ALIASES.some(a => normalized.includes(a))) map.account = map.account ?? idx
    else if (CARD_ALIASES.some(a => normalized.includes(a))) map.card = map.card ?? idx
    else if (CURRENCY_ALIASES.some(a => normalized.includes(a))) map.currency = map.currency ?? idx
  })

  return map
}

function guessColumnsFromData(rows: unknown[][]): ColMap {
  // Find first row that looks like it has a date
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i] as string[]
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '')
      if (cell.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/)) {
        // Assume: col j = date, j+1 = description, last numeric = amount
        const map: ColMap = { date: j, description: j + 1 }
        // Find last numeric column
        for (let k = row.length - 1; k > j + 1; k--) {
          const val = cleanAmount(String(row[k] || ''))
          if (val !== 0) {
            map.amount = k
            break
          }
        }
        return map
      }
    }
  }
  return {}
}

function getString(row: unknown[], idx?: number): string {
  if (idx === undefined || !row || idx >= row.length) return ''
  return String(row[idx] ?? '').trim()
}

function cleanDesc(desc: string): string {
  return desc.replace(/\s+/g, ' ').trim().slice(0, 200)
}

function extractMerchantFromDesc(desc: string): string | null {
  const words = desc.split(/\s+/).filter(w => w.length > 2)
  if (words.length === 0) return null
  return words.slice(0, 3).join(' ')
}

function detectCurrency(text: string): string {
  if (/USD|U\$S|US\$|dolar/i.test(text)) return 'USD'
  if (/EUR|€|euro/i.test(text)) return 'EUR'
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
