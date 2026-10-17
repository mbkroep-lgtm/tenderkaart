import json, urllib.request, os, time
os.makedirs('preview', exist_ok=True)
B='https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?dataFinal=20281017&tamanhoPagina=50&pagina='
out=[]
for p in [1,2,50,150,300,450,570]:
    t=time.time()
    try:
        r=urllib.request.urlopen(urllib.request.Request(B+str(p),headers={'Accept':'application/json','User-Agent':'Mozilla/5.0 (tendermap; +https://tenderkaart.vercel.app)'}),timeout=90)
        d=json.loads(r.read().decode() or '{}'); out.append(f"pagina {p}: {time.time()-t:.1f}s n={len(d.get('data') or [])} totaal={d.get('totalRegistros')} pag={d.get('totalPaginas')}")
    except Exception as e: out.append(f"pagina {p}: FOUT na {time.time()-t:.1f}s {e}")
open('preview/log.txt','w').write('\n'.join(out))
