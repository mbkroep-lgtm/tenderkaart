import json, urllib.request, os, time, re, http.cookiejar, zipfile, io
os.makedirs('preview/p', exist_ok=True)
UA={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept':'application/json, text/html, */*'}
log=[]
def save(n,b): open(f'preview/p/{n}.txt','wb').write(b[:600000]); log.append(f"{n}: {len(b)}B")
try:
    cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    page=op.open(urllib.request.Request('https://www.ungm.org/Public/Notice',headers=UA),timeout=40).read().decode('utf-8','replace')
    tok=re.search(r'name="__RequestVerificationToken" type="hidden" value="([^"]+)"',page).group(1)
    body={"PageIndex":0,"PageSize":50,"Title":"starlink","Description":"","Reference":"","PublishedFrom":"","PublishedTo":"","DeadlineFrom":"","DeadlineTo":"","Countries":[],"Agencies":[],"UNSPSCs":[],"NoticeTypes":[],"SortField":"DatePublished","SortAscending":False,"isPicker":False,"IsSustainable":False,"IsActive":False,"NoticeDisplayType":None,"NoticeSearchTotalLabelId":"noticeSearchTotal","TypeOfCompetitions":[]}
    r=op.open(urllib.request.Request('https://www.ungm.org/Public/Notice/Search',data=json.dumps(body).encode(),headers={**UA,'Content-Type':'application/json','RequestVerificationToken':tok,'X-Requested-With':'XMLHttpRequest','Referer':'https://www.ungm.org/Public/Notice'},method='POST'),timeout=40)
    save('ungm_search',r.read())
except Exception as e: log.append(f"ungm: FOUT {e}")
for n,u in [("kz2","https://goszakup.gov.kz/ru/search/lots?filter%5Bname%5D=starlink&count_record=50&page=1"),
            ("kenya_p1","https://tenders.go.ke/api/active-tenders?page=2"),
            ("kenya_p2","https://tenders.go.ke/api/active-tenders?per_page=100&page=1")]:
    try: save(n,urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40).read())
    except Exception as e: log.append(f"{n}: FOUT {e}")
try:
    b=urllib.request.urlopen(urllib.request.Request('https://oeffentlichevergabe.de/api/notice-exports?pubDay=2026-10-20&format=ocds.zip',headers=UA),timeout=60).read()
    z=zipfile.ZipFile(io.BytesIO(b)); names=z.namelist(); log.append(f"de zip {len(b)}B, {len(names)} bestanden")
    save('de_one', z.read(names[0]))
except Exception as e: log.append(f"de: FOUT {e}")
open('preview/log.txt','w').write('\n'.join(log))
