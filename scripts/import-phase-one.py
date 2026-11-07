"""Import public sample rates only. Never export cost, margin or inventory columns."""
import csv, json, re, sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
package_rows = list(csv.reader(open(sys.argv[1], encoding='utf-8-sig')))
stock_rows = list(csv.DictReader(open(sys.argv[2], encoding='utf-8-sig')))
def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')
def amount(value):
    match = re.search(r'\d[\d,]*', value)
    return int(match[0].replace(',', '')) * 100 if match else 0
aliases = {
 'Digital BP monitor':'bp-machine', 'Manual wheelchair':'wheelchair',
 'Walking frame / walker':'walker', 'Axillary crutches, pair':'crutches-pair',
 'Manual hospital bed':'hospital-bed-manual', 'Chair commode':'commode-chair',
 'Anti-decubitus air mattress':'air-mattress', 'TENS machine':'tens-unit',
 'Cold therapy machine':'cold-therapy-machine', 'Cold therapy pack':'gel-ice-packs-set-of-2',
 'Compression stockings':'compression-stockings-pair',
}
items = {}
for row in stock_rows:
    name = row['Product name'].strip()
    if not name: continue
    id = aliases.get(name, slug(name))
    rent = row['Average monthly rental charged'].strip()
    monthly = amount(rent) if rent.startswith('₹') else 0
    items[id] = dict(id=id, name=name, category=row['Category'], kind='product',
      price=amount(row["Brand's selling price"]), rental7=((monthly//100+3)//4)*100,
      rental30=monthly, rentalDaily=0, deposit=0, unit='each',
      source='catalog-range', priceNote='Sample price uses the lower end of the supplied range. Brand and specifications to be confirmed.')
start = next(i for i,r in enumerate(package_rows) if r and r[0]=='Item')
head = package_rows[start]
slugs = ['knee-replacement','hip-replacement','acl-reconstruction','knee-arthroscopy-meniscus-repair','fracture-recovery','ankle-foot-surgery','upper-limb-fracture-fixation','spine-surgery','cervical-spine-surgery','shoulder-surgery']
packages = [dict(slug=s, name=head[i+5], weeks=int(package_rows[start+1][i+5]), lines=[]) for i,s in enumerate(slugs)]
for row in package_rows[start+2:]:
    if len(row)<4 or row[1] not in ['Product','Rental','Service']: continue
    name, kind, unit, rate = row[0], row[1], row[2], amount(row[3])
    id = slug(name)
    if kind=='Service': id = 'service-'+id
    item = items.get(id,dict(id=id,name=name,category='Recovery supplies' if kind=='Product' else 'Recovery equipment',kind='product',price=0,rental7=0,rental30=0,rentalDaily=0,deposit=0,unit='each'))
    if kind=='Product': item['price']=rate
    elif kind=='Rental':
        if unit=='day': item.update(rentalDaily=rate,rental7=rate*7,rental30=rate*30)
        else: item.update(rental7=rate,rental30=rate*5)
    else: item.update(kind='service',price=rate,category='Care services',unit=unit)
    item['name']=name
    if kind=='Product': item['unit']=unit
    item.update(source='package-sheet',priceNote='Sample item rate from the supplied package sheet; final pricing and suitability to be confirmed.')
    items[id]=item
    for i,p in enumerate(packages):
        qty=int(row[i+5] or 0)
        if qty:
            p['lines'].append(dict(productId=id,mode=kind.lower() if kind!='Product' else 'purchase',quantity=1 if kind=='Rental' else qty,days=qty*(7 if unit=='week' else 1) if kind=='Rental' else 7))
for p in packages:
    def price(l):
        it=items[l['productId']]
        return (it['rentalDaily']*l['days'] if it['rentalDaily'] else it['rental7']*((l['days']+6)//7)) if l['mode']=='rental' else it['price']*l['quantity']
    p['price']=sum(price(l) for l in p['lines'])//100
    stated=next(r for r in package_rows if r and r[0]=='Standard price (₹)')[5+slugs.index(p['slug'])]
    assert p['price']*100==amount(stated), (p['slug'],p['price'],stated)
public = {'items':list(items.values()),'packages':packages}
for target in ['lib/data/phase-one.json','packages/core/data/phase-one.json']:
    (root/target).write_text(json.dumps(public,indent=2)+'\n')
print(f'Imported {len(items)} public catalog items and {len(packages)} reconciled packages; no internal cost or inventory fields exported.')
