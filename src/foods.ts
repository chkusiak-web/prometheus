// USDA SR Legacy foods (7,448 rows, from the WRKT handoff), searched on the device.
// Nutrients are per 100 g for legacy foods, or per 100 mL when serving mL is present.
export type FoodRow = [name: string, kcal: number, protein: number, carbs: number, fat: number, serving: string, grams: number, ml?: number]

// Label values per cup (240 mL), converted to values per 100 mL.
const OAT_MILKS: FoodRow[] = [
  // https://www.oatly.com/en-us/products/chilled-oatmilk/chilled-oatmilk-64-oz
  ['Oatly Original Oat Milk', 120 / 2.4, 3 / 2.4, 16 / 2.4, 5 / 2.4, '1 cup (240 mL)', 0, 240],
  // https://www.oatly.com/en-us/products/chilled-oatmilk/chilled-oatmilk-unsweetened-64-oz
  ['Oatly Unsweetened Oat Milk', 40 / 2.4, 0, 6 / 2.4, 1.5 / 2.4, '1 cup (240 mL)', 0, 240],
  // https://silk.com/plant-based-products/oatmilk/oatmilk/
  ['Silk Original Oat Milk', 120 / 2.4, 1 / 2.4, 18 / 2.4, 5 / 2.4, '1 cup (240 mL)', 0, 240],
]

let FOODS: FoodRow[] | null = null, WORDS: string[][] = []
let legacyCount = 0
let loading: Promise<FoodRow[]> | null = null
export function loadFoods() {
  if (FOODS) return Promise.resolve(FOODS)
  return loading ||= Promise.all([
    fetchCatalog<FoodRow[]>('foods.json'),
    fetchCatalog<FoodRow[]>('catalog/survey.json').catch(() => []),
  ]).then(([legacy, survey]) => {
    legacyCount = legacy.length
    FOODS = [...legacy, ...survey]; WORDS = FOODS.map(r => r[0].replace(/\(Includes foods[^)]*\)/, '').toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean)); return FOODS
  }).catch(error => { loading = null; throw error })
}

const PROC = new Set(['breaded', 'fried', 'frozen', 'prepackaged', 'dehydrated', 'canned', 'mix', 'restaurant', 'fast', 'babyfood', 'imitation', 'dry', 'dried', 'powder', 'powdered', 'sifted', 'duck', 'goose', 'quail', 'substitute'])
const SYN: Record<string, string> = { oatmeal: 'oats', rice: 'rice white long-grain regular cooked', apple: 'apples raw with skin', apples: 'apples raw with skin', milk: 'milk whole', bread: 'bread whole-wheat', potato: 'potatoes baked flesh skin', chicken: 'chicken broiler breast meat only cooked', 'chicken breast': 'chicken broiler breast meat only', salmon: 'fish salmon atlantic', coffee: 'beverages coffee brewed prepared with tap water', eggs: 'egg whole', egg: 'egg whole', steak: 'beef steak' }
const BRAND = /^[A-Z0-9'&.\- ]{3,},/

/** Every word must start a word in the name. Common, whole forms rank first; brands and processed forms sink. */
const normalizeQuery = (q: string) => q.toLowerCase().trim().replace(/\boat[-\s]*milk\b/g, 'oat milk').replace(/\s+/g, ' ')

export function searchFoods(q: string, branded = false): FoodRow[] {
  if (!FOODS) return []
  q = normalizeQuery(q)
  q = SYN[q] || q
  const qs = q.split(/[^a-z0-9%]+/).filter(Boolean).map(w => w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
  if (!qs.length) return []
  const out: [number, number][] = []
  for (let i = 0; i < FOODS.length; i++) {
    const W = WORDS[i]
    if (!qs.every(w => W.some(x => x.startsWith(w)))) continue
    const r = FOODS[i]
    if ((i < legacyCount && BRAND.test(r[0])) !== branded) continue
    const sc = W.length + (BRAND.test(r[0]) ? 20 : 0) + W.filter(x => PROC.has(x)).length * 3 - (W[0].startsWith(qs[0]) ? 6 : 0)
      - qs.filter(w => W.includes(w)).length * 2 - (/^1 (large|medium|small|egg|piece|slice|fruit|item|whole)/i.test(r[5] || '') ? 5 : 0)
      - (W[0] === qs[0] || W[0] === qs[0] + 's' ? 8 : 0) // "Bananas, raw" for banana
      - (!qs.includes('raw') && W.includes('cooked') ? 3 : 0) // people mostly log cooked food
      + (W.includes('ready') ? 6 : 0) // ready-to-eat cereals sink
    out.push([sc, i])
  }
  return out.sort((a, b) => a[0] - b[0]).slice(0, 40).map(x => FOODS![x[1]])
}

export const tidy = (n: string) => { let t = n.replace(/\s*\(Includes foods[^)]*\)/, '').replace(/\s+/g, ' '); if (BRAND.test(t)) t = t.replace(/^([^,]+),/, (_, a: string) => a.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) + ','); return t }
const GENERIC = new Set(['Beverages', 'Cereals', 'Fish', 'Snacks', 'Candies', 'Spices', 'Alcoholic beverage', 'Alcoholic Beverage', 'Babyfood'])
/** "Beverages, coffee, brewed, …" → "Coffee, brewed"; "Bananas, raw" stays. */
export const shortName = (n: string) => { const p = tidy(n).split(',').map(x => x.trim()); const q = GENERIC.has(p[0]) && p[1] ? p.slice(1) : p; return [q[0][0].toUpperCase() + q[0].slice(1), ...q.slice(1, 2)].join(', ') }
export const servingAmount = (r: FoodRow) => r[7] || r[6] || 100
export const servL = (r: FoodRow) => r[5] || '100 g'

export function portionUnits(row: FoodRow) {
  if (row[7]) return [
    { label: 'Servings', amount: row[7] },
    ...cupMeasure(row, row[7]),
    { label: 'Milliliters (mL)', amount: 1 },
  ]

  const servingGrams = servingAmount(row)
  const units = [{ label: 'Servings', amount: servingGrams }, { label: 'Grams (g)', amount: 1 }]
  if (!Number.isFinite(row[6]) || row[6] <= 0) return units

  const serving = servL(row)
  units.push(...cupMeasure(row, servingGrams))

  const ml = serving.match(/^(\d+(?:\.\d+)?)\s*m[lL]\b/i)
  const fluidOunces = serving.match(/(?:^|\()(\d+(?:\.\d+)?)\s*fl\s*oz\b/i)
  const volumeMl = ml ? Number(ml[1]) : fluidOunces ? Number(fluidOunces[1]) * 29.5735295625 : 0
  if (volumeMl > 0) units.push({ label: 'Milliliters (mL)', amount: servingGrams / volumeMl })
  return units
}

function cupMeasure(row: FoodRow, serving: number) {
  const cups = Number(servL(row).match(/^(\d+(?:\.\d+)?) cups?\b/i)?.[1])
  return cups > 0 ? [{ label: 'Cups', amount: serving / cups }] : []
}

async function fetchCatalog<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Unable to load ${path}`)
  return response.json() as Promise<T>
}

function matchesWords(row: FoodRow, terms: string[]) {
  const words = normalizeQuery(row[0]).match(/[a-z0-9]+/g) || []
  return terms.every(term => words.some(word => word.startsWith(term)))
}

export const isBarcode = (query: string) => /^(?:\d{8}|\d{12,14})$/.test(query)

export async function lookupBarcode(query: string) {
  if (!isBarcode(query)) return undefined
  const code = query.replace(/^0+/, '')
  if (!code) return undefined
  const response = await fetch(`catalog/barcode/${code.slice(0, 3)}.json`)
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error('Barcode lookup failed')
  const rows = await response.json() as Record<string, FoodRow>
  return rows[code]
}

let lastShard: { prefix: string; rows: FoodRow[] } | undefined

export async function searchBrandedFoods(query: string): Promise<FoodRow[]> {
  const terms = normalizeQuery(query).match(/[a-z0-9]+/g) || []
  const longest = [...terms].sort((a, b) => b.length - a.length)[0]
  if (!longest || longest.length < 3) return []
  const prefix = longest.slice(0, 3)
  const fallback = OAT_MILKS.filter(row => matchesWords(row, terms))
  const rows = lastShard?.prefix === prefix ? lastShard.rows
    : await fetchCatalog<FoodRow[]>(`catalog/search/${prefix}.json`).catch(() => [])
  if (rows.length) lastShard = { prefix, rows }
  const hits = rows.filter(row => matchesWords(row, terms))
  hits.sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0]))
  return (hits.length ? hits : fallback).slice(0, 30)
}
