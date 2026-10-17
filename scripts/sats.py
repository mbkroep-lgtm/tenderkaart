import subprocess, os
os.makedirs('preview', exist_ok=True)
cmds = [
 "curl -sS -m 40 -o /dev/null -w '%{http_code} %{time_total}s ip=%{remote_ip}\\n' 'https://pncp.gov.br/api/search/?q=starlink&tipos_documento=edital&pagina=1&tam_pagina=10&ordenacao=-data'",
 "curl -sS -m 40 -o /dev/null -w '%{http_code} %{time_total}s\\n' 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=20261001&dataFinal=20261016&codigoModalidadeContratacao=6&pagina=1'",
 "curl -sS -m 40 -o /dev/null -w '%{http_code}\\n' https://pncp.gov.br/",
 "curl -sS -m 40 -o /dev/null -w '%{http_code}\\n' https://www.gov.br/",
 "curl -sS -m 40 -o /dev/null -w '%{http_code}\\n' 'https://compras.dados.gov.br/'",
 "curl -sS -m 30 ifconfig.io/country_code",
 "getent hosts pncp.gov.br",
]
with open('preview/log.txt','w') as f:
    for c in cmds:
        r = subprocess.run(c, shell=True, capture_output=True, text=True)
        f.write(f"$ {c}\n{r.stdout}{r.stderr}\n")
