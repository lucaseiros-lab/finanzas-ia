export type TransactionType = 'income' | 'expense' | 'transfer'

export type Category =
  | 'Alimentación'
  | 'Bancos'
  | 'Cafeterías'
  | 'Combustible'
  | 'Comisiones'
  | 'Cuidado personal'
  | 'Delivery'
  | 'Educación'
  | 'Efectivo'
  | 'Expensas'
  | 'Farmacia'
  | 'Gastos Papá'
  | 'Hogar'
  | 'Impuestos'
  | 'Ingresos'
  | 'Inversiones'
  | 'Mercado Pago'
  | 'Ocio'
  | 'Restaurantes'
  | 'Ropa'
  | 'Salud'
  | 'Seguros'
  | 'Servicios'
  | 'Sueldos'
  | 'Supermercado'
  | 'Suscripciones'
  | 'Tecnología'
  | 'Transferencias'
  | 'Transporte'
  | 'Viajes'
  | 'Otros' // legacy — no mostrar en UI

export const CATEGORIES: Category[] = [
  'Alimentación',
  'Bancos',
  'Cafeterías',
  'Combustible',
  'Comisiones',
  'Cuidado personal',
  'Delivery',
  'Educación',
  'Efectivo',
  'Expensas',
  'Farmacia',
  'Gastos Papá',
  'Hogar',
  'Impuestos',
  'Ingresos',
  'Inversiones',
  'Mercado Pago',
  'Ocio',
  'Restaurantes',
  'Ropa',
  'Salud',
  'Seguros',
  'Servicios',
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
  Bancos: '#334155',
  'Cafeterías': '#d97706',
  Combustible: '#0891b2',
  Comisiones: '#6b7280',
  'Cuidado personal': '#f472b6',
  Delivery: '#fb923c',
  Educación: '#0284c7',
  Efectivo: '#84cc16',
  Expensas: '#7c3aed',
  Farmacia: '#ec4899',
  'Gastos Papá': '#a855f7',
  Hogar: '#8b5cf6',
  Impuestos: '#dc2626',
  Ingresos: '#4ade80',
  Inversiones: '#16a34a',
  'Mercado Pago': '#00b1ea',
  Ocio: '#e879f9',
  Restaurantes: '#f97316',
  Ropa: '#f43f5e',
  Salud: '#ef4444',
  Seguros: '#64748b',
  Servicios: '#6366f1',
  Sueldos: '#22c55e',
  Supermercado: '#10b981',
  Suscripciones: '#9333ea',
  Tecnología: '#2563eb',
  Transferencias: '#737373',
  Transporte: '#06b6d4',
  Viajes: '#14b8a6',
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
