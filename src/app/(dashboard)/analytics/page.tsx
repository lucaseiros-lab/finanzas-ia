'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { CATEGORY_COLORS, DashboardStats, Category } from '@/types'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  Radar, PieChart, Pie, Cell, Legend,
} from 'recharts'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold mb-1 text-sm">{label}</p>}
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color || entry.fill }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState(12)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard?months=${months}`)
      if (res.ok) setStats(await res.json())
    } finally {
      setLoading(false)
    }
  }, [months])

  useEffect(() => { load() }, [load])

  const avgMonthlyExpense = stats && stats.monthly_evolution.length > 0
    ? stats.monthly_evolution.reduce((s, m) => s + m.expenses, 0) / stats.monthly_evolution.length
    : 0

  const avgMonthlyIncome = stats && stats.monthly_evolution.length > 0
    ? stats.monthly_evolution.reduce((s, m) => s + m.income, 0) / stats.monthly_evolution.length
    : 0

  const radarData = stats?.top_categories.slice(0, 8).map(c => ({
    category: c.category.length > 12 ? c.category.slice(0, 12) + '…' : c.category,
    value: c.total,
  })) || []

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Análisis profundo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tendencias y patrones de gasto</p>
        </div>
        <div className="flex items-center gap-2">
          {[3, 6, 12].map(m => (
            <Button key={m} variant={months === m ? 'default' : 'outline'} size="sm" onClick={() => setMonths(m)}>
              {m}m
            </Button>
          ))}
          <Button variant="ghost" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Gasto mensual promedio',
            value: loading ? null : formatCurrency(avgMonthlyExpense),
            icon: TrendingDown,
            color: 'text-red-500',
            bg: 'bg-red-500/10',
          },
          {
            label: 'Ingreso mensual promedio',
            value: loading ? null : formatCurrency(avgMonthlyIncome),
            icon: TrendingUp,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
          },
          {
            label: 'Categorías activas',
            value: loading ? null : String(stats?.top_categories.length || 0),
            icon: TrendingUp,
            color: 'text-brand-400',
            bg: 'bg-brand-500/10',
          },
          {
            label: 'Gastos recurrentes',
            value: loading ? null : String(stats?.recurring_expenses.length || 0),
            icon: RefreshCw,
            color: 'text-violet-400',
            bg: 'bg-violet-500/10',
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="p-5">
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${bg} mb-3`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className="text-xs text-muted-foreground">{label}</p>
            {loading
              ? <Skeleton className="h-7 w-28 mt-1" />
              : <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            }
          </Card>
        ))}
      </div>

      {/* Monthly bar comparison */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Gastos por mes</CardTitle>
          <CardDescription>Evolución del gasto mensual</CardDescription>
        </CardHeader>
        <CardContent>
          {loading
            ? <Skeleton className="h-64 w-full" />
            : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats?.monthly_evolution || []} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} className="fill-muted-foreground" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="expenses" name="Gastos" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="income" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </CardContent>
      </Card>

      {/* Two charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Radar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Radar de categorías</CardTitle>
            <CardDescription>Distribución proporcional de gasto</CardDescription>
          </CardHeader>
          <CardContent>
            {loading
              ? <Skeleton className="h-64 w-full" />
              : (
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid className="stroke-border" />
                    <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Radar
                      name="Gasto"
                      dataKey="value"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </RadarChart>
                </ResponsiveContainer>
              )
            }
          </CardContent>
        </Card>

        {/* Full category breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Desglose completo</CardTitle>
            <CardDescription>Todas las categorías con % del total</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)
              : (stats?.expenses_by_category || []).map(({ category, total, percentage }) => (
                <div key={category} className="flex items-center gap-2.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[category] || '#9ca3af' }}
                  />
                  <span className="text-xs flex-1 truncate">{category}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: CATEGORY_COLORS[category] || '#9ca3af',
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-9 text-right">{percentage.toFixed(1)}%</span>
                    <span className="text-xs font-medium w-28 text-right">{formatCurrency(total)}</span>
                  </div>
                </div>
              ))
            }
          </CardContent>
        </Card>
      </div>

      {/* Recurring table */}
      {!loading && stats?.recurring_expenses && stats.recurring_expenses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Gastos recurrentes detectados</CardTitle>
            <CardDescription>
              Patrones que se repiten — candidatos a presupuestar o cortar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/40">
              {stats.recurring_expenses.map(({ description, amount, frequency }) => (
                <div key={description} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{description}</p>
                    <Badge variant="secondary" className="text-[10px] h-4 mt-0.5 capitalize">{frequency}</Badge>
                  </div>
                  <p className="text-sm font-semibold shrink-0 ml-4">{formatCurrency(amount)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
