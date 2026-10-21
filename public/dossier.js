// AI Tender Bid Assistant (browserkant): tekst uit aanbestedingsstukken halen, de stappen bij de AI aanvragen
// en het inschrijfdossier als Word- en Excel-bestanden (in één ZIP) opbouwen. Geen externe pakketten nodig,
// behalve pdf.js (van cdnjs) voor PDF's.
(function(root){
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/";
  const enc = new TextEncoder(), dec = new TextDecoder();

  // ---------- ZIP lezen ----------
  async function inflateRaw(u8){
    const ds = new DecompressionStream("deflate-raw");
    const out = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(out);
  }
  async function unzip(buf){
    const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let e = u8.length - 22; while(e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if(e < 0) throw new Error("Geen geldig ZIP-bestand");
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    const files = {};
    for(let i = 0; i < n; i++){
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      const lnl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true), start = off + 30 + lnl + lxl;
      const data = u8.subarray(start, start + csize);
      if(!name.endsWith("/")) files[name] = { method, data };
      p += 46 + nlen + xlen + clen;
    }
    const get = async name => { const f = files[name]; if(!f) return null; return f.method === 0 ? f.data : inflateRaw(f.data); };
    return { names: Object.keys(files), get };
  }

  // ---------- tekst uit bestanden ----------
  const xmlText = s => s.replace(/<w:tab\/>/g, "\t").replace(/<\/w:p>|<\/text:p>|<\/a:p>/g, "\n").replace(/<w:br\/>/g, "\n").replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n");
  async function pdfText(buf){
    const pdfjs = await import(PDFJS + "pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.mjs";
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    let out = "";
    for(let i = 1; i <= doc.numPages; i++){
      const tc = await (await doc.getPage(i)).getTextContent();
      out += `\n[pagina ${i}]\n` + tc.items.map(it => it.str + (it.hasEOL ? "\n" : " ")).join("");
    }
    return out;
  }
  async function xlsxText(z){
    const ss = await z.get("xl/sharedStrings.xml"), strings = [];
    if(ss){ const x = dec.decode(ss); for(const m of x.matchAll(/<si>([\s\S]*?)<\/si>/g)) strings.push(xmlText(m[1])); }
    let out = ""; const wb = await z.get("xl/workbook.xml"), titles = wb ? [...dec.decode(wb).matchAll(/<sheet [^>]*name="([^"]*)"/g)].map(m => xmlText(m[1])) : [];
    const sheets = z.names.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
    for(const name of sheets){
      const x = dec.decode(await z.get(name)), nr = parseInt(name.match(/sheet(\d+)/)[1]); out += `\n[Tabblad: ${titles[nr - 1] || name.split("/").pop()}]\n`;
      for(const row of x.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)){
        const cells = [...row[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)].map(c => {
          const v = (c[2].match(/<v>([\s\S]*?)<\/v>/) || [])[1], isS = /t="s"/.test(c[1]);
          if(/t="inlineStr"/.test(c[1])) return xmlText(c[2]);
          return v == null ? "" : isS ? strings[+v] || "" : v; });
        if(cells.some(Boolean)) out += cells.join(" | ") + "\n";
      }
    }
    return out;
  }
  async function fileText(name, buf){
    const ext = (name.split(".").pop() || "").toLowerCase();
    if(ext === "pdf") return pdfText(buf);
    if(["txt","csv","md","html","htm","xml","json"].includes(ext)) return dec.decode(buf).replace(/<[^>]+>/g, ext.startsWith("htm") ? " " : (m => m));
    if(["docx","xlsx","pptx","odt","ods","zip"].includes(ext)){
      const z = await unzip(buf);
      if(ext === "docx"){ let t = ""; for(const n of z.names.filter(n => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n))) t += xmlText(dec.decode(await z.get(n))); return t; }
      if(ext === "xlsx") return xlsxText(z);
      if(ext === "pptx"){ let t = ""; for(const n of z.names.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))) t += xmlText(dec.decode(await z.get(n))) + "\n"; return t; }
      if(ext === "odt" || ext === "ods") return xmlText(dec.decode(await z.get("content.xml")));
      // ZIP: alle bestanden erin
      let t = "";
      for(const n of z.names){ if(/(^|\/)(__MACOSX|\.)/.test(n)) continue;
        try { const sub = await fileText(n, (await z.get(n)).slice().buffer); if(sub && sub.trim()) t += `\n\n===== ${n} =====\n${sub}`; } catch(e) { t += `\n\n===== ${n} ===== (niet leesbaar)`; } }
      return t;
    }
    throw new Error(`Bestandstype .${ext} kan niet gelezen worden (gebruik PDF, Word, Excel of ZIP)`);
  }
  async function readFiles(files, onFile){
    let all = ""; const names = [], skipped = [];
    for(const f of files){
      onFile && onFile(f.name);
      try { const t = await fileText(f.name, await f.arrayBuffer()); if(t && t.trim().length > 20){ all += `\n\n===== ${f.name} =====\n${t.replace(/[ \t]+/g, " ").trim()}`; names.push(f.name); } else skipped.push(f.name + " (geen tekst, mogelijk een scan)"); }
      catch(e) { skipped.push(`${f.name} (${e.message})`); }
    }
    return { text: all.trim(), names, skipped };
  }

  // ---------- ZIP schrijven (zonder compressie, met CRC32) ----------
  const CRC = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for(let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(entries){   // entries: [{name, data: Uint8Array|string}]
    const parts = [], central = []; let off = 0;
    const now = new Date(), dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF,
      dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
    for(const e of entries){
      const data = typeof e.data === "string" ? enc.encode(e.data) : e.data, name = enc.encode(e.name), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    }
    const csize = central.reduce((s, x) => s + x.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
  }
  const blobBytes = async b => new Uint8Array(await b.arrayBuffer());

  // ---------- Word (.docx) ----------
  const x = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const MARK = /(\[(?:ONTBREEKT|PRIJS INVULLEN|HANDTEKENING NODIG)[^\]]*\])/;
  function runs(text, bold){
    return String(text == null ? "" : text).split(MARK).filter(s => s !== "").map(s => {
      const hl = MARK.test(s) && s.startsWith("[");
      return `<w:r><w:rPr>${bold ? "<w:b/>" : ""}${hl ? '<w:highlight w:val="yellow"/>' : ""}</w:rPr><w:t xml:space="preserve">${x(s)}</w:t></w:r>`;
    }).join("");
  }
  const para = (text, style, bold) => String(text == null ? "" : text).split(/\n+/).map(line =>
    `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}${runs(line, bold)}</w:p>`).join("");
  function table(head, rows){
    const cell = (v, h) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>${h ? '<w:shd w:val="clear" w:color="auto" w:fill="DCE6F2"/>' : ""}</w:tcPr>${para(v, "", h)}</w:tc>`;
    const b = '<w:tblBorders>' + ["top","left","bottom","right","insideH","insideV"].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/>`).join("") + '</w:tblBorders>';
    return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${b}</w:tblPr>` +
      `<w:tr><w:trPr><w:tblHeader/></w:trPr>${head.map(h => cell(h, true)).join("")}</w:tr>` +
      rows.map(r => `<w:tr>${r.map(v => cell(v, false)).join("")}</w:tr>`).join("") + `</w:tbl><w:p/>`;
  }
  // blocks: {h1}|{h2}|{p}|{bullets:[]}|{table:{head,rows}}
  async function docx(title, blocks, meta){
    let body = para(title, "Title");
    if(meta) body += para(meta, "Subtitle");
    for(const b of blocks){
      if(b.h1) body += para(b.h1, "Heading1");
      else if(b.h2) body += para(b.h2, "Heading2");
      else if(b.p != null) body += para(b.p);
      else if(b.bullets) body += b.bullets.filter(v => v != null && v !== "").map(v => para("• " + v, "ListParagraph")).join("");
      else if(b.table) body += table(b.table.head, b.table.rows);
    }
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1134" w:bottom="1418" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const st = (id, name, size, color, extra) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="${size > 24 ? 240 : 160}" w:after="80"/>${extra || ""}</w:pPr><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr></w:style>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="21"/><w:lang w:val="nl-NL"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${st("Title", "Title", 40, "0E3E96")}${st("Subtitle", "Subtitle", 20, "595959")}${st("Heading1", "heading 1", 28, "0E3E96", '<w:outlineLvl w:val="0"/>')}${st("Heading2", "heading 2", 23, "2468CE", '<w:outlineLvl w:val="1"/>')}
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360" w:hanging="220"/><w:spacing w:after="40"/></w:pPr></w:style>
</w:styles>`;
    return zip([
      { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>` },
      { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
      { name: "word/_rels/document.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: "word/document.xml", data: doc },
      { name: "word/styles.xml", data: styles }
    ]);
  }

  // ---------- Excel (.xlsx) ----------
  const col = i => { let s = ""; i++; while(i){ const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  // sheets: [{name, head:[], rows:[[]], widths:[], money:[kolomindexen]}]
  async function xlsx(sheets){
    const sheetXml = sh => {
      const all = [sh.head, ...sh.rows];
      const rowsXml = all.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
        const ref = col(ci) + (ri + 1);
        if(ri > 0 && typeof v === "number" && isFinite(v)) return `<c r="${ref}"${(sh.money || []).includes(ci) ? ' s="2"' : ""}><v>${v}</v></c>`;
        if(v == null || v === "") return "";
        const s = String(v), mark = MARK.test(s);
        return `<c r="${ref}" t="inlineStr"${ri === 0 ? ' s="1"' : mark ? ' s="3"' : ' s="4"'}><is><t xml:space="preserve">${x(s)}</t></is></c>`; }).join("")}</row>`).join("");
      const cols = (sh.widths || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${rowsXml}</sheetData>${all.length > 1 ? `<autoFilter ref="A1:${col(sh.head.length - 1)}${all.length}"/>` : ""}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
    };
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;€&quot; #,##0.00"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0E3E96"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
    const entries = [
      { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
      { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${x(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
      { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: "xl/styles.xml", data: styles },
      ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) }))
    ];
    const b = zip(entries);
    return new Blob([b], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  // ---------- het dossier opbouwen uit de AI-antwoorden ----------
  const secBlocks = secs => (secs || []).flatMap(s => [{ h1: s.kop }, ...(s.tekst ? [{ p: s.tekst }] : []), ...(s.punten && s.punten.length ? [{ bullets: s.punten }] : [])]);
  const list = (title, arr) => arr && arr.length ? [{ h2: title }, { bullets: arr }] : [];
  async function buildFiles(t, parts){
    const A = parts.analyse || {}, O = parts.ontwerp || {}, P = parts.aanpak || {}, PL = parts.planning || {}, C = parts.compliance || {}, E = parts.espd || {};
    const meta = `${t.title || ""}\n${t.buyer || ""}${t.country ? " · " + t.country : ""} · kenmerk ${t.pub}\nConcept van ${new Date().toLocaleDateString("nl-NL")} · BroadbandEU · te controleren en goed te keuren vóór indiening`;
    const out = [];
    const add = async (name, blob) => out.push({ name, blob });
    if(parts.analyse) await add("00_Go-no-go_analyse.docx", await docx("Go/no-go-analyse", [
      { h1: `Advies: ${String(A.goNoGo?.advies || "").toUpperCase()}` }, { bullets: A.goNoGo?.redenen || [] }, ...list("Ontbreekt nog", A.goNoGo?.ontbrekend),
      { h1: "Samenvatting" }, { p: A.samenvatting }, { table: { head: ["Onderdeel", "Waarde"], rows: [["Opdrachtgever", A.opdrachtgever], ["Scope", A.scope], ["Looptijd", A.looptijd], ["Sluiting", A.sluiting], ["Vragen stellen tot", A.vragenDeadline], ["Taal", A.taal]].map(r => r.map(v => v || "")) } },
      { h1: "Voorgestelde oplossing" }, { p: A.oplossing },
      { h1: "Gunningscriteria" }, { table: { head: ["Criterium", "Weging"], rows: (A.gunningscriteria || []).map(g => [g.criterium, g.weging]) } },
      { h1: "Eisen" }, { table: { head: ["Id", "Eis", "Type", "Bron"], rows: (A.eisen || []).map(e => [e.id, e.eis, e.type, e.bron]) } },
      ...list("Gevraagde documenten", A.gevraagdeDocumenten), ...list("Risico's", A.risicos), ...list("Vragen aan de opdrachtgever", A.vragenAanOpdrachtgever)
    ], meta));
    if(PL.offerteBrief) await add("01_Commerciele_offerte.docx", await docx(PL.offerteBrief.titel || "Commerciële offerte", [
      ...secBlocks(PL.offerteBrief.secties), { h1: "Prijzen" },
      { table: { head: ["Post", "Omschrijving", "Aantal", "Eenmalig", "Per maand"], rows: (PL.prijzen || []).map(p => [p.post, p.omschrijving, `${p.aantal ?? ""} ${p.eenheid || ""}`, p.eenmalig == null ? "[PRIJS INVULLEN]" : "€ " + Number(p.eenmalig).toLocaleString("nl-NL", { minimumFractionDigits: 2 }), p.maandelijks == null ? "[PRIJS INVULLEN]" : "€ " + Number(p.maandelijks).toLocaleString("nl-NL", { minimumFractionDigits: 2 })]) } },
      ...list("Aannames", PL.aannames), ...(PL.contractwaardeSchatting ? [{ h2: "Geschatte contractwaarde" }, { p: PL.contractwaardeSchatting }] : [])
    ], meta));
    if(O.secties) await add("02_Technisch_ontwerp.docx", await docx(O.titel || "Technisch ontwerp", secBlocks(O.secties), meta));
    if(P.planVanAanpak) await add("03_Plan_van_aanpak.docx", await docx(P.planVanAanpak.titel || "Plan van aanpak", secBlocks(P.planVanAanpak.secties), meta));
    if(PL.planning) await add("04_Implementatieplanning.xlsx", await xlsx([{ name: "Planning", head: ["Fase", "Activiteit", "Start (week)", "Duur (weken)", "Eind (week)", "Verantwoordelijke", "Mijlpaal"], widths: [18, 50, 12, 12, 12, 22, 30],
      rows: PL.planning.map(r => [r.fase, r.activiteit, Number(r.startWeek) || "", Number(r.duurWeken) || "", (Number(r.startWeek) || 0) + (Number(r.duurWeken) || 0) || "", r.verantwoordelijke, r.mijlpaal]) }]));
    if(P.sla) await add("05_SLA_en_support.docx", await docx(P.sla.titel || "SLA en support", secBlocks(P.sla.secties), meta));
    if(E.espd) await add("06_UEA_ESPD_concept.docx", await docx("Uniform Europees Aanbestedingsdocument (concept)", [
      { p: "Concept om over te nemen in het UEA/ESPD-formulier van de opdrachtgever. Gele markeringen moeten nog worden ingevuld of ondertekend." },
      { table: { head: ["Deel", "Vraag", "Antwoord"], rows: E.espd.map(e => [e.deel, e.vraag, e.antwoord]) } }], meta));
    if(C.referenties) await add("07_Referentieprojecten.docx", await docx("Referentieprojecten", C.referenties.length
      ? [{ table: { head: ["Klant", "Omschrijving", "Jaar", "Waarde", "Contact", "Bron"], rows: C.referenties.map(r => [r.klant, r.omschrijving, r.jaar, r.waarde, r.contact, r.bron]) } }]
      : [{ p: "[ONTBREEKT: referentieprojecten. Upload een overzicht met referenties in Beheer → Bedrijfsdossier.]" }], meta));
    if(C.matrix) await add("08_Compliance_matrix.xlsx", await xlsx([{ name: "Compliance", head: ["Id", "Eis", "Type", "Voldoet", "Toelichting", "Bewijs", "Ontbreekt"], widths: [8, 60, 12, 10, 50, 30, 30],
      rows: C.matrix.map(m => [m.id, m.eis, m.type, m.voldoet, m.toelichting, m.bewijs, m.ontbreekt ? (/^\[/.test(m.ontbreekt) ? m.ontbreekt : `[ONTBREEKT: ${m.ontbreekt}]`) : ""]) }]));
    if(PL.prijzen) await add("09_Prijzenblad.xlsx", await xlsx([{ name: "Prijzen", head: ["Post", "Omschrijving", "Eenheid", "Aantal", "Eenmalig (€)", "Per maand (€)", "Eenmalig totaal (€)", "Per maand totaal (€)", "Bron", "Opmerking"],
      widths: [22, 45, 10, 8, 14, 14, 16, 16, 24, 30], money: [4, 5, 6, 7],
      rows: PL.prijzen.map(p => { const n = Number(p.aantal) || 0, e1 = p.eenmalig == null ? null : Number(p.eenmalig), m1 = p.maandelijks == null ? null : Number(p.maandelijks);
        return [p.post, p.omschrijving, p.eenheid, n || "", e1 ?? "[PRIJS INVULLEN]", m1 ?? "[PRIJS INVULLEN]", e1 == null ? "" : Math.round(e1 * n * 100) / 100, m1 == null ? "" : Math.round(m1 * n * 100) / 100, p.bron, p.opmerking]; }) }]));
    if(E.checklist) await add("10_Indieningschecklist.docx", await docx("Indieningschecklist en eindcontrole", [
      { table: { head: ["Item", "Status", "Toelichting"], rows: E.checklist.map(c => [c.item, c.status === "ontbreekt" ? "[ONTBREEKT]" : c.status === "handtekening" ? "[HANDTEKENING NODIG]" : c.status, c.toelichting]) } },
      { h1: "Eindcontrole" }, ...list("Ontbrekende bewijsstukken", E.eindcontrole?.ontbrekendeBewijsstukken), ...list("Onbeantwoorde eisen", E.eindcontrole?.onbeantwoordeEisen),
      ...list("Afwijkingen", E.eindcontrole?.afwijkingen), ...(E.eindcontrole?.advies ? [{ h2: "Advies" }, { p: E.eindcontrole.advies }] : [])
    ], meta));
    return out;
  }
  async function zipFiles(files){ return zip(await Promise.all(files.map(async f => ({ name: f.name, data: await blobBytes(f.blob) })))); }

  root.Dossier = { readFiles, buildFiles, zipFiles, docx, xlsx, unzip, fileText };
})(window);
