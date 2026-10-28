import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { prisma } from '../../src/app/database/prisma'

// RNF-04 — el sistema delega los pagos en Mercado Pago y no guarda datos de tarjetas ni de
// cuentas bancarias; lo único que retiene es el identificador del pago que devuelve la pasarela.
//
// Se revisan los NOMBRES de campos y columnas (no los comentarios ni los valores): por ejemplo
// balance_payment_method guarda la palabra 'card' como método de cobro en el local, y eso no es
// un número de tarjeta.
const FORBIDDEN = [
  /card.?(number|num|no)\b/i,
  /\b(pan|credit.?card|debit.?card)\b/i,
  /card.?holder/i,
  /\b(cvv|cvc|cvv2|csc)\b/i,
  /security.?code/i,
  /expir(y|ation)/i,
  /\b(iban|cbu|cvu|swift)\b/i,
  /bank.?(account|name|number)?\b/i,
  /account.?(number|num|no)\b/i,
]

function forbiddenIn(names: string[]): string[] {
  return names.filter(n => FORBIDDEN.some(re => re.test(n)))
}

// Nombres de campo de cada modelo de schema.prisma (primer token de cada línea de campo),
// más el nombre de columna de @map("...").
function fieldNamesOf(schema: string): string[] {
  const names: string[] = []
  let inModel = false
  for (const raw of schema.split(/\r?\n/)) {
    const line = raw.trim()
    if (/^model\s+\w+\s*\{/.test(line)) { inModel = true; continue }
    if (inModel && line === '}') { inModel = false; continue }
    if (!inModel || line === '' || line.startsWith('//') || line.startsWith('@@')) continue
    const field = /^(\w+)\s+/.exec(line)
    if (field) names.push(field[1])
    const mapped = /@map\("([^"]+)"\)/.exec(line)
    if (mapped) names.push(mapped[1])
  }
  return names
}

describe('el esquema no guarda datos de tarjeta ni bancarios (RNF-04)', () => {
  it('schema.prisma no tiene ningún campo de número de tarjeta, código de seguridad o dato bancario', () => {
    const schema = readFileSync(path.join(__dirname, '../../prisma/schema.prisma'), 'utf8')
    const names = fieldNamesOf(schema)

    expect(names.length).toBeGreaterThan(50)            // se leyeron los modelos de verdad
    expect(forbiddenIn(names)).toEqual([])
  })

  it('la base migrada tampoco tiene columnas de ese tipo', async () => {
    const rows = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'`

    expect(rows.length).toBeGreaterThan(50)
    expect(forbiddenIn(rows.map(r => r.column_name))).toEqual([])
  })

  it('el único dato de pago externo que se conserva es el identificador del pago de Mercado Pago', () => {
    const schema = readFileSync(path.join(__dirname, '../../prisma/schema.prisma'), 'utf8')
    const names = fieldNamesOf(schema)

    expect(names).toContain('mpPaymentId')
    expect(names.filter(n => /^mp[A-Z]/.test(n))).toEqual(['mpPaymentId', 'mpPaymentId'])
  })

  it('la revisión sí detecta columnas prohibidas (la prueba no es una tautología)', () => {
    const candidatos = fieldNamesOf(`
      model Mal {
        id         String @id
        cardNumber String
        cvv        String @map("security_code")
        cbu        String
        iban       String
        mpPaymentId String? @map("mp_payment_id")
      }`)

    expect(forbiddenIn(candidatos)).toEqual(['cardNumber', 'cvv', 'security_code', 'cbu', 'iban'])
  })
})
