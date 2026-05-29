'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Transaction, CATEGORIES, CATEGORY_COLORS, Category } from '@/types'
import {
  Search, Filter, ChevronLeft, ChevronRight, CheckCircle2,
  AlertCircle, TrendingUp, TrendingDown, ArrowUpDown, X, Edit2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

export default function TransactionsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [type, setType] = useState(searchParams.get('type') || '')
  const [needsReview, setNeedsReview] = useState(searchParams.get('needs_review') === 'true')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const searchTimeout = useRef<NodeJS.Timeout>()

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(PAGE_SIZE))
    params.set('sort_by', sortBy)
    params.set('sort_order', sortOrder)
    if (search) params.set('search', search)
    if (category) params.set('category', category)
    if (type) params.set('type', type)
    if (needsReview) params.set('needs_review', 'true')
    return params.toString()
  }, [page, sortBy, sortOrder, search, category, type, needsReview])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions?${buildQuery()}`)
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions)
        setTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => { load() }, [load])

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [search, category, type, needsReview])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => load(), 400)
  }

  const updateCategory = async (id: string, newCategory: Category) => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: newCategory }),
    })

    if (res.ok) {
      const data = await res.json()
      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, ...data.transaction } : t)
      )
      setEditingId(null)
      toast({
        title: 'Categoría actualizada',
        description: `Aprendizaje guardado para futuros movimientos similares.`,
      })
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const activeFilters = [search, category, type, needsReview].filter(Boolean).length

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Movimientos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total.toLocaleString('es-AR')} movimientos en total
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar descripción o comercio..."
            className="pl-9 h-9"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {CATEGORIES.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="expense">Gasto</SelectItem>
            <SelectItem value="income">Ingreso</SelectItem>
            <SelectItem value="transfer">Transferencia</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={needsReview ? 'default' : 'outline'}
          size="sm"
          onClick={() => setNeedsReview(!needsReview)}
          className="h-9 gap-2"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Por revisar
        </Button>

        {activeFilters > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            onClick={() => { setSearch(''); setCategory(''); setType(''); setNeedsReview(false) }}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_140px_120px_100px_80px] gap-4 px-4 py-2.5 border-b border-border/50 bg-muted/30">
          <button
            onClick={() => { setSortBy('description'); setSortOrder(s => s === 'asc' ? 'desc' : 'asc') }}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            Descripción <ArrowUpDown className="h-3 w-3" />
          </button>
          <button
            onClick={() => { setSortBy('date'); setSortOrder(s => s === 'asc' ? 'desc' : 'asc') }}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Fecha <ArrowUpDown className="h-3 w-3" />
          </button>
          <span className="text-xs font-medium text-muted-foreground">Categoría</span>
          <button
            onClick={() => { setSortBy('amount'); setSortOrder(s => s === 'asc' ? 'desc' : 'asc') }}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors justify-end"
          >
            Importe <ArrowUpDown className="h-3 w-3" />
          </button>
          <span className="text-xs font-medium text-muted-foreground text-center">Estado</span>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-border/40">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[1fr_140px_120px_100px_80px] gap-4 px-4 py-3.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                  <Skeleton className="h-4 w-6 mx-auto" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No se encontraron movimientos</p>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearch(''); setCategory(''); setType(''); setNeedsReview(false) }}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {transactions.map(tx => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  editing={editingId === tx.id}
                  onEdit={() => setEditingId(editingId === tx.id ? null : tx.id)}
                  onCategoryChange={(cat) => updateCategory(tx.id, cat)}
                  onCancelEdit={() => setEditingId(null)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString('es-AR')}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function TransactionRow({
  tx, editing, onEdit, onCategoryChange, onCancelEdit,
}: {
  tx: Transaction
  editing: boolean
  onEdit: () => void
  onCategoryChange: (cat: Category) => void
  onCancelEdit: () => void
}) {
  const color = CATEGORY_COLORS[tx.category] || '#9ca3af'

  return (
    <div className={cn(
      'grid grid-cols-[1fr_140px_120px_100px_80px] gap-4 px-4 py-3.5 transition-colors duration-100',
      editing ? 'bg-primary/5' : 'hover:bg-muted/30',
      tx.needs_review && !editing && 'border-l-2 border-l-amber-500/60'
    )}>
      {/* Description */}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{tx.description}</p>
        {tx.merchant && tx.merchant !== tx.description && (
          <p className="text-xs text-muted-foreground truncate">{tx.merchant}</p>
        )}
        {tx.bank && (
          <p className="text-[10px] text-muted-foreground/60 truncate">{tx.bank}</p>
        )}
      </div>

      {/* Date */}
      <p className="text-sm text-muted-foreground self-center">{formatDate(tx.date)}</p>

      {/* Category */}
      <div className="self-center">
        {editing ? (
          <div className="flex flex-col gap-1">
            <Select value={tx.category} onValueChange={(v) => onCategoryChange(v as Category)}>
              <SelectTrigger className="h-7 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button onClick={onCancelEdit} className="text-[10px] text-muted-foreground hover:text-foreground text-left">
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={onEdit}
            className="group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all hover:ring-2 hover:ring-border"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {tx.category}
            <Edit2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>

      {/* Amount */}
      <div className="self-center text-right">
        <p className={cn(
          'text-sm font-semibold',
          tx.type === 'income' ? 'text-emerald-500' : tx.type === 'expense' ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
          {formatCurrency(tx.amount, tx.currency)}
        </p>
        {tx.installments && tx.installments > 1 && (
          <p className="text-[10px] text-muted-foreground">
            {tx.installment_number}/{tx.installments}
          </p>
        )}
      </div>

      {/* Status */}
      <div className="self-center flex items-center justify-center">
        {tx.needs_review ? (
          <span title="Requiere revisión"><AlertCircle className="h-4 w-4 text-amber-500" /></span>
        ) : tx.category_confirmed ? (
          <span title="Confirmado"><CheckCircle2 className="h-4 w-4 text-emerald-500" /></span>
        ) : (
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" title="Auto-categorizado" />
        )}
      </div>
    </div>
  )
}
