/**
 * Parser específico para extractos Santander Argentina.
 * Maneja el formato multi-línea: Caja de Ahorro, Tarjetas Visa y Amex.
 *
 * Bugs corregidos:
 * - Año mal parseado: "24/04/2688882263" → regex ahora captura exactamente DD/MM/YY o DD/MM/20YY
 * - Sección Visa/Amex: "Tarjeta Santander" y "Visa crédito" están en líneas SEPARADAS
 * - Formato split de tarjeta: fecha sola en una línea, comprobante+monto en la siguiente
 * - "Consumos totales por tarjeta" (resumen) reseteaba sección antes de las transacciones reales
 *   → Fix: reset solo con "Consumos totales" EXACTO (fin de línea)
 * - "Saldo anterior" y "Tu pago en pesos" eran parseados como transacciones de tarjeta
 */

import { ParsedTransaction } from '@/types'
import { parseDateArgentine, cleanAmount } from '@/lib/utils'

type Section = 'account_ars' | 'account_usd' | 'visa' | 'amex' | 'other'

const SKIP_LINES = [
  'saldo inicial', 'saldo total', 'saldo anterior', 'fecha', 'comprobante', 'movimiento',
  'caja de ahorro', 'cuenta corriente', 'saldo en cuenta',
  'total a pagar', 'pago mínimo', 'pago minimo',
  'pagos totales', 'impuestos', '¿qué es', 'plan v:', 'tna:', 'tea:',
  'pago anterior', 'devoluciones', 'legales', 'fondos comunes',
  'iibb percep', 'iva rg', 'db.rg', 'cuotas a vencer',
  'total consumos', 'consumos totales por', // "por tarjeta" — NO resetear sección
  'información de la tarjeta', 'tarjeta terminada',
  'fechacomprobantedescrip', 'fechacomprobante',
  'tu pago en', 'tc1430', 'monto a pagar', 'período actual',
  'cierre anterior', 'próximo cierre', 'superclub', 'puntos disponibles',
  'así usaste', 'retiros de efectivo', 'tasa nominal', 'tasa efectiva',
]

function shouldSkip(line: string): boolean {
  const lc = line.toLowerCase()
  return SKIP_LINES.some(s => lc.startsWith(s) || lc.includes(s)) ||
    /^\d+\s*-\s*\d+$/.test(line) // page numbers like "1 - 18"
}

function cleanDesc(desc: string): string {
  return desc
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-\/]+/, '')
    .trim()
    .slice(0, 200)
}

function extractMerchantFromDesc(desc: string): string | undefined {
  const cleaned = desc
    .replace(/^(transferencia\s+realizada|transferencia\s+inmediata|debito\s+debin|pago\s+de\s+servicios|debito\s+automatico|debito\s+transf|pago\s+a\s+proveedores\s+recibido|pago\s+interes|extraccion|retiro\s+en\s+efvo|comision)\s*/i, '')
    .replace(/\s+(S\.?A\.?|SRL|S\.R\.L\.?|SA)\.?$/i, '')
    .trim()
  const words = cleaned.split(/\s+/).filter(w => w.length > 1)
  if (words.length === 0) return undefined
  return words.slice(0, 4).join(' ')
}

// Detects if a line is an amount line
function isAmountLine(line: string): boolean {
  return /^-?\s*[\$U]/.test(line) || /^-?\s*\d[\d\.,]*\s*$/.test(line)
}

// Parse amount from lines like: "-$ 79.658,00 $ 8.071.352,05"
function parseAmountLine(line: string): { amount: number; isDebit: boolean; balance?: number; currency: string } | null {
  // USD
  const usdMatch = line.match(/^(-?)U\$S\s*([\d\.]+,\d{2,})\s*(?:U\$S\s*([\d\.]+,\d{2,}))?/)
  if (usdMatch) {
    return {
      amount: cleanAmount(usdMatch[2]),
      isDebit: usdMatch[1] === '-' || line.startsWith('-'),
      balance: usdMatch[3] ? cleanAmount(usdMatch[3]) : undefined,
      currency: 'USD',
    }
  }
  // ARS debit: -$ X.XXX,XX
  const debitMatch = line.match(/^-[\$\s]*([\d\.]+,\d{2})\s*\$?\s*([\d\.]+,\d{2})?/)
  if (debitMatch) {
    return {
      amount: cleanAmount(debitMatch[1]),
      isDebit: true,
      balance: debitMatch[2] ? cleanAmount(debitMatch[2]) : undefined,
      currency: 'ARS',
    }
  }
  // ARS credit: $ X.XXX,XX
  const creditMatch = line.match(/^\$\s*([\d\.]+,\d{2})\s*\$?\s*([\d\.]+,\d{2})?/)
  if (creditMatch) {
    return {
      amount: cleanAmount(creditMatch[1]),
      isDebit: false,
      balance: creditMatch[2] ? cleanAmount(creditMatch[2]) : undefined,
      currency: 'ARS',
    }
  }
  return null
}

/**
 * Date pattern for Santander PDFs.
 * Santander uses DD/MM/YY (2-digit year) immediately followed by comprobante digits.
 * e.g. "24/04/2688882263Transferencia..." — year is 26, NOT 2688.
 * We match: 20XX (4-digit starting with 20) OR any 2-digit year.
 */
const DATE_PATTERN = /^(\d{1,2}\/\d{1,2}\/(?:20\d{2}|\d{2}))/

export function parseSantanderPDF(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  let section: Section = 'other'
  let currentCard: string | undefined
  // pendingCard tracks "Tarjeta Santander" seen on previous line
  let pendingCard = false

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // ── Section detection ──────────────────────────────────────
    // "Tarjeta Santander" is ALWAYS on its own line, followed by card type on next line
    if (/^tarjeta santander$/i.test(line)) {
      pendingCard = true; i++; continue
    }
    if (pendingCard) {
      if (/^visa\s+cr[eé]dito$/i.test(line)) {
        section = 'visa'; currentCard = 'Visa'; pendingCard = false; i++; continue
      }
      if (/^american express\s+cr[eé]dito$/i.test(line)) {
        section = 'amex'; currentCard = 'American Express'; pendingCard = false; i++; continue
      }
      pendingCard = false
    }

    if (/movimientos en pesos/i.test(line)) { section = 'account_ars'; i++; continue }
    if (/movimientos en d[oó]lares/i.test(line)) { section = 'account_usd'; i++; continue }

    // Also handle inline detection (fallback for other PDF layouts)
    if (/tarjeta santander.*visa.*cr[eé]dito/i.test(line)) {
      section = 'visa'; currentCard = 'Visa'; i++; continue
    }
    if (/american express.*cr[eé]dito/i.test(line) || /tarjeta santander.*american/i.test(line)) {
      section = 'amex'; currentCard = 'American Express'; i++; continue
    }

    if (/^consumos del mes/i.test(line)) { i++; continue }
    // Reset to 'other' only on true section boundaries
    // Reset SOLO en boundaries reales — "Consumos totales" EXACTO (no "por tarjeta")
    if (/^pagos$/i.test(line) || /^tarjetas$/i.test(line) || /^resumen de tus productos/i.test(line) || /^consumos totales$/i.test(line)) {
      section = 'other'; i++; continue
    }
    // Skip sub-headers that appear inside credit card sections (don't reset)
    if (/^pago anterior/i.test(line) || /^legales$/i.test(line) || /^impuestos$/i.test(line)) {
      i++; continue
    }
    if (section === 'other') { i++; continue }
    if (shouldSkip(line)) { i++; continue }

    // ── Date detection ─────────────────────────────────────────
    const dateMatch = line.match(DATE_PATTERN)
    if (!dateMatch) { i++; continue }

    const date = parseDateArgentine(dateMatch[1])
    if (!date || date.getFullYear() < 2000 || date.getFullYear() > 2035) { i++; continue }

    // ── Account transactions (multi-line) ──────────────────────
    if (section === 'account_ars' || section === 'account_usd') {
      // Strip date, then strip comprobante (digits immediately adjacent, NO space required)
      const afterDate = line
        .replace(DATE_PATTERN, '')    // remove DD/MM/YY
        .replace(/^\d+/, '')          // remove comprobante (digits with no space)
        .trim()

      let descParts = afterDate ? [afterDate] : []
      let amountParsed: ReturnType<typeof parseAmountLine> = null

      let j = i + 1
      while (j < lines.length && j <= i + 3) {
        const nextLine = lines[j]
        if (nextLine.match(DATE_PATTERN)) break
        if (isAmountLine(nextLine)) {
          amountParsed = parseAmountLine(nextLine)
          j++
          break
        }
        if (!shouldSkip(nextLine) && nextLine.length > 2) {
          descParts.push(nextLine)
        }
        j++
      }

      if (!amountParsed || amountParsed.amount === 0) { i = j; continue }

      const desc = cleanDesc(descParts.join(' '))
      if (!desc) { i = j; continue }

      const descLc = desc.toLowerCase()

      // Credit card payment: import as 'transfer' (not expense) so it's excluded from
      // category spending but available for cash flow analysis
      const isCreditCardPayment = /pago\s+(de\s+)?tarjeta\s+de\s+cr[eé]dito/i.test(desc)

      let type: 'income' | 'expense' | 'transfer' = amountParsed.isDebit ? 'expense' : 'income'
      if (isCreditCardPayment) type = 'transfer'
      else if (descLc.includes('transferencia')) type = amountParsed.isDebit ? 'transfer' : 'income'
      if (descLc.includes('sueldo') || descLc.includes('pago a proveedores recibido') || descLc.includes('pago recibido')) type = 'income'
      if (descLc.includes('extraccion') || descLc.includes('retiro')) type = 'expense'

      transactions.push({
        date,
        description: desc,
        merchant: extractMerchantFromDesc(desc),
        amount: amountParsed.amount,
        type,
        bank: 'Santander',
        account: section === 'account_ars' ? 'Caja de Ahorro ARS' : 'Caja de Ahorro USD',
        currency: section === 'account_usd' ? 'USD' : amountParsed.currency,
        balance: amountParsed.balance,
        raw_data: { raw_line: line },
      })

      i = j
      continue
    }

    // ── Credit card transactions ───────────────────────────────
    if (section === 'visa' || section === 'amex') {
      // Two possible formats:
      // 1. All on one line: DD/MM/YY[COMP]Description [X de X] $ amount
      // 2. Split: line = "DD/MM/YY", next line = "[COMP]Description [X de X] $ amount"

      let afterDate = line
        .replace(DATE_PATTERN, '')  // remove date
        .replace(/^\d+/, '')         // remove comprobante (no space needed)
        .trim()

      // If afterDate is empty, data is on the next line
      if (!afterDate && i + 1 < lines.length) {
        const nextLine = lines[i + 1]
        if (!nextLine.match(DATE_PATTERN) && !shouldSkip(nextLine)) {
          afterDate = nextLine
            .replace(/^\d+/, '')  // remove comprobante
            .trim()
          i++ // consume the next line
        }
      }

      if (!afterDate) { i++; continue }

      // Extract USD amount
      const usdAmtMatch = afterDate.match(/U\$S\s*([\d\.,]+)\s*$/)
      // Extract ARS amount
      const arsAmtMatch = afterDate.match(/\$\s*([\d\.]+,\d{2})\s*$/)

      let amount = 0
      let currency = 'ARS'
      let installments: number | undefined
      let installmentNum: number | undefined

      if (usdAmtMatch) {
        amount = cleanAmount(usdAmtMatch[1])
        currency = 'USD'
        afterDate = afterDate.replace(/U\$S\s*[\d\.,]+\s*$/, '').trim()
      } else if (arsAmtMatch) {
        amount = cleanAmount(arsAmtMatch[1])
        afterDate = afterDate.replace(/\$\s*[\d\.]+,\d{2}\s*$/, '').trim()
      }

      if (amount === 0) { i++; continue }

      // Detect installments: "03 de 03" or "01 de 06"
      const cuotaMatch = afterDate.match(/(\d{1,2})\s+de\s+(\d{1,2})\s*$/)
      if (cuotaMatch) {
        installmentNum = parseInt(cuotaMatch[1])
        installments = parseInt(cuotaMatch[2])
        afterDate = afterDate.replace(/\d{1,2}\s+de\s+\d{1,2}\s*$/, '').trim()
      }

      const desc = cleanDesc(afterDate)
      if (!desc || desc.length < 2) { i++; continue }

      transactions.push({
        date,
        description: desc,
        merchant: extractMerchantFromDesc(desc),
        amount,
        type: 'expense',
        bank: 'Santander',
        card: currentCard,
        currency,
        installments,
        installment_number: installmentNum,
        raw_data: { raw_line: line },
      })

      i++
      continue
    }

    i++
  }

  // Deduplicate
  const seen = new Set<string>()
  return transactions.filter(t => {
    const key = `${t.date.toISOString().slice(0, 10)}_${t.amount}_${t.description.slice(0, 25)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function isSantanderPDF(text: string): boolean {
  const sample = text.slice(0, 3000)
  return /santander/i.test(sample) ||
    /mi resumen de cuenta/i.test(sample) ||
    /movimientos en pesos/i.test(sample) ||
    /tarjeta santander/i.test(sample)
}
