import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'ARS'): string {
  const formatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return formatter.format(amount)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function normalizePattern(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word.length > 2)
    .slice(0, 4)
    .join(' ')
}

export function detectBank(text: string): string | null {
  const normalized = text.toLowerCase()
  const banks: [string, string][] = [
    ['santander', 'Santander'],
    ['bbva', 'BBVA'],
    ['macro', 'Banco Macro'],
    ['galicia', 'Banco Galicia'],
    ['nacion', 'Banco Nación'],
    ['nación', 'Banco Nación'],
    ['icbc', 'ICBC'],
    ['hsbc', 'HSBC'],
    ['mercado pago', 'Mercado Pago'],
    ['uala', 'Ualá'],
    ['ualá', 'Ualá'],
    ['naranja', 'Naranja X'],
    ['brubank', 'Brubank'],
    ['ciudad', 'Banco Ciudad'],
    ['provincia', 'Banco Provincia'],
    ['patagonia', 'Banco Patagonia'],
    ['supervielle', 'Banco Supervielle'],
    ['comafi', 'Banco Comafi'],
    ['credicoop', 'Banco Credicoop'],
    ['hipotecario', 'Banco Hipotecario'],
    ['frances', 'BBVA'],
    ['francés', 'BBVA'],
  ]
  for (const [key, name] of banks) {
    if (normalized.includes(key)) return name
  }
  return null
}

export function parseDateArgentine(dateStr: string): Date | null {
  if (!dateStr) return null
  dateStr = dateStr.trim()

  // dd/mm/yyyy or dd-mm-yyyy
  const dmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y)
    return new Date(year, parseInt(m) - 1, parseInt(d))
  }

  // yyyy-mm-dd (ISO)
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    return new Date(dateStr.substring(0, 10))
  }

  // dd/mm/yy
  const dmyShort = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (dmyShort) {
    const [, d, m, y] = dmyShort
    return new Date(2000 + parseInt(y), parseInt(m) - 1, parseInt(d))
  }

  // Try native parse as fallback
  const d = new Date(dateStr)
  if (!isNaN(d.getTime())) return d

  return null
}

export function cleanAmount(amountStr: string): number {
  if (typeof amountStr === 'number') return amountStr
  const cleaned = String(amountStr)
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')  // Argentine: dots as thousands separator
    .replace(',', '.')   // Argentine: comma as decimal separator
    .trim()
  return parseFloat(cleaned) || 0
}
