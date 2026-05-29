import Anthropic from '@anthropic-ai/sdk'
import { Category, ParsedTransaction, CATEGORIES } from '@/types'
import { normalizePattern } from '@/lib/utils'

const client = new Anthropic()

// Known patterns for offline/fallback categorization (no API cost)
const OFFLINE_RULES: [RegExp, Category][] = [
  // Supermercado
  [/carrefour|coto|dia\b|jumbo|walmart|vea\b|disco\b|vital|libertad|changomas|super\s*dia|supermercado/i, 'Supermercado'],
  // Farmacia
  [/farmacity|farmacia|drogueria|farma\b|botiqu/i, 'Farmacia'],
  // Salud
  [/osde|swiss medical|medife|hospital|clinica|clínica|laboratorio|medico|médico|odontolog|dentista|optica|óptica|radiolog/i, 'Salud'],
  // Restaurantes
  [/mcdonalds|mc\s*donalds|burger king|kfc|subway|pizza\s*hut|mostaza|kentucky|wendys|papas\s*fritas|parrilla|restaurant|restoran|comedor|bodegon|bares\b|cafe\b|cafeteria|cafetería/i, 'Restaurantes'],
  // Delivery
  [/pedidos\s*ya|pedidosya|rappi|uber\s*eat|just\s*eat|glovo|delivery/i, 'Delivery'],
  // Streaming
  [/netflix|spotify|disney\+|disney\s*plus|hbo|amazon\s*prime|apple\s*tv|youtube\s*premium|crunchyroll|paramount/i, 'Streaming'],
  // Combustible
  [/ypf|shell\b|axion|petrobras|esso\b|nafta|gasoil|combustible|estacion\s*serv|surtidor/i, 'Combustible'],
  // Transporte
  [/cabify|uber\b|taxi\b|remis|sube\b|metrobus|trenes\s*arg|metrovias|subte|colectivo|aerol/i, 'Transporte'],
  // Servicios
  [/edenor|edesur|metrogas|aysa|osba|epec|luz\b|gas\b|agua\b|cloacas|telefon|movistar|personal\b|claro\b|nextel|tuenti|fibertel|telecentro|cablevision|direct\s*tv|startigo|arnet/i, 'Servicios'],
  // Impuestos
  [/arba\b|afip\b|agip\b|impuesto|ingresos\s*brutos|monotributo|iva\b|tasa\b|municipal|aranceles/i, 'Impuestos'],
  // Expensas
  [/expensa|consorcio|administracion\s*edificio/i, 'Expensas'],
  // Seguros
  [/sancor\s*seguros|la\s*segunda|zurich|mapfre|allianz|meridional|seguro\b|cobertura|poliza|póliza/i, 'Seguros'],
  // Educación
  [/universidad|colegio|escuela|instituto|academia|capacitacion|capacitación|udemy|coursera|libros\b|libreria|librería/i, 'Educación'],
  // Viajes
  [/airbnb|booking|despegar|almundo|aerolineas|lan\b|flybondi|jetsmart|hotel\b|motel|hostel|aeropuerto|vuelo\b/i, 'Viajes'],
  // Tecnología
  [/apple\b|microsoft|google\b|adobe\b|amazon\s*web|aws\b|hostinger|godaddy|mercado\s*libre|meli\b|samsung|lg\b|sony\b/i, 'Tecnología'],
  // Comisiones bancarias
  [/comision|comisión|mantenimiento\s*cuenta|costo\s*tarjeta|cargo\s*fijo|administracion\s*cuenta/i, 'Comisiones'],
  // Bancos
  [/extracto|resumen\s*cuenta|cbu\b|debito\s*automatico|banco\b/i, 'Bancos'],
  // Inversiones
  [/fci\b|fondo\s*comun|plazo\s*fijo|cauciones|cedears|on\b|obligacion|letes|rofex|byma\b|invertir|inversion|inversión/i, 'Inversiones'],
  // Transferencias
  [/transferencia|traspaso|envio\s*dinero|alias\s*cbu/i, 'Transferencias'],
  // Sueldos e ingresos
  [/sueldo|salario|haberes|acreditacion\s*sueldo|rem\.\s*neta|liquidacion|remuneracion/i, 'Sueldos'],
  // Hogar
  [/easy\b|sodimac|homecenter|ferreteria|ferretería|muebles|colchones|electro/i, 'Hogar'],
  // Ocio
  [/cine\b|cinema|teatro\b|entradas|ticketek|passline|eventbrite|club\b|gimnasio|gym\b|sport|deporte|musica|música/i, 'Ocio'],
]

export function categorizeOffline(description: string, merchant?: string): Category | null {
  const text = [description, merchant].filter(Boolean).join(' ')

  for (const [pattern, category] of OFFLINE_RULES) {
    if (pattern.test(text)) return category
  }
  return null
}

interface CategorizationResult {
  category: Category
  confidence: number
  needs_review: boolean
}

// Batch categorize using Claude API with prompt caching
export async function categorizeBatch(
  transactions: Array<{ description: string; merchant?: string; amount: number; type: string }>,
  learningPatterns: Array<{ pattern: string; category: Category }>
): Promise<CategorizationResult[]> {
  if (transactions.length === 0) return []

  const categoriesStr = CATEGORIES.join(', ')
  const learningContext = learningPatterns.length > 0
    ? `\nPatrones aprendidos del usuario:\n${learningPatterns.slice(0, 100).map(p => `"${p.pattern}" → ${p.category}`).join('\n')}`
    : ''

  const systemPrompt = `Sos un sistema experto en clasificar transacciones bancarias argentinas.

Categorías disponibles: ${categoriesStr}

Reglas:
- Clasificá cada transacción en la categoría más específica posible
- Si el monto es positivo y el tipo es "income", preferí Sueldos/Ingresos/Transferencias
- Para débitos automáticos de servicios, usá Servicios
- Para pagos con tarjeta en comercios, detectá el rubro del comercio
- Si no podés determinar con suficiente certeza (confianza < 0.7), devolvé needs_review: true
- Considerá el contexto argentino: Mercado Pago, SUBE, YPF, etc.
${learningContext}

Respondé SOLO con un JSON array válido, sin texto adicional. Formato:
[{"category":"Categoría","confidence":0.95,"needs_review":false}, ...]`

  const transactionsText = transactions
    .map((t, i) => `${i + 1}. "${t.description}"${t.merchant ? ` (${t.merchant})` : ''} | $${t.amount} | ${t.type}`)
    .join('\n')

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Clasificá estas ${transactions.length} transacciones:\n\n${transactionsText}`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('Invalid response type')

    // Parse JSON response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found in response')

    const results = JSON.parse(jsonMatch[0]) as CategorizationResult[]

    // Validate and sanitize
    return results.map(r => ({
      category: CATEGORIES.includes(r.category as Category) ? r.category : 'Otros',
      confidence: Math.min(1, Math.max(0, r.confidence || 0.5)),
      needs_review: r.needs_review || false,
    }))
  } catch (error) {
    console.error('AI categorization error:', error)
    // Fallback: return 'Otros' with needs_review for all
    return transactions.map(() => ({
      category: 'Otros' as Category,
      confidence: 0.3,
      needs_review: true,
    }))
  }
}

// Use Claude Vision for image PDFs (OCR + extraction in one call)
export async function extractFromImageWithVision(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Extraé todas las transacciones de este extracto bancario argentino.
Para cada transacción, devolvé una línea con el formato:
FECHA | DESCRIPCION | IMPORTE | TIPO (D=débito/gasto, C=crédito/ingreso) | SALDO

Reglas:
- Usá el formato de fecha DD/MM/YYYY
- Importes sin símbolo de moneda, con punto decimal
- Solo incluí filas que sean transacciones reales, no totales ni encabezados
- Si no encontrás transacciones, devolvé "SIN_TRANSACCIONES"`,
          },
        ],
      },
    ],
  })

  const content = response.content[0]
  return content.type === 'text' ? content.text : ''
}

// Smart categorizer: tries offline rules first, then AI for ambiguous ones
export async function smartCategorize(
  transactions: ParsedTransaction[],
  learningPatterns: Array<{ pattern: string; category: Category }>
): Promise<CategorizationResult[]> {
  const results: CategorizationResult[] = new Array(transactions.length)
  const needsAI: number[] = []

  // First pass: offline rules + learning patterns
  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i]

    // Check user's learned patterns first (highest priority)
    const normalDesc = normalizePattern(t.description)
    const learnedMatch = learningPatterns.find(lp =>
      normalizePattern(lp.pattern) === normalDesc ||
      normalDesc.includes(normalizePattern(lp.pattern))
    )

    if (learnedMatch) {
      results[i] = { category: learnedMatch.category, confidence: 0.99, needs_review: false }
      continue
    }

    // Try offline rules
    const offlineCategory = categorizeOffline(t.description, t.merchant)
    if (offlineCategory) {
      results[i] = { category: offlineCategory, confidence: 0.85, needs_review: false }
      continue
    }

    // Type-based fallback
    if (t.type === 'income') {
      results[i] = { category: 'Ingresos', confidence: 0.6, needs_review: true }
    } else if (t.type === 'transfer') {
      results[i] = { category: 'Transferencias', confidence: 0.7, needs_review: false }
    } else {
      // Needs AI
      needsAI.push(i)
      results[i] = { category: 'Otros', confidence: 0, needs_review: true }
    }
  }

  // Second pass: batch AI for ambiguous ones
  if (needsAI.length > 0) {
    const BATCH_SIZE = 50
    const batches: number[][] = []
    for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
      batches.push(needsAI.slice(i, i + BATCH_SIZE))
    }

    for (const batch of batches) {
      const batchTxs = batch.map(i => transactions[i])
      const batchResults = await categorizeBatch(
        batchTxs.map(t => ({
          description: t.description,
          merchant: t.merchant,
          amount: t.amount,
          type: t.type,
        })),
        learningPatterns
      )

      batch.forEach((txIdx, batchIdx) => {
        results[txIdx] = batchResults[batchIdx]
      })
    }
  }

  return results
}
