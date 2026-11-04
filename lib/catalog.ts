import data from './data/phase-one.json';
export type CartLine = { productId: string; mode: 'purchase' | 'rental' | 'service'; quantity: number; days: number; packageSlug?: string };
export const catalog = data.items.map(item => ({...item,
 image: item.id==='bp-machine'?'/images/bp-machine.webp':item.id==='wheelchair'?'/images/wheelchair.webp':'/images/recovery-essential.svg',
 subtitle: item.kind==='service'?'Care, connected to your recovery.':'Practical support for recovery at home.',
 description: `${item.name}, available as a sample ${item.kind==='service'?'care service':'recovery essential'} on its own or within a customized recovery package.`,
 features: ['Available in recovery packages', 'Shared account and order history', 'Sample pricing for this iteration'],
 specs: [['Listing', 'Sample catalog item'], ['Unit', item.unit], ['Availability', 'Demo only · Mumbai launch planned']],
 note: 'Suggested package contents are sample planning templates, not a prescription. Your treating team must confirm device fit, specifications, quantities and the appropriate care plan.',
}));
export const products = catalog.filter(p=>p.kind!=='service');
export const services = catalog.filter(p=>p.kind==='service');
export const rentalProducts = products.filter(p=>p.rental7>0);
export const money = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);
export function getProduct(id: string) { return catalog.find(p => p.id === id); }
export function linePrice(line: CartLine) {
 const p=getProduct(line.productId); if(!p)throw new Error('Unknown product');
 if(line.mode==='rental')return p.rentalDaily?p.rentalDaily*line.days:line.days===30?p.rental30:p.rental7*Math.ceil(line.days/7);
 return p.price;
}
export function validLine(line:CartLine) {
 const p=getProduct(line.productId);
 return !!p && (line.mode==='service'?p.kind==='service':p.kind!=='service'&&(line.mode==='purchase'?p.price>0:p.rental7>0));
}
export function cartTotals(lines: CartLine[]) {
 const subtotal=lines.reduce((s,l)=>s+linePrice(l)*l.quantity,0);
 const deposit=lines.reduce((s,l)=>s+(l.mode==='rental'?getProduct(l.productId)!.deposit*l.quantity:0),0);
 return {subtotal,deposit,total:subtotal+deposit};
}
export function lineLabel(line:Pick<CartLine,'mode'|'days'>){return line.mode==='rental'?`${line.days}-day rental`:line.mode==='service'?'Care service':'Purchase'}
