import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parsePDFText, extractTextFromPDF, isImagePDF } from '@/lib/parsers/pdf'
import { parseExcelBuffer, parseCSVBuffer } from '@/lib/parsers/excel'
import { smartCategorize, extractFromImageWithVision } from '@/lib/ai/categorizer'
import { detectBank, normalizePattern } from '@/lib/utils'
import { ParsedTransaction, Category } from '@/types'
import { createServiceClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export const maxDuration = 60 // Vercel Pro: 60s, Hobby: 10s

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    const filename = file.name
    const ext = filename.split('.').pop()?.toLowerCase()
    const buffer = Buffer.from(await file.arrayBuffer())

    // Deduplication: check if file with same content hash was already imported
    const contentHash = createHash('sha256').update(buffer).digest('hex')
    const serviceClient = createServiceClient()

    try {
      const { data: existingFile } = await serviceClient
        .from('files')
        .select('id, original_name, created_at')
        .eq('user_id', user.id)
        .eq('content_hash', contentHash)
        .eq('status', 'done')
        .maybeSingle()

      if (existingFile) {
        return NextResponse.json(
          { error: `Este archivo ya fue importado anteriormente (${existingFile.original_name}, ${new Date(existingFile.created_at).toLocaleDateString('es-AR')}). Si querés reimportar, eliminá primero el archivo anterior.` },
          { status: 409 }
        )
      }
    } catch {
      // Column may not exist yet — skip dedup check
    }
    const { data: fileRecord, error: fileError } = await serviceClient
      .from('files')
      .insert({
        user_id: user.id,
        filename: `${Date.now()}_${filename}`,
        original_name: filename,
        bank: detectBank(filename),
        status: 'processing',
        ...(contentHash ? { content_hash: contentHash } : {}),
      })
      .select()
      .single()

    if (fileError || !fileRecord) {
      return NextResponse.json({ error: 'Error al crear registro de archivo' }, { status: 500 })
    }

    let parsedTransactions: ParsedTransaction[] = []

    try {
      if (ext === 'pdf') {
        const text = await extractTextFromPDF(buffer)

        if (isImagePDF(text)) {
          // Use Claude Vision for image PDFs
          const base64 = buffer.toString('base64')
          const visionText = await extractFromImageWithVision(base64)
          parsedTransactions = parsePDFText(visionText, filename)
        } else {
          parsedTransactions = parsePDFText(text, filename)
        }
      } else if (ext === 'xlsx' || ext === 'xls') {
        parsedTransactions = parseExcelBuffer(buffer, filename)
      } else if (ext === 'csv') {
        parsedTransactions = parseCSVBuffer(buffer, filename)
      } else {
        throw new Error(`Formato no soportado: ${ext}`)
      }
    } catch (parseError) {
      await serviceClient
        .from('files')
        .update({ status: 'error', error_message: String(parseError) })
        .eq('id', fileRecord.id)

      return NextResponse.json(
        { error: `Error al parsear archivo: ${parseError}` },
        { status: 422 }
      )
    }

    if (parsedTransactions.length === 0) {
      await serviceClient
        .from('files')
        .update({ status: 'error', error_message: 'No se encontraron transacciones en el archivo' })
        .eq('id', fileRecord.id)

      return NextResponse.json(
        { error: 'No se encontraron transacciones en el archivo' },
        { status: 422 }
      )
    }

    // Load user's AI learning patterns
    const { data: learningData } = await serviceClient
      .from('ai_learning')
      .select('pattern, normalized_pattern, category')
      .eq('user_id', user.id)

    const learningPatterns = (learningData || []).map(l => ({
      pattern: l.normalized_pattern,
      category: l.category as Category,
    }))

    // Categorize all transactions
    const categorizationResults = await smartCategorize(parsedTransactions, learningPatterns)

    // Build transaction records for DB insertion
    const transactionRecords = parsedTransactions.map((t, i) => {
      const cat = categorizationResults[i]
      return {
        user_id: user.id,
        file_id: fileRecord.id,
        date: t.date.toISOString().slice(0, 10),
        description: t.description,
        merchant: t.merchant || null,
        amount: t.amount,
        type: t.type,
        category: cat.category,
        category_confirmed: false,
        needs_review: cat.needs_review,
        bank: t.bank || detectBank(filename) || null,
        account: t.account || null,
        card: t.card || null,
        installments: t.installments || null,
        installment_number: t.installment_number || null,
        balance: t.balance || null,
        currency: t.currency || 'ARS',
        raw_data: t.raw_data || null,
      }
    })

    // Batch insert (Supabase limit: 1000 per call)
    const BATCH = 500
    for (let i = 0; i < transactionRecords.length; i += BATCH) {
      const { error: insertError } = await serviceClient
        .from('transactions')
        .insert(transactionRecords.slice(i, i + BATCH))

      if (insertError) {
        console.error('Insert error:', insertError)
        throw new Error(`Error insertando transacciones: ${insertError.message}`)
      }
    }

    // Update file record as done
    await serviceClient
      .from('files')
      .update({
        status: 'done',
        bank: parsedTransactions[0]?.bank || detectBank(filename) || null,
        transaction_count: parsedTransactions.length,
      })
      .eq('id', fileRecord.id)

    return NextResponse.json({
      success: true,
      file_id: fileRecord.id,
      transaction_count: parsedTransactions.length,
      pending_review: categorizationResults.filter(r => r.needs_review).length,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: `Error interno: ${error}` },
      { status: 500 }
    )
  }
}
