(function () {
"use strict";
const $ = id => document.getElementById(id);
let email = "";

function msg(text, isError){
  const m = $("authMsg");
  m.textContent = text || ""; m.hidden = !text; m.classList.toggle("err", !!isError);
}
function busy(btn, on, label){
  btn.disabled = on;
  if(on){ btn.dataset.label = btn.textContent; btn.textContent = label; }
  else if(btn.dataset.label){ btn.textContent = btn.dataset.label; }
}
async function api(path, opts){
  const r = await fetch(path, {credentials:"same-origin", headers:{"Content-Type":"application/json"}, ...opts});
  let d = {}; try { d = await r.json(); } catch(e) {}
  if(!r.ok) throw new Error(d.error || "Er ging iets mis. Probeer het opnieuw.");
  return d;
}
function showCode(addr, recent){
  email = addr;
  $("stepEmail").hidden = true; $("stepCode").hidden = false;
  $("codeEmail").textContent = addr;
  $("authCode").value = ""; $("authCode").focus();
  msg(recent ? "Er is net al een code verstuurd. Kijk in je inbox (en je spammap)." : "");
}
function showEmail(){
  $("stepCode").hidden = true; $("stepEmail").hidden = false; msg("");
  $("authEmail").focus();
}
// Openbare kaart: meteen tonen; inloggen alleen voor beheer via een klein linkje.
function openMode(){
  showApp("", false);
  $("btnLogout").hidden = true;
  $("btnLogin").hidden = false;
  $("authNote").textContent = "Inloggen is alleen nodig voor beheer. Je krijgt een code per e-mail.";
  $("authBack").hidden = false;
}
function showApp(who, admin){
  $("btnLogin").hidden = true; $("btnLogout").hidden = false;
  window.isAdmin = !!admin;
  document.body.classList.toggle("admin", !!admin);
  $("btnAdmin").hidden = !admin;
  $("authView").hidden = true;
  $("appView").hidden = false;
  $("whoami").textContent = who || "";
  window.rerenderTenders && window.rerenderTenders();
  window.startTenderApp();
}

$("stepEmail").addEventListener("submit", async e => {
  e.preventDefault();
  const addr = $("authEmail").value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)){ msg("Vul een geldig e-mailadres in.", true); return; }
  const btn = $("btnEmail"); busy(btn, true, "Even geduld…"); msg("");
  try {
    const d = await api("/api/login", {method:"POST", body:JSON.stringify({email:addr})});
    if(d.status === "pay"){ msg("Je gaat naar de beveiligde betaalpagina van Stripe…"); location.href = d.url; return; }
    showCode(d.email, d.recent);
  } catch(err) { msg(err.message, true); }
  busy(btn, false);
});

$("stepCode").addEventListener("submit", async e => {
  e.preventDefault();
  const code = $("authCode").value.replace(/\D/g, "");
  if(code.length !== 6){ msg("De code bestaat uit 6 cijfers.", true); return; }
  const btn = $("btnCode"); busy(btn, true, "Controleren…"); msg("");
  try {
    const d = await api("/api/verify", {method:"POST", body:JSON.stringify({email, code})});
    let admin = false; try { admin = (await api("/api/me")).admin; } catch(e) {}
    showApp(d.email, admin);
  } catch(err) { msg(err.message, true); }
  busy(btn, false);
});
$("authCode").addEventListener("input", e => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
  if(e.target.value.length === 6) $("stepCode").requestSubmit();
});

$("btnResend").addEventListener("click", async () => {
  msg("");
  try {
    const d = await api("/api/login", {method:"POST", body:JSON.stringify({email})});
    if(d.status === "pay"){ location.href = d.url; return; }
    msg(d.recent ? "Wacht even: je kunt over een minuut een nieuwe code aanvragen." : "Er is een nieuwe code verstuurd.", d.recent);
  } catch(err) { msg(err.message, true); }
});
$("btnOther").addEventListener("click", showEmail);

$("btnLogin").addEventListener("click", () => { $("appView").hidden = true; $("authView").hidden = false; showEmail(); });
$("authBack").addEventListener("click", () => { $("authView").hidden = true; $("appView").hidden = false; });
$("btnLogout").addEventListener("click", async () => {
  try { await api("/api/logout", {method:"POST"}); } catch(e) {}
  location.href = "/";
});

// ---------- Opstarten ----------
(async () => {
  const params = new URLSearchParams(location.search);
  const paid = params.get("betaald");
  const cancelled = params.get("geannuleerd");
  if(paid || cancelled) history.replaceState(null, "", "/");

  if(paid){
    $("authView").hidden = false;
    msg("Betaling controleren…");
    try {
      const d = await api("/api/confirm?session_id=" + encodeURIComponent(paid));
      showCode(d.email, d.recent);
      msg("Bedankt voor je betaling! Je inlogcode is onderweg naar je e-mail.");
    } catch(err) { showEmail(); msg(err.message, true); }
    return;
  }

  let me = {requireLogin:false};
  try {
    const r = await fetch("/api/me", {credentials:"same-origin", cache:"no-store"});
    me = await r.json().catch(() => me);
    if(me.loggedIn){ showApp(me.email, me.admin); return; }
  } catch(e) {}
  if(!me.requireLogin){ openMode(); return; }
  $("authView").hidden = false;
  if(cancelled) msg("De betaling is geannuleerd. Je kunt het opnieuw proberen wanneer je wilt.", true);
  $("authEmail").focus();
})();
})();
