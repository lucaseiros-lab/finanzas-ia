'use client'

export default function TransactionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-8 space-y-4">
      <h2 className="text-xl font-bold text-red-500">Error en Movimientos</h2>
      <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-64 text-red-400">
        {error.message}
        {'\n\n'}
        {error.stack}
      </pre>
      <p className="text-sm text-muted-foreground">digest: {error.digest}</p>
      <button onClick={reset} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm">
        Reintentar
      </button>
    </div>
  )
}
