export type TransactionType = 'income' | 'expense' | 'transfer'

export type Category =
  | 'Alimentación'
  | 'Supermercado'
  | 'Salud'
  | 'Farmacia'
  | 'Restaurantes'
  | 'Delivery'
  | 'Impuestos'
  | 'Servicios'
  | 'Hogar'
  | 'Expensas'
  | 'Transporte'
  | 'Combustible'
  | 'Streaming'
  | 'Suscripciones'
  | 'Ocio'
  | 'Viajes'
  | 'Educación'
  | 'Tecnología'
  | 'Seguros'
  | 'Bancos'
  | 'Comisiones'
  | 'Inversiones'
  | 'Transferencias'
  | 'Sueldos'
  | 'Ingresos'
  | 'Mercado Pago'
  | 'Efectivo'
  | 'Otros' // legacy — no mostrar en UI

export const CATEGORIES: Category[] = [
  'Alimentación',
  'Bancos',
  'Combustible',
  'Comisiones',
  'Delivery',
  'Educación',
  'Efectivo',
  'Expensas',
  'Farmacia',
  'Hogar',
  'Impuestos',
  'Ingresos',
  'Inversiones',
  'Mercado Pago',
  'Ocio',
  'Restaurantes',
  'Salud',
  'Seguros',
  'Servicios',
  'Streaming',
  'Sueldos',
  'Supermercado',
  'Suscripciones',
  'Tecnología',
  'Transferencias',
  'Transporte',
  'Viajes',
]

export const CATEGORY_COLORS: Record<Category, string> = {
  Alimentación: '#f59e0b',
  Supermercado: '#10b981',
  Salud: '#ef4444',
  Farmacia: '#ec4899',
  Restaurantes: '#f97316',
  Delivery: '#fb923c',
  Impuestos: '#dc2626',
  Servicios: '#6366f1',
  Hogar: '#8b5cf6',
  Expensas: '#7c3aed',
  Transporte: '#06b6d4',
  Combustible: '#0891b2',
  Streaming: '#a855f7',
  Suscripciones: '#9333ea',
  Ocio: '#e879f9',
  Viajes: '#14b8a6',
  Educación: '#0284c7',
  Tecnología: '#2563eb',
  Seguros: '#64748b',
  Bancos: '#334155',
  Comisiones: '#6b7280',
  Inversiones: '#16a34a',
  Transferencias: '#737373',
  Sueldos: '#22c55e',
  Ingresos: '#4ade80',
  'Mercado Pago': '#00b1ea',
  Efectivo: '#84cc16',
  Otros: '#9ca3af',
}

export interface Transaction {
  id: string
  user_id: string
  file_id: string | null
  date: string
  description: string
  merchant: string | null
  amount: number
  type: TransactionType
  category: Category
  category_confirmed: boolean
  needs_review: boolean
  bank: string | null
  account: string | null
  card: string | null
  installments: number | null
  installment_number: number | null
  balance: number | null
  currency: string
  raw_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface FileRecord {
  id: string
  user_id: string
  filename: string
  original_name: string
  bank: string | null
  account_type: string | null
  status: 'processing' | 'done' | 'error'
  error_message: string | null
  transaction_count: number
  created_at: string
  updated_at: string
}

export interface AILearning {
  id: string
  user_id: string
  pattern: string
  normalized_pattern: string
  category: Category
  confidence: number
  occurrences: number
  last_seen: string
  created_at: string
  updated_at: string
}

export interface ParsedTransaction {
  date: Date
  description: string
  merchant?: string
  amount: number
  type: TransactionType
  bank?: string
  account?: string
  card?: string
  installments?: number
  installment_number?: number
  balance?: number
  currency?: string
  raw_data?: Record<string, unknown>
}

export interface DashboardStats {
  total_income: number
  total_expenses: number
  net: number
  transaction_count: number
  pending_review: number
  top_categories: { category: Category; total: number; count: number }[]
  top_merchants: { merchant: string; total: number; count: number }[]
  monthly_evolution: { month: string; income: number; expenses: number }[]
  expenses_by_category: { category: Category; total: number; percentage: number }[]
  recurring_expenses: { description: string; amount: number; frequency: string }[]
}
