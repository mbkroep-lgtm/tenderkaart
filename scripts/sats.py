import json, urllib.request, os, time, re
os.makedirs('preview/p', exist_ok=True)
UA={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept':'application/json, text/html, */*'}
C=[
 ("ungm_js","GET","https://www.ungm.org/Scripts/UNGM.js",None,{}),
 ("ungm_bundle","GET","https://www.ungm.org/bundles/ungmcommon?v=fm4r1JWsHbLeP8hAUwq9IGEpWYPm-Du9hAP5qTN1vyM1",None,{}),
 ("dominicana_p","GET","https://datosabiertos.dgcp.gob.do/api-dgcp/v1/procesos?page=2&limit=100",None,{}),
 ("servicebund_rss","GET","https://www.service.bund.de/Content/DE/Ausschreibungen/Suche/Formular.html?nn=4641482&resultsPerPage=100&templateQueryString=starlink&sortOrder=dateOfIssue_dt+desc&jobsrss=true",None,{}),
 ("ecuador","GET","https://datosabiertos.compraspublicas.gob.ec/PLATAFORMA/api/search_ocds?year=2026&search=starlink",None,{}),
 ("kz2","GET","https://goszakup.gov.kz/ru/search/lots?filter%5Bname%5D=starlink&count_record=50&page=1",None,{}),
 ("za_day","GET","https://ocds-api.etenders.gov.za/api/OCDSReleases?PageNumber=1&PageSize=1000&dateFrom=2026-10-20&dateTo=2026-10-20",None,{}),
 ("kenya_p","GET","https://tenders.go.ke/api/active-tenders?page=2&perPage=100",None,{}),
]
log=[]
for name,m,url,body,h in C:
    t=time.time()
    try:
        req=urllib.request.Request(url,data=body.encode() if body else None,headers={**UA,**h},method=m)
        b=urllib.request.urlopen(req,timeout=40).read(3000000)
        open(f'preview/p/{name}.txt','wb').write(b[:600000]); log.append(f"{name}: {len(b)}B {time.time()-t:.1f}s")
    except Exception as e: log.append(f"{name}: FOUT {e}")
    time.sleep(1)
open('preview/log.txt','w').write('\n'.join(log))
