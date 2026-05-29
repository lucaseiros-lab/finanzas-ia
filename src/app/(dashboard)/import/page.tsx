'use client'

export const dynamic = 'force-dynamic'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import {
  Upload, FileText, FileSpreadsheet, CheckCircle2,
  XCircle, Loader2, AlertCircle, ArrowRight, X
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  progress: number
  result?: {
    transaction_count: number
    pending_review: number
  }
  error?: string
}

const ACCEPTED_FORMATS = {
  'application/pdf': ['.pdf'],
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}

const BANK_EXAMPLES = [
  'Santander', 'BBVA', 'Macro', 'Galicia', 'Nación', 'ICBC',
  'HSBC', 'Mercado Pago', 'Ualá', 'Naranja X', 'Brubank',
]

export default function ImportPage() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      status: 'pending',
      progress: 0,
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FORMATS,
    maxSize: 20 * 1024 * 1024, // 20MB
    onDropRejected: (rejected) => {
      rejected.forEach(({ file, errors }) => {
        toast({
          title: `${file.name} rechazado`,
          description: errors[0]?.message || 'Formato no soportado',
          variant: 'destructive',
        })
      })
    },
  })

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const uploadFile = async (uf: UploadFile): Promise<void> => {
    setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: 'uploading', progress: 20 } : f))

    const formData = new FormData()
    formData.append('file', uf.file)

    // Simulate progress while waiting
    const progressInterval = setInterval(() => {
      setFiles(prev => prev.map(f =>
        f.id === uf.id && f.progress < 85
          ? { ...f, progress: f.progress + Math.random() * 15 }
          : f
      ))
    }, 800)

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      const data = await res.json()

      if (!res.ok) {
        setFiles(prev => prev.map(f =>
          f.id === uf.id ? { ...f, status: 'error', progress: 0, error: data.error || 'Error desconocido' } : f
        ))
        return
      }

      setFiles(prev => prev.map(f =>
        f.id === uf.id ? { ...f, status: 'done', progress: 100, result: data } : f
      ))
    } catch (err) {
      clearInterval(progressInterval)
      setFiles(prev => prev.map(f =>
        f.id === uf.id ? { ...f, status: 'error', progress: 0, error: 'Error de conexión' } : f
      ))
    }
  }

  const uploadAll = async () => {
    const pending = files.filter(f => f.status === 'pending')
    if (pending.length === 0) return

    setUploading(true)
    // Upload sequentially to avoid rate limits
    for (const f of pending) {
      await uploadFile(f)
    }
    setUploading(false)

    const done = files.filter(f => f.status === 'done').length + pending.filter(f => f.status === 'done').length
    toast({
      title: `${pending.length} archivo${pending.length > 1 ? 's' : ''} procesado${pending.length > 1 ? 's' : ''}`,
      description: 'Los movimientos ya están disponibles en el dashboard.',
    })
  }

  const hasPending = files.some(f => f.status === 'pending')
  const allDone = files.length > 0 && files.every(f => f.status === 'done' || f.status === 'error')

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return FileText
    return FileSpreadsheet
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="p-8 space-y-8 max-w-3xl animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar extractos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          PDF, CSV, XLS o XLSX. La IA categoriza todo automáticamente.
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200',
          isDragActive
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            'h-14 w-14 rounded-2xl flex items-center justify-center transition-colors duration-200',
            isDragActive ? 'bg-primary/15' : 'bg-muted'
          )}>
            <Upload className={cn('h-6 w-6 transition-colors', isDragActive ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          {isDragActive ? (
            <p className="text-base font-medium text-primary">Soltá los archivos acá</p>
          ) : (
            <>
              <div>
                <p className="text-base font-medium">Arrastrá archivos o hacé clic para seleccionar</p>
                <p className="text-sm text-muted-foreground mt-1">PDF · CSV · XLS · XLSX — hasta 20MB por archivo</p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                {BANK_EXAMPLES.map(b => (
                  <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
                ))}
                <Badge variant="secondary" className="text-xs">y más...</Badge>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {files.length} archivo{files.length > 1 ? 's' : ''} seleccionado{files.length > 1 ? 's' : ''}
              </CardTitle>
              {hasPending && !uploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setFiles(prev => prev.filter(f => f.status !== 'pending'))}
                >
                  Limpiar pendientes
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {files.map(uf => {
              const FileIcon = getFileIcon(uf.file.name)
              return (
                <div key={uf.id} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <FileIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{uf.file.name}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{formatSize(uf.file.size)}</span>
                          {uf.status === 'pending' && (
                            <button onClick={() => removeFile(uf.id)} className="text-muted-foreground hover:text-foreground">
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          {uf.status === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                          {uf.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                          {uf.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        </div>
                      </div>

                      {uf.status === 'uploading' && (
                        <div className="mt-2">
                          <Progress value={uf.progress} className="h-1.5" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {uf.progress < 30 ? 'Subiendo...' : uf.progress < 70 ? 'Extrayendo datos...' : 'Categorizando con IA...'}
                          </p>
                        </div>
                      )}

                      {uf.status === 'done' && uf.result && (
                        <div className="mt-2 flex items-center gap-3">
                          <Badge variant="success" className="text-xs">
                            {uf.result.transaction_count} movimientos
                          </Badge>
                          {uf.result.pending_review > 0 && (
                            <Badge variant="warning" className="text-xs">
                              {uf.result.pending_review} por revisar
                            </Badge>
                          )}
                        </div>
                      )}

                      {uf.status === 'error' && (
                        <div className="mt-2 flex items-center gap-2">
                          <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                          <p className="text-xs text-red-500">{uf.error}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              {allDone ? (
                <Link href="/transactions" className="ml-auto">
                  <Button variant="gradient">
                    Ver movimientos <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="gradient"
                  disabled={!hasPending || uploading}
                  onClick={uploadAll}
                  className="ml-auto"
                >
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</>
                  ) : (
                    <>Procesar {files.filter(f => f.status === 'pending').length} archivo{files.filter(f => f.status === 'pending').length > 1 ? 's' : ''}</>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium mb-1">🔍 OCR automático</p>
              <p className="text-muted-foreground text-xs">PDFs imagen son procesados con IA para extraer el texto</p>
            </div>
            <div>
              <p className="font-medium mb-1">🧠 Categorización IA</p>
              <p className="text-muted-foreground text-xs">Cada movimiento se clasifica automáticamente. Corregís lo que no sea correcto</p>
            </div>
            <div>
              <p className="font-medium mb-1">📈 Aprendizaje continuo</p>
              <p className="text-muted-foreground text-xs">Cada corrección mejora la precisión para los próximos archivos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
