#!/usr/bin/env node
/* Submit all site URLs to IndexNow (Bing, Yandex, Seznam, Naver…).
 *
 * Usage:  node scripts/indexnow.js
 *
 * The key file 74d5a7f9a4cb4affadf38a391aa7dcff.txt must be reachable at the
 * site root (https://calcultaxesquebec.ca/<key>.txt) for IndexNow to verify
 * ownership. Re-run this whenever content changes to ping search engines.
 */
"use strict";
const https = require("https");

const HOST = "calcultaxesquebec.ca";
const KEY = "74d5a7f9a4cb4affadf38a391aa7dcff";
const SITE = "https://" + HOST;

const PATHS = [
  "/",
  "/calcul-tps-tvq/",
  "/calcul-taxe-inverse-quebec/",
  "/quebec-tax-calculator/",
  "/taux-tps-tvq-quebec/",
  "/blog/",
  "/comment-calculer-tps-tvq-quebec/",
  "/comment-retirer-taxes-prix-quebec/",
  "/taxe-quebec-2026/",
  "/difference-tps-tvq/",
  "/prix-avant-taxes-quebec/",
  "/sitemap.xml"
];

const payload = JSON.stringify({
  host: HOST,
  key: KEY,
  keyLocation: `${SITE}/${KEY}.txt`,
  urlList: PATHS.map((p) => SITE + p)
});

// Submit to Bing directly plus the shared IndexNow hub (which also notifies
// Yandex, Seznam, Naver…). Submitting one endpoint normally fans out to all,
// but Bing is pinged explicitly as requested.
const ENDPOINTS = [
  { host: "www.bing.com", path: "/indexnow", label: "Bing" },
  { host: "api.indexnow.org", path: "/indexnow", label: "IndexNow hub" }
];

function submit(ep) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: ep.host,
        path: ep.path,
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          console.log(`${ep.label} (${ep.host}) → HTTP ${res.statusCode}${body ? " " + body.trim() : ""}`);
          // 200 / 202 = accepted. 422 = key/URL mismatch. 403 = key not verified.
          resolve(ok);
        });
      }
    );
    req.on("error", (e) => {
      console.error(`${ep.label} request failed:`, e.message);
      resolve(false);
    });
    req.write(payload);
    req.end();
  });
}

(async () => {
  console.log(`Submitting ${PATHS.length} URLs for ${HOST}…`);
  const results = await Promise.all(ENDPOINTS.map(submit));
  process.exit(results.some(Boolean) ? 0 : 1);
})();
