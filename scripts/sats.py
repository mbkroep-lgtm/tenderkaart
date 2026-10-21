import json, urllib.request, urllib.parse, os, time, ssl, concurrent.futures as cf
os.makedirs('preview', exist_ok=True)
UA={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept':'application/json, text/html, */*'}
C=[
 ("UNGM zoek","POST","https://www.ungm.org/Public/Notice/Search",json.dumps({"PageIndex":0,"PageSize":15,"Title":"starlink","Description":"","Reference":"","PublishedFrom":"","PublishedTo":"","DeadlineFrom":"","DeadlineTo":"","Countries":[],"Agencies":[],"UNSPSCs":[],"NoticeTypes":[],"SortField":"DatePublished","SortAscending":False,"isPicker":False,"IsSustainable":False,"NoticeDisplayType":None,"NoticeSearchTotalLabelId":"noticeSearchTotal","TypeOfCompetitions":[]}),{"Content-Type":"application/json"}),
 ("Polen BZP","GET","https://ezamowienia.gov.pl/mo-board/api/v1/Board/Search?NoticeType=ContractNotice&PublicationDateFrom=2026-10-01&PublicationDateTo=2026-10-20&SubjectContains=starlink&PageNumber=1&PageSize=50",None,{}),
 ("Polen BZP2","GET","https://ezamowienia.gov.pl/mo-board/api/v1/notice?NoticeType=ContractNotice&PublicationDateFrom=2026-10-01&PublicationDateTo=2026-10-20&PageSize=10",None,{}),
 ("Ecuador SERCOP","GET","https://datosabiertos.compraspublicas.gob.ec/PLATAFORMA/api/search_ocds?year=2026&search=starlink",None,{}),
 ("Zuid-Afrika eTenders","GET","https://ocds-api.etenders.gov.za/api/OCDSReleases?PageNumber=1&PageSize=50&dateFrom=2026-10-01&dateTo=2026-10-20",None,{}),
 ("Moldavië MTender","GET","https://public.mtender.gov.md/tenders/?limit=5",None,{}),
 ("Duitsland oeffentlichevergabe","GET","https://oeffentlichevergabe.de/api/notice-exports?pubDay=2026-10-20&format=ocds.zip",None,{}),
 ("Duitsland service.bund","GET","https://www.service.bund.de/Content/DE/Ausschreibungen/Suche/Formular.html?view=processForm&nn=4641514&resultsPerPage=20&templateQueryString=starlink",None,{}),
 ("Portugal BASE","GET","https://www.base.gov.pt/Base4/pt/resultados/?type=search_anuncios&query=texto%3Dstarlink&sort=-drPublicationDate&page=0&size=25",None,{}),
 ("Portugal BASE POST","POST","https://www.base.gov.pt/Base4/pt/resultados/","type=search_anuncios&version=133.0&query=texto%3Dstarlink&sort=-drPublicationDate&page=0&size=25",{"Content-Type":"application/x-www-form-urlencoded"}),
 ("Roemenië SEAP","POST","https://www.e-licitatie.ro/api-pub/NoticeCommon/GetCNoticeList/",json.dumps({"sysNoticeTypeIds":[],"sortProperties":[],"pageSize":5,"hasUnansweredQuestions":False,"startPublicationDate":"2026-10-01T00:00:00.000Z","sysProcedureStateId":None,"pageIndex":0,"contractObject":"starlink"}),{"Content-Type":"application/json;charset=UTF-8","Referer":"https://www.e-licitatie.ro/pub/notices/contract-notices/list/0/0"}),
 ("Noorwegen Doffin","POST","https://api.doffin.no/webclient/api/v2/search-api/search",json.dumps({"numHitsPerPage":10,"page":1,"searchString":"starlink","sortBy":"RELEVANCE","facets":{}}),{"Content-Type":"application/json"}),
 ("Finland Hilma","GET","https://www.hankintailmoitukset.fi/fi/search?q=starlink",None,{}),
 ("Estland","GET","https://riigihanked.riik.ee/rhr/api/public/v1/opendata/notice/2026/10/json",None,{}),
 ("Slowakije UVO","GET","https://www.uvo.gov.sk/vyhladavanie/vyhladavanie-zakaziek?cpv=&text=starlink",None,{}),
 ("Tsjechië NEN","GET","https://nen.nipez.cz/verejne-zakazky?q=starlink",None,{}),
 ("Spanje PLACSP","GET","https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom",None,{}),
 ("Italië ANAC","GET","https://dati.anticorruzione.it/opendata/api/3/action/package_search?q=bandi",None,{}),
 ("Uruguay ARCE","GET","https://www.comprasestatales.gub.uy/ocds/rss",None,{}),
 ("Uruguay ARCE2","GET","https://www.comprasestatales.gub.uy/comprasenlinea/jboss/generarReporte?tipo_pub=ALL&tipo_compra=&rango-fecha=&filtro_cat=&filtro_desc=starlink",None,{}),
 ("Paraguay DNCP","GET","https://www.contrataciones.gov.py/datos/api/v3/doc/search/processes?q=starlink",None,{}),
 ("Peru OECE","GET","https://contratacionesabiertas.oece.gob.pe/api/v1/releases?search=starlink",None,{}),
 ("Dominicaanse Rep.","GET","https://datosabiertos.dgcp.gob.do/api-dgcp/v1/procesos?descripcion=starlink",None,{}),
 ("Honduras","GET","https://www.contratacionesabiertas.gob.hn/api/v1/release/?q=starlink",None,{}),
 ("Chili MercadoPublico","GET","https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?estado=activas&ticket=F8537A18-6766-4DEF-9E59-426B4FEE2844",None,{}),
 ("Mexico ComprasMX","GET","https://comprasmx.buengobierno.gob.mx/",None,{}),
 ("Argentina COMPR.AR","GET","https://comprar.gob.ar/BuscarAvanzado.aspx",None,{}),
 ("Kenia PPIP","GET","https://tenders.go.ke/api/active-tenders?search=starlink",None,{}),
 ("Nigeria NOCOPO","GET","https://nocopo.bpp.gov.ng/api/v1/releases?q=starlink",None,{}),
 ("Filipijnen PhilGEPS","GET","https://notices.philgeps.gov.ph/GEPSNONPILOT/Tender/SplashOpportunitiesSearchUI.aspx?menuIndex=3&ClickFrom=OpenOpp&Result=3",None,{}),
 ("Indonesië INAPROC","GET","https://isb.lkpp.go.id/isb-2/api/satudata/ListPaketSPSE?tahun=2026",None,{}),
 ("India CPPP","GET","https://eprocure.gov.in/cppp/latestactivetendersnew/cpppdata",None,{}),
 ("India GeM","GET","https://bidplus.gem.gov.in/all-bids",None,{}),
 ("Zuid-Korea KONEPS","GET","https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoThngPPSSrch?numOfRows=10&pageNo=1&type=json&bidNtceNm=starlink",None,{}),
 ("Japan JETRO","GET","https://www.jetro.go.jp/gov_procurement/",None,{}),
 ("Nieuw-Zeeland GETS","GET","https://www.gets.govt.nz/ExternalIndex.htm",None,{}),
 ("Australië NSW","GET","https://api.tenders.nsw.gov.au/v1/ocds/releases?search=starlink",None,{}),
 ("Kazachstan goszakup","GET","https://goszakup.gov.kz/ru/search/lots?filter%5Bname%5D=starlink",None,{}),
 ("Georgië","GET","https://tenders.procurement.gov.ge/public/?lang=en",None,{}),
 ("Kirgizië","GET","http://zakupki.gov.kg/popp/view/order/list.xhtml",None,{}),
 ("Armenië","GET","https://armeps.am/ppcm/public/tenders",None,{}),
 ("ADB","GET","https://www.adb.org/projects/tenders/rss",None,{}),
 ("AfDB","GET","https://www.afdb.org/en/projects-and-operations/procurement/resources-for-businesses/general-procurement-notices/rss",None,{}),
 ("EBRD ECEPP","GET","https://ecepp.ebrd.com/delta/noticeSearchResults.html?searchString=starlink",None,{}),
 ("IDB","GET","https://projectprocurement.iadb.org/en/procurement-notices?search_api_fulltext=starlink",None,{}),
 ("NATO NSPA","GET","https://eportal.nspa.nato.int/Codification/CageTool/home",None,{}),
 ("UNICEF","GET","https://www.unicef.org/supply/tenders",None,{}),
 ("UNHCR","GET","https://www.unhcr.org/what-we-do/how-we-work/procurement/tender-notices",None,{}),
 ("WFP","GET","https://www.wfp.org/procurement",None,{}),
 ("OCP registry","GET","https://data.open-contracting.org/en/search/",None,{}),
 ("Oostenrijk","GET","https://www.data.gv.at/katalog/api/3/action/package_search?q=ausschreibung",None,{}),
 ("België e-Proc","GET","https://www.publicprocurement.be/api/sea/search/publications?text=starlink",None,{}),
 ("Griekenland KIMDIS","GET","https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice?page=0",None,{}),
 ("Bulgarije CAIS","GET","https://app.eop.bg/today",None,{}),
 ("Kroatië EOJN","GET","https://eojn.hr/",None,{}),
 ("Litouwen CVP","GET","https://cvpp.eviesiejipirkimai.lt/",None,{}),
 ("Letland EIS","GET","https://www.eis.gov.lv/EKEIS/Supplier/Procurements",None,{}),
 ("Ierland eTenders","GET","https://www.etenders.gov.ie/epps/quickSearchAction.do?searchSelect=1&searchString=starlink",None,{}),
 ("Denemarken udbud","GET","https://udbud.dk/",None,{}),
 ("Zweden","GET","https://www.upphandlingsmyndigheten.se/",None,{}),
 ("Turkije EKAP","GET","https://ekap.kik.gov.tr/EKAP/Ortak/IhaleArama/index.html",None,{}),
 ("Israël","GET","https://mr.gov.il/ilgstorefront/en/search/?s=TENDER&q=starlink",None,{}),
 ("Saudi Etimad","GET","https://tenders.etimad.sa/Tender/AllTendersForVisitor",None,{}),
 ("VAE","GET","https://www.dubaiesupply.gov.ae/",None,{}),
 ("Vietnam","GET","https://muasamcong.mpi.gov.vn/",None,{}),
 ("Thailand","GET","https://process3.gprocurement.go.th/egp2procmainWeb/jsp/procsearch.sch",None,{}),
 ("Maleisië","GET","https://www.eperolehan.gov.my/",None,{}),
 ("Bangladesh e-GP","GET","https://www.eprocure.gov.bd/",None,{}),
 ("Pakistan PPRA","GET","https://www.ppra.org.pk/",None,{}),
 ("Ghana","GET","https://www.ghaneps.gov.gh/",None,{}),
 ("Zambia ZPPA","GET","https://www.zppa.org.zm/",None,{}),
 ("Rwanda Umucyo","GET","https://www.umucyo.gov.rw/",None,{}),
 ("Tanzania NeST","GET","https://nest.go.tz/",None,{}),
 ("Uganda EGP","GET","https://egpuganda.go.ug/",None,{}),
]
def run(c):
    name,m,url,body,h=c; t=time.time()
    try:
        req=urllib.request.Request(url,data=body.encode() if body else None,headers={**UA,**h},method=m)
        r=urllib.request.urlopen(req,timeout=30); b=r.read(400000)
        txt=b.decode('utf-8','replace')
        return f"{name}: {r.status} {r.headers.get('content-type','')[:40]} {len(b)}B {time.time()-t:.1f}s starlink={txt.lower().count('starlink')} :: {txt[:160]!r}"
    except urllib.error.HTTPError as e:
        return f"{name}: HTTP {e.code} :: {e.read(160)!r}"
    except Exception as e:
        return f"{name}: FOUT {str(e)[:120]}"
with cf.ThreadPoolExecutor(8) as ex: res=list(ex.map(run,C))
open('preview/log.txt','w').write('\n'.join(res))
