'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CATEGORY_COLORS, Category } from '@/types'
import { useCategories } from '@/hooks/useCategories'
import { formatCurrency } from '@/lib/utils'
import { CheckCircle2, ChevronDown, ChevronUp, Layers, ArrowLeft, ArrowRight, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TxRow {
  id: string
  date: string
  description: string
  amount: number
  currency: string
  category: Category
  card: string | null
}

interface Group {
  key: string
  label: string
  fullDescription: string
  count: number
  total: number
  currency: string
  suggestedCategory: Category
  transactions: TxRow[]
  saved: boolean
  skipped: boolean
}

function normalizeKey(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length > 2)
    .slice(0, 3)
    .join(' ')
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="h-8 w-48 bg-muted rounded animate-pulse" /></div>}>
      <ReviewInner />
    </Suspense>
  )
}

function ReviewInner() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cursor, setCursor] = useState(0)   // index into pending[]
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const { categories: userCategories } = useCategories()
  const cardRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/transactions?needs_review=true&limit=500&page=1')
      if (!res.ok) return
      const data = await res.json()
      const txs: TxRow[] = data.transactions
      setTotal(data.total)

      const map = new Map<string, TxRow[]>()
      for (const tx of txs) {
        const key = normalizeKey(tx.description)
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(tx)
      }

      const built: Group[] = []
      for (const [key, items] of map.entries()) {
        const first = items[0]
        const catCount = new Map<string, number>()
        for (const t of items) catCount.set(t.category, (catCount.get(t.category) || 0) + 1)
        const suggestedCategory = ([...catCount.entries()].sort((a, b) => b[1] - a[1])[0][0]) as Category

        built.push({
          key,
          label: first.description.split(' ').slice(0, 5).join(' '),
          fullDescription: first.description,
          count: items.length,
          total: items.reduce((s, t) => s + t.amount, 0),
          currency: first.currency,
          suggestedCategory,
          transactions: items,
          saved: false,
          skipped: false,
        })
      }

      built.sort((a, b) => b.count - a.count)
      setGroups(built)
      setCursor(0)
      setDone(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Focus card on mount / cursor change for keyboard nav
  useEffect(() => {
    cardRef.current?.focus()
    setExpanded(false)
  }, [cursor])

  const pending = groups.filter(g => !g.saved && !g.skipped)
  const completed = groups.filter(g => g.saved)
  const currentGroup = pending[cursor]
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  const applyCategory = useCallback(async (category: Category) => {
    if (!currentGroup || saving) return
    setSaving(true)
    try {
      await Promise.all(
        currentGroup.transactions.map(tx =>
          fetch(`/api/transactions/${tx.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, category_confirmed: true }),
          })
        )
      )
      setGroups(prev => prev.map(g =>
        g.key === currentGroup.key ? { ...g, saved: true, suggestedCategory: category } : g
      ))
      setDone(d => d + currentGroup.count)
      // Advance cursor (stay at same index — next item slides in)
      setCursor(c => Math.min(c, pending.length - 2))
    } finally {
      setSaving(false)
    }
  }, [currentGroup, saving, pending.length])

  const skipGroup = useCallback(() => {
    if (!currentGroup) return
    setGroups(prev => prev.map(g =>
      g.key === currentGroup.key ? { ...g, skipped: true } : g
    ))
    setCursor(c => Math.min(c, pending.length - 2))
  }, [currentGroup, pending.length])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor(c => Math.min(c + 1, pending.length - 1))
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor(c => Math.max(c - 1, 0))
      }
      if (e.key === 'Enter' && currentGroup) {
        e.preventDefault()
        applyCategory(currentGroup.suggestedCategory)
      }
      if (e.key === 'Escape') skipGroup()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentGroup, pending.length, applyCategory, skipGroup])

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-2xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-amber-500" />
            Revisión rápida
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pending.length} grupos · {total} transacciones
            {' · '}
            <kbd className="text-xs bg-muted px-1 rounded">←→</kbd> navegar
            {' · '}
            <kbd className="text-xs bg-muted px-1 rounded">↵</kbd> aprobar sugerencia
          </p>
        </div>
        {pending.length > 0 && (
          <span className="text-sm font-medium text-muted-foreground">
            {cursor + 1} / {pending.length}
          </span>
        )}
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{done} aprobadas</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}

      {pending.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
            <p className="font-medium">¡Todo revisado!</p>
            <p className="text-sm text-muted-foreground mt-1">No hay transacciones pendientes</p>
            {groups.filter(g => g.skipped).length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setGroups(prev => prev.map(g => ({ ...g, skipped: false })))
                  setCursor(0)
                }}
              >
                Revisar {groups.filter(g => g.skipped).length} omitidas
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Main card */}
          <div
            ref={cardRef}
            tabIndex={0}
            className="outline-none"
          >
            <Card className="border-amber-500/40 bg-amber-500/5 shadow-sm">
              <CardContent className="p-5 space-y-4">
                {/* Top: description + meta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-base leading-tight truncate">
                      {currentGroup.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {currentGroup.fullDescription}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-sm">{formatCurrency(currentGroup.total, currentGroup.currency)}</p>
                    <p className="text-xs text-muted-foreground">{currentGroup.count}x</p>
                  </div>
                </div>

                {/* Suggested category highlight */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sugerida:</span>
                  <button
                    onClick={() => applyCategory(currentGroup.suggestedCategory)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    style={{
                      borderColor: CATEGORY_COLORS[currentGroup.suggestedCategory] || '#9ca3af',
                      color: CATEGORY_COLORS[currentGroup.suggestedCategory] || '#9ca3af',
                      backgroundColor: `${CATEGORY_COLORS[currentGroup.suggestedCategory] || '#9ca3af'}15`,
                    }}
                  >
                    {saving ? (
                      <span className="h-3 w-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    {currentGroup.suggestedCategory}
                    <span className="text-xs opacity-60 ml-0.5">[↵]</span>
                  </button>
                </div>

                {/* Category grid */}
                <div className="flex flex-wrap gap-1.5">
                  {userCategories
                    .filter(c => c.name !== 'Otros' && c.name !== currentGroup.suggestedCategory)
                    .map(c => {
                      const color = CATEGORY_COLORS[c.name as Category] || c.color || '#9ca3af'
                      return (
                        <button
                          key={c.name}
                          onClick={() => applyCategory(c.name as Category)}
                          disabled={saving}
                          className="px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-40 border"
                          style={{
                            borderColor: `${color}50`,
                            color,
                            backgroundColor: `${color}10`,
                          }}
                        >
                          {c.name}
                        </button>
                      )
                    })}
                </div>

                {/* Expand transactions */}
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {expanded ? 'Ocultar' : `Ver ${currentGroup.count} movimientos`}
                </button>

                {expanded && (
                  <div className="space-y-1 border-t border-border/40 pt-2">
                    {currentGroup.transactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between text-xs py-0.5 gap-2">
                        <span className="text-muted-foreground truncate flex-1">{tx.description}</span>
                        <span className="shrink-0">{tx.date}</span>
                        <span className="shrink-0 font-medium">{formatCurrency(tx.amount, tx.currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCursor(c => Math.max(c - 1, 0))}
              disabled={cursor === 0}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Anterior
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={skipGroup}
              className="gap-1 text-muted-foreground"
            >
              <SkipForward className="h-4 w-4" /> Omitir
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCursor(c => Math.min(c + 1, pending.length - 1))}
              disabled={cursor >= pending.length - 1}
              className="gap-1"
            >
              Siguiente <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Queue preview: next 3 */}
          {pending.length > 1 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs text-muted-foreground">Próximos</p>
              {pending.slice(cursor + 1, cursor + 4).map((g, i) => (
                <button
                  key={g.key}
                  onClick={() => setCursor(cursor + 1 + i)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-5 w-5 rounded-md bg-amber-500/10 text-amber-600 text-xs font-bold flex items-center justify-center shrink-0">
                      {g.count}
                    </span>
                    <span className="text-sm truncate">{g.label}</span>
                  </div>
                  <span className="text-xs ml-2 shrink-0" style={{ color: CATEGORY_COLORS[g.suggestedCategory] || '#9ca3af' }}>
                    {g.suggestedCategory}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Completed summary (collapsed) */}
      {completed.length > 0 && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer select-none list-none flex items-center gap-1 pt-2 border-t border-border/30">
            <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
            {completed.length} grupos aprobados esta sesión
          </summary>
          <div className="mt-2 space-y-1">
            {completed.map(g => (
              <div key={g.key} className="flex items-center gap-2 py-0.5 opacity-50 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="truncate flex-1">{g.label}</span>
                <span style={{ color: CATEGORY_COLORS[g.suggestedCategory] }}>{g.suggestedCategory}</span>
                <span className="text-muted-foreground">{g.count}x</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
