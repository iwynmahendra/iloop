import json, io, contextlib, re, os
ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
with contextlib.redirect_stdout(io.StringIO()):
    from gen import *
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'genapi.py')).read().split("out = []")[0].split("from gen import *")[1].replace("   # re-runs the (deterministic) schema generation, gives us M with parsed fields",""))
import os
api = json.load(open('/dev/stdin')) if False else None
OUT=ROOT + '/apps/web/src/generated/resources.ts'
src=open(ROOT + '/apps/api/src/crud/resources.generated.ts').read()
data=json.loads(src[src.index('= [')+2:src.rindex(';')])
def human(s): 
    s=re.sub(r'([a-z0-9])([A-Z])',r'\1 \2',s); s=s.replace('M2','m²'); return s[0].upper()+s[1:]
by_delegate={d['delegate']:d for d in data}
PLUR={'Category':'Categories','City':'Cities','Country':'Countries','Currency':'Currencies','Amenity':'Amenities','Cancellation Policy':'Cancellation policies','Room Inventory':'Room inventory','Trip Itinerary Day':'Trip itinerary days','Club Opening Hour':'Club opening hours'}
res=[]
for d in data:
    label=human(d['name']); plural=PLUR.get(label, label+'s'); plural=plural[0]+plural[1:].lower() if plural not in PLUR.values() else plural
    names=[f['n'] for f in d['fields']]
    disp=next((x for x in ['name','title','code','plateNumber','date','eventDate'] if x in names), None)
    refmap={r['field']:by_delegate[r['delegate']] for r in d['refs'] if r['delegate'] in by_delegate}
    fields=[]
    for f in d['fields']:
        o=dict(f); o['label']=human(f['n']).replace(' Id','').replace('Code','code') if f['n'].endswith('Id') else human(f['n'])
        if f['n'] in refmap: t=refmap[f['n']]; o['ref']=dict(group=t['group'],path=t['path'],display=next((x for x in ['name','title','code','plateNumber'] if x in [g['n'] for g in t['fields']]),None),resource=t['name'])
        if f['n']=='countryCode': o['codeRef']='countries'; o['label']='Country'
        if f['n']=='currencyCode': o['codeRef']='currencies'; o['label']='Currency'
        fields.append(o)
    cols=[]
    def add(n): 
        if n and n in [x['n'] for x in fields] and n not in cols and len(cols)<7: cols.append(n)
    add('code'); add('name'); add('title'); add('plateNumber')
    for f in fields:
        if f['t']=='enum' and f['n']!='status' and sum(1 for c in cols if next(x for x in fields if x['n']==c)['t']=='enum')<2: add(f['n'])
    for f in fields:
        if 'ref' in f and f['n']!='parentId' and len(cols)<6: add(f['n'])
    for t in ('decimal','date','time','int'):
        for f in fields:
            if f['t']==t and not f['opt'] and len(cols)<7 and sum(1 for c in cols if next(x for x in fields if x['n']==c)['t']==t)<1: add(f['n'])
    if not cols: cols=[fields[0]['n']]
    children=[]
    for o in data:
        if o['group']==d['group'] and o['name']!=d['name']:
            for r in o['refs']:
                if r['delegate']==d['delegate'] and r['field']!='parentId': children.append(dict(path=o['path'],group=o['group'],field=r['field'],label=None,name=o['name']))
    res.append(dict(name=d['name'],label=label,plural=plural,group=d['group'],path=d['path'],tenant=d['tenant'],sharedRead=d['sharedRead'],display=disp,columns=cols,search=d['search'],fields=fields,sets=d['sets'],children=children))
for r in res:
    for c in r['children']:
        t=next(x for x in res if x['name']==c['name']); c['label']=t['plural']
os.makedirs(os.path.dirname(OUT),exist_ok=True)
open(OUT,'w').write("// GENERATED from the data model. Do not edit by hand.\nexport type FieldType = 'uuid'|'string'|'char'|'int'|'bigint'|'decimal'|'bool'|'date'|'datetime'|'json'|'time'|'array'|'enum';\nexport interface FieldDef { n: string; t: FieldType; opt: boolean; hasDefault: boolean; values?: string[]; max?: number; label: string; codeRef?: 'countries'|'currencies'; ref?: { group: string; path: string; display: string|null; resource: string } }\nexport interface SetDef { path: 'images'|'amenities'; kind: 'image'|'join'; delegate?: string; refDelegate?: string; parentField: string; childField: string; relation: string }\nexport interface ChildDef { path: string; group: string; field: string; label: string; name: string }\nexport interface ResourceDef { name: string; label: string; plural: string; group: 'shared'|'hotel'|'trips'|'transport'|'club'; path: string; tenant: boolean; sharedRead: boolean; display: string|null; columns: string[]; search: string[]; fields: FieldDef[]; sets: SetDef[]; children: ChildDef[] }\nexport const resources: ResourceDef[] = %s;\n" % json.dumps(res, indent=1))
print(len(res), [ (r['name'], r['columns']) for r in res][:6])
