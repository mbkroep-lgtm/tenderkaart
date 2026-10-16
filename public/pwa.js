(function () {
"use strict";
const $ = id => document.getElementById(id);
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
if (standalone) return;   // draait al als app
const btn = $("btnInstall"), tip = $("installTip");
const ua = navigator.userAgent;
const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
let deferred = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; btn.hidden = false; });
if (ios) btn.hidden = false;
btn.addEventListener("click", async () => {
  if (deferred) { deferred.prompt(); const r = await deferred.userChoice.catch(() => null); deferred = null; if (r && r.outcome === "accepted") btn.hidden = true; return; }
  $("installText").textContent = ios
    ? "Tik in Safari onderaan op het deel-icoon (vierkant met pijl omhoog) en kies \"Zet op beginscherm\"."
    : "Open het menu van je browser (⋮) en kies \"App installeren\" of \"Toevoegen aan startscherm\".";
  tip.hidden = false;
});
$("installClose").addEventListener("click", () => tip.hidden = true);
addEventListener("appinstalled", () => { btn.hidden = true; tip.hidden = true; });
})();
