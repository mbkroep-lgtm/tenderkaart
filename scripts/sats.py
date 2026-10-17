import json, urllib.request, os, time, concurrent.futures as cf
os.makedirs('preview', exist_ok=True)
B='https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?dataFinal=20281017&tamanhoPagina=50&pagina='
def get(p):
    t=time.time()
    try:
        r=urllib.request.urlopen(urllib.request.Request(B+str(p),headers={'Accept':'application/json','User-Agent':'Mozilla/5.0 (tendermap; +https://tenderkaart.vercel.app)'}),timeout=40)
        d=json.loads(r.read().decode() or '{}'); return f"{p}:{time.time()-t:.1f}s n={len(d.get('data') or [])}"
    except Exception as e: return f"{p}:FOUT {time.time()-t:.1f}s {str(e)[:60]}"
out=[]
for w in [2,4]:
    t=time.time()
    with cf.ThreadPoolExecutor(w) as ex: res=list(ex.map(get, range(100+w*30, 130+w*30)))
    out.append(f"== {w} tegelijk, 30 pagina's in {time.time()-t:.0f}s"); out+=res
open('preview/log.txt','w').write('\n'.join(out))
