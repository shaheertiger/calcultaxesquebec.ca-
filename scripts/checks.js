#!/usr/bin/env node
/* Post-build checks (Nov 28 2026 fix). Run by build.js after writing the site; any failure exits 1.
 * Also runnable alone: node scripts/checks.js */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = "https://www.calcultaxesquebec.ca";
const HOME_TITLE = "Calcul Taxes Québec 2026 : TPS 5 % + TVQ 9,975 % = 14,975 %"; // must stay byte-for-byte
const MERGED = ["/calculateur-de-taxes-quebec/", "/tps-tvq-en-ligne/"];
const REVERSE_FR = "/calcul-taxe-inverse-quebec/";
const REVERSE_EN = "/reverse-tax-calculator-quebec/";
const ANCHOR_FR = "Calcul taxes inversé Québec : montant avant taxes = total ÷ 1,14975";
const ANCHOR_EN = "Reverse tax calculator Quebec: remove GST + QST (÷ 1.14975)";

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const fileFor = (u) => (u === "/" ? "index.html" : u.slice(1) + "index.html");
const sitemap = read("sitemap.xml");
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const paths = pages.map((u) => u.replace(SITE, ""));

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

/* 1. reverse page: calculator + solved default example in the static HTML */
{
  const h = read(fileFor(REVERSE_FR));
  const card = h.slice(h.indexOf("data-calc"), h.indexOf('id="round-note"'));
  check("reverse page: calculator in static HTML", h.includes('data-calc data-default-mode="remove"'));
  check("reverse page: default 114,98 $ in the input", /data-input[^>]*value="114,98"/.test(h));
  check("reverse page: solved example (100,00 / 5,00 / 9,98) in static HTML",
    card.includes('data-out="big">100,00&nbsp;$') && card.includes('data-out="tps">5,00&nbsp;$') && card.includes('data-out="tvq">9,98&nbsp;$'));
  check("reverse page: calculator sits before the first H2 (above the fold)", h.indexOf("data-calc") < h.indexOf("<h2"));
  check("reverse page: rounding rule stated", h.includes("Arrondi au cent près"));
  check("reverse page: WebApplication + FAQPage + BreadcrumbList schema",
    ["\"WebApplication\"", "\"FAQPage\"", "\"BreadcrumbList\""].every((t) => h.includes(t)));
  check("reverse page: in-content link to the English twin", h.includes(`href="${REVERSE_EN}" hreflang="en-CA"`));
  const en = read(fileFor(REVERSE_EN));
  check("EN reverse page: in-content link to the French twin", en.includes(`href="${REVERSE_FR}" hreflang="fr-CA"`));
  for (const [file, me, other] of [[h, REVERSE_FR, REVERSE_EN], [en, REVERSE_EN, REVERSE_FR]]) {
    check(`hreflang fr-CA/en-CA pair on ${me}`,
      file.includes(`hreflang="fr-CA" href="${SITE}${REVERSE_FR}"`) && file.includes(`hreflang="en-CA" href="${SITE}${REVERSE_EN}"`), other);
  }
}

/* 2. merged pages: single 301 to the homepage, not in the sitemap, no internal links */
{
  const redirects = JSON.parse(read("vercel.json")).redirects;
  const sources = new Set(redirects.map((r) => r.source));
  for (const u of MERGED) {
    for (const src of [u, u.slice(0, -1)]) {
      const r = redirects.find((x) => x.source === src);
      check(`${src} -> 301 to /`, r && r.statusCode === 301 && r.destination === "/" && !r.permanent);
    }
    check(`${u} not in sitemap`, !paths.includes(u));
    check(`${u} has no page folder`, !fs.existsSync(path.join(ROOT, fileFor(u))));
  }
  check("no redirect chains (no destination is itself a redirect source)", redirects.every((r) => !sources.has(r.destination)));
}

/* 3. one host + links: every page */
{
  const badHost = [], badLink = [], missingAnchor = [], linksToMerged = [];
  for (const p of paths) {
    const h = read(fileFor(p));
    const lang = /<html lang="en/.test(h) ? "en" : "fr";
    // canonical, hreflang, og:url, JSON-LD and any absolute reference to the site must be https://www.
    for (const m of h.matchAll(/(?:https?:)?\/\/(?:www\.)?calcultaxesquebec\.ca[^"'\s<]*/g)) {
      if (!m[0].startsWith(SITE + "/")) badHost.push(`${p}: ${m[0]}`);
    }
    if (!h.includes(`<link rel="canonical" href="${SITE}${p}">`)) badHost.push(`${p}: canonical`);
    for (const m of h.matchAll(/href="([^"]*)"/g)) {
      const href = m[1];
      if (/^http:\/\//.test(href)) badLink.push(`${p}: ${href}`);
      if (href.startsWith("/") && !href.startsWith("//")) {
        const clean = href.split("#")[0];
        if (clean && !/\.[a-z0-9]+$/i.test(clean) && !clean.endsWith("/")) badLink.push(`${p}: ${href} (no trailing slash)`);
        if (MERGED.includes(clean) || MERGED.includes(clean + "/")) linksToMerged.push(`${p}: ${href}`);
      }
    }
    const related = h.slice(h.indexOf('id="links-title"'));
    if (h.includes('id="links-title"')) {
      if (lang === "fr" && p !== REVERSE_FR && !related.includes(`href="${REVERSE_FR}">${ANCHOR_FR}`)) missingAnchor.push(p);
      if (lang === "en" && p !== REVERSE_EN && !related.includes(`href="${REVERSE_EN}">${ANCHOR_EN}`)) missingAnchor.push(p);
    } else missingAnchor.push(p + " (no related block)");
  }
  for (const m of sitemap.matchAll(/(?:href|<loc>)="?([^"<]+)/g)) if (!m[1].startsWith(SITE + "/")) badHost.push(`sitemap: ${m[1]}`);
  check("every canonical / hreflang / sitemap / JSON-LD URL uses https://www.", !badHost.length, badHost.slice(0, 5).join(", "));
  check("no http:// links, internal links keep their trailing slash", !badLink.length, badLink.slice(0, 5).join(", "));
  check("no internal link to the two 301'd URLs", !linksToMerged.length, linksToMerged.slice(0, 5).join(", "));
  check("related block has the reverse-tax anchor on every FR / EN page", !missingAnchor.length, missingAnchor.join(", "));
}

/* 4. homepage */
{
  const h = read("index.html");
  const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1];
  check("homepage title byte-for-byte unchanged", Buffer.from(title || "").equals(Buffer.from(HOME_TITLE)), title);
  check("homepage H1 unchanged", h.includes("<h1>Calcul Taxes Québec 2026</h1>"));
  check("homepage links in content to the reverse page with the query anchor",
    h.includes(`<a href="${REVERSE_FR}">calcul taxes inversé : montant avant taxes</a>`));
  const desc = (h.match(/name="description" content="([^"]*)"/) || [])[1] || "";
  check("homepage meta: 'calcul des taxes 2026', 140–155 chars", /calcul des taxes 2026/i.test(desc) && desc.length >= 140 && desc.length <= 155, `${desc.length} chars`);
}

/* 5. every page ≤ 2 clicks from the homepage */
{
  const depth = { "/": 0 }, queue = ["/"];
  while (queue.length) {
    const u = queue.shift();
    const h = read(fileFor(u));
    for (const m of h.matchAll(/href="(\/[^"#]*\/)"/g)) if (!(m[1] in depth) && paths.includes(m[1])) { depth[m[1]] = depth[u] + 1; queue.push(m[1]); }
  }
  const deep = paths.filter((p) => !(p in depth) || depth[p] > 2);
  check("every sitemap page ≤ 2 clicks from home", !deep.length, deep.join(", "));
}

/* 6. reverse-tax unit test (5 cases, build math + calculator.js) */
for (const r of require("./reverse-tax.test.js")) check("reverse-tax " + r.line, r.ok);

module.exports = results;
if (require.main === module || process.env.CHECKS_FROM_BUILD) {
  for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"}  ${r.name}${!r.ok && r.detail ? "  -> " + r.detail : ""}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} checks passed`);
  if (failed) process.exitCode = 1;
}
