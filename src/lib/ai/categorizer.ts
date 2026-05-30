import { GoogleGenerativeAI } from '@google/generative-ai'
import { Category, ParsedTransaction, CATEGORIES } from '@/types'
import { normalizePattern } from '@/lib/utils'

function getGemini() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
}

// Offline rules — cero costo de API, cubre ~80% de transacciones argentinas
const OFFLINE_RULES: [RegExp, Category][] = [
  [/carrefour|coto\b|dia\b|jumbo|walmart|vea\b|disco\b|vital|libertad|changomas|super\s*dia|supermercado/i, 'Supermercado'],
  [/farmacity|farmacia|drogueria|farma\b|botiqu/i, 'Farmacia'],
  [/osde|swiss medical|medife|hospital|clinica|clínica|laboratorio|medico|médico|odontolog|dentista|optica|óptica|radiolog/i, 'Salud'],
  [/mcdonalds|mc\s*donalds|burger king|kfc|subway|pizza\s*hut|mostaza|kentucky|wendys|parrilla|restaurant|restoran|comedor|bodeg[oó]n/i, 'Restaurantes'],
  [/cafe\b|cafeteria|cafetería|starbucks|coffee|cappuccino|espresso|tostadas/i, 'Cafeterías'],
  [/peluquer|barberia|barber[ií]a|spa\b|manicur|pedicur|depilac|estetica|estética|cosmet|perfumer|perfumeria/i, 'Cuidado personal'],
  [/pedidos\s*ya|pedidosya|rappi|uber\s*eat|just\s*eat|glovo|delivery/i, 'Delivery'],
  [/netflix|spotify|disney\+|disney\s*plus|hbo|amazon\s*prime|apple\s*tv|youtube\s*premium|crunchyroll|paramount/i, 'Gastos Papá'],
  [/ypf|shell\b|axion|petrobras|esso\b|nafta|gasoil|combustible|estacion\s*serv|surtidor/i, 'Combustible'],
  [/cabify|uber\b|taxi\b|remis|sube\b|metrobus|trenes\s*arg|metrovias|subte|colectivo|aerol/i, 'Transporte'],
  [/edenor|edesur|metrogas|aysa|osba|epec|luz\b|gas\b|agua\b|telefon|movistar|personal\b|claro\b|fibertel|telecentro|cablevision|direct\s*tv/i, 'Servicios'],
  [/arba\b|afip\b|agip\b|impuesto|ingresos\s*brutos|monotributo|iva\b|tasa\b|municipal|aranceles/i, 'Impuestos'],
  [/expensa|consorcio|administracion\s*edificio/i, 'Expensas'],
  [/sancor\s*seguros|la\s*segunda|zurich|mapfre|allianz|meridional|seguro\b|cobertura|poliza|póliza/i, 'Seguros'],
  [/universidad|colegio|escuela|instituto|academia|capacitacion|capacitación|udemy|coursera|librer[ií]a/i, 'Educación'],
  [/airbnb|booking|despegar|almundo|aerolineas|lan\b|flybondi|jetsmart|hotel\b|hostel|aeropuerto|vuelo\b/i, 'Viajes'],
  [/apple\b|microsoft|google\b|adobe\b|amazon\s*web|aws\b|mercado\s*libre|meli\b|samsung|lg\b|sony\b/i, 'Tecnología'],
  [/comision|comisión|mantenimiento\s*cuenta|costo\s*tarjeta|cargo\s*fijo/i, 'Comisiones'],
  [/fci\b|fondo\s*comun|plazo\s*fijo|cauciones|cedears|rofex|byma\b|invertir|inversion|inversión/i, 'Inversiones'],
  [/transferencia|traspaso|envio\s*dinero|alias\s*cbu/i, 'Transferencias'],
  [/sueldo|salario|haberes|acreditacion\s*sueldo|rem\.\s*neta|liquidacion|remuneracion/i, 'Sueldos'],
  [/easy\b|sodimac|homecenter|ferreteria|ferretería|muebles|colchones/i, 'Hogar'],
  [/cine\b|teatro\b|entradas|ticketek|passline|gimnasio|gym\b|deporte/i, 'Ocio'],
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

export async function categorizeBatch(
  transactions: Array<{ description: string; merchant?: string; amount: number; type: string }>,
  learningPatterns: Array<{ pattern: string; category: Category }>
): Promise<CategorizationResult[]> {
  if (transactions.length === 0) return []

  const categoriesStr = CATEGORIES.join(', ')
  const learningContext = learningPatterns.length > 0
    ? `\nPatrones aprendidos:\n${learningPatterns.slice(0, 80).map(p => `"${p.pattern}" → ${p.category}`).join('\n')}`
    : ''

  const prompt = `Sos un experto en clasificar transacciones bancarias argentinas.

Categorías: ${categoriesStr}

Reglas:
- Elegí la categoría más específica posible
- Si el tipo es "income", preferí Sueldos/Ingresos/Transferencias
- Si no podés determinar con certeza (confianza < 0.7), marcá needs_review: true
- Contexto argentino: Mercado Pago, SUBE, YPF, Naranja X, etc.
${learningContext}

Transacciones a clasificar:
${transactions.map((t, i) => `${i + 1}. "${t.description}"${t.merchant ? ` (${t.merchant})` : ''} | $${t.amount} | ${t.type}`).join('\n')}

Respondé SOLO con un JSON array válido sin texto adicional:
[{"category":"Categoría","confidence":0.95,"needs_review":false}, ...]`

  try {
    const genAI = getGemini()
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array in response')

    const results = JSON.parse(jsonMatch[0]) as CategorizationResult[]
    return results.map(r => ({
      category: CATEGORIES.includes(r.category as Category) ? r.category : 'Otros',
      confidence: Math.min(1, Math.max(0, r.confidence || 0.5)),
      needs_review: r.needs_review || false,
    }))
  } catch (error) {
    console.error('Gemini categorization error:', error)
    return transactions.map(() => ({ category: 'Otros' as Category, confidence: 0.3, needs_review: true }))
  }
}

// OCR para PDFs imagen usando Gemini Vision (gratuito)
export async function extractFromImageWithVision(imageBase64: string): Promise<string> {
  try {
    const genAI = getGemini()
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      },
      `Extraé todas las transacciones de este extracto bancario argentino.
Para cada transacción devolvé una línea:
FECHA | DESCRIPCION | IMPORTE | TIPO (D=débito/gasto, C=crédito/ingreso) | SALDO

- Fecha en formato DD/MM/YYYY
- Importes sin símbolo de moneda, con punto decimal
- Solo filas de transacciones reales, no totales ni encabezados
- Si no hay transacciones, devolvé "SIN_TRANSACCIONES"`,
    ])

    return result.response.text()
  } catch {
    return ''
  }
}

export async function smartCategorize(
  transactions: ParsedTransaction[],
  learningPatterns: Array<{ pattern: string; category: Category }>
): Promise<CategorizationResult[]> {
  const results: CategorizationResult[] = new Array(transactions.length)
  const needsAI: number[] = []

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i]

    // 1. Patrones aprendidos del usuario (prioridad máxima)
    const normalDesc = normalizePattern(t.description)
    const learned = learningPatterns.find(lp =>
      normalizePattern(lp.pattern) === normalDesc ||
      normalDesc.includes(normalizePattern(lp.pattern))
    )
    if (learned) {
      results[i] = { category: learned.category, confidence: 0.99, needs_review: false }
      continue
    }

    // 2. Reglas offline sin costo
    const offline = categorizeOffline(t.description, t.merchant)
    if (offline) {
      results[i] = { category: offline, confidence: 0.85, needs_review: false }
      continue
    }

    // 3. Fallback por tipo
    if (t.type === 'income') {
      results[i] = { category: 'Ingresos', confidence: 0.6, needs_review: true }
    } else if (t.type === 'transfer') {
      results[i] = { category: 'Transferencias', confidence: 0.7, needs_review: false }
    } else {
      needsAI.push(i)
      results[i] = { category: 'Otros', confidence: 0, needs_review: true }
    }
  }

  // 4. Batch AI para los ambiguos (si hay Gemini key configurada)
  if (needsAI.length > 0 && process.env.GEMINI_API_KEY) {
    const BATCH_SIZE = 50
    for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
      const batch = needsAI.slice(i, i + BATCH_SIZE)
      const batchTxs = batch.map(idx => transactions[idx])
      const batchResults = await categorizeBatch(
        batchTxs.map(t => ({ description: t.description, merchant: t.merchant, amount: t.amount, type: t.type })),
        learningPatterns
      )
      batch.forEach((txIdx, batchIdx) => { results[txIdx] = batchResults[batchIdx] })
    }
  }

  return results
}
