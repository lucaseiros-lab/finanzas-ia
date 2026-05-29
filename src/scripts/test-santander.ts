import { parseSantanderPDF } from '../lib/parsers/santander'
import pdfParse from 'pdf-parse'
import fs from 'fs'

async function main() {
  const buf = fs.readFileSync('C:/Users/lucas/Downloads/Santander Abril 2026.pdf')
  const data = await pdfParse(buf)
  const lines = data.text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)

  // Show lines 195-310 (where Visa/Amex sections should be)
  console.log('=== LINES 195-320 ===')
  lines.slice(194, 320).forEach((l: string, i: number) => {
    console.log(`${i+195}|${l}`)
  })

  console.log('\n=== PARSED TRANSACTIONS ===')
  const txs = parseSantanderPDF(data.text)
  const visa = txs.filter(t => t.card === 'Visa')
  const amex = txs.filter(t => t.card === 'American Express')
  const ars = txs.filter(t => !t.card && t.currency !== 'USD')
  const usd = txs.filter(t => !t.card && t.currency === 'USD')
  console.log(`TOTAL: ${txs.length} | ARS: ${ars.length} | USD: ${usd.length} | VISA: ${visa.length} | AMEX: ${amex.length}`)

  console.log('\nVISA:')
  visa.forEach(t => console.log(` ${t.date.toISOString().slice(0,10)} ${(t.currency ?? 'ARS').padEnd(4)} ${String(t.amount).padStart(12)} ${t.description.slice(0,40)}`))
  console.log('\nAMEX:')
  amex.forEach(t => console.log(` ${t.date.toISOString().slice(0,10)} ${(t.currency ?? 'ARS').padEnd(4)} ${String(t.amount).padStart(12)} ${t.description.slice(0,40)}`))
  console.log('\nARS:')
  ars.forEach(t => console.log(` ${t.date.toISOString().slice(0,10)} ${(t.currency ?? 'ARS').padEnd(4)} ${String(t.amount).padStart(12)} ${t.description.slice(0,40)}`))
}

main().catch(console.error)
