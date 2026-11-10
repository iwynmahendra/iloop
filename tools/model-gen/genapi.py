import json, io, contextlib, os
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
with contextlib.redirect_stdout(io.StringIO()):
    from gen import *   # re-runs the (deterministic) schema generation, gives us M with parsed fields
OUTP = ROOT + '/apps/api/src/crud/resources.generated.ts'
SEARCH = ['code','name','title','plateNumber','licenseNumber','email','phone','originLabel','destinationLabel','location','address']
HIDDEN = {'id','supplierId','createdBy','updatedBy','createdAt','updatedAt','deletedAt'}
def kebab(t): return t.replace('_','-')
def ftype(f):
    t = f['ptype']
    if f['enum']: return 'enum'
    return {'u':'uuid'}.get(None,None) or None
# re-derive a short type from sql/pat info
def short(f):
    if f['enum']: return 'enum'
    sql = f['sql']
    if f['ptype']=='String':
        if f['pat']=='@db.Uuid': return 'uuid'
        if f['arr']: return 'array'
        if f['pat']=='@db.VarChar(5)' and f['sql']=='VARCHAR(5)' and f['name'].lower().endswith('time') or f['name'] in ('opensAt','closesAt'): return 'time'
        if f['pat'].startswith('@db.Char'): return 'char'
        return 'string'
    return {'Int':'int','BigInt':'bigint','Decimal':'decimal','Boolean':'bool','DateTime':'date' if f['pat']=='@db.Date' else 'datetime','Json':'json'}[f['ptype']]
def maxlen(f):
    import re
    m = re.search(r'\((\d+)\)', f['pat'] or '')
    return int(m.group(1)) if m else None
out = []
joins = {}   # parent model -> list of sets
skip = set()
for n in ORDER:
    m = M[n]
    if m['kind'] != 'tenant': continue
    names = [f['name'] for f in m['F'] if f['name'] not in HIDDEN and f['name']!='status']
    if 'mediaId' in names:
        parent = [x for x in names if x.endswith('Id') and x!='mediaId'][0]
        rel = [r for r in m['rel'] if r['f']==parent][0]
        joins.setdefault(rel['to'],[]).append(dict(path='images',kind='image',delegate=lower_first(n),parentField=parent,childField='mediaId',relation='media',refDelegate='mediaAsset'))
        skip.add(n)
    elif len(names)==2 and 'amenityId' in names:
        parent = [x for x in names if x!='amenityId'][0]
        rel = [r for r in m['rel'] if r['f']==parent][0]
        joins.setdefault(rel['to'],[]).append(dict(path='amenities',kind='join',delegate=lower_first(n),parentField=parent,childField='amenityId',relation='amenity',refDelegate='amenity'))
        skip.add(n)
for n in ORDER:
    m = M[n]
    if m['kind'] not in ('tenant','global') or n in skip: continue
    fields = []
    for f in m['F']:
        if f['name'] in HIDDEN: continue
        d = dict(n=f['name'], t=short(f), opt=f['opt'], hasDefault=f['dflt'] is not None)
        if f['enum']: d['values'] = ENUMS[f['enum']]
        ml = maxlen(f)
        if ml and d['t'] in ('string','char'): d['max']=ml
        fields.append(d)
    names = [f['n'] for f in fields]
    refs = []
    for r in m['rel']:
        if r['f'] in ('supplierId',) or r['ref']!='id': continue
        refs.append(dict(field=r['f'], delegate=lower_first(r['to'])))
    out.append(dict(name=n, delegate=lower_first(n), table=m['table'], group=m['group'], path=kebab(m['table']), tenant=m['kind']=='tenant',
        fields=fields, search=[s for s in SEARCH if s in names], refs=refs, sets=joins.get(n,[]),
        sharedRead=m['table'] in ('cities','amenities','categories'),
        keyField='code' if 'code' in names else None))
open(OUTP,'w').write("// GENERATED from the data model. Do not edit by hand.\nimport type { ResourceDef } from './types.js';\nexport const resources: ResourceDef[] = %s;\n" % json.dumps(out, indent=1))
print(len(out), 'resources;', sum(len(r['sets']) for r in out), 'sets')
