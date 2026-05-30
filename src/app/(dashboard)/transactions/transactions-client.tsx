'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Transaction, CATEGORY_COLORS, Category } from '@/types'
import { useCategories } from '@/hooks/useCategories'
import {
  Search, ChevronLeft, ChevronRight, CheckCircle2,
  AlertCircle, ArrowUpDown, X, Edit2, Banknote, Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 100

// Radix Select no acepta value="" — usamos sentinel "all"
const ALL = '__all__'

// Logos inline SVG para Visa y Amex
function VisaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 16" className={className} aria-label="Visa">
      <text x="0" y="13" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="14" fill="#1a1f71">VISA</text>
    </svg>
  )
}
function AmexLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 16" className={className} aria-label="American Express">
      <rect width="56" height="16" rx="2" fill="#016FD0"/>
      <text x="4" y="12" fontFamily="Arial" fontWeight="700" fontSize="9" fill="white">AMEX</text>
    </svg>
  )
}

export function TransactionsClient() {
  return (
    <Suspense fallback={<div className="p-8"><div className="h-8 w-48 bg-muted rounded animate-pulse" /></div>}>
      <TransactionsInner />
    </Suspense>
  )
}

function TransactionsInner() {
  const searchParams = useSearchParams()
  const { categories: userCategories } = useCategories()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL)
  const [type, setType] = useState(ALL)
  const [accountFilter, setAccountFilter] = useState(ALL)
  const [needsReview, setNeedsReview] = useState(() => searchParams.get('needs_review') === 'true')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(PAGE_SIZE))
    params.set('sort_by', sortBy)
    params.set('sort_order', sortOrder)
    if (search) params.set('search', search)
    if (category !== ALL) params.set('category', category)
    if (type !== ALL) params.set('type', type)
    if (accountFilter !== ALL) params.set('account_filter', accountFilter)
    if (needsReview) params.set('needs_review', 'true')
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    return params.toString()
  }, [page, sortBy, sortOrder, search, category, type, accountFilter, needsReview, dateFrom, dateTo])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions?${buildQuery()}`)
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions ?? [])
        setTotal(data.total ?? 0)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [buildQuery])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, category, type, accountFilter, needsReview, dateFrom, dateTo])

  useEffect(() => {
    if (!toastMsg) return
    const t = setTimeout(() => setToastMsg(null), 3000)
    return () => clearTimeout(t)
  }, [toastMsg])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => load(), 400)
  }

  const updateCategory = async (id: string, newCategory: Category) => {
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      })
      if (res.ok) {
        const data = await res.json()
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...data.transaction } : t))
        setEditingId(null)
        setToastMsg('Categoría actualizada ✓')
      }
    } catch { /* ignore */ }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const activeFilters = [search, category !== ALL, type !== ALL, accountFilter !== ALL, needsReview, dateFrom, dateTo].filter(Boolean).length

  // Group by account/card for display
  const grouped = groupTransactions(transactions)

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-in">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 bg-card border border-border shadow-lg rounded-lg px-4 py-3 text-sm font-medium">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Movimientos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {total.toLocaleString('es-AR')} movimientos totales
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9 h-9" value={search}
            onChange={e => handleSearchChange(e.target.value)} />
        </div>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las categorías</SelectItem>
            {userCategories.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[120px] h-9">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no_transfer">Gastos e Ingresos</SelectItem>
            <SelectItem value={ALL}>Todos (incl. transferencias)</SelectItem>
            <SelectItem value="expense">Solo gastos</SelectItem>
            <SelectItem value="income">Solo ingresos</SelectItem>
            <SelectItem value="transfer">Transferencias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="Cuenta / Tarjeta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las cuentas</SelectItem>
            <SelectItem value="ars">🏦 Caja de Ahorro $</SelectItem>
            <SelectItem value="usd">🏦 Caja de Ahorro U$S</SelectItem>
            <SelectItem value="visa">💳 Visa</SelectItem>
            <SelectItem value="amex">💳 American Express</SelectItem>
          </SelectContent>
        </Select>

        {/* Date range */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-[130px]"
            title="Desde"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-[130px]"
            title="Hasta"
          />
        </div>

        <Button variant={needsReview ? 'default' : 'outline'} size="sm"
          onClick={() => setNeedsReview(r => !r)} className="h-9 gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Por revisar</span>
          {needsReview && <span className="hidden sm:inline">→ activo</span>}
        </Button>

        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground"
            onClick={() => { setSearch(''); setCategory(ALL); setType(ALL); setAccountFilter(ALL); setNeedsReview(false); setDateFrom(''); setDateTo('') }}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">No se encontraron movimientos</p>
            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" className="mt-2"
                onClick={() => { setSearch(''); setCategory(ALL); setType(ALL); setNeedsReview(false) }}>
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* When filtering, show flat list */}
          {activeFilters > 0 ? (
            <TransactionTable
              transactions={transactions}
              editingId={editingId}
              setEditingId={setEditingId}
              updateCategory={updateCategory}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
            />
          ) : (
            /* Grouped by account/card */
            <>
              {grouped.map(group => (
                <AccountGroup
                  key={group.key}
                  group={group}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  updateCategory={updateCategory}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  sortOrder={sortOrder}
                  setSortOrder={setSortOrder}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString('es-AR')}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8"
              disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">{page} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8"
              disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Grouping logic ─────────────────────────────────────────────────────────────

interface TxGroup {
  key: string
  label: string
  icon: 'bank' | 'visa' | 'amex' | 'other'
  currency: string
  transactions: Transaction[]
  totalIncome: number
  totalExpense: number
  totalIncomeUSD: number
  totalExpenseUSD: number
}

function groupTransactions(txs: Transaction[]): TxGroup[] {
  const map = new Map<string, Transaction[]>()

  for (const tx of txs) {
    const key = tx.card
      ? tx.card.toLowerCase().replace(/\s/g, '_')
      : tx.account
        ? tx.account.toLowerCase().replace(/\s/g, '_')
        : 'otros'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(tx)
  }

  const groups: TxGroup[] = []
  for (const [key, items] of map.entries()) {
    const first = items[0]
    const label = first.card
      ? `Tarjeta ${first.card}`
      : first.account || 'Otros'
    const icon: TxGroup['icon'] =
      label.toLowerCase().includes('visa') ? 'visa' :
      label.toLowerCase().includes('amex') || label.toLowerCase().includes('american') ? 'amex' :
      first.account ? 'bank' : 'other'

    const ars = items.filter(t => (t.currency === 'ARS' || !t.currency) && t.type !== 'transfer')
    const usd = items.filter(t => t.currency === 'USD' && t.type !== 'transfer')

    groups.push({
      key,
      label,
      icon,
      currency: 'ARS',
      transactions: items,
      totalIncome: ars.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      totalExpense: ars.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      totalIncomeUSD: usd.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      totalExpenseUSD: usd.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    })
  }

  // Sort: bank first, then cards
  const order = { bank: 0, visa: 1, amex: 2, other: 3 }
  return groups.sort((a, b) => order[a.icon] - order[b.icon])
}

// ── Account group component ────────────────────────────────────────────────────

function AccountGroup({
  group, editingId, setEditingId, updateCategory, sortBy, setSortBy, sortOrder, setSortOrder,
}: {
  group: TxGroup
  editingId: string | null
  setEditingId: (id: string | null) => void
  updateCategory: (id: string, cat: Category) => void
  sortBy: string
  setSortBy: (s: string) => void
  sortOrder: 'asc' | 'desc'
  setSortOrder: (s: 'asc' | 'desc') => void
}) {
  const [open, setOpen] = useState(true)
  const iconEl =
    group.icon === 'visa' ? <VisaLogo className="h-4 w-8" /> :
    group.icon === 'amex' ? <AmexLogo className="h-4 w-10" /> :
    group.icon === 'bank' ? <Banknote className="h-4 w-4 text-orange-400" /> :
    <Wallet className="h-4 w-4 text-muted-foreground" />

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      {/* Group header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-card border border-border/50">
          {iconEl}
        </span>
        <span className="font-semibold text-sm flex-1">{group.label}</span>
        <span className="text-xs text-muted-foreground mr-2">{group.transactions.length} mov.</span>

        {/* Totals */}
        <div className="hidden sm:flex items-center gap-4 text-xs mr-2">
          {group.totalIncome > 0 && (
            <span className="text-emerald-500 font-medium">
              +{formatCurrency(group.totalIncome, 'ARS')}
            </span>
          )}
          {group.totalExpense > 0 && (
            <span className="text-red-400 font-medium">
              -{formatCurrency(group.totalExpense, 'ARS')}
            </span>
          )}
          {group.totalExpenseUSD > 0 && (
            <span className="text-orange-400 font-medium text-[11px]">
              -{formatCurrency(group.totalExpenseUSD, 'USD')}
            </span>
          )}
        </div>

        <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {/* Mobile totals */}
      {open && (
        <div className="sm:hidden flex gap-3 px-4 py-2 bg-muted/20 border-b border-border/40 text-xs">
          {group.totalIncome > 0 && <span className="text-emerald-500">+{formatCurrency(group.totalIncome, 'ARS')}</span>}
          {group.totalExpense > 0 && <span className="text-red-400">-{formatCurrency(group.totalExpense, 'ARS')}</span>}
          {group.totalExpenseUSD > 0 && <span className="text-orange-400">-{formatCurrency(group.totalExpenseUSD, 'USD')}</span>}
        </div>
      )}

      {/* Table */}
      {open && (
        <TransactionTable
          transactions={group.transactions}
          editingId={editingId}
          setEditingId={setEditingId}
          updateCategory={updateCategory}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
        />
      )}
    </div>
  )
}

// ── Flat transaction table ─────────────────────────────────────────────────────

function TransactionTable({
  transactions, editingId, setEditingId, updateCategory, sortBy, setSortBy, sortOrder, setSortOrder,
}: {
  transactions: Transaction[]
  editingId: string | null
  setEditingId: (id: string | null) => void
  updateCategory: (id: string, cat: Category) => void
  sortBy: string
  setSortBy: (s: string) => void
  sortOrder: 'asc' | 'desc'
  setSortOrder: (s: 'asc' | 'desc') => void
}) {
  return (
    <div>
      {/* Desktop header */}
      <div className="hidden md:grid grid-cols-[1fr_120px_130px_110px_60px] gap-3 px-4 py-2 border-b border-border/40 bg-muted/20">
        <button onClick={() => { setSortBy('description'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground text-left">
          Descripción <ArrowUpDown className="h-3 w-3" />
        </button>
        <button onClick={() => { setSortBy('date'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          Fecha <ArrowUpDown className="h-3 w-3" />
        </button>
        <span className="text-xs font-medium text-muted-foreground">Categoría</span>
        <button onClick={() => { setSortBy('amount'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground justify-end">
          Importe <ArrowUpDown className="h-3 w-3" />
        </button>
        <span className="text-xs font-medium text-muted-foreground text-center">Rev.</span>
      </div>

      <div className="divide-y divide-border/30">
        {transactions.map(tx => (
          <TransactionRow key={tx.id} tx={tx}
            editing={editingId === tx.id}
            onEdit={() => setEditingId(editingId === tx.id ? null : tx.id)}
            onCategoryChange={cat => updateCategory(tx.id, cat)}
            onCancelEdit={() => setEditingId(null)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Single row ─────────────────────────────────────────────────────────────────

function TransactionRow({ tx, editing, onEdit, onCategoryChange, onCancelEdit }: {
  tx: Transaction
  editing: boolean
  onEdit: () => void
  onCategoryChange: (cat: Category) => void
  onCancelEdit: () => void
}) {
  const { categories: userCategories } = useCategories()
  const color = CATEGORY_COLORS[tx.category] || '#9ca3af'

  return (
    <>
      {/* Desktop */}
      <div className={cn(
        'hidden md:grid grid-cols-[1fr_120px_130px_110px_60px] gap-3 px-4 py-3 transition-colors',
        editing ? 'bg-primary/5' : 'hover:bg-muted/20',
        tx.needs_review && !editing && 'border-l-2 border-l-amber-500/50'
      )}>
        <div className="min-w-0 flex items-center gap-2">
          {tx.card === 'Visa' && <VisaLogo className="h-4 w-8 shrink-0" />}
          {tx.card === 'American Express' && <AmexLogo className="h-4 w-10 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm truncate">{tx.description}</p>
            {tx.merchant && tx.merchant !== tx.description && (
              <p className="text-xs text-muted-foreground/70 truncate">{tx.merchant}</p>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground self-center">{formatDate(tx.date)}</p>
        <div className="self-center">
          {editing ? (
            <div className="flex flex-col gap-1">
              <Select value={tx.category} onValueChange={v => onCategoryChange(v as Category)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {userCategories.map(c => <SelectItem key={c.name} value={c.name} className="text-xs">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <button onClick={onCancelEdit} className="text-[10px] text-muted-foreground hover:text-foreground">Cancelar</button>
            </div>
          ) : (
            <button onClick={onEdit}
              className="group flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium hover:ring-1 hover:ring-border"
              style={{ backgroundColor: `${color}18`, color }}>
              {tx.category}
              <Edit2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
            </button>
          )}
        </div>
        <div className="self-center text-right">
          <p className={cn('text-sm font-medium tabular-nums',
            tx.type === 'income' ? 'text-emerald-500' : 'text-foreground')}>
            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
          </p>
          {tx.installments && tx.installments > 1 && (
            <p className="text-[10px] text-muted-foreground">{tx.installment_number}/{tx.installments}</p>
          )}
        </div>
        <div className="self-center flex justify-center">
          {tx.needs_review
            ? <AlertCircle className="h-4 w-4 text-amber-500" />
            : tx.category_confirmed
              ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              : <div className="h-2 w-2 rounded-full bg-muted-foreground/25" />}
        </div>
      </div>

      {/* Mobile */}
      <div className={cn(
        'md:hidden px-4 py-3 transition-colors',
        editing ? 'bg-primary/5' : 'active:bg-muted/20',
        tx.needs_review && 'border-l-2 border-l-amber-500/50'
      )} onClick={onEdit}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {tx.card === 'Visa' && <VisaLogo className="h-3.5 w-7 shrink-0" />}
              {tx.card === 'American Express' && <AmexLogo className="h-3.5 w-9 shrink-0" />}
              <p className="text-sm truncate">{tx.description}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(tx.date)} · <span style={{ color }}>{tx.category}</span>
            </p>
          </div>
          <p className={cn('text-sm font-medium shrink-0 tabular-nums',
            tx.type === 'income' ? 'text-emerald-500' : 'text-foreground')}>
            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
          </p>
        </div>
        {editing && (
          <div className="mt-2" onClick={e => e.stopPropagation()}>
            <Select value={tx.category} onValueChange={v => onCategoryChange(v as Category)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {userCategories.map(c => <SelectItem key={c.name} value={c.name} className="text-xs">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </>
  )
}
