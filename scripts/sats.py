import json, urllib.request, os, time, re
os.makedirs('preview/p', exist_ok=True)
UA={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept':'application/json, text/html, */*'}
C=[
 ("ungm_page","GET","https://www.ungm.org/Public/Notice",None,{}),
 ("bzp_day","GET","https://ezamowienia.gov.pl/mo-board/api/v1/notice?NoticeType=ContractNotice&PublicationDateFrom=2026-10-19&PublicationDateTo=2026-10-20&PageSize=500",None,{}),
 ("ro_seap","POST","https://www.e-licitatie.ro/api-pub/NoticeCommon/GetCNoticeList/",json.dumps({"sysNoticeTypeIds":[],"sortProperties":[],"pageSize":50,"hasUnansweredQuestions":False,"startPublicationDate":"2026-10-19T00:00:00.000Z","sysProcedureStateId":None,"pageIndex":0}),{"Content-Type":"application/json;charset=UTF-8","Referer":"https://www.e-licitatie.ro/pub/notices/contract-notices/list/0/0"}),
 ("kenya","GET","https://tenders.go.ke/api/active-tenders?search=starlink",None,{}),
 ("kenya_all","GET","https://tenders.go.ke/api/active-tenders",None,{}),
 ("ecuador","GET","https://datosabiertos.compraspublicas.gob.ec/PLATAFORMA/api/search_ocds?year=2026&search=starlink",None,{}),
 ("dominicana","GET","https://datosabiertos.dgcp.gob.do/api-dgcp/v1/procesos?limit=5",None,{}),
 ("za","GET","https://ocds-api.etenders.gov.za/api/OCDSReleases?PageNumber=1&PageSize=20&dateFrom=2026-10-19&dateTo=2026-10-20",None,{}),
 ("kz","GET","https://goszakup.gov.kz/ru/search/lots?filter%5Bname%5D=starlink",None,{}),
 ("ebrd","GET","https://ecepp.ebrd.com/delta/noticeSearchResults.html?searchString=starlink",None,{}),
 ("uy","GET","https://www.comprasestatales.gub.uy/ocds/rss",None,{}),
 ("doffin","POST","https://api.doffin.no/webclient/api/v2/search-api/search",json.dumps({"numHitsPerPage":10,"page":1,"searchString":"starlink","sortBy":"PUBLICATION_DATE_DESC","facets":{}}),{"Content-Type":"application/json"}),
 ("base","POST","https://www.base.gov.pt/Base4/pt/resultados/","type=search_anuncios&version=133.0&query=texto%3Dstarlink&sort=-drPublicationDate&page=0&size=25",{"Content-Type":"application/x-www-form-urlencoded"}),
 ("israel","GET","https://mr.gov.il/ilgstorefront/en/search/?s=TENDER&q=starlink",None,{}),
 ("slowakije","GET","https://www.uvo.gov.sk/vyhladavanie/vyhladavanie-zakaziek?cpv=&text=starlink",None,{}),
 ("nen","GET","https://nen.nipez.cz/verejne-zakazky?q=starlink",None,{}),
 ("servicebund","GET","https://www.service.bund.de/Content/DE/Ausschreibungen/Suche/Formular.html?view=processForm&nn=4641514&resultsPerPage=20&templateQueryString=starlink",None,{}),
 ("placsp","GET","https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom",None,{}),
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
