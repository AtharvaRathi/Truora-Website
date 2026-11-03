export type CartLine = { productId: string; mode: 'purchase' | 'rental'; quantity: number; days: 7 | 30 };
export const products = [
  {
    id: 'bp-machine', name: 'BP Machine', subtitle: 'A simpler check-in at home.', category: 'HOME MONITORING', image: '/images/bp-machine.webp',
    price: 179900, mrp: 229900, rental7: 39900, rental30: 99900, deposit: 50000,
    description: 'A fictional upper-arm digital blood pressure monitor for exploring Truora’s shopping experience. A clear display and a simple control layout make up this sample configuration.',
    features: ['One-touch operation', 'Large digital display', 'Upper-arm cuff included', 'Compact tabletop design'],
    specs: [['Type', 'Automatic upper-arm monitor'], ['Display', 'Digital LCD'], ['Power', 'Battery operated'], ['In the demo box', 'Monitor, cuff, tubing and sample guide']],
    note: 'Illustrative specifications only. This is not a verified medical device listing, and no accuracy, certification or clinical suitability claim is made.',
  },
  {
    id: 'wheelchair', name: 'Wheelchair', subtitle: 'A little more freedom to move.', category: 'MOBILITY SUPPORT', image: '/images/wheelchair.webp',
    price: 649900, mrp: 799900, rental7: 59900, rental30: 149900, deposit: 200000,
    description: 'A fictional folding manual wheelchair for exploring equipment purchases and rentals. This sample model pairs a metal frame with a dark upholstered seat and removable footrests.',
    features: ['Folding manual frame', 'Large rear wheels with hand rims', 'Padded armrests', 'Paired footrests'],
    specs: [['Type', 'Manual folding wheelchair'], ['Frame', 'Metal frame, sample configuration'], ['Upholstery', 'Dark fabric seat and back'], ['In the demo box', 'Wheelchair, footrests and sample guide']],
    note: 'Dimensions, weight capacity, fit and suitability must be verified for a real product before use. This demo listing does not confirm any of these specifications.',
  },
] as const;
export const money = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);
export function getProduct(id: string) { return products.find(p => p.id === id); }
export function linePrice(line: CartLine) { const p = getProduct(line.productId); if (!p) throw new Error('Unknown product'); return line.mode === 'purchase' ? p.price : line.days === 7 ? p.rental7 : p.rental30; }
export function cartTotals(lines: CartLine[]) {
  const subtotal = lines.reduce((sum, line) => sum + linePrice(line) * line.quantity, 0);
  const deposit = lines.reduce((sum, line) => sum + (line.mode === 'rental' ? getProduct(line.productId)!.deposit * line.quantity : 0), 0);
  return { subtotal, deposit, total: subtotal + deposit };
}
