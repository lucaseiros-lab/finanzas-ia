# FinanzasIA

**Análisis automático de extractos bancarios con inteligencia artificial.**

Aplicación web full stack SaaS para importar, normalizar, categorizar y analizar extractos bancarios argentinos. Diseñada para escalar a producto comercial.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Estilos | Tailwind CSS + shadcn/ui |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth |
| IA | Anthropic Claude API (haiku-4-5 / opus-4-5) |
| Parsing PDF | pdf-parse + Claude Vision (OCR) |
| Parsing Excel/CSV | SheetJS (xlsx) |
| Gráficos | Recharts |
| Deploy | Vercel (free tier) |

---

## Setup local

### 1. Clonar e instalar

```bash
cd finanzas-ia
npm install
```

### 2. Variables de entorno

Copiá `.env.local.example` a `.env.local` y completá:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-api03-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Base de datos

En Supabase → SQL Editor, ejecutá el contenido de:
```
supabase/migrations/001_init.sql
```

### 4. Correr en desarrollo

```bash
npm run dev
```

---

## Deploy en Vercel (gratuito)

1. Subí el proyecto a un repo de GitHub
2. En [vercel.com](https://vercel.com), conectá el repo
3. Agregá todas las variables de entorno del `.env.local`
4. Deploy automático en cada push a `main`

---

## Arquitectura

```
src/
├── app/
│   ├── (auth)/          # Login y registro
│   ├── (dashboard)/     # Dashboard, Import, Transactions, Analytics
│   ├── api/             # Endpoints REST
│   └── page.tsx         # Landing page
├── components/
│   ├── ui/              # Componentes base (Button, Card, etc.)
│   └── dashboard/       # Sidebar, charts
├── lib/
│   ├── supabase/        # Clientes browser/server
│   ├── parsers/         # PDF, Excel, CSV
│   └── ai/              # Categorización con Claude
└── types/               # TypeScript types
```

### Flujo de importación

```
Archivo subido
    ↓
PDF → pdf-parse (texto) o Claude Vision (OCR si es imagen)
Excel/CSV → SheetJS
    ↓
Parser detecta columnas, fechas, importes, tipo de transacción
    ↓
Normalizador → estructura universal
    ↓
AI Categorizer:
  1. Chequea patrones aprendidos del usuario (prioridad máxima)
  2. Reglas offline (Farmacity → Farmacia, Netflix → Streaming, etc.)
  3. Claude API batch para casos ambiguos
    ↓
Inserción en Supabase con RLS por usuario
```

### Aprendizaje de IA

Cada vez que un usuario corrige una categoría:
1. Se guarda en `ai_learning` con el patrón normalizado
2. Se propaga a todos los movimientos similares del mismo comercio (no confirmados)
3. En la próxima importación, ese patrón tiene prioridad máxima

---

## Bancos soportados

Santander · BBVA · Macro · Galicia · Banco Nación · ICBC · HSBC · Mercado Pago · Ualá · Naranja X · Brubank · Banco Ciudad · Banco Provincia · Supervielle · Patagonia · Comafi · Credicoop · Hipotecario · Itaú · y cualquier banco con PDF/Excel/CSV estándar.

---

## Categorías

26 categorías: Alimentación · Supermercado · Salud · Farmacia · Restaurantes · Delivery · Impuestos · Servicios · Hogar · Expensas · Transporte · Combustible · Streaming · Suscripciones · Ocio · Viajes · Educación · Tecnología · Seguros · Bancos · Comisiones · Inversiones · Transferencias · Sueldos · Ingresos · Otros

---

## Monetización futura

- Plan gratuito: N archivos/mes, 1 usuario
- Plan Pro: archivos ilimitados, múltiples usuarios, exportación, alertas
- Plan Business: API, integración bancaria directa, white-label
- Modelo SaaS: Stripe para pagos, Supabase pro para escala

---

## Seguridad

- Row Level Security (RLS) en todas las tablas: cada usuario solo accede a sus datos
- PDFs no se almacenan permanentemente (se procesan en memoria)
- Autenticación JWT vía Supabase Auth
- Variables sensibles solo en servidor (SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY)

---

## Mantenimiento

- **Agregar banco nuevo**: el sistema detecta automáticamente si el PDF tiene columnas reconocibles. Para formatos muy específicos, agregar una regla en `src/lib/parsers/pdf.ts`
- **Agregar categoría**: modificar el array `CATEGORIES` en `src/types/index.ts` y agregar color en `CATEGORY_COLORS`
- **Mejorar detección offline**: agregar patrón en `OFFLINE_RULES` en `src/lib/ai/categorizer.ts`

---

*FinanzasIA — Construido con Next.js + Supabase + Claude AI*
