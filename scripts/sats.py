import json, urllib.request, os, time
os.makedirs('preview', exist_ok=True)
B='https://pncp.gov.br/api/consulta/v1/contratacoes/'
def get(u):
    t=time.time()
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers={'Accept':'application/json','User-Agent':'Mozilla/5.0'}),timeout=60)
        b=r.read().decode(); d=json.loads(b) if b.strip() else {}
        return d, time.time()-t, r.status
    except Exception as e: return {'err':str(e)}, time.time()-t, 0
out=[]
for m in [6,8,4,9,5,12]:
    d,dt,st=get(B+f'publicacao?dataInicial=20261015&dataFinal=20261015&codigoModalidadeContratacao={m}&pagina=1&tamanhoPagina=50')
    out.append(f"publicacao mod {m} 1 dag: status {st} total {d.get('totalRegistros')} pag {d.get('totalPaginas')} {dt:.1f}s {d.get('err','')}")
d,dt,st=get(B+'proposta?dataFinal=20261231&pagina=1&tamanhoPagina=50')
out.append(f"proposta open: status {st} total {d.get('totalRegistros')} pag {d.get('totalPaginas')} {dt:.1f}s {d.get('err','')}")
if d.get('data'): out.append(json.dumps(d['data'][0],ensure_ascii=False)[:1500])
d,dt,st=get(B+'proposta?dataFinal=20261231&pagina=1&tamanhoPagina=500')
out.append(f"proposta 500: status {st} n {len(d.get('data') or [])} {dt:.1f}s {d.get('err','')}")
open('preview/log.txt','w').write('\n'.join(out))
