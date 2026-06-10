#!/usr/bin/env node
/* Submit site URLs to IndexNow (Bing, Yandex, Seznam, Naver…).
 *
 * Usage:
 *   node scripts/indexnow.js                     # submit every URL in sitemap.xml
 *   node scripts/indexnow.js /tps-tvq-en-ligne/  # submit specific path(s)/URL(s)
 *
 * URLs are read from sitemap.xml (run `node build.js` first) so the list never
 * drifts out of sync. The key file 74d5a7f9a4cb4affadf38a391aa7dcff.txt must be
 * reachable at the site root (https://calcultaxesquebec.ca/<key>.txt) for
 * IndexNow to verify ownership. Re-run after each deploy to ping Bing instantly.
 */
"use strict";
const https = require("https");
const fs = require("fs");
const path = require("path");

const HOST = "calcultaxesquebec.ca";
const KEY = "74d5a7f9a4cb4affadf38a391aa7dcff";
const SITE = "https://" + HOST;

// Derive the URL list straight from sitemap.xml so it never drifts out of sync
// as pages are added/removed. Accepts explicit URLs as CLI args to submit a subset.
function urlsFromSitemap() {
  const xml = fs.readFileSync(path.join(__dirname, "..", "sitemap.xml"), "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const cliUrls = process.argv.slice(2);
const urlList = cliUrls.length
  ? cliUrls.map((u) => (u.startsWith("http") ? u : SITE + (u.startsWith("/") ? u : "/" + u)))
  : [...urlsFromSitemap(), `${SITE}/sitemap.xml`];

const payload = JSON.stringify({
  host: HOST,
  key: KEY,
  keyLocation: `${SITE}/${KEY}.txt`,
  urlList
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
  console.log(`Submitting ${urlList.length} URLs for ${HOST}…`);
  const results = await Promise.all(ENDPOINTS.map(submit));
  process.exit(results.some(Boolean) ? 0 : 1);
})();
