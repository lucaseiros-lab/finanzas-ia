'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { CATEGORY_COLORS, DashboardStats } from '@/types'
import {
  TrendingUp, TrendingDown, ArrowRight, AlertCircle,
  Wallet, ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend,
  BarChart, Bar,
} from 'recharts'

function StatCard({
  title, value, subtitle, trend, icon: Icon, colorClass = 'text-foreground', loading,
}: {
  title: string
  value: string
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  icon: React.ElementType
  colorClass?: string
  loading?: boolean
}) {
  if (loading) return (
    <Card className="p-6">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-8 w-36 mb-2" />
      <Skeleton className="h-3 w-20" />
    </Card>
  )

  return (
    <Card className="p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center bg-muted`}>
          <Icon className={`h-4 w-4 ${colorClass}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold tracking-tight ${colorClass}`}>{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
          {trend === 'up' && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
          {trend === 'down' && <ArrowDownRight className="h-3 w-3 text-red-500" />}
          {subtitle}
        </p>
      )}
    </Card>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-sm">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }} className="text-xs">
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
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

  const net = stats ? stats.net : 0
  const netPositive = net >= 0

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Resumen financiero de los últimos {months} meses</p>
        </div>
        <div className="flex items-center gap-2">
          {[3, 6, 12].map(m => (
            <Button
              key={m}
              variant={months === m ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMonths(m)}
            >
              {m}m
            </Button>
          ))}
          <Button variant="ghost" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Pending review alert */}
      {stats && stats.pending_review > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-sm">
            <span className="font-medium text-amber-500">{stats.pending_review} movimientos</span>
            <span className="text-muted-foreground"> necesitan revisión de categoría.</span>
          </p>
          <Link href="/transactions?needs_review=true" className="ml-auto">
            <Button variant="outline" size="sm" className="h-7 text-xs">
              Revisar <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Ingresos totales"
          value={stats ? formatCurrency(stats.total_income) : '—'}
          subtitle={`${stats?.transaction_count || 0} movimientos`}
          icon={TrendingUp}
          colorClass="text-emerald-500"
          loading={loading}
        />
        <StatCard
          title="Gastos totales"
          value={stats ? formatCurrency(stats.total_expenses) : '—'}
          icon={TrendingDown}
          colorClass="text-red-500"
          loading={loading}
        />
        <StatCard
          title="Balance neto"
          value={stats ? formatCurrency(Math.abs(net)) : '—'}
          subtitle={netPositive ? 'Superávit' : 'Déficit'}
          trend={netPositive ? 'up' : 'down'}
          icon={Wallet}
          colorClass={netPositive ? 'text-emerald-500' : 'text-red-500'}
          loading={loading}
        />
        <StatCard
          title="Pendientes"
          value={stats ? String(stats.pending_review) : '—'}
          subtitle="Requieren revisión"
          icon={AlertCircle}
          colorClass="text-amber-500"
          loading={loading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Monthly evolution (2/3 width) */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolución mensual</CardTitle>
            <CardDescription>Ingresos vs gastos por mes</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={stats?.monthly_evolution || []} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="income" name="Ingresos" stroke="#10b981" fill="url(#incomeGrad)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="expenses" name="Gastos" stroke="#ef4444" fill="url(#expensesGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie chart (1/3 width) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gastos por categoría</CardTitle>
            <CardDescription>Distribución del período</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={stats?.expenses_by_category.slice(0, 8) || []}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {(stats?.expenses_by_category.slice(0, 8) || []).map((entry, i) => (
                      <Cell
                        key={entry.category}
                        fill={CATEGORY_COLORS[entry.category] || '#9ca3af'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--popover))',
                      color: 'hsl(var(--popover-foreground))',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top categories */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top categorías de gasto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
            ) : (
              (stats?.top_categories.slice(0, 7) || []).map(({ category, total, count }) => {
                const pct = stats!.total_expenses > 0 ? (total / stats!.total_expenses) * 100 : 0
                return (
                  <div key={category} className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[category] || '#9ca3af' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm truncate">{category}</span>
                        <span className="text-sm font-medium ml-2 shrink-0">{formatCurrency(total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[category] || '#9ca3af' }}
                        />
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px] h-5">{count}</Badge>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Top merchants */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top comercios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
            ) : (
              (stats?.top_merchants.slice(0, 7) || []).map(({ merchant, total, count }, i) => (
                <div key={merchant} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                    <span className="text-sm truncate font-medium">{merchant}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-xs text-muted-foreground">{count}x</span>
                    <span className="text-sm font-semibold">{formatCurrency(total)}</span>
                  </div>
                </div>
              ))
            )}
            {!loading && (!stats?.top_merchants || stats.top_merchants.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sin datos aún. <Link href="/import" className="text-primary hover:underline">Importá un extracto</Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recurring expenses */}
      {!loading && stats?.recurring_expenses && stats.recurring_expenses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Gastos recurrentes detectados</CardTitle>
            <CardDescription>Se repiten en múltiples períodos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {stats.recurring_expenses.slice(0, 8).map(({ description, amount, frequency }) => (
                <div key={description} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1 capitalize">{frequency}</p>
                  <p className="text-sm font-medium truncate">{description}</p>
                  <p className="text-base font-bold text-primary mt-1">{formatCurrency(amount)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
