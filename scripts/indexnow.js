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
  "/sitemap.xml"
];

const payload = JSON.stringify({
  host: HOST,
  key: KEY,
  keyLocation: `${SITE}/${KEY}.txt`,
  urlList: PATHS.map((p) => SITE + p)
});

const req = https.request(
  {
    host: "api.indexnow.org",
    path: "/indexnow",
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
      console.log("IndexNow HTTP", res.statusCode);
      if (body) console.log(body);
      // 200 / 202 = accepted. 422 = key/URL mismatch. 403 = key not verified.
      process.exit(res.statusCode >= 200 && res.statusCode < 300 ? 0 : 1);
    });
  }
);
req.on("error", (e) => {
  console.error("IndexNow request failed:", e.message);
  process.exit(1);
});
req.write(payload);
req.end();
