// USDA SR Legacy foods (7,448 rows, from the WRKT handoff), searched on the device.
// Row: [name, kcal/100 g, protein, carbs, fat (g/100 g), serving label, serving grams]
export type FoodRow = [string, number, number, number, number, string, number]

let FOODS: FoodRow[] | null = null, WORDS: string[][] = []
let loading: Promise<FoodRow[]> | null = null
export function loadFoods() {
  if (FOODS) return Promise.resolve(FOODS)
  return loading ||= fetch('foods.json').then(r => r.json()).then((d: FoodRow[]) => {
    FOODS = d; WORDS = d.map(r => r[0].replace(/\(Includes foods[^)]*\)/, '').toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean)); return d
  })
}

const PROC = new Set(['breaded', 'fried', 'frozen', 'prepackaged', 'dehydrated', 'canned', 'mix', 'restaurant', 'fast', 'babyfood', 'imitation', 'dry', 'dried', 'powder', 'powdered', 'sifted', 'duck', 'goose', 'quail', 'substitute'])
const SYN: Record<string, string> = { oatmeal: 'oats', rice: 'rice white long-grain regular cooked', apple: 'apples raw with skin', apples: 'apples raw with skin', milk: 'milk whole', bread: 'bread whole-wheat', potato: 'potatoes baked flesh skin', chicken: 'chicken broiler breast meat only cooked', 'chicken breast': 'chicken broiler breast meat only', salmon: 'fish salmon atlantic', coffee: 'beverages coffee brewed prepared with tap water', eggs: 'egg whole', egg: 'egg whole', steak: 'beef steak' }
const BRAND = /^[A-Z0-9'&.\- ]{3,},/

/** Every word must start a word in the name. Common, whole forms rank first; brands and processed forms sink. */
export function searchFoods(q: string): FoodRow[] {
  if (!FOODS) return []
  q = q.toLowerCase().trim(); q = SYN[q] || q
  const qs = q.split(/[^a-z0-9%]+/).filter(Boolean).map(w => w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
  if (!qs.length) return []
  const out: [number, number][] = []
  for (let i = 0; i < FOODS.length; i++) {
    const W = WORDS[i]
    if (!qs.every(w => W.some(x => x.startsWith(w)))) continue
    const r = FOODS[i]
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
export const servG = (r: FoodRow) => r[6] || 100
export const servL = (r: FoodRow) => r[5] || '100 g'
