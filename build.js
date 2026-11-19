#!/usr/bin/env node
/* Static site generator for calcultaxesquebec.ca
 * Outputs plain HTML (no runtime framework). Run: node build.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

/* Vercel's primary domain is www (the apex 308s to it), so every canonical, hreflang and sitemap URL
 * must use www. Pointing canonicals at the apex sent Google to a redirect on every page (Nov 2026 fix). */
const SITE = "https://www.calcultaxesquebec.ca";
const UPDATED_YEAR = "2026";
const BUILD_DATE = "2026-11-17"; // default lastmod; set `modified` on a page (or `dateModified` on a post) when only it changes
const DATE_PUBLISHED = "2026-01-01";

/* Bing Webmaster Tools site verification (content of the msvalidate.01 meta).
 * Paste the code from Bing Webmaster Tools > Settings > Verify ownership.
 * Leave empty to omit the tag (Bing also auto-verifies via the IndexNow key file). */
const BING_VERIFICATION = "";

/* IndexNow key — the key file lives at /<key>.txt (Bing/IndexNow instant indexing). */
const INDEXNOW_KEY = "74d5a7f9a4cb4affadf38a391aa7dcff";

/* ----------------------------- shared partials ---------------------------- */

const LOGO_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#fff" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';

const NAV = {
  fr: [
    { href: "/", label: "Accueil" },
    { href: "/calcul-taxe-inverse-quebec/", label: "Taxe inverse" },
    { href: "/calcul-salaire-net-quebec/", label: "Salaire net" },
    { href: "/calcul-taxe-de-bienvenue-quebec/", label: "Taxe de bienvenue" },
    { href: "/taux-tps-tvq-quebec/", label: "Taux TPS TVQ" },
    { href: "/blog/", label: "Blogue" },
    { href: "/quebec-tax-calculator/", label: "English" }
  ],
  en: [
    { href: "/quebec-tax-calculator/", label: "Sales tax" },
    { href: "/reverse-tax-calculator-quebec/", label: "Reverse tax" },
    { href: "/quebec-income-tax-calculator/", label: "Income tax" },
    { href: "/quebec-welcome-tax-calculator/", label: "Welcome tax" },
    { href: "/", label: "Français" }
  ]
};

function header(lang, currentPath) {
  const fr = lang !== "en";
  const homeHref = fr ? "/" : "/quebec-tax-calculator/";
  const tagline = fr ? "Calculatrice TPS/TVQ rapide" : "Fast GST/QST calculator";
  // FR/EN toggle: FR -> "/", EN -> "/quebec-tax-calculator/"
  const frActive = lang !== "en";
  const skip = fr ? "Aller au contenu" : "Skip to content";
  return `<a class="skip-link" href="#contenu">${skip}</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${homeHref}" aria-label="Calcul Taxes Québec">
      <span class="logo">${LOGO_SVG}</span>
      <span>
        <span class="name">Calcul Taxes Québec</span>
        <span class="tagline">${tagline}</span>
      </span>
    </a>
    <nav class="lang-toggle" aria-label="${fr ? "Langue" : "Language"}">
      <a href="/"${frActive ? ' aria-current="true"' : ""} hreflang="fr" lang="fr">FR</a>
      <a href="/quebec-tax-calculator/"${!frActive ? ' aria-current="true"' : ""} hreflang="en" lang="en">EN</a>
    </nav>
  </div>
</header>`;
}

function footer(lang) {
  const fr = lang !== "en";
  const items = NAV[fr ? "fr" : "en"]
    .map((n) => `<a href="${n.href}">${n.label}</a>`)
    .join("\n        ");
  const legal = fr
    ? `Calcul Taxes Québec — calculatrice TPS/TVQ informative. Les résultats sont arrondis au cent près et fournis à titre indicatif. Dernière mise à jour&nbsp;: ${UPDATED_YEAR}.`
    : `Calcul Taxes Québec — informational GST/QST calculator. Results are rounded to the nearest cent and provided for guidance only. Last updated: ${UPDATED_YEAR}.`;
  return `<footer class="site-footer">
  <div class="wrap">
    <nav aria-label="${fr ? "Liens du site" : "Site links"}">
        ${items}
    </nav>
    <p class="legal">${legal}</p>
  </div>
</footer>`;
}

function calcCard(lang, mode) {
  const fr = lang !== "en";
  const m = mode === "remove" ? "remove" : "add";
  const L = fr
    ? {
        modeGroup: "Mode de calcul",
        add: "Ajouter les taxes",
        remove: "Retirer les taxes",
        inLabel: m === "remove" ? "Montant avec taxes incluses" : "Montant avant taxes",
        quick: "Montants rapides",
        row1: m === "remove" ? "Total avec taxes incluses" : "Sous-total",
        big: m === "remove" ? "Montant avant taxes" : "Total avec taxes",
        copy: "Copier le résultat",
        clear: "Effacer",
        note: "Les montants sont arrondis au cent près.",
        placeholder: "0,00"
      }
    : {
        modeGroup: "Calculation mode",
        add: "Add tax",
        remove: "Remove tax",
        inLabel: m === "remove" ? "Total with tax included" : "Amount before tax",
        quick: "Quick amounts",
        row1: m === "remove" ? "Total with tax" : "Subtotal",
        big: m === "remove" ? "Amount before tax" : "Total with tax",
        copy: "Copy result",
        clear: "Clear",
        note: "Amounts are rounded to the nearest cent.",
        placeholder: "0.00"
      };
  const cur = "$";
  const amounts = [5, 10, 20, 50, 100, 250, 500, 1000];
  const chipFmt = (n) =>
    fr
      ? `${n.toLocaleString("fr-CA")} $`.replace(/ /g, " ")
      : `$${n.toLocaleString("en-CA")}`;
  const chips = amounts
    .map((n) => `<button type="button" data-chip="${n}">${chipFmt(n)}</button>`)
    .join("\n        ");
  return `<div class="card calc" data-calc data-default-mode="${m}">
    <div class="mode-switch" role="group" aria-label="${L.modeGroup}">
      <button type="button" data-mode="add" aria-pressed="${m === "add"}">${L.add}</button>
      <button type="button" data-mode="remove" aria-pressed="${m === "remove"}">${L.remove}</button>
    </div>
    <div class="field">
      <label for="amount" data-label="input">${L.inLabel}</label>
      <div class="input-money">
        <input id="amount" data-input type="text" inputmode="decimal" autocomplete="off"
               enterkeyhint="done" placeholder="${L.placeholder}" aria-describedby="round-note">
        <span class="cur" aria-hidden="true">${cur}</span>
      </div>
      <div class="chips" role="group" aria-label="${L.quick}">
        ${chips}
      </div>
    </div>
    <div class="result" aria-live="polite">
      <div class="breakdown">
        <div class="row"><span class="k" data-label="row1">${L.row1}</span><span class="v" data-out="row1">${fmtZero(lang)}</span></div>
        <div class="row"><span class="k">TPS&nbsp;5&nbsp;%${fr ? "" : " · GST"}</span><span class="v" data-out="tps">${fmtZero(lang)}</span></div>
        <div class="row"><span class="k">TVQ&nbsp;9,975&nbsp;%${fr ? "" : " · QST"}</span><span class="v" data-out="tvq">${fmtZero(lang)}</span></div>
      </div>
      <div class="total-box">
        <span class="lbl" data-label="big">${L.big}</span>
        <span class="amt" data-out="big">${fmtZero(lang)}</span>
      </div>
      <div class="actions">
        <button type="button" class="btn-copy" data-copy>${L.copy}</button>
        <button type="button" class="btn-clear" data-clear>${L.clear}</button>
      </div>
      <p class="note" id="round-note">${L.note}</p>
    </div>
  </div>`;
}

function fmtZero(lang) {
  return lang === "en" ? "$0.00" : "0,00&nbsp;$";
}

function salaryCard(lang, opts = {}) {
  const fr = lang !== "en";
  const freq = opts.freq || "year";
  const sel = (v) => (v === freq ? " selected" : "");
  const z = fmtZero(lang);
  const L = fr
    ? {
        label: "Salaire brut", placeholder: "0,00", per: "Période de paie",
        year: "Par année", month: "Par mois", biweek: "Aux 2 semaines", week: "Par semaine", hour: "Par heure",
        hours: "Heures / semaine", net: "Salaire net", gross: "Salaire brut", fed: "Impôt fédéral",
        qc: "Impôt du Québec", qpp: "RRQ (Régime de rentes)", ei: "Assurance-emploi", qpip: "RQAP",
        ded: "Retenues totales", rate: "Taux d'imposition effectif", copy: "Copier le résultat", clear: "Effacer",
        note: "Estimation pour un particulier salarié au Québec (crédits de base, taux 2026). À titre indicatif."
      }
    : {
        label: "Gross pay", placeholder: "0.00", per: "Pay period",
        year: "Per year", month: "Per month", biweek: "Every 2 weeks", week: "Per week", hour: "Per hour",
        hours: "Hours / week", net: "Net pay", gross: "Gross pay", fed: "Federal tax",
        qc: "Quebec tax", qpp: "QPP (pension plan)", ei: "Employment Insurance", qpip: "QPIP",
        ded: "Total deductions", rate: "Effective tax rate", copy: "Copy result", clear: "Clear",
        note: "Estimate for a single salaried Quebec resident (basic credits, 2026 rates). For guidance only."
      };
  return `<div class="card calc salary" data-salary${opts.main === "biweek" ? ' data-sal-main="biweek"' : ""}>
    <div class="field">
      <label for="salary">${L.label}</label>
      <div class="input-money">
        <input id="salary" data-sal-input type="text" inputmode="decimal" autocomplete="off"
               enterkeyhint="done" placeholder="${L.placeholder}">
        <span class="cur" aria-hidden="true">$</span>
      </div>
      <div class="freq">
        <select data-sal-freq aria-label="${L.per}">
          <option value="year"${sel("year")}>${L.year}</option>
          <option value="month"${sel("month")}>${L.month}</option>
          <option value="biweek"${sel("biweek")}>${L.biweek}</option>
          <option value="week"${sel("week")}>${L.week}</option>
          <option value="hour"${sel("hour")}>${L.hour}</option>
        </select>
        <label class="hours" data-sal-hourswrap hidden>${L.hours}
          <input data-sal-hours type="text" inputmode="decimal" autocomplete="off" value="40">
        </label>
      </div>
    </div>
    <div class="result" aria-live="polite">
      <div class="total-box">
        <span class="lbl">${opts.main === "biweek" ? (fr ? "Paie nette aux 2 semaines" : "Net pay every 2 weeks") : L.net}</span>
        <span class="amt" data-sal-out="net">${z}</span>
        <span class="sub" data-sal-out="netperiod"></span>
      </div>
      <div class="breakdown">
        <div class="row"><span class="k">${L.gross}</span><span class="v" data-sal-out="gross">${z}</span></div>
        <div class="row"><span class="k">${L.fed}</span><span class="v" data-sal-out="fed">${z}</span></div>
        <div class="row"><span class="k">${L.qc}</span><span class="v" data-sal-out="qc">${z}</span></div>
        <div class="row"><span class="k">${L.qpp}</span><span class="v" data-sal-out="qpp">${z}</span></div>
        <div class="row"><span class="k">${L.ei}</span><span class="v" data-sal-out="ei">${z}</span></div>
        <div class="row"><span class="k">${L.qpip}</span><span class="v" data-sal-out="qpip">${z}</span></div>
        <div class="row total"><span class="k">${L.ded}</span><span class="v" data-sal-out="deductions">${z}</span></div>
      </div>
      <div class="rate-row"><span>${L.rate}</span><b data-sal-out="rate">0&nbsp;%</b></div>
      <div class="actions">
        <button type="button" class="btn-copy" data-sal-copy>${L.copy}</button>
        <button type="button" class="btn-clear" data-sal-clear>${L.clear}</button>
      </div>
      <p class="note">${L.note}</p>
    </div>
  </div>`;
}

function breadcrumbs(lang, items) {
  // items: [{name, href}] ; last has no link rendered as current
  const lis = items
    .map((it, i) => {
      const last = i === items.length - 1;
      return `<li>${last ? `<span aria-current="page">${it.name}</span>` : `<a href="${it.href}">${it.name}</a>`}</li>`;
    })
    .join("");
  return `<nav class="crumbs" aria-label="${lang === "en" ? "Breadcrumb" : "Fil d'Ariane"}"><ol>${lis}</ol></nav>`;
}

function faqSection(lang, faqs) {
  if (!faqs || !faqs.length) return "";
  const title = lang === "en" ? "Frequently asked questions" : "Questions fréquentes";
  const blocks = faqs
    .map(
      (f) => `      <details>
        <summary>${f.q}</summary>
        <p>${f.a}</p>
      </details>`
    )
    .join("\n");
  return `  <section class="content faq" aria-labelledby="faq-title">
    <h2 id="faq-title">${title}</h2>
${blocks}
  </section>`;
}

function internalLinks(lang, currentPath) {
  const fr = lang !== "en";
  const all = (fr ? [
    { href: "/", label: "Calcul taxes Québec", sub: "Ajouter la TPS et la TVQ" },
    { href: "/calcul-taxe-inverse-quebec/", label: "Calcul taxe inverse Québec", sub: "Retirer les taxes d'un prix" },
    { href: "/calcul-salaire-net-quebec/", label: "Calcul salaire net Québec", sub: "Salaire brut en net (impôts, RRQ…)" },
    { href: "/calcul-taxe-de-bienvenue-quebec/", label: "Calcul taxe de bienvenue", sub: "Droits de mutation 2026, Montréal et Québec" },
    { href: "/calcul-paie-net-quebec/", label: "Calcul paie net Québec", sub: "Paie nette aux 2 semaines ou par heure" },
    { href: "/calcul-impot-quebec/", label: "Calcul impôt Québec", sub: "Impôt fédéral et provincial 2026" },
    { href: "/tranches-imposition-quebec/", label: "Tranches d'imposition 2026", sub: "Taux marginal Québec + fédéral" },
    { href: "/taux-tps-tvq-quebec/", label: "Taux TPS TVQ Québec", sub: "TPS 5 %, TVQ 9,975 %" },
    { href: "/calcul-taxes-canada/", label: "Calcul taxes Canada", sub: "TPS, TVH, TVP par province" },
    { href: "/calcul-taxes-ontario/", label: "Calcul taxes Ontario", sub: "TVH 13 %" },
    { href: "/quebec-tax-calculator/", label: "Quebec Tax Calculator", sub: "Version anglaise" }
  ] : [
    { href: "/quebec-tax-calculator/", label: "Quebec Sales Tax Calculator", sub: "Add GST and QST" },
    { href: "/reverse-tax-calculator-quebec/", label: "Reverse Tax Calculator Quebec", sub: "Remove tax from a price" },
    { href: "/quebec-income-tax-calculator/", label: "Quebec Income Tax Calculator", sub: "Salary after tax, 2026" },
    { href: "/quebec-paycheck-calculator/", label: "Quebec Paycheck Calculator", sub: "Take-home pay every 2 weeks" },
    { href: "/quebec-tax-brackets/", label: "Quebec Tax Brackets 2026", sub: "Combined marginal rates" },
    { href: "/what-is-the-tax-in-quebec/", label: "What is the tax in Quebec?", sub: "Plain-English guide" },
    { href: "/quebec-tax-rate/", label: "Quebec Tax Rate", sub: "14.975% and other provinces" },
    { href: "/canada-sales-tax-calculator/", label: "Canada Sales Tax Calculator", sub: "GST, HST, PST by province" },
    { href: "/ontario-sales-tax-calculator/", label: "Ontario Sales Tax Calculator", sub: "HST 13%" },
    { href: "/quebec-welcome-tax-calculator/", label: "Quebec Welcome Tax Calculator", sub: "Land transfer tax, 2026 brackets" },
    { href: "/", label: "Calcul taxes Québec", sub: "Version française" }
  ]).map((l) => ({ ...l, subFr: l.sub, subEn: l.sub }))
  .filter((l) => l.href !== currentPath);
  const title = fr ? "Autres calculatrices et ressources" : "Other calculators and resources";
  const links = all
    .map(
      (l) =>
        `      <a href="${l.href}">${l.label}<span>${fr ? l.subFr : l.subEn}</span></a>`
    )
    .join("\n");
  return `  <section class="content" aria-labelledby="links-title">
    <h2 id="links-title">${title}</h2>
    <div class="links-grid">
${links}
    </div>
  </section>`;
}

/* ------------------------------- schema (JSON-LD) ------------------------------- */

function jsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

function schemaFor(page) {
  const url = SITE + page.url;
  const graph = [];

  graph.push({
    "@type": "WebSite",
    "@id": SITE + "/#website",
    url: SITE + "/",
    name: "Calcul Taxes Québec",
    inLanguage: "fr-CA",
    publisher: { "@id": SITE + "/#org" }
  });

  graph.push({
    "@type": "Organization",
    "@id": SITE + "/#org",
    name: "Calcul Taxes Québec",
    url: SITE + "/",
    logo: { "@type": "ImageObject", url: SITE + "/icons/icon-512.png" }
  });

  graph.push({
    "@type": "WebApplication",
    "@id": url + "#app",
    name: page.title,
    url: url,
    applicationCategory: "FinanceApplication",
    operatingSystem: "All",
    browserRequirements: "Requires JavaScript.",
    inLanguage: page.lang === "en" ? "en-CA" : "fr-CA",
    description: page.desc,
    datePublished: DATE_PUBLISHED,
    dateModified: page.modified || BUILD_DATE,
    offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
    featureList:
      page.featureList ||
      (page.lang === "en"
        ? ["Add GST and QST", "Remove tax (reverse)", "Quebec number formatting"]
        : ["Ajouter la TPS et la TVQ", "Retirer les taxes (inverse)", "Format québécois"])
  });

  // Breadcrumb
  graph.push({
    "@type": "BreadcrumbList",
    "@id": url + "#breadcrumb",
    itemListElement: page.crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: SITE + c.href
    }))
  });

  if (page.faqs && page.faqs.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": url + "#faq",
      mainEntity: page.faqs.map((f) => ({
        "@type": "Question",
        name: stripTags(f.q),
        acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) }
      }))
    });
  }

  return jsonLd({ "@context": "https://schema.org", "@graph": graph });
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

/* --------------------------------- layout --------------------------------- */

function layout(page) {
  const url = SITE + page.url;
  const lang = page.lang;
  const htmlLang = lang === "en" ? "en-CA" : "fr-CA";
  const ogLocale = lang === "en" ? "en_CA" : "fr_CA";

  // hreflang alternates between FR home and EN page; subpages reference themselves + x-default
  let alternates = "";
  if (page.pair) {
    const [fr, en] = page.pair;
    alternates =
      `\n  <link rel="alternate" hreflang="fr-CA" href="${SITE}${fr}">` +
      `\n  <link rel="alternate" hreflang="en-CA" href="${SITE}${en}">` +
      `\n  <link rel="alternate" hreflang="x-default" href="${SITE}${fr}">`;
  } else if (page.url === "/" || page.url === "/quebec-tax-calculator/") {
    alternates =
      `\n  <link rel="alternate" hreflang="fr-CA" href="${SITE}/">` +
      `\n  <link rel="alternate" hreflang="en-CA" href="${SITE}/quebec-tax-calculator/">` +
      `\n  <link rel="alternate" hreflang="x-default" href="${SITE}/">`;
  }

  return `<!DOCTYPE html>
<html lang="${htmlLang}" data-lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${page.title}</title>
  <meta name="description" content="${page.desc}">
  <link rel="canonical" href="${url}">${alternates}
  <meta name="theme-color" content="#0A0A0A">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <meta name="format-detection" content="telephone=no">${BING_VERIFICATION ? `\n  <meta name="msvalidate.01" content="${BING_VERIFICATION}">` : ""}

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Calcul Taxes Québec">
  <meta property="og:locale" content="${ogLocale}">
  <meta property="og:title" content="${page.title}">
  <meta property="og:description" content="${page.desc}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE}/icons/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${page.title}">
  <meta name="twitter:description" content="${page.desc}">
  <meta name="twitter:image" content="${SITE}/icons/og-image.png">

  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/icons/icon-192.png" sizes="192x192" type="image/png">
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Taxes Québec">

  <link rel="preload" href="/assets/css/styles.css" as="style">
  <link rel="stylesheet" href="/assets/css/styles.css">
  ${page.schemaHtml || schemaFor(page)}
  <script>
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  </script>
  <script defer src="/_vercel/insights/script.js"></script>
</head>
<body>
${header(lang, page.url)}
<main class="wrap" id="contenu">
  ${breadcrumbs(lang, page.crumbs)}
  <div class="hero">
    <h1>${page.h1}</h1>
    ${page.intro ? `<p class="intro">${page.intro}</p>` : ""}
  </div>
  ${page.showCalc === false ? "" : calcCard(lang, page.mode)}
${page.body}
${page.hideLinks ? "" : internalLinks(lang, page.url)}
${faqSection(lang, page.faqs)}
</main>
${footer(lang)}
<script src="/assets/js/calculator.js" defer></script>${(page.extraJs || []).map((src) => `\n<script src="${src}" defer></script>`).join("")}
</body>
</html>
`;
}

/* ------------------------------ content blocks ----------------------------- */

const TRUST_FR = `  <div class="card info-card">
    <div class="rate-pills">
      <span class="pill">TPS <b>5&nbsp;%</b></span>
      <span class="pill">TVQ <b>9,975&nbsp;%</b></span>
      <span class="pill">Combiné <b>14,975&nbsp;%</b></span>
    </div>
    <p>Au Québec, la TPS est de 5&nbsp;% et la TVQ est de 9,975&nbsp;%. Le total combiné est généralement de 14,975&nbsp;% sur les produits et services taxables. La TVQ est calculée sur le prix de vente avant taxes, et non sur la TPS.</p>
    <span class="updated">Dernière mise à jour&nbsp;: ${UPDATED_YEAR}</span>
  </div>`;

const TRUST_EN = `  <div class="card info-card">
    <div class="rate-pills">
      <span class="pill">GST <b>5%</b></span>
      <span class="pill">QST <b>9.975%</b></span>
      <span class="pill">Combined <b>14.975%</b></span>
    </div>
    <p>In Quebec, the GST is 5% and the QST is 9.975%. The combined total is generally 14.975% on taxable goods and services. The QST is calculated on the selling price before taxes, not on the GST.</p>
    <span class="updated">Last updated: ${UPDATED_YEAR}</span>
  </div>`;

/* --------------------------------- FAQs ----------------------------------- */

const FAQ_HOME = [
  { q: "Quelle est la taxe au Québec?", a: "Au Québec, la TPS est de 5&nbsp;% et la TVQ est de 9,975&nbsp;%. Le total combiné est généralement de 14,975&nbsp;% sur les produits et services taxables." },
  { q: "Comment calculer les taxes au Québec?", a: "Multipliez le montant avant taxes par 5&nbsp;% pour la TPS, puis par 9,975&nbsp;% pour la TVQ. Additionnez ensuite le montant avant taxes, la TPS et la TVQ." },
  { q: "Comment retirer les taxes d'un prix au Québec?", a: "Divisez le prix avec taxes incluses par 1,14975 pour obtenir le montant approximatif avant taxes. La calculatrice affiche ensuite la TPS et la TVQ séparément." },
  { q: "Est-ce que la TVQ est calculée sur la TPS?", a: "Non. La TVQ est calculée sur le prix de vente avant taxes, et non sur le montant incluant la TPS." },
  { q: "Quel est le taux combiné TPS TVQ au Québec?", a: "Le taux combiné est de 14,975&nbsp;% pour la plupart des produits et services taxables au Québec." }
];

const FAQ_TPSTVQ = [
  { q: "Comment calculer la TPS et la TVQ?", a: "Multipliez le montant avant taxes par 5&nbsp;% pour la TPS, puis par 9,975&nbsp;% pour la TVQ. Le total avec taxes correspond au montant avant taxes plus la TPS plus la TVQ." },
  { q: "Est-ce que la TVQ est calculée sur la TPS?", a: "Non. La TVQ est calculée sur le prix de vente avant taxes, et non sur le montant incluant la TPS." },
  { q: "Quel est le taux combiné TPS TVQ au Québec?", a: "Le taux combiné est de 14,975&nbsp;% pour la plupart des produits et services taxables au Québec." },
  { q: "La calculatrice fonctionne-t-elle pour un montant avec taxes incluses?", a: "Oui. Choisissez «&nbsp;Retirer les taxes&nbsp;» pour partir d'un prix avec taxes incluses et obtenir le montant avant taxes, la TPS et la TVQ." }
];

const FAQ_INVERSE = [
  { q: "Comment retirer les taxes d'un prix au Québec?", a: "Divisez le prix avec taxes incluses par 1,14975 pour obtenir le montant approximatif avant taxes. La calculatrice affiche ensuite la TPS et la TVQ séparément." },
  { q: "Comment trouver le montant avant taxes à partir d'un total?", a: "Entrez le total avec taxes incluses et choisissez «&nbsp;Retirer les taxes&nbsp;». Le montant avant taxes est obtenu en divisant le total par 1,14975." },
  { q: "Le calcul de taxe inverse est-il exact?", a: "Le résultat est très proche du montant réel, mais comme les taxes sont arrondies au cent, un écart de quelques cents est possible selon l'arrondissement d'origine." },
  { q: "Quel est le taux combiné utilisé pour la taxe inverse?", a: "On utilise le taux combiné de 14,975&nbsp;%, soit un diviseur de 1,14975 appliqué au prix avec taxes incluses." }
];

const FAQ_TAUX = [
  { q: "Quels sont les taux de TPS et de TVQ au Québec?", a: "La TPS est de 5&nbsp;% et la TVQ est de 9,975&nbsp;%, pour un taux combiné de 14,975&nbsp;% sur la plupart des produits et services taxables." },
  { q: "Les taux TPS et TVQ changent-ils en 2026?", a: "Les taux courants demeurent 5&nbsp;% pour la TPS et 9,975&nbsp;% pour la TVQ. Cette page est mise à jour si les taux applicables changent." },
  { q: "Quel est le taux combiné TPS TVQ au Québec?", a: "Le taux combiné est de 14,975&nbsp;% pour la plupart des produits et services taxables au Québec." },
  { q: "Est-ce que la TVQ est calculée sur la TPS?", a: "Non. La TVQ est calculée sur le prix de vente avant taxes, et non sur le montant incluant la TPS." }
];

const FAQ_EN = [
  { q: "What is the sales tax in Quebec?", a: "In Quebec, the GST is 5% and the QST is 9.975%, for a combined rate of generally 14.975% on taxable goods and services." },
  { q: "How do I calculate GST and QST in Quebec?", a: "Multiply the amount before tax by 5% for the GST, then by 9.975% for the QST. Add the amount before tax, the GST and the QST together to get the total." },
  { q: "How do I remove tax from a price in Quebec?", a: "Divide the tax-included price by 1.14975 to get the approximate amount before tax. The calculator then shows the GST and QST separately." },
  { q: "Is the QST calculated on the GST?", a: "No. The QST is calculated on the selling price before taxes, not on the amount including the GST." }
];


/* ------------------------- computed answer blocks (Nov 2026) -------------------------
 * EatBetter-style: the answer with numbers first, then tables computed from the real formula,
 * so every page carries figures no other page has. */
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n, lang) =>
  lang === "en"
    ? "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | | /g, "&nbsp;") + "&nbsp;$";
const moneyInt = (n, lang) =>
  lang === "en" ? "$" + n.toLocaleString("en-CA", { maximumFractionDigits: 0 }) : n.toLocaleString("fr-CA", { maximumFractionDigits: 0 }).replace(/ | | /g, "&nbsp;") + "&nbsp;$";
function addTax(x) { const g = r2(x * 0.05), q = r2(x * 0.09975); return { base: x, g, q, total: r2(x + g + q) }; }
function removeTax(t) { const base = r2(t / 1.14975), g = r2(base * 0.05), q = r2(base * 0.09975); return { total: t, base, g, q }; }

function quickAnswer(lang, html) {
  return `  <div class="answer"><span class="tag">${lang === "en" ? "Quick answer" : "Réponse rapide"}</span>${html}</div>`;
}

function addTable(lang, amounts) {
  const fr = lang !== "en";
  const rows = amounts.map((a) => { const t = addTax(a); return `<tr><td>${money(a, lang)}</td><td>${money(t.g, lang)}</td><td>${money(t.q, lang)}</td><td>${money(t.total, lang)}</td></tr>`; }).join("\n        ");
  return `    <table class="data-table">
      <thead><tr><th>${fr ? "Avant taxes" : "Before tax"}</th><th>${fr ? "TPS 5&nbsp;%" : "GST 5%"}</th><th>${fr ? "TVQ 9,975&nbsp;%" : "QST 9.975%"}</th><th>${fr ? "Total avec taxes" : "Total with tax"}</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}

function removeTable(lang, totals) {
  const fr = lang !== "en";
  const rows = totals.map((t) => { const x = removeTax(t); return `<tr><td>${money(t, lang)}</td><td>${money(x.g, lang)}</td><td>${money(x.q, lang)}</td><td>${money(x.base, lang)}</td></tr>`; }).join("\n        ");
  return `    <table class="data-table">
      <thead><tr><th>${fr ? "Prix taxes incluses" : "Price with tax"}</th><th>${fr ? "TPS incluse" : "GST included"}</th><th>${fr ? "TVQ incluse" : "QST included"}</th><th>${fr ? "Prix avant taxes" : "Price before tax"}</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}

/* Welcome tax (droits de mutation), 2026 brackets.
 * Province: quebec.ca (0.5 % to 62 900 $, 1 % to 315 000 $, 1.5 % above).
 * Montréal: montreal.ca (2 % to 1 104 700 $, 2.5 % to 2 136 500 $, 3.5 % to 3 113 000 $, 4 % above, from 552 300 $).
 * Ville de Québec: ville.quebec.qc.ca (2.5 % from 500 000 $ to 750 000 $, 3 % above). */
const WT = {
  standard: [[62900, 0.005], [315000, 0.01], [Infinity, 0.015]],
  montreal: [[62900, 0.005], [315000, 0.01], [552300, 0.015], [1104700, 0.02], [2136500, 0.025], [3113000, 0.035], [Infinity, 0.04]],
  quebecCity: [[62900, 0.005], [315000, 0.01], [500000, 0.015], [750000, 0.025], [Infinity, 0.03]]
};
function welcomeTax(base, table) { let prev = 0, tax = 0; for (const [cap, rate] of table) { if (base > prev) tax += (Math.min(base, cap) - prev) * rate; prev = cap; } return r2(tax); }
/* First-buyer refundable credit announced April 2026: 100 % of the first 5 000 $ + 25 % of the next 3 500 $ (max 5 875 $), homes under 1 M$. */
function firstBuyerCredit(tax, price) { if (price >= 1000000) return 0; return r2(Math.min(tax, 5000) + Math.max(0, Math.min(tax - 5000, 3500)) * 0.25); }

function welcomeTable(lang, prices) {
  const fr = lang !== "en";
  const rows = prices.map((p) => {
    const st = welcomeTax(p, WT.standard), mtl = welcomeTax(p, WT.montreal), qc = welcomeTax(p, WT.quebecCity);
    return `<tr><td>${moneyInt(p, lang)}</td><td>${money(st, lang)}</td><td>${money(mtl, lang)}</td><td>${money(qc, lang)}</td></tr>`;
  }).join("\n        ");
  return `    <table class="data-table">
      <thead><tr><th>${fr ? "Prix d'achat" : "Purchase price"}</th><th>${fr ? "Barème provincial" : "Provincial scale"}</th><th>Montréal</th><th>${fr ? "Ville de Québec" : "Quebec City"}</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}

function welcomeCard(lang) {
  const fr = lang !== "en";
  return `<div class="card calc" data-wt>
    <div class="field">
      <label for="wt-price">${fr ? "Prix d'achat (ou valeur au rôle si plus élevée)" : "Purchase price (or assessed value if higher)"}</label>
      <div class="input-money"><input id="wt-price" data-wt-price type="text" inputmode="decimal" autocomplete="off" placeholder="${fr ? "450 000" : "450,000"}"><span class="cur" aria-hidden="true">$</span></div>
    </div>
    <div class="field">
      <label for="wt-city">${fr ? "Municipalité" : "Municipality"}</label>
      <select id="wt-city" data-wt-city>
        <option value="standard">${fr ? "Barème provincial (la plupart des villes)" : "Provincial scale (most municipalities)"}</option>
        <option value="montreal">Montréal</option>
        <option value="quebecCity">${fr ? "Ville de Québec" : "Quebec City"}</option>
      </select>
    </div>
    <label class="check"><input type="checkbox" data-wt-first> ${fr ? "Premier achat (crédit d'impôt 2026)" : "First-time buyer (2026 tax credit)"}</label>
    <div class="result" aria-live="polite">
      <div class="total-box"><span class="lbl">${fr ? "Taxe de bienvenue" : "Welcome tax"}</span><span class="amt" data-wt-out="tax">${fmtZero(lang)}</span></div>
      <div class="breakdown">
        <div class="row"><span class="k">${fr ? "Crédit premier acheteur" : "First-buyer credit"}</span><span class="v" data-wt-out="credit">${fmtZero(lang)}</span></div>
        <div class="row"><span class="k">${fr ? "Coût net" : "Net cost"}</span><span class="v" data-wt-out="net">${fmtZero(lang)}</span></div>
      </div>
      <p class="note">${fr ? "Tranches 2026. Une municipalité peut fixer des taux plus élevés au-delà de 500 000 $; vérifiez auprès de la vôtre." : "2026 brackets. A municipality can set higher rates above $500,000; check with yours."}</p>
    </div>
  </div>
  <script>window.WT=${JSON.stringify({ standard: WT.standard.map(([c, r]) => [c === Infinity ? null : c, r]), montreal: WT.montreal.map(([c, r]) => [c === Infinity ? null : c, r]), quebecCity: WT.quebecCity.map(([c, r]) => [c === Infinity ? null : c, r]) })};</script>`;
}

/* ===================== income tax, brackets, paycheque, tax rate (Nov 17 2026) =====================
 * Same pattern as the Nov 11 pages that lifted impressions 3.5×: the answer and a number in the
 * title, a quick-answer box, then tables computed from the real engine (assets/js/salary.js), so
 * the figures always match the calculator on the page.
 * Keyword clusters (Semrush CA export, 2026-11-17):
 *   quebec tax brackets / tax brackets quebec / quebec and canada tax brackets … (~9,000/mo, KD 32–62)
 *   tranches / taux d'imposition / bracket impôt Québec (~3,500/mo, KD 32–41)
 *   calcul impôt Québec / calculateur impôt / impôt Québec calcul (~7,000/mo, KD 14–41)
 *   quebec paycheck / pay / take home pay calculator (~3,600/mo, KD 38–54)
 *   calcul paie net / simulation calcul paie Québec (~1,800/mo, KD 26–38)
 *   quebec tax rate / sales tax rate / how much is tax in quebec (~6,000/mo, KD 15–60) */
const { computeNet: netPay, R: TAXP } = require("./assets/js/salary.js");
const ABATE = TAXP.federal.abatement;
const FED_BR = TAXP.federal.brackets;
const QC_BR = TAXP.quebec.brackets;

const pct = (r, lang, d = 2) => {
  const f = 10 ** d, s = (Math.round(r * 100 * f + 1e-6) / f).toFixed(d).replace(/\.?0+$/, "");
  return lang === "en" ? s + "%" : s.replace(".", ",") + "&nbsp;%";
};
const num = (n, lang) => (lang === "en" ? n.toLocaleString("en-CA", { maximumFractionDigits: 0 }) : n.toLocaleString("fr-CA", { maximumFractionDigits: 0 }).replace(/ | | /g, "&nbsp;"));
const mInt = (n, lang) => moneyInt(Math.round(n), lang);
const incomeTax = (g) => { const r = netPay(g); return { ...r, tax: r.fed + r.qc }; };

function rateAt(brackets, income) { for (const [cap, rate] of brackets) if (income <= cap) return rate; return brackets[brackets.length - 1][1]; }
/* Combined marginal rate for a Quebec resident: federal rate less the 16.5 % abatement, plus the Quebec rate. */
function combinedRate(income) { return rateAt(FED_BR, income) * (1 - ABATE) + rateAt(QC_BR, income); }
function combinedBands() {
  const caps = [...new Set([...FED_BR, ...QC_BR].map(([c]) => c))].sort((a, b) => a - b);
  let lo = 0;
  return caps.map((cap) => { const mid = cap === Infinity ? lo + 1 : (lo + cap) / 2; const band = { lo, hi: cap, fed: rateAt(FED_BR, mid), qc: rateAt(QC_BR, mid) }; band.total = band.fed * (1 - ABATE) + band.qc; lo = cap; return band; });
}
const TOP_COMBINED = combinedBands().slice(-1)[0].total;
function bandLabel(lo, hi, lang) {
  const fr = lang !== "en";
  if (hi === Infinity) return fr ? `Plus de ${mInt(lo, lang)}` : `Over ${mInt(lo, lang)}`;
  if (lo === 0) return fr ? `Jusqu'à ${mInt(hi, lang)}` : `Up to ${mInt(hi, lang)}`;
  return `${mInt(lo, lang)} – ${mInt(hi, lang)}`;
}
function bracketTable(lang, brackets, rateHead) {
  const fr = lang !== "en";
  let lo = 0;
  const rows = brackets.map(([cap, rate]) => { const r = `<tr><td>${bandLabel(lo, cap, lang)}</td><td>${pct(rate, lang)}</td></tr>`; lo = cap; return r; }).join("\n        ");
  return `    <table class="data-table">
      <thead><tr><th>${fr ? "Revenu imposable" : "Taxable income"}</th><th>${rateHead}</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}
function combinedTable(lang) {
  const fr = lang !== "en";
  const rows = combinedBands().map((b) => `<tr><td>${bandLabel(b.lo, b.hi, lang)}</td><td>${pct(b.fed * (1 - ABATE), lang)}</td><td>${pct(b.qc, lang)}</td><td><b>${pct(b.total, lang)}</b></td></tr>`).join("\n        ");
  return `    <table class="data-table">
      <thead><tr><th>${fr ? "Revenu imposable" : "Taxable income"}</th><th>${fr ? "Fédéral (après abattement)" : "Federal (after abatement)"}</th><th>${fr ? "Québec" : "Quebec"}</th><th>${fr ? "Taux marginal combiné" : "Combined marginal rate"}</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}
const TAX_INCOMES = [25000, 30000, 40000, 50000, 60000, 75000, 90000, 100000, 125000, 150000, 200000];
function taxByIncomeTable(lang, incomes = TAX_INCOMES) {
  const fr = lang !== "en";
  const rows = incomes.map((g) => { const r = incomeTax(g); return `<tr><td>${mInt(g, lang)}</td><td>${mInt(r.fed, lang)}</td><td>${mInt(r.qc, lang)}</td><td><b>${mInt(r.tax, lang)}</b></td><td>${pct(r.tax / g, lang, 1)}</td><td>${pct(combinedRate(g), lang)}</td></tr>`; }).join("\n        ");
  return `    <table class="data-table">
      <thead><tr><th>${fr ? "Revenu" : "Income"}</th><th>${fr ? "Impôt fédéral" : "Federal tax"}</th><th>${fr ? "Impôt Québec" : "Quebec tax"}</th><th>${fr ? "Impôt total" : "Total tax"}</th><th>${fr ? "Taux effectif" : "Average rate"}</th><th>${fr ? "Taux marginal" : "Marginal rate"}</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}
const PAY_SALARIES = [30000, 40000, 45000, 50000, 55000, 60000, 70000, 80000, 90000, 100000, 120000];
function payTable(lang) {
  const fr = lang !== "en";
  const rows = PAY_SALARIES.map((g) => { const r = netPay(g); return `<tr><td>${mInt(g, lang)}</td><td>${money(r2(r.net / 52), lang)}</td><td><b>${money(r2(r.net / 26), lang)}</b></td><td>${money(r2(r.net / 12), lang)}</td></tr>`; }).join("\n        ");
  return `    <table class="data-table">
      <thead><tr><th>${fr ? "Salaire brut annuel" : "Annual gross salary"}</th><th>${fr ? "Net par semaine" : "Net weekly"}</th><th>${fr ? "Net aux 2 semaines" : "Net every 2 weeks"}</th><th>${fr ? "Net par mois" : "Net monthly"}</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}
const HOURLY = [17, 18, 20, 22, 25, 28, 30, 35, 40, 50];
function hourlyTable(lang) {
  const fr = lang !== "en";
  const rows = HOURLY.map((h) => { const g = h * 40 * 52, r = netPay(g); return `<tr><td>${money(h, lang)}</td><td>${mInt(g, lang)}</td><td><b>${money(r2(r.net / 26), lang)}</b></td><td>${money(r2(r.net / 2080), lang)}</td></tr>`; }).join("\n        ");
  return `    <table class="data-table">
      <thead><tr><th>${fr ? "Taux horaire" : "Hourly wage"}</th><th>${fr ? "Brut annuel (40 h)" : "Annual gross (40 h)"}</th><th>${fr ? "Net aux 2 semaines" : "Net every 2 weeks"}</th><th>${fr ? "Net par heure" : "Net per hour"}</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}
/* Sales tax by province, rates in force in 2026 (CRA GST/HST rates; BC, SK and MB PST/RST sites).
 * Nova Scotia's HST fell from 15 % to 14 % on April 1, 2025. PST/RST/QST are charged on the price before GST,
 * so the rates add up. kind: gst (GST only), hst (single harmonized tax), pst/rst/qst (GST + provincial tax). */
const PROV = [
  { code: "qc", fr: "Québec", en: "Quebec", kind: "qst", prov: 0.09975 },
  { code: "on", fr: "Ontario", en: "Ontario", kind: "hst", prov: 0.08 },
  { code: "bc", fr: "Colombie-Britannique", en: "British Columbia", kind: "pst", prov: 0.07 },
  { code: "ab", fr: "Alberta", en: "Alberta", kind: "gst", prov: 0 },
  { code: "sk", fr: "Saskatchewan", en: "Saskatchewan", kind: "pst", prov: 0.06 },
  { code: "mb", fr: "Manitoba", en: "Manitoba", kind: "rst", prov: 0.07 },
  { code: "nb", fr: "Nouveau-Brunswick", en: "New Brunswick", kind: "hst", prov: 0.10 },
  { code: "ns", fr: "Nouvelle-Écosse", en: "Nova Scotia", kind: "hst", prov: 0.09 },
  { code: "pe", fr: "Île-du-Prince-Édouard", en: "Prince Edward Island", kind: "hst", prov: 0.10 },
  { code: "nl", fr: "Terre-Neuve-et-Labrador", en: "Newfoundland and Labrador", kind: "hst", prov: 0.10 },
  { code: "yt", fr: "Yukon", en: "Yukon", kind: "gst", prov: 0 },
  { code: "nt", fr: "Territoires du Nord-Ouest", en: "Northwest Territories", kind: "gst", prov: 0 },
  { code: "nu", fr: "Nunavut", en: "Nunavut", kind: "gst", prov: 0 }
].map((p) => ({ ...p, fed: 0.05, rate: r2((0.05 + p.prov) * 100000) / 100000 }));
const PROV_BY = Object.fromEntries(PROV.map((p) => [p.code, p]));
const TAXNAME = { fr: { gst: "TPS", hst: "TVH", pst: "TVP", rst: "TVD", qst: "TVQ" }, en: { gst: "GST", hst: "HST", pst: "PST", rst: "RST", qst: "QST" } };
function provParts(p, lang) {
  const n = TAXNAME[lang === "en" ? "en" : "fr"];
  if (p.kind === "hst") return `${n.hst} ${pct(p.rate, lang, 3)}`;
  if (p.kind === "gst") return `${n.gst} ${pct(0.05, lang)}`;
  return `${n.gst} ${pct(0.05, lang)} + ${n[p.kind]} ${pct(p.prov, lang, 3)}`;
}
/* Same rounding as the calculators: each tax rounded to the cent (HST as one tax). */
function provTax(p, base) {
  if (p.kind === "hst") { const t = r2(base * p.rate); return { base, t1: t, t2: 0, tax: t, total: r2(base + t) }; }
  const t1 = r2(base * 0.05), t2 = r2(base * p.prov);
  return { base, t1, t2, tax: r2(t1 + t2), total: r2(base + t1 + t2) };
}
function provRemove(p, total) { const base = r2(total / (1 + p.rate)); return { ...provTax(p, base), total }; }
function provName(p, lang) { return lang === "en" ? p.en : p.fr; }

function provinceTable(lang) {
  const fr = lang !== "en";
  const rows = PROV.map((p) => { const t = provTax(p, 100), r = provRemove(p, 100); return `<tr><td>${provName(p, lang)}</td><td>${provParts(p, lang)}</td><td><b>${pct(p.rate, lang, 3)}</b></td><td>${money(t.total, lang)}</td><td>${money(r.base, lang)}</td></tr>`; }).join("\n        ");
  return `    <table class="data-table">
      <thead><tr><th>Province</th><th>${fr ? "Taxes" : "Taxes"}</th><th>${fr ? "Taux total" : "Total rate"}</th><th>${fr ? "100 $ + taxes" : "$100 + tax"}</th><th>${fr ? "100 $ taxes incl. = avant taxes" : "$100 tax incl. = before tax"}</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}
function provAmountTable(lang, p, amounts) {
  const fr = lang !== "en", n = TAXNAME[fr ? "fr" : "en"];
  const hst = p.kind === "hst";
  const head = hst ? `<th>${n.hst} ${pct(p.rate, lang, 3)}</th>` : `<th>${n.gst} 5${fr ? "&nbsp;%" : "%"}</th><th>${n[p.kind]} ${pct(p.prov, lang, 3)}</th>`;
  const rows = amounts.map((a) => { const t = provTax(p, a); return `<tr><td>${money(a, lang)}</td>${hst ? `<td>${money(t.t1, lang)}</td>` : `<td>${money(t.t1, lang)}</td><td>${money(t.t2, lang)}</td>`}<td>${money(t.total, lang)}</td></tr>`; }).join("\n        ");
  return `    <table class="data-table">
      <thead><tr><th>${fr ? "Avant taxes" : "Before tax"}</th>${head}<th>${fr ? "Total avec taxes" : "Total with tax"}</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}
function provRemoveTable(lang, p, totals) {
  const fr = lang !== "en";
  const rows = totals.map((t) => { const x = provRemove(p, t); return `<tr><td>${money(t, lang)}</td><td>${money(x.tax, lang)}</td><td>${money(x.base, lang)}</td></tr>`; }).join("\n        ");
  return `    <table class="data-table">
      <thead><tr><th>${fr ? "Prix taxes incluses" : "Price with tax"}</th><th>${fr ? "Taxes incluses" : "Tax included"}</th><th>${fr ? "Prix avant taxes" : "Price before tax"}</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}
/* Tax on one amount in every province, cheapest to most expensive. */
function provCompareTable(lang, amount) {
  const fr = lang !== "en";
  const rows = [...PROV].sort((a, b) => a.rate - b.rate || provName(a, lang).localeCompare(provName(b, lang)))
    .map((p) => { const t = provTax(p, amount); return `<tr><td>${provName(p, lang)}</td><td>${money(t.tax, lang)}</td><td>${money(t.total, lang)}</td></tr>`; }).join("\n        ");
  return `    <table class="data-table">
      <thead><tr><th>Province</th><th>${fr ? `Taxes sur ${moneyInt(amount, lang)}` : `Tax on ${moneyInt(amount, lang)}`}</th><th>${fr ? "Total" : "Total"}</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}

function canadaCard(lang, defaultProv = "on", mode = "add") {
  const fr = lang !== "en";
  const opts = PROV.map((p) => `<option value="${p.code}" data-fed="0.05" data-prov="${p.prov}" data-kind="${p.kind}"${p.code === defaultProv ? " selected" : ""}>${provName(p, lang)} (${stripTags(pct(p.rate, lang, 3))})</option>`).join("\n          ");
  const chips = [10, 20, 50, 100, 250, 500, 1000].map((n) => `<button type="button" data-ca-chip="${n}">${fr ? n.toLocaleString("fr-CA").replace(/ /g, " ") + " $" : "$" + n.toLocaleString("en-CA")}</button>`).join("\n        ");
  const p = PROV_BY[defaultProv];
  return `<div class="card calc" data-ca data-ca-default-mode="${mode}">
    <div class="mode-switch" role="group" aria-label="${fr ? "Mode de calcul" : "Calculation mode"}">
      <button type="button" data-ca-mode="add" aria-pressed="${mode === "add"}">${fr ? "Ajouter les taxes" : "Add tax"}</button>
      <button type="button" data-ca-mode="remove" aria-pressed="${mode === "remove"}">${fr ? "Retirer les taxes" : "Remove tax"}</button>
    </div>
    <div class="field">
      <label for="ca-prov">${fr ? "Province ou territoire" : "Province or territory"}</label>
      <select id="ca-prov" data-ca-prov>
          ${opts}
      </select>
    </div>
    <div class="field">
      <label for="ca-amount" data-ca-label="input">${fr ? "Montant avant taxes" : "Amount before tax"}</label>
      <div class="input-money">
        <input id="ca-amount" data-ca-input type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" placeholder="${fr ? "0,00" : "0.00"}">
        <span class="cur" aria-hidden="true">$</span>
      </div>
      <div class="chips" role="group" aria-label="${fr ? "Montants rapides" : "Quick amounts"}">
        ${chips}
      </div>
    </div>
    <div class="result" aria-live="polite">
      <div class="breakdown">
        <div class="row"><span class="k" data-ca-label="row1">${fr ? "Sous-total" : "Subtotal"}</span><span class="v" data-ca-out="row1">${fmtZero(lang)}</span></div>
        <div class="row"><span class="k" data-ca-label="t1">${provParts(p, lang).split(" + ")[0]}</span><span class="v" data-ca-out="t1">${fmtZero(lang)}</span></div>
        <div class="row"${p.kind === "hst" || p.kind === "gst" ? " hidden" : ""}><span class="k" data-ca-label="t2">${provParts(p, lang).split(" + ")[1] || ""}</span><span class="v" data-ca-out="t2">${fmtZero(lang)}</span></div>
      </div>
      <div class="total-box">
        <span class="lbl" data-ca-label="big">${fr ? "Total avec taxes" : "Total with tax"}</span>
        <span class="amt" data-ca-out="big">${fmtZero(lang)}</span>
      </div>
      <div class="rate-row"><span>${fr ? "Taux total" : "Total rate"}</span><b data-ca-out="rate">${pct(p.rate, lang, 3)}</b></div>
      <div class="actions">
        <button type="button" class="btn-copy" data-ca-copy>${fr ? "Copier le résultat" : "Copy result"}</button>
        <button type="button" class="btn-clear" data-ca-clear>${fr ? "Effacer" : "Clear"}</button>
      </div>
      <p class="note">${fr ? "Taux 2026. Chaque taxe est arrondie au cent près." : "2026 rates. Each tax is rounded to the nearest cent."}</p>
    </div>
  </div>`;
}

const S60 = incomeTax(60000);
const S50 = incomeTax(50000);
const S100 = incomeTax(100000);
const QC_LOW = QC_BR[0], FED_LOW = FED_BR[0];
// Gross salary at which each income tax starts (basic personal amount + contribution credits)
const firstTaxed = (key) => { for (let g = 10000; g < 60000; g += 50) if (netPay(g)[key] > 0.5) return g; return 0; };
const QC_START = firstTaxed("qc"), FED_START = firstTaxed("fed");
// Worked example: Quebec tax on 60 000 $ of taxable income, before credits
const EX_LOW = r2(QC_LOW[0] * QC_LOW[1]);
const EX_HIGH = r2((60000 - QC_LOW[0]) * QC_BR[1][1]);

/* --------------------------------- pages ---------------------------------- */

const pages = [];

// 1. Home (FR)
pages.push({
  url: "/",
  modified: "2026-11-19",
  out: "index.html",
  lang: "fr",
  mode: "add",
  title: "Calcul Taxes Québec 2026 : TPS 5 % + TVQ 9,975 % = 14,975 %",
  desc: "Calcul des taxes au Québec en 2026 : TPS 5 % et TVQ 9,975 %, soit 14,975 %. 100 $ avant taxes = 114,98 $. Ajoutez ou retirez les taxes instantanément.",
  h1: "Calcul Taxes Québec",
  intro:
    "Entrez un montant et voyez instantanément la TPS, la TVQ et le total avec taxes. Simple, rapide et fait pour le Québec.",
  crumbs: [{ name: "Accueil", href: "/" }],
  faqs: FAQ_HOME.concat([
    { q: "Combien de taxes sur 100 $ au Québec?", a: "Sur 100&nbsp;$ avant taxes, la TPS est de 5,00&nbsp;$ et la TVQ de 9,98&nbsp;$, soit 14,98&nbsp;$ de taxes et un total de 114,98&nbsp;$." },
    { q: "Comment calculer 15 % de taxes au Québec?", a: "Le taux réel n'est pas 15&nbsp;% mais 14,975&nbsp;%. Multipliez le prix par 1,14975 pour obtenir le total. Arrondir à 15&nbsp;% surestime les taxes de 2,5&nbsp;cents par 100&nbsp;$." },
    { q: "Quels produits ne sont pas taxés au Québec?", a: "Les produits alimentaires de base (épicerie), les médicaments sur ordonnance, la plupart des loyers résidentiels et certains services de santé et d'éducation sont détaxés ou exonérés. Les plats préparés, l'alcool, les boissons gazeuses et les grignotines sont taxables." }
  ]),
  body:
    quickAnswer("fr", "<p>Au Québec en 2026, on ajoute <b>5&nbsp;% de TPS</b> et <b>9,975&nbsp;% de TVQ</b> au prix avant taxes, soit <b>14,975&nbsp;%</b>. Multipliez par 1,14975&nbsp;: 100&nbsp;$ devient 114,98&nbsp;$. Pour retirer les taxes, divisez par 1,14975.</p>") +
    TRUST_FR +
    `
  <section class="content" aria-labelledby="table-title">
    <h2 id="table-title">Combien de taxes sur 10&nbsp;$, 100&nbsp;$ ou 1&nbsp;000&nbsp;$?</h2>
    <p>Taxes calculées avec les taux 2026, arrondies au cent comme sur une facture&nbsp;:</p>
${addTable("fr", [1, 5, 10, 20, 25, 50, 75, 100, 200, 250, 500, 1000, 2000, 5000, 10000])}
  </section>
  <section class="content" aria-labelledby="reverse-title">
    <h2 id="reverse-title">Retirer les taxes d'un prix</h2>
    <p>Vous avez un prix avec taxes incluses? Choisissez «&nbsp;Retirer les taxes&nbsp;» dans la calculatrice, entrez le total et obtenez le montant avant taxes, la TPS et la TVQ. Pour le tableau complet et la formule, consultez le <a href="/calcul-taxe-inverse-quebec/">calcul des taxes inversé (TPS TVQ inversée)</a>.</p>
  </section>
  <section class="content" aria-labelledby="simple-title">
    <h2 id="simple-title">Calculatrice TPS TVQ simple pour le Québec</h2>
    <p>Cette calculatrice vous aide à ajouter ou retirer les taxes du Québec en quelques secondes. Elle utilise les taux courants de TPS et de TVQ applicables à la plupart des produits et services taxables.</p>
    <h2>Ajouter ou retirer les taxes</h2>
    <p>Choisissez «&nbsp;Ajouter les taxes&nbsp;» pour partir d'un prix avant taxes. Choisissez «&nbsp;Retirer les taxes&nbsp;» si votre prix inclut déjà la TPS et la TVQ.</p>
    <h2>Pourquoi utiliser Calcul Taxes Québec?</h2>
    <ul class="benefits">
      <li>Calcul instantané</li>
      <li>Format adapté au Québec</li>
      <li>TPS et TVQ séparées</li>
      <li>Fonction inverse incluse</li>
      <li>Aucun compte requis</li>
    </ul>
  </section>`
});

// 3. /calcul-taxe-inverse-quebec/ (FR)
pages.push({
  url: "/calcul-taxe-inverse-quebec/",
  modified: "2026-11-19",
  out: "calcul-taxe-inverse-quebec/index.html",
  pair: ["/calcul-taxe-inverse-quebec/", "/reverse-tax-calculator-quebec/"],
  lang: "fr",
  mode: "remove",
  title: "Taxes Inversées Québec 2026 : Total ÷ 1,14975 (TPS TVQ)",
  desc: "Calcul des taxes inversé 2026 : divisez le prix taxes incluses par 1,14975. 114,98 $ = 100 $ avant taxes + 5,00 $ de TPS + 9,98 $ de TVQ. Tableau et calculatrice TPS TVQ inversée.",
  h1: "Calcul taxes inversé Québec (TPS TVQ inversée)",
  intro:
    "Vous avez un prix avec taxes incluses? Entrez le total : la calculatrice inversée retire la TPS et la TVQ et donne le montant avant taxes.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Calcul Taxe Inverse Québec", href: "/calcul-taxe-inverse-quebec/" }],
  faqs: FAQ_INVERSE.concat([
    { q: "Comment calculer le montant avant taxes de 50 $?", a: "Divisez 50&nbsp;$ par 1,14975&nbsp;: le prix avant taxes est de 43,49&nbsp;$, dont 2,17&nbsp;$ de TPS et 4,34&nbsp;$ de TVQ incluses." },
    { q: "Quel pourcentage de taxes est inclus dans un prix au Québec?", a: "Environ 13,02&nbsp;% d'un prix taxes incluses est constitué de taxes (14,975 ÷ 114,975). Retirer 14,975&nbsp;% du total est une erreur courante&nbsp;: on obtiendrait un montant trop bas." },
    { q: "Comment calculer la TPS et la TVQ inversée?", a: "Divisez le total par 1,14975 pour obtenir le prix avant taxes, puis multipliez ce prix par 5&nbsp;% pour la TPS et par 9,975&nbsp;% pour la TVQ. Sur 100&nbsp;$ taxes incluses&nbsp;: 86,98&nbsp;$ avant taxes, 4,35&nbsp;$ de TPS et 8,68&nbsp;$ de TVQ." },
    { q: "Comment calculer seulement la TVQ incluse dans un prix?", a: "Multipliez le prix taxes incluses par 9,975 ÷ 114,975 (environ 8,676&nbsp;%). Pour la TPS seule, multipliez par 5 ÷ 114,975 (environ 4,349&nbsp;%)." },
    { q: "Le calcul des taxes inversé a-t-il changé en 2026?", a: "Non. Les taux sont les mêmes en 2026&nbsp;: TPS 5&nbsp;% et TVQ 9,975&nbsp;%. Le diviseur reste donc 1,14975." }
  ]),
  body:
    quickAnswer("fr", "<p>Calcul des taxes inversé au Québec en 2026&nbsp;: <b>divisez le total par 1,14975</b>. Exemple&nbsp;: 114,98&nbsp;$ ÷ 1,14975 = <b>100,00&nbsp;$ avant taxes</b>, dont 5,00&nbsp;$ de TPS et 9,98&nbsp;$ de TVQ. Environ 13&nbsp;% d'un prix taxes incluses, c'est des taxes&nbsp;: ne retirez pas 14,975&nbsp;%.</p>") +
    TRUST_FR +
    `
  <section class="content" aria-labelledby="rtable-title">
    <h2 id="rtable-title">Taxes inversées : prix avant taxes pour les montants courants</h2>
    <p>TPS et TVQ incluses dans chaque total, calculées avec les taux 2026 et arrondies au cent&nbsp;:</p>
${removeTable("fr", [1, 5, 10, 20, 25, 50, 75, 100, 114.98, 150, 200, 250, 500, 1000, 1500, 2000, 5000, 10000])}
  </section>` +
    `
  <section class="content" aria-labelledby="rev-title">
    <h2 id="rev-title">Formule du calcul TPS TVQ inversé</h2>
    <div class="formula">Prix avant taxes = total ÷ 1,14975
TPS incluse = prix avant taxes × 5&nbsp;%
TVQ incluse = prix avant taxes × 9,975&nbsp;%</div>
    <p>Le calcul de taxe inverse part d'un prix avec taxes incluses pour retrouver le montant avant taxes. On divise le total par 1,14975, puis on répartit la TPS (5&nbsp;%) et la TVQ (9,975&nbsp;%).</p>
    <h3>Exemple sur 114,98&nbsp;$</h3>
    <p>Pour un total de 114,98&nbsp;$ avec taxes incluses, le montant avant taxes est de 100,00&nbsp;$, la TPS de 5,00&nbsp;$ et la TVQ de 9,98&nbsp;$.</p>
    <h2>Pourquoi ne pas soustraire 14,975&nbsp;%?</h2>
    <p>Les taxes ont été ajoutées sur le prix avant taxes&nbsp;: il faut donc diviser, pas soustraire. Sur 114,98&nbsp;$, retirer 14,975&nbsp;% donne 97,76&nbsp;$, soit 2,24&nbsp;$ de trop peu. Diviser par 1,14975 donne le bon montant&nbsp;: 100,00&nbsp;$.</p>
    <h2>Trouver seulement la TPS ou la TVQ incluse</h2>
    <ul class="benefits">
      <li>TPS incluse = total × 5 ÷ 114,975 (≈ 4,349&nbsp;%)</li>
      <li>TVQ incluse = total × 9,975 ÷ 114,975 (≈ 8,676&nbsp;%)</li>
      <li>Taxes incluses = total × 14,975 ÷ 114,975 (≈ 13,025&nbsp;%)</li>
    </ul>
    <p>Pratique pour un reçu, une note de frais ou pour réclamer des crédits de taxe sur les intrants (CTI/RTI) comme travailleur autonome.</p>
    <h2>Pourquoi un petit écart est possible</h2>
    <p>Comme les taxes sont arrondies au cent, le montant avant taxes obtenu par calcul inverse peut différer de quelques cents du prix original. Les montants sont arrondis au cent près.</p>
    <h2>Calculer dans l'autre sens</h2>
    <p>Pour ajouter les taxes à un prix avant taxes, utilisez le <a href="/">calcul TPS TVQ</a>.</p>
  </section>`
});

// 4. /quebec-tax-calculator/ (EN)
pages.push({
  url: "/quebec-tax-calculator/",
  out: "quebec-tax-calculator/index.html",
  lang: "en",
  mode: "add",
  title: "Quebec Sales Tax Calculator 2026: GST 5% + QST 9.975%",
  desc: "Quebec sales tax in 2026 is 14.975%: GST 5% plus QST 9.975%. $100 before tax = $114.98. Add or remove Quebec tax instantly with this free calculator.",
  h1: "Quebec Sales Tax Calculator",
  intro:
    "Enter an amount and instantly calculate Quebec GST, QST, and the total with tax. Simple, fast, and made for Quebec.",
  crumbs: [{ name: "Home", href: "/quebec-tax-calculator/" }],
  faqs: FAQ_EN.concat([
    { q: "How much is tax on $100 in Quebec?", a: "On $100 before tax, the GST is $5.00 and the QST is $9.98, so you pay $14.98 in tax and $114.98 in total." },
    { q: "Is Quebec sales tax 15%?", a: "Almost: the combined rate is 14.975%, not 15%. Multiply the price by 1.14975 to get the total." },
    { q: "What is not taxed in Quebec?", a: "Basic groceries, prescription drugs, most residential rent and some health and education services are zero-rated or exempt. Prepared meals, alcohol, soft drinks and snacks are taxable." }
  ]),
  body:
    quickAnswer("en", "<p>Quebec adds <b>5% GST</b> and <b>9.975% QST</b> to the price before tax: <b>14.975%</b> in total. Multiply by 1.14975: $100 becomes $114.98. To remove tax, divide by 1.14975.</p>") +
    TRUST_EN +
    `
  <section class="content" aria-labelledby="entable-title">
    <h2 id="entable-title">How much tax on $10, $100 or $1,000 in Quebec?</h2>
${addTable("en", [1, 5, 10, 20, 25, 50, 75, 100, 200, 250, 500, 1000, 2000, 5000, 10000])}
  </section>` +
    `
  <section class="content" aria-labelledby="how-en">
    <h2 id="how-en">How to calculate Quebec sales tax</h2>
    <p>To add tax, multiply the amount before tax by 5% for the GST and by 9.975% for the QST, then add both to the original amount. To remove tax, divide the tax-included total by 1.14975 to find the amount before tax.</p>
    <h3>Example on $100</h3>
    <p>On $100.00: the GST is $5.00, the QST is $9.98, and the total with tax is $114.98.</p>
    <h2>Add or remove tax</h2>
    <p>Choose “Add tax” to start from a price before tax. Choose “Remove tax” if your price already includes GST and QST. The QST is calculated on the price before taxes, not on the GST.</p>
  </section>`
});

// 5. /taux-tps-tvq-quebec/ (FR)
pages.push({
  url: "/taux-tps-tvq-quebec/",
  out: "taux-tps-tvq-quebec/index.html",
  lang: "fr",
  mode: "add",
  pair: ["/taux-tps-tvq-quebec/", "/quebec-tax-rate/"],
  title: "Taux TPS TVQ Québec 2026 : 5 % + 9,975 % = 14,975 %",
  desc: "Taux de taxes au Québec en 2026 : TPS 5 % + TVQ 9,975 % = 14,975 %. 100 $ avant taxes = 114,98 $. Comparaison avec l'Ontario (TVH 13 %) et les autres provinces.",
  h1: "Taux TPS TVQ Québec",
  intro:
    "Consultez les taux courants de TPS et de TVQ au Québec et calculez instantanément les taxes sur un montant.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Taux TPS TVQ Québec", href: "/taux-tps-tvq-quebec/" }],
  faqs: [...FAQ_TAUX,
    { q: "Les taxes sont-elles plus élevées au Québec qu'en Ontario?", a: "Oui. Le taux combiné du Québec (14,975&nbsp;%) dépasse d'environ 2 points la TVH de 13&nbsp;% de l'Ontario. Sur 100&nbsp;$, on paie 114,98&nbsp;$ au Québec et 113,00&nbsp;$ en Ontario." },
    { q: "Y a-t-il une TVH au Québec?", a: "Non. Le Québec applique deux taxes distinctes, la TPS (5&nbsp;%) et la TVQ (9,975&nbsp;%). La TVH est utilisée en Ontario et dans les provinces de l'Atlantique." }],
  body:
    quickAnswer("fr", "<p>Au Québec, le taux de taxes est de <b>14,975&nbsp;%</b>&nbsp;: <b>TPS 5&nbsp;%</b> (fédérale) + <b>TVQ 9,975&nbsp;%</b> (provinciale). Multipliez un prix par <b>1,14975</b> pour obtenir le total&nbsp;: 100&nbsp;$ avant taxes = <b>114,98&nbsp;$</b>. Les taux sont inchangés en 2026.</p>") +
    TRUST_FR +
    `
  <section class="content" aria-labelledby="rates-title">
    <h2 id="rates-title">Taux de taxes au Québec en ${UPDATED_YEAR}</h2>
    <p>Au Québec, deux taxes s'appliquent sur la plupart des produits et services taxables&nbsp;: la TPS (taxe fédérale) et la TVQ (taxe provinciale).</p>
    <ul class="benefits">
      <li>TPS&nbsp;: 5&nbsp;%</li>
      <li>TVQ&nbsp;: 9,975&nbsp;%</li>
      <li>Taux combiné&nbsp;: 14,975&nbsp;%</li>
    </ul>
    <h2>Comment les taux s'appliquent</h2>
    <p>La TVQ de 9,975&nbsp;% est calculée sur le prix de vente avant taxes, et non sur la TPS. Le taux combiné de 14,975&nbsp;% sert d'estimation rapide du total des taxes.</p>
    <h2>TPS et TVQ sur des montants courants</h2>
${addTable("fr", [1, 5, 10, 20, 25, 50, 75, 100, 200, 500, 1000, 5000])}
    <h2>Taux de taxes de vente par province (2026)</h2>
${provinceTable("fr")}
    <h2>Calculer un montant</h2>
    <p>Entrez un montant ci-dessus pour voir la TPS, la TVQ et le total. Pour retirer les taxes d'un prix, utilisez le <a href="/calcul-taxe-inverse-quebec/">calcul de taxe inverse</a>.</p>
    <h2>Vous cherchez le taux d'impôt sur le revenu?</h2>
    <p>L'impôt sur le revenu est distinct des taxes de vente&nbsp;: au Québec, il va de 14&nbsp;% à 25,75&nbsp;% en 2026, plus l'impôt fédéral. Voyez les <a href="/tranches-imposition-quebec/">tranches d'imposition 2026</a> ou le <a href="/calcul-impot-quebec/">calcul d'impôt Québec</a>.</p>
    <p class="note">Dernière mise à jour&nbsp;: ${UPDATED_YEAR}.</p>
  </section>`
});

// 8. /calcul-salaire-net-quebec/ (FR) — net-pay (brut → net) calculator
pages.push({
  url: "/calcul-salaire-net-quebec/",
  out: "calcul-salaire-net-quebec/index.html",
  pair: ["/calcul-salaire-net-quebec/", "/quebec-income-tax-calculator/"],
  lang: "fr",
  showCalc: false,
  extraJs: ["/assets/js/salary.js"],
  featureList: ["Salaire brut en net", "Impôt fédéral et du Québec", "RRQ, assurance-emploi et RQAP", "Net par période de paie"],
  title: "Calcul Salaire Net Québec 2026 : 60 000 $ brut = 45 857 $ net",
  desc: "Calculez votre salaire net au Québec à partir du brut (taux 2026). Impôt fédéral et provincial, RRQ, assurance-emploi et RQAP, net par mois ou par paie.",
  h1: "Calcul salaire net Québec",
  intro:
    "Entrez votre salaire brut et obtenez votre salaire net au Québec : impôt fédéral et provincial, RRQ, assurance-emploi et RQAP, avec le net par période de paie.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Calcul salaire net Québec", href: "/calcul-salaire-net-quebec/" }],
  faqs: [
    { q: "Comment passer du salaire brut au salaire net au Québec?", a: "On soustrait du salaire brut l'impôt fédéral, l'impôt du Québec, la cotisation au RRQ (Régime de rentes du Québec), l'assurance-emploi et le RQAP. Ce qui reste est le salaire net, c'est-à-dire le montant déposé sur votre paie." },
    { q: "Quelles retenues sont prélevées sur la paie au Québec en 2026?", a: "Cinq retenues principales&nbsp;: l'impôt fédéral, l'impôt du Québec, le RRQ (6,3&nbsp;% jusqu'à 74&nbsp;600&nbsp;$, plus 4&nbsp;% jusqu'à 85&nbsp;000&nbsp;$), l'assurance-emploi (1,30&nbsp;% jusqu'à 68&nbsp;900&nbsp;$) et le RQAP (0,430&nbsp;% jusqu'à 103&nbsp;000&nbsp;$)." },
    { q: "Le calcul du salaire net est-il exact?", a: "C'est une estimation fiable pour un particulier salarié avec les crédits de base. Le montant réel peut varier selon vos crédits, déductions (REER, pension), avantages imposables ou votre situation familiale." },
    { q: "Quel est le salaire net de 60 000 $ au Québec?", a: "Pour un salaire brut de 60&nbsp;000&nbsp;$ en 2026, le salaire net est d'environ 45&nbsp;857&nbsp;$ par année, soit près de 3&nbsp;821&nbsp;$ par mois, après un total de retenues d'environ 23,6&nbsp;%." },
    { q: "Pourquoi l'assurance-emploi est-elle plus basse au Québec?", a: "Parce que le Québec administre son propre régime parental (le RQAP). Le taux d'assurance-emploi y est donc réduit (1,30&nbsp;% en 2026) et une cotisation distincte au RQAP s'ajoute." }
  ],
  body:
    salaryCard("fr") +
    `
  <div class="card info-card">
    <div class="rate-pills">
      <span class="pill">RRQ <b>6,3&nbsp;%</b></span>
      <span class="pill">Assurance-emploi <b>1,30&nbsp;%</b></span>
      <span class="pill">RQAP <b>0,430&nbsp;%</b></span>
    </div>
    <p>Au Québec, votre salaire brut est réduit par l'impôt fédéral, l'impôt provincial et trois cotisations sociales (RRQ, assurance-emploi, RQAP). Le calculateur applique les paramètres 2026 et estime le net déposé sur votre paie.</p>
    <span class="updated">Taux 2026 — Dernière mise à jour&nbsp;: ${UPDATED_YEAR}</span>
  </div>
  <section class="content" aria-labelledby="how-net">
    <h2 id="how-net">Comment passer du salaire brut au salaire net</h2>
    <p>Le salaire net est ce qu'il reste du salaire brut une fois retirées les retenues obligatoires. Au Québec, on soustrait l'impôt fédéral, l'impôt du Québec, la cotisation au RRQ, l'assurance-emploi (AE) et le RQAP.</p>
    <h2>Ce qui est retenu sur votre paie en 2026</h2>
    <ul class="benefits">
      <li>Impôt fédéral — barème de 14&nbsp;% à 33&nbsp;%, moins l'abattement du Québec (16,5&nbsp;%)</li>
      <li>Impôt du Québec — barème de 14&nbsp;% à 25,75&nbsp;%</li>
      <li>RRQ — 6,3&nbsp;% sur le salaire entre 3&nbsp;500&nbsp;$ et 74&nbsp;600&nbsp;$, puis 4&nbsp;% jusqu'à 85&nbsp;000&nbsp;$</li>
      <li>Assurance-emploi — 1,30&nbsp;% jusqu'à 68&nbsp;900&nbsp;$ (taux réduit du Québec)</li>
      <li>RQAP — 0,430&nbsp;% jusqu'à 103&nbsp;000&nbsp;$</li>
    </ul>
    <h2>Salaire net selon le salaire brut (2026)</h2>
    <p>Estimations annuelles pour un particulier salarié au Québec avec les crédits de base&nbsp;:</p>
    <table class="data-table">
      <thead><tr><th>Salaire brut</th><th>Salaire net</th><th>Net / mois</th><th>Retenues</th></tr></thead>
      <tbody>
        <tr><td>30 000&nbsp;$</td><td>25 595&nbsp;$</td><td>2 133&nbsp;$</td><td>14,7&nbsp;%</td></tr>
        <tr><td>40 000&nbsp;$</td><td>32 429&nbsp;$</td><td>2 702&nbsp;$</td><td>18,9&nbsp;%</td></tr>
        <tr><td>50 000&nbsp;$</td><td>39 264&nbsp;$</td><td>3 272&nbsp;$</td><td>21,5&nbsp;%</td></tr>
        <tr><td>60 000&nbsp;$</td><td>45 857&nbsp;$</td><td>3 821&nbsp;$</td><td>23,6&nbsp;%</td></tr>
        <tr><td>75 000&nbsp;$</td><td>54 627&nbsp;$</td><td>4 552&nbsp;$</td><td>27,2&nbsp;%</td></tr>
        <tr><td>100 000&nbsp;$</td><td>70 262&nbsp;$</td><td>5 855&nbsp;$</td><td>29,7&nbsp;%</td></tr>
      </tbody>
    </table>
    <h2>Ce que l'estimation ne comprend pas</h2>
    <p>Le calcul suppose un revenu d'emploi seul et les crédits personnels de base. Il ne tient pas compte des cotisations REER ou de régime de retraite, des avantages imposables, des crédits familiaux, des revenus d'autres sources ni des situations particulières. Pour un calcul officiel, consultez Revenu Québec et l'Agence du revenu du Canada.</p>
    <h2>Calculer les taxes plutôt que le salaire</h2>
    <p>Vous cherchez plutôt à calculer les taxes de vente? Utilisez le <a href="/">calcul TPS TVQ</a> ou le <a href="/">calculateur de taxes Québec</a>.</p>
  </section>`
});


// EN reverse — "reverse tax calculator quebec" cluster (~3,850 searches/month, KD 2–21)
pages.push({
  url: "/reverse-tax-calculator-quebec/",
  modified: "2026-11-19",
  out: "reverse-tax-calculator-quebec/index.html",
  pair: ["/calcul-taxe-inverse-quebec/", "/reverse-tax-calculator-quebec/"],
  lang: "en",
  mode: "remove",
  title: "Reverse Tax Calculator Quebec 2026: Remove GST + QST (÷ 1.14975)",
  desc: "Reverse Quebec sales tax: divide the tax-included price by 1.14975. $114.98 = $100 before tax + $5.00 GST + $9.98 QST. Free reverse GST/QST calculator with a table of common totals.",
  h1: "Reverse Tax Calculator Quebec",
  intro: "Enter a price that already includes tax and get the amount before tax, plus the GST and QST it contains.",
  crumbs: [{ name: "Home", href: "/quebec-tax-calculator/" }, { name: "Reverse Tax Calculator Quebec", href: "/reverse-tax-calculator-quebec/" }],
  faqs: [
    { q: "How do you reverse calculate Quebec sales tax?", a: "Divide the tax-included price by 1.14975. The result is the price before tax; 5% of it is the GST and 9.975% of it is the QST." },
    { q: "What is the price before tax of $50 in Quebec?", a: "$50 ÷ 1.14975 = $43.49 before tax, with $2.17 of GST and $4.34 of QST included." },
    { q: "What percentage of a Quebec price is tax?", a: "About 13.02% of a tax-included price is tax (14.975 ÷ 114.975). Taking 14.975% off the total is a common mistake that gives too low a number." },
    { q: "Why is my reverse calculation off by a cent?", a: "Each tax is rounded to the cent on the original bill, so working backwards can differ by a cent or two from the shelf price." },
    { q: "Does the reverse calculator work for HST provinces?", a: "No. It uses Quebec's GST (5%) and QST (9.975%). HST provinces use one harmonized rate, for example 13% in Ontario. Use the <a href=\"/canada-sales-tax-calculator/\">Canada sales tax calculator</a> for other provinces." },
    { q: "How do I find only the QST included in a price?", a: "Multiply the tax-included price by 9.975 ÷ 114.975 (about 8.676%). For the GST only, multiply by 5 ÷ 114.975 (about 4.349%)." }
  ],
  body:
    quickAnswer("en", "<p>To take tax out of a Quebec price, <b>divide the total by 1.14975</b>. Example: $114.98 ÷ 1.14975 = <b>$100.00 before tax</b>, which includes $5.00 GST and $9.98 QST. About 13% of any tax-included Quebec price is tax.</p>") +
    TRUST_EN +
    `
  <section class="content" aria-labelledby="rev-en-table">
    <h2 id="rev-en-table">Price before tax for common Quebec totals</h2>
    <p>GST and QST included in each total, using 2026 rates and rounded to the cent:</p>
${removeTable("en", [1, 5, 10, 20, 25, 50, 75, 100, 114.98, 150, 200, 250, 500, 1000, 1500, 2000, 5000, 10000])}
    <h2>Reverse GST/QST formula</h2>
    <div class="formula">Price before tax = total ÷ 1.14975
GST included = price before tax × 5%
QST included = price before tax × 9.975%</div>
    <h2>Reverse vs forward: which do you need?</h2>
    <p>Use reverse when you have a receipt or a price that already includes tax and need the amount before tax, for an expense report, a bookkeeping entry or an input tax credit claim. To add tax to a price, use the <a href="/quebec-tax-calculator/">Quebec sales tax calculator</a>.</p>
    <h2>Why not just subtract 14.975%?</h2>
    <p>Tax was added on the price before tax, so it must be removed by dividing. On $114.98, subtracting 14.975% gives $97.76, which is $2.24 too low. Dividing by 1.14975 gives the correct $100.00.</p>
    <h2>Finding only the GST or the QST in a price</h2>
    <ul class="benefits">
      <li>GST included = total × 5 ÷ 114.975 (≈ 4.349%)</li>
      <li>QST included = total × 9.975 ÷ 114.975 (≈ 8.676%)</li>
      <li>All tax included = total × 14.975 ÷ 114.975 (≈ 13.025%)</li>
    </ul>
    <p>Useful for receipts, expense reports and input tax credit claims if you're self-employed. Need the French version? See the <a href="/calcul-taxe-inverse-quebec/">calcul taxes inversé</a>.</p>
  </section>`
});

// EN income tax — "quebec income tax calculator" cluster (~8,300 searches/month)
pages.push({
  url: "/quebec-income-tax-calculator/",
  out: "quebec-income-tax-calculator/index.html",
  pair: ["/calcul-salaire-net-quebec/", "/quebec-income-tax-calculator/"],
  lang: "en",
  showCalc: false,
  extraJs: ["/assets/js/salary.js"],
  featureList: ["Gross to net pay", "Federal and Quebec income tax", "QPP, EI and QPIP", "Net pay per pay period"],
  title: "Quebec Income Tax Calculator 2026: $60,000 Salary = $45,857 Net",
  desc: "Quebec income tax calculator for 2026: enter your salary to see federal and Quebec tax, QPP, EI and QPIP, and your take-home pay per year, month or paycheque.",
  h1: "Quebec Income Tax Calculator 2026",
  intro: "Enter your gross salary to estimate federal and Quebec income tax, payroll deductions and your take-home pay.",
  crumbs: [{ name: "Home", href: "/quebec-tax-calculator/" }, { name: "Quebec Income Tax Calculator", href: "/quebec-income-tax-calculator/" }],
  faqs: [
    { q: "How much tax do I pay on $60,000 in Quebec?", a: "On a $60,000 salary in 2026, total deductions (federal and Quebec income tax, QPP, EI and QPIP) are about $14,143, leaving roughly $45,857 a year, or $3,821 a month." },
    { q: "Why does Quebec have two income tax returns?", a: "Quebec collects its own provincial income tax through Revenu Québec, so residents file a federal return with the CRA and a provincial return (TP-1) with Revenu Québec." },
    { q: "What is the Quebec abatement?", a: "Quebec residents get a 16.5% reduction of basic federal tax, because Quebec funds some programs that the federal government funds elsewhere." },
    { q: "What payroll deductions come off a Quebec paycheque?", a: "Federal income tax, Quebec income tax, the Quebec Pension Plan (QPP), Employment Insurance at Quebec's reduced rate, and the Quebec Parental Insurance Plan (QPIP)." },
    { q: "Is this calculator exact?", a: "It is an estimate for a single salaried employee with basic credits. RRSP contributions, pension plans, taxable benefits and family credits change the real amount." }
  ],
  body:
    quickAnswer("en", "<p>On a <b>$60,000</b> salary in Quebec in 2026, you take home about <b>$45,857</b> a year ($3,821 a month) after federal and Quebec income tax, QPP, EI and QPIP: about 23.6% in deductions.</p>") +
    salaryCard("en") +
    `
  <div class="card info-card">
    <div class="rate-pills">
      <span class="pill">QPP <b>6.3%</b></span>
      <span class="pill">EI <b>1.30%</b></span>
      <span class="pill">QPIP <b>0.430%</b></span>
    </div>
    <p>Quebec residents pay federal tax (reduced by the 16.5% Quebec abatement), Quebec income tax, and three payroll contributions. The calculator uses 2026 parameters.</p>
    <span class="updated">2026 rates</span>
  </div>
  <section class="content" aria-labelledby="inc-table">
    <h2 id="inc-table">Take-home pay by salary in Quebec (2026)</h2>
    <table class="data-table">
      <thead><tr><th>Gross salary</th><th>Take-home pay</th><th>Per month</th><th>Deductions</th></tr></thead>
      <tbody>
        <tr><td>$30,000</td><td>$25,595</td><td>$2,133</td><td>14.7%</td></tr>
        <tr><td>$40,000</td><td>$32,429</td><td>$2,702</td><td>18.9%</td></tr>
        <tr><td>$50,000</td><td>$39,264</td><td>$3,272</td><td>21.5%</td></tr>
        <tr><td>$60,000</td><td>$45,857</td><td>$3,821</td><td>23.6%</td></tr>
        <tr><td>$75,000</td><td>$54,627</td><td>$4,552</td><td>27.2%</td></tr>
        <tr><td>$100,000</td><td>$70,262</td><td>$5,855</td><td>29.7%</td></tr>
      </tbody>
    </table>
    <h2>2026 Quebec payroll contributions</h2>
    <ul class="benefits">
      <li>QPP: 6.3% on earnings between $3,500 and $74,600, then 4% up to $85,000</li>
      <li>Employment Insurance: 1.30% up to $68,900 (Quebec's reduced rate)</li>
      <li>QPIP: 0.430% up to $103,000</li>
      <li>Federal tax: brackets from 14% to 33%, less the 16.5% Quebec abatement</li>
      <li>Quebec tax: brackets from 14% to 25.75%</li>
    </ul>
    <h2>What the estimate leaves out</h2>
    <p>It assumes employment income only and basic personal credits. RRSP or pension contributions, taxable benefits, family credits and other income change the result. For official figures, see Revenu Québec and the Canada Revenue Agency.</p>
  </section>`
});

// Welcome tax FR — "taxe de bienvenue" / "welcome tax" (KD 4–9)
const WT_PRICES = [200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 750000, 1000000, 1500000];
pages.push({
  url: "/calcul-taxe-de-bienvenue-quebec/",
  out: "calcul-taxe-de-bienvenue-quebec/index.html",
  pair: ["/calcul-taxe-de-bienvenue-quebec/", "/quebec-welcome-tax-calculator/"],
  lang: "fr",
  showCalc: false,
  extraJs: ["/assets/js/welcome.js"],
  featureList: ["Droits de mutation 2026", "Barèmes Montréal et Ville de Québec", "Crédit premier acheteur"],
  title: `Calcul Taxe de Bienvenue Québec 2026 : 500 000 $ = ${Math.round(welcomeTax(500000, WT.standard)).toLocaleString("fr-CA")} $`,
  desc: "Calculez la taxe de bienvenue 2026 au Québec : 0,5 % jusqu'à 62 900 $, 1 % jusqu'à 315 000 $, 1,5 % au-delà. Barèmes de Montréal et de Québec et crédit premier acheteur.",
  h1: "Calcul de la taxe de bienvenue au Québec (2026)",
  intro: "Entrez le prix d'achat pour obtenir les droits de mutation 2026, selon le barème provincial, de Montréal ou de la Ville de Québec, et le crédit pour premier acheteur.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Calcul taxe de bienvenue", href: "/calcul-taxe-de-bienvenue-quebec/" }],
  faqs: [
    { q: "Comment calculer la taxe de bienvenue en 2026?", a: "On applique 0,5&nbsp;% sur les premiers 62&nbsp;900&nbsp;$, 1&nbsp;% de 62&nbsp;900&nbsp;$ à 315&nbsp;000&nbsp;$ et 1,5&nbsp;% au-delà, sur le plus élevé du prix d'achat ou de la valeur au rôle." },
    { q: "Combien coûte la taxe de bienvenue sur une maison de 500 000 $?", a: `Environ ${Math.round(welcomeTax(500000, WT.standard)).toLocaleString("fr-CA")}&nbsp;$ selon le barème provincial 2026, le même montant à Montréal et à Québec, car leurs taux plus élevés commencent au-delà de 500&nbsp;000&nbsp;$ ou 552&nbsp;300&nbsp;$.` },
    { q: "La taxe de bienvenue est-elle remboursée aux premiers acheteurs?", a: "Oui, depuis 2026&nbsp;: un crédit d'impôt remboursable couvre 100&nbsp;% des premiers 5&nbsp;000&nbsp;$ de droits et 25&nbsp;% des 3&nbsp;500&nbsp;$ suivants, jusqu'à 5&nbsp;875&nbsp;$, pour une propriété de moins de 1&nbsp;M$." },
    { q: "Quand paie-t-on la taxe de bienvenue?", a: "La municipalité envoie le compte quelques semaines ou mois après l'inscription de l'acte de vente. Elle est généralement payable dans les 30 jours." },
    { q: "Pourquoi Montréal est-elle plus chère?", a: "Montréal ajoute des tranches au-delà de 552&nbsp;300&nbsp;$&nbsp;: 2&nbsp;%, 2,5&nbsp;%, 3,5&nbsp;% puis 4&nbsp;% au-delà de 3&nbsp;113&nbsp;000&nbsp;$." }
  ],
  body:
    quickAnswer("fr", `<p>En 2026, la taxe de bienvenue est de <b>0,5&nbsp;%</b> jusqu'à 62&nbsp;900&nbsp;$, <b>1&nbsp;%</b> jusqu'à 315&nbsp;000&nbsp;$ et <b>1,5&nbsp;%</b> au-delà. Sur une propriété de 500&nbsp;000&nbsp;$, c'est <b>${money(welcomeTax(500000, WT.standard), "fr")}</b>. Les premiers acheteurs peuvent récupérer jusqu'à 5&nbsp;875&nbsp;$.</p>`) +
    welcomeCard("fr") +
    `
  <section class="content" aria-labelledby="wt-table">
    <h2 id="wt-table">Taxe de bienvenue selon le prix (2026)</h2>
${welcomeTable("fr", WT_PRICES)}
    <h2>Barème 2026 des droits de mutation</h2>
    <ul class="benefits">
      <li>0,5&nbsp;% sur la tranche jusqu'à 62&nbsp;900&nbsp;$</li>
      <li>1&nbsp;% de 62&nbsp;900&nbsp;$ à 315&nbsp;000&nbsp;$</li>
      <li>1,5&nbsp;% au-delà de 315&nbsp;000&nbsp;$ (barème provincial)</li>
      <li>Montréal&nbsp;: 2&nbsp;% de 552&nbsp;300&nbsp;$ à 1&nbsp;104&nbsp;700&nbsp;$, 2,5&nbsp;% jusqu'à 2&nbsp;136&nbsp;500&nbsp;$, 3,5&nbsp;% jusqu'à 3&nbsp;113&nbsp;000&nbsp;$, 4&nbsp;% au-delà</li>
      <li>Ville de Québec&nbsp;: 2,5&nbsp;% de 500&nbsp;000&nbsp;$ à 750&nbsp;000&nbsp;$, 3&nbsp;% au-delà</li>
    </ul>
    <p>Sources&nbsp;: Québec.ca (droits sur les mutations immobilières), montreal.ca, ville.quebec.qc.ca. D'autres villes, comme Laval, peuvent aussi avoir des taux plus élevés au-delà de 500&nbsp;000&nbsp;$&nbsp;: vérifiez auprès de votre municipalité. En 2027, les tranches passent à 64&nbsp;400&nbsp;$ et 322&nbsp;600&nbsp;$.</p>
  </section>`
});

pages.push({
  url: "/quebec-welcome-tax-calculator/",
  out: "quebec-welcome-tax-calculator/index.html",
  pair: ["/calcul-taxe-de-bienvenue-quebec/", "/quebec-welcome-tax-calculator/"],
  lang: "en",
  showCalc: false,
  extraJs: ["/assets/js/welcome.js"],
  featureList: ["2026 land transfer duties", "Montreal and Quebec City scales", "First-time buyer credit"],
  title: `Quebec Welcome Tax Calculator 2026: $500,000 Home = $${Math.round(welcomeTax(500000, WT.standard)).toLocaleString("en-CA")}`,
  desc: "Calculate Quebec's 2026 welcome tax (land transfer duties): 0.5% to $62,900, 1% to $315,000, 1.5% above, plus Montreal and Quebec City scales and the first-buyer credit.",
  h1: "Quebec Welcome Tax Calculator (2026)",
  intro: "Enter the purchase price to get 2026 transfer duties on the provincial, Montreal or Quebec City scale, and the first-time buyer credit.",
  crumbs: [{ name: "Home", href: "/quebec-tax-calculator/" }, { name: "Quebec Welcome Tax Calculator", href: "/quebec-welcome-tax-calculator/" }],
  faqs: [
    { q: "How is the welcome tax calculated in Quebec?", a: "In 2026: 0.5% on the first $62,900, 1% from $62,900 to $315,000 and 1.5% above, applied to the higher of the purchase price or the assessed value." },
    { q: "How much is the welcome tax on a $500,000 house?", a: `About $${Math.round(welcomeTax(500000, WT.standard)).toLocaleString("en-CA")} on the 2026 provincial scale. Montreal and Quebec City give the same amount at $500,000 because their higher rates start above $552,300 and $500,000.` },
    { q: "Do first-time buyers get the welcome tax back?", a: "Since 2026, a refundable tax credit repays 100% of the first $5,000 of duties and 25% of the next $3,500, up to $5,875, for homes under $1 million." },
    { q: "When do you pay the welcome tax?", a: "The municipality sends the bill a few weeks or months after the deed is registered; it is usually due within 30 days." },
    { q: "Is the welcome tax the same as land transfer tax?", a: "Yes. \"Welcome tax\" is the common name for Quebec's duties on transfers of immovables (droits de mutation), paid to the municipality." }
  ],
  body:
    quickAnswer("en", `<p>In 2026, Quebec's welcome tax is <b>0.5%</b> up to $62,900, <b>1%</b> up to $315,000 and <b>1.5%</b> above. On a $500,000 home that's <b>${money(welcomeTax(500000, WT.standard), "en")}</b>. First-time buyers can get up to $5,875 back.</p>`) +
    welcomeCard("en") +
    `
  <section class="content" aria-labelledby="wt-en-table">
    <h2 id="wt-en-table">Welcome tax by home price (2026)</h2>
${welcomeTable("en", WT_PRICES)}
    <h2>2026 brackets</h2>
    <ul class="benefits">
      <li>0.5% on the portion up to $62,900</li>
      <li>1% from $62,900 to $315,000</li>
      <li>1.5% above $315,000 (provincial scale)</li>
      <li>Montreal: 2% from $552,300 to $1,104,700, 2.5% to $2,136,500, 3.5% to $3,113,000, 4% above</li>
      <li>Quebec City: 2.5% from $500,000 to $750,000, 3% above</li>
    </ul>
    <p>Sources: Québec.ca (transfer duties), montreal.ca, ville.quebec.qc.ca. Other cities such as Laval may also charge higher rates above $500,000; check with your municipality. In 2027 the brackets rise to $64,400 and $322,600.</p>
  </section>`
});

// ---------- FR: /tranches-imposition-quebec/ ----------
pages.push({
  url: "/tranches-imposition-quebec/",
  out: "tranches-imposition-quebec/index.html",
  pair: ["/tranches-imposition-quebec/", "/quebec-tax-brackets/"],
  lang: "fr",
  showCalc: false,
  extraJs: ["/assets/js/salary.js"],
  featureList: ["Tranches d'imposition du Québec 2026", "Tranches fédérales 2026", "Taux marginal combiné", "Calcul de l'impôt selon le salaire"],
  title: `Tranches d'imposition Québec 2026 : 14 % à 25,75 % (${pct(TOP_COMBINED, "fr").replace("&nbsp;", " ")} combiné)`,
  desc: `Tranches d'imposition 2026 au Québec : 14 % jusqu'à ${num(QC_BR[0][0], "en").replace(/,/g, " ")} $, 19 %, 24 % et 25,75 % au-delà de ${num(QC_BR[2][0], "en").replace(/,/g, " ")} $. Tranches fédérales, taux marginal combiné et calculateur.`,
  h1: "Tranches d'imposition Québec 2026",
  intro: "Les tranches et taux d'imposition 2026 du Québec et du fédéral, le taux marginal combiné pour un résident du Québec, et l'impôt réel selon votre revenu.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Tranches d'imposition Québec", href: "/tranches-imposition-quebec/" }],
  faqs: [
    { q: "Quelles sont les tranches d'imposition au Québec en 2026?", a: `14&nbsp;% jusqu'à ${mInt(QC_BR[0][0], "fr")}, 19&nbsp;% de ${mInt(QC_BR[0][0], "fr")} à ${mInt(QC_BR[1][0], "fr")}, 24&nbsp;% de ${mInt(QC_BR[1][0], "fr")} à ${mInt(QC_BR[2][0], "fr")} et 25,75&nbsp;% au-delà. S'y ajoute l'impôt fédéral, réduit de 16,5&nbsp;% pour les résidents du Québec.` },
    { q: "Quel est mon taux marginal à 60 000 $ au Québec?", a: `${pct(combinedRate(60000), "fr")} en 2026&nbsp;: ${pct(rateAt(FED_BR, 60000) * (1 - ABATE), "fr")} au fédéral (après abattement) et ${pct(rateAt(QC_BR, 60000), "fr")} au Québec. Chaque dollar gagné de plus est imposé à ce taux, mais pas votre revenu entier.` },
    { q: "Est-ce que tout mon revenu est imposé au taux de ma tranche?", a: "Non. Chaque taux ne s'applique qu'à la portion du revenu comprise dans sa tranche. Passer dans une tranche supérieure n'augmente l'impôt que sur les dollars au-dessus du seuil." },
    { q: "Quelle est la différence entre taux marginal et taux effectif?", a: `Le taux marginal s'applique à votre prochain dollar de revenu. Le taux effectif est l'impôt total divisé par le revenu. À 60&nbsp;000&nbsp;$, le taux marginal est de ${pct(combinedRate(60000), "fr")} alors que le taux effectif n'est que d'environ ${pct(S60.tax / 60000, "fr", 1)}.` },
    { q: "Quel est le revenu minimum imposable au Québec?", a: `Grâce au montant personnel de base (${mInt(TAXP.quebec.bpa, "fr")} au Québec, ${mInt(TAXP.federal.bpaMax, "fr")} au fédéral) et aux crédits pour cotisations, un salarié ne paie pas d'impôt du Québec avant environ ${mInt(QC_START, "fr")} de salaire, ni d'impôt fédéral avant environ ${mInt(FED_START, "fr")}.` },
    { q: "Qu'est-ce que l'abattement du Québec?", a: "Les résidents du Québec obtiennent une réduction de 16,5&nbsp;% de leur impôt fédéral de base, parce que le Québec finance lui-même certains programmes. C'est pourquoi le taux fédéral effectif de la première tranche est de 11,69&nbsp;% plutôt que 14&nbsp;%." }
  ],
  body:
    quickAnswer("fr", `<p>En 2026, l'impôt du Québec compte <b>4 tranches</b>&nbsp;: <b>14&nbsp;%</b> jusqu'à ${mInt(QC_BR[0][0], "fr")}, <b>19&nbsp;%</b> jusqu'à ${mInt(QC_BR[1][0], "fr")}, <b>24&nbsp;%</b> jusqu'à ${mInt(QC_BR[2][0], "fr")} et <b>25,75&nbsp;%</b> au-delà. Avec le fédéral, le taux marginal combiné va de <b>${pct(combinedBands()[0].total, "fr")}</b> à <b>${pct(TOP_COMBINED, "fr")}</b>. Sur 60&nbsp;000&nbsp;$, l'impôt total est d'environ <b>${mInt(S60.tax, "fr")}</b> (${pct(S60.tax / 60000, "fr", 1)}).</p>`) +
    `
  <section class="content" aria-labelledby="br-qc">
    <h2 id="br-qc">Tranches d'imposition du Québec 2026</h2>
${bracketTable("fr", QC_BR, "Taux du Québec")}
    <h2>Tranches d'imposition fédérales 2026</h2>
${bracketTable("fr", FED_BR, "Taux fédéral")}
    <p>Les résidents du Québec déduisent l'abattement de 16,5&nbsp;% de leur impôt fédéral de base. Le montant personnel de base fédéral (${mInt(TAXP.federal.bpaMax, "fr")}) diminue graduellement entre ${mInt(TAXP.federal.bpaPhaseStart, "fr")} et ${mInt(TAXP.federal.bpaPhaseEnd, "fr")}.</p>
    <h2>Taux marginal combiné Québec + fédéral (2026)</h2>
${combinedTable("fr")}
  </section>` +
    salaryCard("fr") +
    `
  <section class="content" aria-labelledby="br-eff">
    <h2 id="br-eff">Impôt réel selon le revenu (2026)</h2>
    <p>Impôt fédéral et du Québec d'un salarié avec les crédits de base, sans les cotisations RRQ, AE et RQAP&nbsp;:</p>
${taxByIncomeTable("fr")}
    <h2>Exemple&nbsp;: comment les tranches s'appliquent à 60&nbsp;000&nbsp;$</h2>
    <ul class="benefits">
      <li>Premiers ${mInt(QC_BR[0][0], "fr")} × 14&nbsp;% = ${money(EX_LOW, "fr")}</li>
      <li>${mInt(60000 - QC_BR[0][0], "fr")} restants × 19&nbsp;% = ${money(EX_HIGH, "fr")}</li>
      <li>Impôt du Québec avant crédits = ${money(r2(EX_LOW + EX_HIGH), "fr")}</li>
      <li>Moins les crédits non remboursables (montant personnel de base de ${mInt(TAXP.quebec.bpa, "fr")}, RRQ, AE, RQAP à 14&nbsp;%) et la déduction pour travailleur&nbsp;: environ <b>${mInt(S60.qc, "fr")}</b> d'impôt du Québec réellement payé.</li>
    </ul>
    <p>Résultat&nbsp;: même si votre dernier dollar est imposé à 19&nbsp;% au Québec, votre taux réel sur l'ensemble du revenu est beaucoup plus bas. Pour votre propre salaire, utilisez le calculateur ci-dessus ou le <a href="/calcul-impot-quebec/">calcul d'impôt Québec</a>.</p>
    <h2>Ce que les tranches ne disent pas</h2>
    <p>Les tranches s'appliquent au revenu imposable, après déductions comme le REER. Une cotisation REER de 1&nbsp;000&nbsp;$ à 60&nbsp;000&nbsp;$ de revenu économise donc environ ${money(r2(1000 * combinedRate(60000)), "fr")} d'impôt, soit votre taux marginal. Sources&nbsp;: Revenu Québec et Agence du revenu du Canada, paramètres 2026.</p>
  </section>`
});

// ---------- EN: /quebec-tax-brackets/ ----------
pages.push({
  url: "/quebec-tax-brackets/",
  out: "quebec-tax-brackets/index.html",
  pair: ["/tranches-imposition-quebec/", "/quebec-tax-brackets/"],
  lang: "en",
  showCalc: false,
  extraJs: ["/assets/js/salary.js"],
  featureList: ["2026 Quebec tax brackets", "2026 federal tax brackets", "Combined marginal tax rates", "Tax by salary"],
  title: `Quebec Tax Brackets 2026: 14% to 25.75% (${pct(TOP_COMBINED, "en")} Combined Top Rate)`,
  desc: `2026 Quebec income tax brackets: 14% up to $${num(QC_BR[0][0], "en")}, 19%, 24% and 25.75% over $${num(QC_BR[2][0], "en")}. Federal brackets, combined marginal rates for Quebec residents and a tax calculator.`,
  h1: "Quebec Tax Brackets 2026",
  intro: "Quebec and federal income tax brackets for 2026, the combined marginal rate a Quebec resident actually pays, and the real tax on common salaries.",
  crumbs: [{ name: "Home", href: "/quebec-tax-calculator/" }, { name: "Quebec Tax Brackets 2026", href: "/quebec-tax-brackets/" }],
  faqs: [
    { q: "What are the Quebec tax brackets for 2026?", a: `14% up to ${mInt(QC_BR[0][0], "en")}, 19% from ${mInt(QC_BR[0][0], "en")} to ${mInt(QC_BR[1][0], "en")}, 24% from ${mInt(QC_BR[1][0], "en")} to ${mInt(QC_BR[2][0], "en")} and 25.75% above. Federal tax is added on top, reduced by 16.5% for Quebec residents.` },
    { q: "What is the marginal tax rate on $60,000 in Quebec?", a: `${pct(combinedRate(60000), "en")} in 2026: ${pct(rateAt(FED_BR, 60000) * (1 - ABATE), "en")} federal (after the abatement) plus ${pct(rateAt(QC_BR, 60000), "en")} Quebec. That rate applies to your next dollar, not your whole income.` },
    { q: "What is the highest tax bracket in Quebec?", a: `25.75% on Quebec taxable income over ${mInt(QC_BR[2][0], "en")}. Combined with the top federal rate of 33% (less the abatement), the top marginal rate is ${pct(TOP_COMBINED, "en")} above ${mInt(FED_BR[3][0], "en")}.` },
    { q: "Does moving into a higher bracket reduce my take-home pay?", a: "No. Only the dollars above the threshold are taxed at the higher rate, so a raise always leaves you with more money after tax." },
    { q: "How much income is tax-free in Quebec?", a: `Thanks to the basic personal amount (${mInt(TAXP.quebec.bpa, "en")} Quebec, ${mInt(TAXP.federal.bpaMax, "en")} federal) and contribution credits, an employee pays no Quebec income tax until about ${mInt(QC_START, "en")} of salary and no federal tax until about ${mInt(FED_START, "en")}.` },
    { q: "Why is federal tax lower for Quebec residents?", a: "Quebec residents get a 16.5% abatement on basic federal tax because Quebec funds some programs itself. The lowest federal bracket is effectively 11.69% instead of 14%." }
  ],
  body:
    quickAnswer("en", `<p>Quebec has <b>4 tax brackets</b> in 2026: <b>14%</b> up to ${mInt(QC_BR[0][0], "en")}, <b>19%</b> up to ${mInt(QC_BR[1][0], "en")}, <b>24%</b> up to ${mInt(QC_BR[2][0], "en")} and <b>25.75%</b> above. With federal tax, combined marginal rates run from <b>${pct(combinedBands()[0].total, "en")}</b> to <b>${pct(TOP_COMBINED, "en")}</b>. On $60,000, total income tax is about <b>${mInt(S60.tax, "en")}</b> (${pct(S60.tax / 60000, "en", 1)}).</p>`) +
    `
  <section class="content" aria-labelledby="br-qc-en">
    <h2 id="br-qc-en">Quebec income tax brackets 2026</h2>
${bracketTable("en", QC_BR, "Quebec rate")}
    <h2>Federal income tax brackets 2026</h2>
${bracketTable("en", FED_BR, "Federal rate")}
    <p>Quebec residents subtract the 16.5% Quebec abatement from basic federal tax. The federal basic personal amount (${mInt(TAXP.federal.bpaMax, "en")}) phases down between ${mInt(TAXP.federal.bpaPhaseStart, "en")} and ${mInt(TAXP.federal.bpaPhaseEnd, "en")}.</p>
    <h2>Combined Quebec + federal marginal tax rates (2026)</h2>
${combinedTable("en")}
  </section>` +
    salaryCard("en") +
    `
  <section class="content" aria-labelledby="br-eff-en">
    <h2 id="br-eff-en">Actual income tax by salary (2026)</h2>
    <p>Federal and Quebec income tax for an employee with basic credits, excluding QPP, EI and QPIP contributions:</p>
${taxByIncomeTable("en")}
    <h2>Example: how the brackets apply to $60,000</h2>
    <ul class="benefits">
      <li>First ${mInt(QC_BR[0][0], "en")} × 14% = ${money(EX_LOW, "en")}</li>
      <li>Remaining ${mInt(60000 - QC_BR[0][0], "en")} × 19% = ${money(EX_HIGH, "en")}</li>
      <li>Quebec tax before credits = ${money(r2(EX_LOW + EX_HIGH), "en")}</li>
      <li>Less non-refundable credits (${mInt(TAXP.quebec.bpa, "en")} basic personal amount, QPP, EI, QPIP at 14%) and the worker deduction: about <b>${mInt(S60.qc, "en")}</b> of Quebec tax actually paid.</li>
    </ul>
    <p>So even though your last dollar is taxed at 19% in Quebec, your average rate is far lower. For your own salary, use the calculator above or the <a href="/quebec-income-tax-calculator/">Quebec income tax calculator</a>.</p>
    <h2>Brackets and RRSP savings</h2>
    <p>Brackets apply to taxable income, after deductions such as RRSP contributions. A $1,000 RRSP contribution at $60,000 of income saves about ${money(r2(1000 * combinedRate(60000)), "en")} in tax, your marginal rate. Sources: Revenu Québec and Canada Revenue Agency, 2026 parameters.</p>
  </section>`
});

// ---------- FR: /calcul-impot-quebec/ ----------
pages.push({
  url: "/calcul-impot-quebec/",
  out: "calcul-impot-quebec/index.html",
  lang: "fr",
  showCalc: false,
  extraJs: ["/assets/js/salary.js"],
  featureList: ["Calcul de l'impôt fédéral et du Québec", "Taux effectif et marginal", "Abattement du Québec", "Retenues sur la paie"],
  title: `Calcul Impôt Québec 2026 : 60 000 $ = ${num(Math.round(S60.tax), "en").replace(/,/g, " ")} $ d'impôt`,
  desc: `Calculez votre impôt 2026 au Québec : impôt fédéral et provincial selon votre salaire. 60 000 $ = ${num(Math.round(S60.tax), "en").replace(/,/g, " ")} $ d'impôt (${(S60.tax / 600).toFixed(1).replace(".", ",")} %). Taux effectif, taux marginal et tableau par revenu.`,
  h1: "Calcul impôt Québec 2026",
  intro: "Entrez votre revenu pour estimer votre impôt fédéral et votre impôt du Québec en 2026, avec votre taux effectif et votre salaire net.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Calcul impôt Québec", href: "/calcul-impot-quebec/" }],
  faqs: [
    { q: "Combien d'impôt paie-t-on sur 50 000 $ au Québec?", a: `Environ ${mInt(S50.tax, "fr")} en 2026&nbsp;: ${mInt(S50.fed, "fr")} d'impôt fédéral et ${mInt(S50.qc, "fr")} d'impôt du Québec, soit un taux effectif de ${pct(S50.tax / 50000, "fr", 1)}. Les cotisations RRQ, AE et RQAP s'ajoutent sur la paie.` },
    { q: "Combien d'impôt paie-t-on sur 100 000 $ au Québec?", a: `Environ ${mInt(S100.tax, "fr")} en 2026 (${mInt(S100.fed, "fr")} au fédéral et ${mInt(S100.qc, "fr")} au Québec), soit ${pct(S100.tax / 100000, "fr", 1)} du revenu. Le taux marginal à ce niveau est de ${pct(combinedRate(100000), "fr")}.` },
    { q: "Comment calculer son impôt au Québec?", a: "On applique les tranches d'imposition au revenu imposable, séparément pour le fédéral et le Québec, puis on soustrait les crédits non remboursables (montant personnel de base, cotisations). L'impôt fédéral est ensuite réduit de l'abattement du Québec de 16,5&nbsp;%." },
    { q: "Pourquoi fait-on deux déclarations de revenus au Québec?", a: "Le Québec perçoit lui-même son impôt provincial. Les résidents produisent donc une déclaration fédérale (Agence du revenu du Canada) et une déclaration du Québec (TP-1, Revenu Québec)." },
    { q: "Le calcul d'impôt est-il exact?", a: "C'est une estimation fiable pour un salarié avec les crédits de base. Les REER, frais de garde, dons, revenus de placement ou crédits familiaux changent le montant réel. Pour un calcul officiel, utilisez un logiciel autorisé par Revenu Québec." }
  ],
  body:
    quickAnswer("fr", `<p>Sur un salaire de <b>60&nbsp;000&nbsp;$</b> en 2026, l'impôt est d'environ <b>${mInt(S60.tax, "fr")}</b>&nbsp;: ${mInt(S60.fed, "fr")} au fédéral et ${mInt(S60.qc, "fr")} au Québec, soit un taux effectif de <b>${pct(S60.tax / 60000, "fr", 1)}</b>. Votre taux marginal est de ${pct(combinedRate(60000), "fr")}.</p>`) +
    salaryCard("fr") +
    `
  <section class="content" aria-labelledby="imp-table">
    <h2 id="imp-table">Impôt selon le revenu au Québec (2026)</h2>
${taxByIncomeTable("fr")}
    <p>Salarié résidant au Québec, crédits de base. Le taux effectif est l'impôt total divisé par le revenu&nbsp;; le taux marginal est celui de votre prochain dollar gagné.</p>
    <h2>Comment l'impôt est calculé, étape par étape</h2>
    <ul class="benefits">
      <li>Revenu imposable&nbsp;: salaire moins les déductions (cotisation RRQ bonifiée, déduction pour travailleur au Québec, REER).</li>
      <li>Impôt du Québec&nbsp;: tranches de 14&nbsp;% à 25,75&nbsp;% (voir les <a href="/tranches-imposition-quebec/">tranches d'imposition 2026</a>).</li>
      <li>Impôt fédéral&nbsp;: tranches de 14&nbsp;% à 33&nbsp;%.</li>
      <li>Crédits non remboursables&nbsp;: montant personnel de base (${mInt(TAXP.quebec.bpa, "fr")} au Québec, ${mInt(TAXP.federal.bpaMax, "fr")} au fédéral), RRQ, AE et RQAP.</li>
      <li>Abattement du Québec&nbsp;: l'impôt fédéral de base est réduit de 16,5&nbsp;%.</li>
    </ul>
    <h2>À partir de quel revenu paie-t-on de l'impôt?</h2>
    <p>Un salarié commence à payer de l'impôt du Québec vers ${mInt(QC_START, "fr")} de salaire et de l'impôt fédéral vers ${mInt(FED_START, "fr")}, grâce au montant personnel de base et aux crédits pour cotisations. Les cotisations RRQ, AE et RQAP, elles, s'appliquent dès le premier dollar (RRQ au-delà de 3&nbsp;500&nbsp;$).</p>
    <h2>Impôt, salaire net ou paie?</h2>
    <p>Pour le montant déposé à chaque paie, utilisez le <a href="/calcul-paie-net-quebec/">calcul de paie nette</a>. Pour le net annuel, le <a href="/calcul-salaire-net-quebec/">calcul du salaire net</a>.</p>
  </section>`
});

// ---------- FR: /calcul-paie-net-quebec/ ----------
const P60 = netPay(60000), P50 = netPay(50000), H25 = netPay(25 * 2080);
pages.push({
  url: "/calcul-paie-net-quebec/",
  out: "calcul-paie-net-quebec/index.html",
  pair: ["/calcul-paie-net-quebec/", "/quebec-paycheck-calculator/"],
  lang: "fr",
  showCalc: false,
  extraJs: ["/assets/js/salary.js"],
  featureList: ["Paie nette par semaine, aux 2 semaines ou par mois", "Taux horaire", "Impôts, RRQ, AE et RQAP"],
  title: `Calcul Paie Net Québec 2026 : 60 000 $ = ${num(Math.round(P60.net / 26), "en").replace(/,/g, " ")} $ aux 2 semaines`,
  desc: `Simulation de paie nette au Québec (2026) : entrez votre salaire ou taux horaire et obtenez votre paie nette par semaine, aux 2 semaines ou par mois après impôts, RRQ, AE et RQAP.`,
  h1: "Calcul de paie nette Québec 2026",
  intro: "Entrez votre salaire ou votre taux horaire pour voir le montant net déposé à chaque paie, après impôts et cotisations.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Calcul paie net Québec", href: "/calcul-paie-net-quebec/" }],
  faqs: [
    { q: "Combien reçoit-on aux 2 semaines avec 50 000 $ par année?", a: `Environ ${money(r2(P50.net / 26), "fr")} net aux 2 semaines en 2026, soit ${money(r2(P50.net / 12), "fr")} par mois, après impôts fédéral et provincial, RRQ, assurance-emploi et RQAP.` },
    { q: "Combien fait 25 $ de l'heure net au Québec?", a: `À 40&nbsp;heures par semaine, 25&nbsp;$/h donne ${mInt(25 * 2080, "fr")} brut par année et environ ${money(r2(H25.net / 26), "fr")} net aux 2 semaines, soit ${money(r2(H25.net / 2080), "fr")} net de l'heure.` },
    { q: "Quelles retenues sont prélevées sur une paie au Québec?", a: "Impôt fédéral, impôt du Québec, RRQ, assurance-emploi (taux réduit du Québec) et RQAP. Votre employeur peut aussi retenir des cotisations syndicales, un régime de retraite ou d'assurance collective." },
    { q: "Pourquoi ma paie réelle diffère-t-elle un peu?", a: "L'employeur utilise les tables de retenues (formulaires TP-1015.3 et TD1) et vos déductions propres. Le RRQ et l'AE cessent aussi d'être prélevés une fois le maximum annuel atteint, donc les dernières paies de l'année peuvent être plus élevées." },
    { q: "Combien de paies y a-t-il par année?", a: "26 paies aux 2 semaines, 52 paies par semaine, 24 paies deux fois par mois ou 12 paies mensuelles. Certaines années comptent 27 paies aux 2 semaines selon le calendrier." }
  ],
  body:
    quickAnswer("fr", `<p>Avec un salaire de <b>60&nbsp;000&nbsp;$</b> en 2026, votre paie nette est d'environ <b>${money(r2(P60.net / 26), "fr")} aux 2 semaines</b> (${money(r2(P60.net / 52), "fr")} par semaine, ${money(r2(P60.net / 12), "fr")} par mois). À <b>25&nbsp;$/h</b> et 40&nbsp;h, c'est environ ${money(r2(H25.net / 26), "fr")} aux 2 semaines.</p>`) +
    salaryCard("fr", { main: "biweek" }) +
    `
  <section class="content" aria-labelledby="paie-table">
    <h2 id="paie-table">Paie nette selon le salaire (2026)</h2>
${payTable("fr")}
    <h2>Paie nette selon le taux horaire (40 h/semaine)</h2>
${hourlyTable("fr")}
    <h2>Ce qui est retenu sur chaque paie</h2>
    <ul class="benefits">
      <li>Impôt fédéral, réduit de l'abattement du Québec de 16,5&nbsp;%</li>
      <li>Impôt du Québec — <a href="/tranches-imposition-quebec/">tranches de 14&nbsp;% à 25,75&nbsp;%</a></li>
      <li>RRQ — 6,3&nbsp;% entre 3&nbsp;500&nbsp;$ et 74&nbsp;600&nbsp;$, puis 4&nbsp;% jusqu'à 85&nbsp;000&nbsp;$</li>
      <li>Assurance-emploi — 1,30&nbsp;% jusqu'à 68&nbsp;900&nbsp;$</li>
      <li>RQAP — 0,430&nbsp;% jusqu'à 103&nbsp;000&nbsp;$</li>
    </ul>
    <p>Le calcul répartit les retenues annuelles également sur chaque paie. Pour l'impôt seulement, voyez le <a href="/calcul-impot-quebec/">calcul d'impôt Québec</a>&nbsp;; pour le net annuel, le <a href="/calcul-salaire-net-quebec/">calcul du salaire net</a>.</p>
  </section>`
});

// ---------- EN: /quebec-paycheck-calculator/ ----------
pages.push({
  url: "/quebec-paycheck-calculator/",
  out: "quebec-paycheck-calculator/index.html",
  pair: ["/calcul-paie-net-quebec/", "/quebec-paycheck-calculator/"],
  lang: "en",
  showCalc: false,
  extraJs: ["/assets/js/salary.js"],
  featureList: ["Net pay per week, every 2 weeks or per month", "Hourly wage", "Taxes, QPP, EI and QPIP"],
  title: `Quebec Paycheck Calculator 2026: $60,000 = $${num(Math.round(P60.net / 26), "en")} Every 2 Weeks`,
  desc: "Quebec paycheck calculator for 2026: enter your salary or hourly wage to see your take-home pay per week, every two weeks or per month after tax, QPP, EI and QPIP.",
  h1: "Quebec Paycheck Calculator 2026",
  intro: "Enter your salary or hourly wage to see the take-home pay deposited each payday, after income tax and payroll contributions.",
  crumbs: [{ name: "Home", href: "/quebec-tax-calculator/" }, { name: "Quebec Paycheck Calculator", href: "/quebec-paycheck-calculator/" }],
  faqs: [
    { q: "How much is a $50,000 salary every two weeks in Quebec?", a: `About ${money(r2(P50.net / 26), "en")} net every two weeks in 2026, or ${money(r2(P50.net / 12), "en")} a month, after federal and Quebec tax, QPP, EI and QPIP.` },
    { q: "How much is $25 an hour after tax in Quebec?", a: `At 40 hours a week, $25/h is ${mInt(25 * 2080, "en")} a year gross and about ${money(r2(H25.net / 26), "en")} net every two weeks, or ${money(r2(H25.net / 2080), "en")} net per hour.` },
    { q: "What is deducted from a Quebec paycheque?", a: "Federal income tax, Quebec income tax, the Quebec Pension Plan (QPP), Employment Insurance at Quebec's reduced rate, and the Quebec Parental Insurance Plan (QPIP). Employers may also deduct union dues, pension or group insurance." },
    { q: "Why is my actual paycheque slightly different?", a: "Employers use payroll withholding tables and your own TD1 / TP-1015.3 forms. QPP and EI also stop once the annual maximum is reached, so late-year paycheques can be higher." },
    { q: "Why is take-home pay lower in Quebec than in Ontario?", a: "Quebec's provincial income tax is higher, partly offset by the 16.5% federal abatement and lower EI. In exchange, Quebec funds programs like subsidized daycare and QPIP parental leave." }
  ],
  body:
    quickAnswer("en", `<p>On a <b>$60,000</b> salary in 2026, your Quebec paycheque is about <b>${money(r2(P60.net / 26), "en")} every two weeks</b> (${money(r2(P60.net / 52), "en")} weekly, ${money(r2(P60.net / 12), "en")} monthly). At <b>$25/hour</b> and 40 hours, it's about ${money(r2(H25.net / 26), "en")} every two weeks.</p>`) +
    salaryCard("en", { main: "biweek" }) +
    `
  <section class="content" aria-labelledby="pay-table-en">
    <h2 id="pay-table-en">Take-home pay by salary in Quebec (2026)</h2>
${payTable("en")}
    <h2>Take-home pay by hourly wage (40 h/week)</h2>
${hourlyTable("en")}
    <h2>What comes off each paycheque</h2>
    <ul class="benefits">
      <li>Federal income tax, less the 16.5% Quebec abatement</li>
      <li>Quebec income tax — <a href="/quebec-tax-brackets/">brackets from 14% to 25.75%</a></li>
      <li>QPP: 6.3% between $3,500 and $74,600, then 4% up to $85,000</li>
      <li>Employment Insurance: 1.30% up to $68,900</li>
      <li>QPIP: 0.430% up to $103,000</li>
    </ul>
    <p>The calculator spreads annual deductions evenly across pay periods. For annual figures, see the <a href="/quebec-income-tax-calculator/">Quebec income tax calculator</a>.</p>
  </section>`
});

// ---------- EN: /quebec-tax-rate/ (pair of /taux-tps-tvq-quebec/) ----------
pages.push({
  url: "/quebec-tax-rate/",
  out: "quebec-tax-rate/index.html",
  pair: ["/taux-tps-tvq-quebec/", "/quebec-tax-rate/"],
  lang: "en",
  mode: "add",
  title: "Quebec Tax Rate 2026: 14.975% (GST 5% + QST 9.975%)",
  desc: "The Quebec sales tax rate in 2026 is 14.975%: 5% GST plus 9.975% QST. $100 before tax = $114.98. Compare with Ontario (13% HST) and every other province.",
  h1: "Quebec Tax Rate 2026",
  intro: "The sales tax rate in Quebec, how it's applied, and how it compares with the other provinces. Enter an amount to add the tax.",
  crumbs: [{ name: "Home", href: "/quebec-tax-calculator/" }, { name: "Quebec Tax Rate", href: "/quebec-tax-rate/" }],
  faqs: [
    { q: "What is the sales tax in Quebec?", a: "14.975% in total: the 5% federal GST plus the 9.975% Quebec Sales Tax (QST), both calculated on the price before tax." },
    { q: "How much is tax on $100 in Quebec?", a: "$14.98: $5.00 GST plus $9.98 QST, for a total of $114.98." },
    { q: "Is Quebec tax higher than Ontario?", a: "Yes. Quebec's combined 14.975% is about 2 points higher than Ontario's 13% HST. On $100, you pay $114.98 in Quebec and $113.00 in Ontario." },
    { q: "Does Quebec have HST?", a: "No. Quebec charges two separate taxes, the GST (5%) and the QST (9.975%). HST is used in Ontario and the Atlantic provinces." },
    { q: "What is the Quebec income tax rate?", a: "Quebec income tax runs from 14% to 25.75% in 2026, on top of federal tax. See the <a href=\"/quebec-tax-brackets/\">2026 Quebec tax brackets</a>." }
  ],
  body:
    quickAnswer("en", "<p>The Quebec sales tax rate is <b>14.975%</b>: <b>5% GST</b> (federal) + <b>9.975% QST</b> (provincial). Multiply a price by <b>1.14975</b> to get the total: $100 before tax = <b>$114.98</b>. Rates are unchanged in 2026.</p>") +
    TRUST_EN +
    `
  <section class="content" aria-labelledby="rate-en-table">
    <h2 id="rate-en-table">Quebec sales tax on common amounts</h2>
${addTable("en", [1, 5, 10, 20, 25, 50, 75, 100, 200, 500, 1000, 5000])}
    <h2>Sales tax rates by province (2026)</h2>
${provinceTable("en")}
    <h2>How the Quebec tax rate is applied</h2>
    <p>Both taxes are calculated on the price before tax: the QST is not charged on the GST. Each tax is rounded to the cent, which is why $100 gives $114.98, not $114.975. To take tax out of a total, divide by 1.14975 with the <a href="/reverse-tax-calculator-quebec/">reverse tax calculator</a>.</p>
    <h2>Looking for the income tax rate?</h2>
    <p>Quebec income tax is separate from sales tax: brackets from 14% to 25.75% in 2026, plus federal tax. See the <a href="/quebec-tax-brackets/">Quebec tax brackets</a> or estimate your tax with the <a href="/quebec-income-tax-calculator/">income tax calculator</a>.</p>
  </section>`
});

// ---------- Canada sales tax calculator (FR/EN) + Ontario HST (FR/EN) ----------
/* Keyword clusters (Semrush CA export, 2026-11-17; the export is Quebec-seeded, so Canada-wide volume is understated):
 *   ontario taxes / taxes in ontario / taxe ontario / how to calculate tax in ontario … (~10,600/mo, "ontario taxes" KD 14)
 *   how to calculate tax in canada (KD 5) / calcul taxes canada / tax calculator canada quebec (~2,500/mo)
 *   bc tax, manitoba tax, taxes in saskatchewan, nova scotia taxes … (answered by the province table) */
const ON = PROV_BY.on, QC = PROV_BY.qc;
const CA_FAQ_FR = [
  { q: "Quel est le taux de taxe de vente au Canada?", a: "La TPS fédérale de 5&nbsp;% s'applique partout. Selon la province, s'ajoute une taxe provinciale (TVP, TVD ou TVQ) ou la TPS est remplacée par une TVH. Le total va de 5&nbsp;% (Alberta et territoires) à 15&nbsp;% (Nouveau-Brunswick, Terre-Neuve-et-Labrador, Île-du-Prince-Édouard)." },
  { q: "Quelles provinces ont la TVH?", a: "L'Ontario (13&nbsp;%), la Nouvelle-Écosse (14&nbsp;%), le Nouveau-Brunswick, Terre-Neuve-et-Labrador et l'Île-du-Prince-Édouard (15&nbsp;%). La TVH combine la TPS et la part provinciale en une seule taxe." },
  { q: "Comment calculer les taxes au Canada?", a: "Multipliez le prix avant taxes par le taux total de la province&nbsp;: 1,13 en Ontario, 1,12 en Colombie-Britannique, 1,14975 au Québec, 1,05 en Alberta. Pour retirer les taxes, divisez le total par ce même nombre." },
  { q: "Quelle province a les taxes les plus basses?", a: "L'Alberta, le Yukon, les Territoires du Nord-Ouest et le Nunavut n'ont que la TPS de 5&nbsp;%. Le Québec (14,975&nbsp;%) et les provinces à TVH de 15&nbsp;% sont les plus élevés." },
  { q: "La taxe provinciale est-elle calculée sur la TPS?", a: "Non. Dans les provinces avec TVP, TVD ou TVQ, la taxe provinciale est calculée sur le prix avant taxes, comme la TPS. Les deux taux s'additionnent donc simplement." },
  { q: "Quelle taxe paie-t-on en achetant en ligne dans une autre province?", a: "En général, la taxe de la province de livraison. Un achat livré en Ontario porte la TVH de 13&nbsp;%, même si le vendeur est au Québec." }
];
const CA_FAQ_EN = [
  { q: "What is the sales tax rate in Canada?", a: "The 5% federal GST applies everywhere. Depending on the province, a provincial tax (PST, RST or QST) is added, or the GST is replaced by a single HST. Totals range from 5% (Alberta and the territories) to 15% (New Brunswick, Newfoundland and Labrador, Prince Edward Island)." },
  { q: "Which provinces have HST?", a: "Ontario (13%), Nova Scotia (14%), New Brunswick, Newfoundland and Labrador and Prince Edward Island (15%). HST combines the GST and the provincial portion into one tax." },
  { q: "How do you calculate sales tax in Canada?", a: "Multiply the price before tax by the province's total rate: 1.13 in Ontario, 1.12 in British Columbia, 1.14975 in Quebec, 1.05 in Alberta. To remove tax, divide the total by the same number." },
  { q: "Which province has the lowest sales tax?", a: "Alberta, Yukon, the Northwest Territories and Nunavut charge only the 5% GST. Quebec (14.975%) and the 15% HST provinces are the highest." },
  { q: "Is PST charged on top of GST?", a: "No. In provinces with PST, RST or QST, the provincial tax is calculated on the price before tax, just like the GST, so the two rates simply add up." },
  { q: "Which tax applies when I buy online from another province?", a: "Generally the tax of the province where the item is delivered. An order shipped to Ontario carries 13% HST even if the seller is in Quebec." }
];

pages.push({
  url: "/calcul-taxes-canada/",
  out: "calcul-taxes-canada/index.html",
  pair: ["/calcul-taxes-canada/", "/canada-sales-tax-calculator/"],
  lang: "fr",
  showCalc: false,
  extraJs: ["/assets/js/canada.js"],
  featureList: ["TPS, TVH, TVP et TVQ des 13 provinces et territoires", "Ajouter ou retirer les taxes", "Taux 2026"],
  title: "Calcul Taxes Canada 2026 : TPS, TVH et TVP par province (5 % à 15 %)",
  desc: "Calculez les taxes de vente partout au Canada : TPS 5 %, TVH 13 % à 15 %, TVP et TVQ. Ontario 100 $ = 113,00 $, Québec 114,98 $, Alberta 105,00 $. Ajoutez ou retirez les taxes.",
  h1: "Calcul des taxes au Canada par province",
  intro: "Choisissez la province ou le territoire, entrez un montant, et obtenez la TPS, la TVH ou la taxe provinciale et le total. Fonctionne aussi pour retirer les taxes.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Calcul taxes Canada", href: "/calcul-taxes-canada/" }],
  faqs: CA_FAQ_FR,
  body:
    quickAnswer("fr", `<p>Au Canada, la taxe de vente va de <b>5&nbsp;%</b> à <b>15&nbsp;%</b> selon la province. Sur 100&nbsp;$&nbsp;: <b>113,00&nbsp;$</b> en Ontario (TVH 13&nbsp;%), <b>112,00&nbsp;$</b> en Colombie-Britannique et au Manitoba, <b>114,98&nbsp;$</b> au Québec, <b>105,00&nbsp;$</b> en Alberta et <b>115,00&nbsp;$</b> dans les provinces à TVH de 15&nbsp;%.</p>`) +
    canadaCard("fr", "on") +
    `
  <section class="content" aria-labelledby="ca-table">
    <h2 id="ca-table">Taux de taxes de vente par province (2026)</h2>
${provinceTable("fr")}
    <h2>Taxes sur un achat de 1&nbsp;000&nbsp;$ selon la province</h2>
${provCompareTable("fr", 1000)}
    <h2>TPS, TVH, TVP, TVQ&nbsp;: quelle différence?</h2>
    <ul class="benefits">
      <li><b>TPS</b> (5&nbsp;%)&nbsp;: taxe fédérale, seule taxe en Alberta et dans les territoires.</li>
      <li><b>TVH</b>&nbsp;: TPS et taxe provinciale fusionnées en une seule taxe (Ontario et provinces de l'Atlantique).</li>
      <li><b>TVP / TVD</b>&nbsp;: taxe provinciale distincte en Colombie-Britannique (7&nbsp;%), en Saskatchewan (6&nbsp;%) et au Manitoba (7&nbsp;%).</li>
      <li><b>TVQ</b> (9,975&nbsp;%)&nbsp;: taxe de vente du Québec, perçue par Revenu Québec. Voir le <a href="/">calcul TPS TVQ</a>.</li>
    </ul>
    <h2>Comment calculer les taxes dans chaque province</h2>
    <p>Multipliez le prix avant taxes par 1 + le taux total&nbsp;: × 1,13 en Ontario, × 1,15 au Nouveau-Brunswick, × 1,12 en Colombie-Britannique, × 1,05 en Alberta. Pour retirer les taxes d'un total, divisez par ce même nombre, comme dans le <a href="/calcul-taxe-inverse-quebec/">calcul de taxe inverse</a>. Chaque taxe est arrondie au cent près.</p>
    <p class="note">Taux en vigueur en 2026 selon l'Agence du revenu du Canada et les ministères des Finances provinciaux. La Nouvelle-Écosse est passée de 15&nbsp;% à 14&nbsp;% le 1<sup>er</sup> avril 2025. Certains biens sont détaxés ou exonérés (épicerie de base, par exemple).</p>
  </section>`
});

pages.push({
  url: "/canada-sales-tax-calculator/",
  out: "canada-sales-tax-calculator/index.html",
  pair: ["/calcul-taxes-canada/", "/canada-sales-tax-calculator/"],
  lang: "en",
  showCalc: false,
  extraJs: ["/assets/js/canada.js"],
  featureList: ["GST, HST, PST and QST for all 13 provinces and territories", "Add or remove tax", "2026 rates"],
  title: "Canada Sales Tax Calculator 2026: GST, HST & PST by Province (5% to 15%)",
  desc: "Calculate sales tax anywhere in Canada: GST 5%, HST 13% to 15%, PST and QST. Ontario $100 = $113.00, BC $112.00, Quebec $114.98, Alberta $105.00. Add or remove tax.",
  h1: "Canada Sales Tax Calculator",
  intro: "Pick a province or territory, enter an amount, and get the GST, HST or provincial tax and the total. Works in reverse to remove tax too.",
  crumbs: [{ name: "Home", href: "/quebec-tax-calculator/" }, { name: "Canada Sales Tax Calculator", href: "/canada-sales-tax-calculator/" }],
  faqs: CA_FAQ_EN,
  body:
    quickAnswer("en", `<p>Sales tax in Canada ranges from <b>5%</b> to <b>15%</b> depending on the province. On $100: <b>$113.00</b> in Ontario (13% HST), <b>$112.00</b> in British Columbia and Manitoba, <b>$114.98</b> in Quebec, <b>$105.00</b> in Alberta and <b>$115.00</b> in the 15% HST provinces.</p>`) +
    canadaCard("en", "on") +
    `
  <section class="content" aria-labelledby="ca-table-en">
    <h2 id="ca-table-en">Sales tax rates by province (2026)</h2>
${provinceTable("en")}
    <h2>Sales tax on a $1,000 purchase by province</h2>
${provCompareTable("en", 1000)}
    <h2>GST, HST, PST, QST: what's the difference?</h2>
    <ul class="benefits">
      <li><b>GST</b> (5%): the federal tax, and the only one in Alberta and the territories.</li>
      <li><b>HST</b>: GST and provincial tax merged into one (Ontario and the Atlantic provinces).</li>
      <li><b>PST / RST</b>: a separate provincial tax in British Columbia (7%), Saskatchewan (6%) and Manitoba (7%).</li>
      <li><b>QST</b> (9.975%): the Quebec Sales Tax, collected by Revenu Québec. See the <a href="/quebec-tax-calculator/">Quebec sales tax calculator</a>.</li>
    </ul>
    <h2>How to calculate sales tax in each province</h2>
    <p>Multiply the price before tax by 1 + the total rate: × 1.13 in Ontario, × 1.15 in New Brunswick, × 1.12 in British Columbia, × 1.05 in Alberta. To remove tax from a total, divide by the same number, as in the <a href="/reverse-tax-calculator-quebec/">reverse tax calculator</a>. Each tax is rounded to the cent.</p>
    <p class="note">Rates in force in 2026 per the Canada Revenue Agency and provincial finance ministries. Nova Scotia's HST dropped from 15% to 14% on April 1, 2025. Some items are zero-rated or exempt (basic groceries, for example).</p>
  </section>`
});

const ON_AMOUNTS = [1, 5, 10, 20, 25, 50, 75, 100, 200, 500, 1000, 5000];
const ON_TOTALS = [10, 20, 50, 100, 113, 200, 500, 1000, 5000];
const QC_VS_ON = [100, 1000, 30000];
function qcVsOnTable(lang) {
  const fr = lang !== "en";
  const rows = QC_VS_ON.map((a) => { const o = provTax(ON, a), q = provTax(QC, a); return `<tr><td>${moneyInt(a, lang)}</td><td>${money(o.tax, lang)}</td><td>${money(q.tax, lang)}</td><td>${money(r2(q.tax - o.tax), lang)}</td></tr>`; }).join("\n        ");
  return `    <table class="data-table">
      <thead><tr><th>${fr ? "Achat" : "Purchase"}</th><th>${fr ? "Ontario (13&nbsp;%)" : "Ontario (13%)"}</th><th>${fr ? "Québec (14,975&nbsp;%)" : "Quebec (14.975%)"}</th><th>${fr ? "Écart" : "Difference"}</th></tr></thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}

pages.push({
  url: "/calcul-taxes-ontario/",
  out: "calcul-taxes-ontario/index.html",
  pair: ["/calcul-taxes-ontario/", "/ontario-sales-tax-calculator/"],
  lang: "fr",
  showCalc: false,
  extraJs: ["/assets/js/canada.js"],
  featureList: ["TVH de l'Ontario 13 %", "Ajouter ou retirer la TVH", "Comparaison Québec–Ontario"],
  title: "Calcul Taxes Ontario 2026 : TVH 13 % (100 $ = 113,00 $)",
  desc: "Calculez les taxes en Ontario : TVH de 13 % (5 % fédéral + 8 % provincial). 100 $ avant taxes = 113,00 $. Retirez la TVH d'un prix : divisez par 1,13. Tableau et comparaison avec le Québec.",
  h1: "Calcul des taxes en Ontario (TVH 13 %)",
  intro: "Entrez un montant pour ajouter ou retirer la TVH de 13&nbsp;% de l'Ontario. Changez de province au besoin.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Calcul taxes Canada", href: "/calcul-taxes-canada/" }, { name: "Calcul taxes Ontario", href: "/calcul-taxes-ontario/" }],
  faqs: [
    { q: "Quelle est la taxe en Ontario?", a: "La TVH (taxe de vente harmonisée) de 13&nbsp;%&nbsp;: 5&nbsp;% fédéral et 8&nbsp;% provincial, perçus en une seule taxe." },
    { q: "Comment calculer la TVH en Ontario?", a: "Multipliez le prix avant taxes par 0,13 pour obtenir la TVH, ou par 1,13 pour le total. Exemple&nbsp;: 50&nbsp;$ × 1,13 = 56,50&nbsp;$." },
    { q: "Comment retirer la TVH d'un prix en Ontario?", a: "Divisez le prix taxes incluses par 1,13. Exemple&nbsp;: 113&nbsp;$ ÷ 1,13 = 100&nbsp;$ avant taxes, dont 13&nbsp;$ de TVH." },
    { q: "Les taxes sont-elles plus basses en Ontario qu'au Québec?", a: `Oui, d'environ 2 points&nbsp;: 13&nbsp;% contre 14,975&nbsp;%. Sur un achat de 1&nbsp;000&nbsp;$, on paie ${money(provTax(ON, 1000).tax, "fr")} de taxes en Ontario et ${money(provTax(QC, 1000).tax, "fr")} au Québec.` },
    { q: "Quels produits ont une remise de TVH en Ontario?", a: "L'Ontario rembourse au point de vente sa part de 8&nbsp;% sur les vêtements et chaussures pour enfants, les couches, les sièges d'auto pour enfants, les livres imprimés et les repas de 4&nbsp;$ ou moins. On ne paie alors que 5&nbsp;%. L'épicerie de base est détaxée." }
  ],
  body:
    quickAnswer("fr", "<p>En Ontario, la taxe de vente est la <b>TVH de 13&nbsp;%</b> (5&nbsp;% fédéral + 8&nbsp;% provincial). Multipliez par <b>1,13</b> pour le total&nbsp;: 100&nbsp;$ = <b>113,00&nbsp;$</b>. Pour retirer la TVH, divisez par 1,13. C'est environ 2 points de moins qu'au Québec (14,975&nbsp;%).</p>") +
    canadaCard("fr", "on") +
    `
  <section class="content" aria-labelledby="on-table">
    <h2 id="on-table">TVH de l'Ontario sur des montants courants</h2>
${provAmountTable("fr", ON, ON_AMOUNTS)}
    <h2>Retirer la TVH&nbsp;: prix avant taxes</h2>
${provRemoveTable("fr", ON, ON_TOTALS)}
    <h2>Taxes Québec vs Ontario</h2>
${qcVsOnTable("fr")}
    <p>Le Québec perçoit deux taxes (TPS et TVQ) alors que l'Ontario n'en perçoit qu'une (TVH). Voir le <a href="/">calcul TPS TVQ</a> pour le Québec ou le <a href="/calcul-taxes-canada/">calcul des taxes au Canada</a> pour les autres provinces.</p>
    <h2>Remise de la part ontarienne</h2>
    <p>Sur certains articles, l'Ontario ne perçoit pas sa part de 8&nbsp;% et seul 5&nbsp;% s'applique&nbsp;: vêtements et chaussures pour enfants, couches, sièges d'auto pour enfants, livres imprimés, journaux et repas ou boissons de 4&nbsp;$ ou moins. L'épicerie de base et les médicaments sur ordonnance ne sont pas taxés.</p>
  </section>`
});

pages.push({
  url: "/ontario-sales-tax-calculator/",
  out: "ontario-sales-tax-calculator/index.html",
  pair: ["/calcul-taxes-ontario/", "/ontario-sales-tax-calculator/"],
  lang: "en",
  showCalc: false,
  extraJs: ["/assets/js/canada.js"],
  featureList: ["Ontario HST 13%", "Add or remove HST", "Ontario vs Quebec comparison"],
  title: "Ontario Sales Tax Calculator 2026: HST 13% ($100 = $113.00)",
  desc: "Calculate Ontario sales tax: 13% HST (5% federal + 8% provincial). $100 before tax = $113.00. Remove HST from a price by dividing by 1.13. Tables and Ontario vs Quebec comparison.",
  h1: "Ontario Sales Tax Calculator (HST 13%)",
  intro: "Enter an amount to add or remove Ontario's 13% HST. Switch province if you need to.",
  crumbs: [{ name: "Home", href: "/quebec-tax-calculator/" }, { name: "Canada Sales Tax Calculator", href: "/canada-sales-tax-calculator/" }, { name: "Ontario Sales Tax Calculator", href: "/ontario-sales-tax-calculator/" }],
  faqs: [
    { q: "What is the sales tax in Ontario?", a: "13% HST (Harmonized Sales Tax): 5% federal and 8% provincial, charged as a single tax." },
    { q: "How do you calculate HST in Ontario?", a: "Multiply the price before tax by 0.13 for the HST, or by 1.13 for the total. Example: $50 × 1.13 = $56.50." },
    { q: "How do you remove HST from a price in Ontario?", a: "Divide the tax-included price by 1.13. Example: $113 ÷ 1.13 = $100 before tax, including $13 of HST." },
    { q: "Are taxes lower in Ontario than in Quebec?", a: `Yes, by about 2 points: 13% versus 14.975%. On a $1,000 purchase you pay ${money(provTax(ON, 1000).tax, "en")} of tax in Ontario and ${money(provTax(QC, 1000).tax, "en")} in Quebec.` },
    { q: "Which items get an HST rebate in Ontario?", a: "Ontario rebates its 8% portion at the till on children's clothing and footwear, diapers, children's car seats, printed books and meals of $4 or less, so only 5% applies. Basic groceries are zero-rated." }
  ],
  body:
    quickAnswer("en", "<p>Ontario's sales tax is the <b>13% HST</b> (5% federal + 8% provincial). Multiply by <b>1.13</b> for the total: $100 = <b>$113.00</b>. To remove HST, divide by 1.13. That's about 2 points less than Quebec (14.975%).</p>") +
    canadaCard("en", "on") +
    `
  <section class="content" aria-labelledby="on-table-en">
    <h2 id="on-table-en">Ontario HST on common amounts</h2>
${provAmountTable("en", ON, ON_AMOUNTS)}
    <h2>Removing HST: price before tax</h2>
${provRemoveTable("en", ON, ON_TOTALS)}
    <h2>Quebec vs Ontario sales tax</h2>
${qcVsOnTable("en")}
    <p>Quebec charges two taxes (GST and QST) while Ontario charges one (HST). See the <a href="/quebec-tax-calculator/">Quebec sales tax calculator</a> or the <a href="/canada-sales-tax-calculator/">Canada sales tax calculator</a> for other provinces.</p>
    <h2>Ontario point-of-sale rebate</h2>
    <p>On some items Ontario doesn't charge its 8% portion, so only 5% applies: children's clothing and footwear, diapers, children's car seats, printed books, newspapers, and prepared food and drinks of $4 or less. Basic groceries and prescription drugs are not taxed.</p>
  </section>`
});

/* ================================== BLOG =================================== */

const BLOG = "/blog/";

function answerBox(lang, html) {
  const tag = lang === "en" ? "Quick answer" : "Réponse rapide";
  return `<div class="answer"><span class="tag">${tag}</span>${html}</div>`;
}
function keyFacts(lang, rows) {
  const title = lang === "en" ? "Key facts" : "Faits clés";
  return `<section class="keyfacts" aria-label="${title}"><h2>${title}</h2><ul>${rows
    .map((r) => `<li><span>${r.k}</span><b>${r.v}</b></li>`)
    .join("")}</ul></section>`;
}
function postCta(href, label, text) {
  return `<div class="cta"><p>${text}</p><a href="${href}">${label}</a></div>`;
}

function postSchema(post) {
  const url = SITE + post.url;
  const inLang = post.lang === "en" ? "en-CA" : "fr-CA";
  const graph = [
    { "@type": "WebSite", "@id": SITE + "/#website", url: SITE + "/", name: "Calcul Taxes Québec", inLanguage: "fr-CA", publisher: { "@id": SITE + "/#org" } },
    { "@type": "Organization", "@id": SITE + "/#org", name: "Calcul Taxes Québec", url: SITE + "/", logo: { "@type": "ImageObject", url: SITE + "/icons/icon-512.png" } },
    {
      "@type": "BlogPosting",
      "@id": url + "#article",
      headline: stripTags(post.h1),
      name: stripTags(post.title),
      description: post.desc,
      inLanguage: inLang,
      datePublished: post.datePublished,
      dateModified: post.dateModified || BUILD_DATE,
      author: { "@id": SITE + "/#org" },
      publisher: { "@id": SITE + "/#org" },
      image: SITE + "/icons/og-image.png",
      mainEntityOfPage: url,
      isPartOf: { "@id": SITE + BLOG + "#blog" }
    },
    {
      "@type": "BreadcrumbList",
      "@id": url + "#breadcrumb",
      itemListElement: post.crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: SITE + c.href }))
    }
  ];
  if (post.howto) {
    graph.push({
      "@type": "HowTo",
      "@id": url + "#howto",
      name: post.howto.name,
      inLanguage: inLang,
      step: post.howto.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: stripTags(s.text) }))
    });
  }
  if (post.faqs && post.faqs.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": url + "#faq",
      mainEntity: post.faqs.map((f) => ({ "@type": "Question", name: stripTags(f.q), acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) } }))
    });
  }
  return jsonLd({ "@context": "https://schema.org", "@graph": graph });
}

/* raw post data */
const POSTS_RAW = [
  {
    url: "/comment-calculer-tps-tvq-quebec/",
    short: "Calculer la TPS et la TVQ",
    title: "Comment calculer la TPS et la TVQ au Québec? | Guide 2026",
    desc: "Comment calculer la TPS (5 %) et la TVQ (9,975 %) au Québec : la formule simple, le raccourci ×1,14975 et un exemple détaillé sur 100 $.",
    h1: "Comment calculer la TPS et la TVQ au Québec?",
    intro: "La méthode exacte, la formule et un exemple chiffré.",
    datePublished: "2026-01-08",
    answer:
      "<p>Pour calculer les taxes au Québec, ajoutez <strong>5&nbsp;% de TPS</strong> et <strong>9,975&nbsp;% de TVQ</strong> au montant avant taxes. Les deux taxes se calculent sur le prix avant taxes. Le raccourci&nbsp;: multipliez le montant par <strong>1,14975</strong> pour obtenir directement le total avec taxes.</p>",
    facts: [
      { k: "TPS", v: "5 %" },
      { k: "TVQ", v: "9,975 %" },
      { k: "Taux combiné", v: "14,975 %" },
      { k: "100 $ avant taxes", v: "114,98 $" }
    ],
    cta: postCta("/", "Ouvrir la calculatrice TPS TVQ", "Pas envie de calculer à la main? La calculatrice ajoute la TPS et la TVQ instantanément."),
    howto: {
      name: "Calculer la TPS et la TVQ au Québec",
      steps: [
        { name: "Calculer la TPS", text: "Multipliez le montant avant taxes par 0,05 (5 %)." },
        { name: "Calculer la TVQ", text: "Multipliez le même montant avant taxes par 0,09975 (9,975 %)." },
        { name: "Additionner", text: "Additionnez le montant avant taxes, la TPS et la TVQ pour obtenir le total." }
      ]
    },
    sections: `    <h2>Explication simple</h2>
    <p>Au Québec, deux taxes s'ajoutent au prix de la plupart des produits et services&nbsp;: la <strong>TPS</strong> (taxe fédérale, 5&nbsp;%) et la <strong>TVQ</strong> (taxe provinciale, 9,975&nbsp;%). Les deux s'appliquent sur le <strong>même</strong> montant&nbsp;: le prix avant taxes. La TVQ ne se calcule pas sur la TPS.</p>
    <h2>La formule</h2>
    <div class="formula">TPS&nbsp;=&nbsp;montant&nbsp;×&nbsp;0,05
TVQ&nbsp;=&nbsp;montant&nbsp;×&nbsp;0,09975
Total&nbsp;=&nbsp;montant&nbsp;+&nbsp;TPS&nbsp;+&nbsp;TVQ

Raccourci&nbsp;:&nbsp;Total&nbsp;=&nbsp;montant&nbsp;×&nbsp;1,14975</div>
    <h2>Exemple avec 100&nbsp;$</h2>
    <table class="data-table">
      <thead><tr><th>Élément</th><th>Montant</th></tr></thead>
      <tbody>
        <tr><td>Montant avant taxes</td><td>100,00&nbsp;$</td></tr>
        <tr><td>TPS (5&nbsp;%)</td><td>5,00&nbsp;$</td></tr>
        <tr><td>TVQ (9,975&nbsp;%)</td><td>9,98&nbsp;$</td></tr>
        <tr><td>Total avec taxes</td><td>114,98&nbsp;$</td></tr>
      </tbody>
    </table>
    <p>La TVQ exacte sur 100&nbsp;$ est de 9,975&nbsp;$, arrondie à 9,98&nbsp;$. Les montants affichés sont arrondis au cent.</p>
    <h2>Erreurs fréquentes</h2>
    <ul>
      <li><strong>Calculer la TVQ sur le montant + TPS.</strong> La TVQ se calcule sur le prix avant taxes seulement.</li>
      <li><strong>Utiliser un ancien taux de TVQ</strong> (comme 9,5&nbsp;%). Le taux est de 9,975&nbsp;% depuis 2013.</li>
      <li><strong>Arrondir trop tôt.</strong> Calculez chaque taxe, puis arrondissez le résultat final au cent.</li>
    </ul>
    <h2>Quand utiliser la calculatrice</h2>
    <p>Pour une facture, un devis ou une dépense, la <a href="/">calculatrice TPS TVQ</a> évite les erreurs d'arrondi. Si votre prix inclut déjà les taxes, utilisez plutôt le <a href="/calcul-taxe-inverse-quebec/">calcul de taxe inverse</a>. Pour les taux à jour, voyez les <a href="/taux-tps-tvq-quebec/">taux TPS TVQ au Québec</a>.</p>`,
    faqs: [
      { q: "Quel est le taux combiné de la TPS et de la TVQ?", a: "Le taux combiné est de 14,975 %&nbsp;: 5 % de TPS plus 9,975 % de TVQ, sur la plupart des produits et services taxables." },
      { q: "Comment calculer rapidement le total avec taxes?", a: "Multipliez le montant avant taxes par 1,14975. Par exemple, 100 $ × 1,14975 = 114,98 $." },
      { q: "La TVQ est-elle calculée sur la TPS?", a: "Non. La TVQ de 9,975 % se calcule sur le prix de vente avant taxes, pas sur le montant incluant la TPS." }
    ]
  },

  {
    url: "/comment-retirer-taxes-prix-quebec/",
    short: "Retirer les taxes d'un prix",
    title: "Comment retirer les taxes d'un prix au Québec? | Calcul inverse",
    desc: "Retirer la TPS et la TVQ d'un prix taxes incluses au Québec : divisez par 1,14975. Formule du calcul de taxe inverse et exemple sur 114,98 $.",
    h1: "Comment retirer les taxes d'un prix au Québec?",
    intro: "La formule du calcul inverse, expliquée simplement.",
    datePublished: "2026-01-10",
    answer:
      "<p>Pour retirer les taxes d'un prix au Québec, <strong>divisez le total par 1,14975</strong>. Le résultat est le montant avant taxes. Sur un prix de 114,98&nbsp;$ taxes incluses, le montant avant taxes est de 100,00&nbsp;$, dont 5,00&nbsp;$ de TPS et 9,98&nbsp;$ de TVQ.</p>",
    facts: [
      { k: "Diviseur", v: "1,14975" },
      { k: "114,98 $ taxes incl.", v: "100,00 $ net" },
      { k: "TPS comprise", v: "5,00 $" },
      { k: "TVQ comprise", v: "9,98 $" }
    ],
    cta: postCta("/calcul-taxe-inverse-quebec/", "Ouvrir le calcul de taxe inverse", "Entrez un prix taxes incluses et voyez le montant avant taxes, la TPS et la TVQ."),
    howto: {
      name: "Retirer la TPS et la TVQ d'un prix au Québec",
      steps: [
        { name: "Trouver le montant avant taxes", text: "Divisez le prix taxes incluses par 1,14975." },
        { name: "Calculer la TPS comprise", text: "Multipliez le montant avant taxes par 0,05." },
        { name: "Calculer la TVQ comprise", text: "Multipliez le montant avant taxes par 0,09975." }
      ]
    },
    sections: `    <h2>Pourquoi diviser par 1,14975</h2>
    <p>Un prix taxes incluses représente 114,975&nbsp;% du prix avant taxes (100&nbsp;% + 5&nbsp;% de TPS + 9,975&nbsp;% de TVQ). Pour revenir au montant de base, on divise donc par 1,14975. On ne soustrait pas simplement 14,975&nbsp;% du total&nbsp;: ce calcul donne un résultat trop bas.</p>
    <h2>La formule</h2>
    <div class="formula">Montant avant taxes&nbsp;=&nbsp;Total&nbsp;÷&nbsp;1,14975
TPS&nbsp;=&nbsp;montant avant taxes&nbsp;×&nbsp;0,05
TVQ&nbsp;=&nbsp;montant avant taxes&nbsp;×&nbsp;0,09975</div>
    <h2>Exemple avec 114,98&nbsp;$</h2>
    <table class="data-table">
      <thead><tr><th>Élément</th><th>Montant</th></tr></thead>
      <tbody>
        <tr><td>Prix taxes incluses</td><td>114,98&nbsp;$</td></tr>
        <tr><td>Montant avant taxes</td><td>100,00&nbsp;$</td></tr>
        <tr><td>TPS comprise (5&nbsp;%)</td><td>5,00&nbsp;$</td></tr>
        <tr><td>TVQ comprise (9,975&nbsp;%)</td><td>9,98&nbsp;$</td></tr>
      </tbody>
    </table>
    <h2>Erreurs fréquentes</h2>
    <ul>
      <li><strong>Soustraire 14,975&nbsp;% du total.</strong> Ça sous-estime le prix avant taxes. Il faut diviser, pas soustraire.</li>
      <li><strong>Diviser par 1,15.</strong> Le bon diviseur est 1,14975, pas 1,15.</li>
      <li><strong>Un écart de quelques cents</strong> est normal&nbsp;: comme le prix original a été arrondi au cent, le calcul inverse peut différer légèrement.</li>
    </ul>
    <h2>Quand l'utiliser</h2>
    <p>Pratique pour séparer les taxes d'un reçu, remplir une dépense ou vérifier une facture. Faites-le automatiquement avec le <a href="/calcul-taxe-inverse-quebec/">calcul de taxe inverse</a>. Pour l'opération inverse, voyez <a href="/comment-calculer-tps-tvq-quebec/">comment calculer la TPS et la TVQ</a>.</p>`,
    faqs: [
      { q: "Par combien diviser pour enlever les taxes au Québec?", a: "Divisez le prix taxes incluses par 1,14975 pour obtenir le montant avant taxes." },
      { q: "Pourquoi ne pas simplement soustraire 14,975 %?", a: "Parce que le 14,975 % s'applique au montant avant taxes, pas au total. Soustraire ce pourcentage du total donne un résultat trop bas; il faut diviser par 1,14975." },
      { q: "Le résultat est-il exact au cent près?", a: "Il est très proche. Un écart de un ou deux cents peut survenir parce que le prix d'origine a déjà été arrondi." }
    ]
  },

  {
    url: "/taxe-quebec-2026/",
    pair: ["/taxe-quebec-2026/", "/what-is-the-tax-in-quebec/"],
    short: "Taxe au Québec en 2026",
    title: "Quelle est la taxe au Québec en 2026? | TPS, TVQ et taux combiné",
    desc: "En 2026, la taxe au Québec est de 5 % (TPS) plus 9,975 % (TVQ), pour un taux combiné de 14,975 % sur la plupart des biens et services.",
    h1: "Quelle est la taxe au Québec en 2026?",
    intro: "Les taux en vigueur et ce qui s'applique.",
    datePublished: "2026-01-05",
    answer:
      "<p>En 2026, la taxe de vente au Québec est de <strong>5&nbsp;% de TPS</strong> (taxe fédérale) plus <strong>9,975&nbsp;% de TVQ</strong> (taxe provinciale), pour un <strong>taux combiné de 14,975&nbsp;%</strong> sur la plupart des produits et services taxables. Ces taux sont inchangés depuis 2013.</p>",
    facts: [
      { k: "TPS (fédérale)", v: "5 %" },
      { k: "TVQ (provinciale)", v: "9,975 %" },
      { k: "Taux combiné", v: "14,975 %" },
      { k: "En vigueur", v: "2026" }
    ],
    cta: postCta("/taux-tps-tvq-quebec/", "Voir les taux et calculer", "Consultez les taux TPS TVQ et calculez les taxes sur n'importe quel montant."),
    sections: `    <h2>Les deux taxes au Québec</h2>
    <p>La <strong>TPS</strong> (taxe sur les produits et services) est fédérale et s'élève à 5&nbsp;%. La <strong>TVQ</strong> (taxe de vente du Québec) est provinciale et s'élève à 9,975&nbsp;%. Les deux s'appliquent sur le prix avant taxes&nbsp;; la TVQ ne se calcule pas sur la TPS.</p>
    <h2>Le taux combiné de 14,975&nbsp;%</h2>
    <p>Additionnées, les deux taxes donnent 14,975&nbsp;%. C'est ce taux combiné qui sert d'estimation rapide&nbsp;: un article de 100&nbsp;$ coûte 114,98&nbsp;$ taxes incluses.</p>
    <h2>Exemples de taxes en 2026</h2>
    <table class="data-table">
      <thead><tr><th>Avant taxes</th><th>Total taxes incluses</th></tr></thead>
      <tbody>
        <tr><td>10,00&nbsp;$</td><td>11,50&nbsp;$</td></tr>
        <tr><td>50,00&nbsp;$</td><td>57,49&nbsp;$</td></tr>
        <tr><td>100,00&nbsp;$</td><td>114,98&nbsp;$</td></tr>
        <tr><td>1 000,00&nbsp;$</td><td>1 149,75&nbsp;$</td></tr>
      </tbody>
    </table>
    <h2>Ce qui n'a pas changé en 2026</h2>
    <p>La TVQ est passée à 9,975&nbsp;% en 2013 et la TPS est à 5&nbsp;% depuis 2008. Aucun changement de taux n'est entré en vigueur pour 2026. Certains produits (par exemple plusieurs aliments de base) sont détaxés ou exonérés et ne portent pas ces taxes.</p>
    <p>Pour calculer un montant précis, utilisez la <a href="/">calculatrice TPS TVQ</a> ou la page des <a href="/taux-tps-tvq-quebec/">taux TPS TVQ au Québec</a>.</p>`,
    faqs: [
      { q: "Quel est le taux de taxe au Québec en 2026?", a: "5 % de TPS et 9,975 % de TVQ, soit un taux combiné de 14,975 % sur la plupart des biens et services taxables." },
      { q: "Les taux de taxes ont-ils changé en 2026?", a: "Non. La TPS reste à 5 % et la TVQ à 9,975 %, des taux inchangés depuis 2013." },
      { q: "Tous les produits sont-ils taxés au Québec?", a: "Non. Certains biens et services, comme plusieurs aliments de base, sont détaxés ou exonérés de TPS et de TVQ." }
    ]
  },

  {
    url: "/difference-tps-tvq/",
    short: "Différence TPS et TVQ",
    title: "TPS et TVQ : quelle est la différence? | Fédérale vs provinciale",
    desc: "La TPS est la taxe fédérale de 5 % (Canada); la TVQ est la taxe provinciale de 9,975 % (Québec). Qui les perçoit, différences et exemple.",
    h1: "TPS et TVQ : quelle est la différence?",
    intro: "Fédérale contre provinciale, en clair.",
    datePublished: "2026-01-12",
    answer:
      "<p>La <strong>TPS</strong> (taxe sur les produits et services) est la taxe <strong>fédérale</strong> de 5&nbsp;% perçue pour le gouvernement du Canada. La <strong>TVQ</strong> (taxe de vente du Québec) est la taxe <strong>provinciale</strong> de 9,975&nbsp;% du Québec. Les deux sont perçues par Revenu Québec et s'appliquent sur le prix avant taxes.</p>",
    facts: [
      { k: "TPS — fédérale", v: "5 %" },
      { k: "TVQ — provinciale", v: "9,975 %" },
      { k: "Perçues par", v: "Revenu Québec" },
      { k: "Base de calcul", v: "Prix avant taxes" }
    ],
    cta: postCta("/", "Calculer la TPS et la TVQ", "Voyez la TPS et la TVQ séparément sur n'importe quel montant."),
    sections: `    <h2>La TPS : la taxe fédérale</h2>
    <p>La TPS s'applique partout au Canada au taux de 5&nbsp;%. Elle revient au gouvernement fédéral. Au Québec, c'est Revenu Québec qui l'administre et la perçoit.</p>
    <h2>La TVQ : la taxe provinciale</h2>
    <p>La TVQ est propre au Québec, au taux de 9,975&nbsp;%. Elle revient au gouvernement provincial. Elle se calcule sur le prix de vente avant taxes, comme la TPS.</p>
    <h2>Comparaison rapide</h2>
    <table class="data-table">
      <thead><tr><th>Taxe</th><th>Taux</th></tr></thead>
      <tbody>
        <tr><td>TPS — fédérale (Canada)</td><td>5&nbsp;%</td></tr>
        <tr><td>TVQ — provinciale (Québec)</td><td>9,975&nbsp;%</td></tr>
        <tr><td>Combiné</td><td>14,975&nbsp;%</td></tr>
      </tbody>
    </table>
    <h2>Est-ce que la TVQ est calculée sur la TPS?</h2>
    <p>Non. Depuis 2013, la TVQ se calcule sur le prix avant taxes, et non sur le montant incluant la TPS. Les deux taxes s'appliquent à la même base.</p>
    <h2>Pourquoi deux taxes?</h2>
    <p>Le Canada est un système à deux paliers&nbsp;: une taxe fédérale (TPS) et une taxe provinciale (la TVQ au Québec). D'autres provinces utilisent une taxe harmonisée (TVH), mais le Québec garde sa TVQ distincte. Pour additionner les deux, utilisez la <a href="/">calculatrice TPS TVQ</a>.</p>`,
    faqs: [
      { q: "Quelle est la différence entre la TPS et la TVQ?", a: "La TPS est la taxe fédérale de 5 % du Canada; la TVQ est la taxe provinciale de 9,975 % du Québec. Les deux s'ajoutent au prix avant taxes." },
      { q: "Qui perçoit la TPS et la TVQ au Québec?", a: "Au Québec, Revenu Québec perçoit les deux taxes, puis remet la portion fédérale au gouvernement du Canada." },
      { q: "La TVQ s'applique-t-elle sur la TPS?", a: "Non. La TVQ se calcule sur le prix avant taxes, pas sur le montant incluant la TPS." }
    ]
  },

  {
    url: "/prix-avant-taxes-quebec/",
    short: "Prix avant taxes",
    title: "Comment trouver le prix avant taxes au Québec? | Méthode simple",
    desc: "Pour trouver le prix avant taxes au Québec, divisez le prix taxes incluses par 1,14975. Méthode, formule et tableau de référence.",
    h1: "Comment trouver le prix avant taxes au Québec?",
    intro: "La méthode et un tableau de référence prêt à l'emploi.",
    datePublished: "2026-01-14",
    answer:
      "<p>Pour trouver le prix avant taxes au Québec, <strong>divisez le prix taxes incluses par 1,14975</strong>. Par exemple, un total de 57,49&nbsp;$ correspond à un prix avant taxes d'environ 50,00&nbsp;$. C'est le même calcul que la taxe inverse.</p>",
    facts: [
      { k: "Diviseur", v: "1,14975" },
      { k: "11,50 $ → net", v: "10,00 $" },
      { k: "57,49 $ → net", v: "50,00 $" },
      { k: "114,98 $ → net", v: "100,00 $" }
    ],
    cta: postCta("/calcul-taxe-inverse-quebec/", "Trouver le prix avant taxes", "Entrez un total taxes incluses et obtenez le prix avant taxes au cent près."),
    sections: `    <h2>La méthode</h2>
    <p>Un prix taxes incluses vaut 114,975&nbsp;% du prix avant taxes. Pour retrouver le montant net, on divise donc le total par 1,14975. Inutile de séparer la TPS et la TVQ d'abord&nbsp;: une seule division suffit.</p>
    <h2>La formule</h2>
    <div class="formula">Prix avant taxes&nbsp;=&nbsp;Prix taxes incluses&nbsp;÷&nbsp;1,14975</div>
    <h2>Tableau de référence</h2>
    <table class="data-table">
      <thead><tr><th>Prix taxes incluses</th><th>Prix avant taxes</th></tr></thead>
      <tbody>
        <tr><td>11,50&nbsp;$</td><td>10,00&nbsp;$</td></tr>
        <tr><td>22,98&nbsp;$</td><td>19,99&nbsp;$</td></tr>
        <tr><td>57,49&nbsp;$</td><td>50,00&nbsp;$</td></tr>
        <tr><td>114,98&nbsp;$</td><td>100,00&nbsp;$</td></tr>
        <tr><td>1 149,75&nbsp;$</td><td>1 000,00&nbsp;$</td></tr>
      </tbody>
    </table>
    <h2>Pourquoi un écart de quelques cents</h2>
    <p>Le prix affiché en magasin a déjà été arrondi au cent. En remontant au prix avant taxes, on peut donc tomber à un ou deux cents près du montant exact. C'est normal et sans conséquence pour la plupart des usages.</p>
    <h2>Cas pratiques</h2>
    <p>Utile pour une dépense professionnelle, un remboursement ou une comptabilité simple. La <a href="/calcul-taxe-inverse-quebec/">calculatrice de taxe inverse</a> fait le calcul et sépare la TPS et la TVQ. Pour ajouter les taxes à un prix, voyez <a href="/comment-calculer-tps-tvq-quebec/">comment calculer la TPS et la TVQ</a>.</p>`,
    faqs: [
      { q: "Comment calculer le prix avant taxes au Québec?", a: "Divisez le prix taxes incluses par 1,14975. Le résultat est le prix avant taxes." },
      { q: "Quel est le prix avant taxes de 100 $ taxes incluses?", a: "Environ 86,98 $ : 100 ÷ 1,14975 ≈ 86,98 $ avant taxes." },
      { q: "Est-ce le même calcul que la taxe inverse?", a: "Oui. Trouver le prix avant taxes et faire un calcul de taxe inverse, c'est la même opération : diviser par 1,14975." }
    ]
  },

  {
    url: "/produits-sans-taxes-quebec/",
    short: "Produits sans taxes",
    title: "Quels produits n'ont pas de TPS/TVQ au Québec? | Liste 2026",
    desc: "Aliments de base, médicaments sur ordonnance, loyer résidentiel, services financiers : la liste des produits et services sans TPS ni TVQ au Québec.",
    h1: "Quels produits n'ont pas de TPS/TVQ au Québec?",
    intro: "La liste des biens et services sans taxe, par catégorie.",
    datePublished: "2026-06-12",
    answer:
      "<p>Plusieurs biens et services ne portent <strong>ni TPS ni TVQ</strong> au Québec. Les principaux sont les <strong>aliments de base</strong> (épicerie), les <strong>médicaments sur ordonnance</strong>, le <strong>loyer résidentiel</strong> et la plupart des <strong>services financiers, de santé et d'enseignement</strong>. Ces biens sont soit détaxés (taxés à 0&nbsp;%), soit exonérés.</p>",
    facts: [
      { k: "Aliments de base", v: "0 $ de taxe" },
      { k: "Médicaments sur ordonnance", v: "Détaxés" },
      { k: "Loyer résidentiel", v: "Exonéré" },
      { k: "Taux normal sinon", v: "14,975 %" }
    ],
    cta: postCta("/", "Calculer la TPS et la TVQ", "Pour un produit taxable, la calculatrice ajoute la TPS et la TVQ instantanément."),
    sections: `    <h2>Les grandes catégories sans taxe</h2>
    <p>La plupart des produits et services sont taxables au taux combiné de <strong>14,975&nbsp;%</strong>. Certaines catégories y échappent toutefois&nbsp;: elles ne portent ni TPS ni TVQ pour le consommateur.</p>
    <table class="data-table">
      <thead><tr><th>Catégorie</th><th>Taxe</th></tr></thead>
      <tbody>
        <tr><td>Aliments de base (épicerie)</td><td>Aucune</td></tr>
        <tr><td>Médicaments sur ordonnance</td><td>Aucune</td></tr>
        <tr><td>Certains appareils médicaux</td><td>Aucune</td></tr>
        <tr><td>Loyer résidentiel</td><td>Aucune</td></tr>
        <tr><td>Plusieurs services financiers</td><td>Aucune</td></tr>
        <tr><td>Plusieurs services de santé et d'enseignement</td><td>Aucune</td></tr>
      </tbody>
    </table>
    <h2>Les aliments de base</h2>
    <p>L'épicerie courante (pain, lait, légumes, viande, etc.) est <strong>détaxée</strong>&nbsp;: aucune TPS ni TVQ. Attention&nbsp;: les aliments préparés, les repas au restaurant, les boissons gazeuses, les croustilles, les bonbons et l'alcool restent taxables au taux normal.</p>
    <h2>La santé et les médicaments</h2>
    <p>Les médicaments sur ordonnance et plusieurs appareils médicaux sont détaxés. Les services d'un médecin ou d'un dentiste sont généralement exonérés. Les produits de santé vendus en vente libre, eux, sont habituellement taxables.</p>
    <h2>Le logement et les services financiers</h2>
    <p>Le loyer d'un logement résidentiel est exonéré&nbsp;: pas de taxe sur le loyer mensuel. La plupart des services financiers de base (intérêts, plusieurs frais bancaires) le sont aussi.</p>
    <h2>Détaxé ou exonéré&nbsp;?</h2>
    <p>Dans les deux cas, le consommateur ne paie aucune taxe. La différence touche surtout les entreprises&nbsp;: voyez la <a href="/taxable-detaxe-exonere-quebec/">différence entre taxable, détaxé et exonéré</a>. Pour un produit taxable, utilisez la <a href="/">calculatrice TPS TVQ</a> ou consultez les <a href="/taux-tps-tvq-quebec/">taux TPS TVQ au Québec</a>.</p>
    <p class="disclaimer">Information générale seulement. Vérifiez les cas particuliers auprès de Revenu Québec.</p>`,
    faqs: [
      { q: "L'épicerie est-elle taxée au Québec?", a: "Les aliments de base (épicerie courante) ne portent ni TPS ni TVQ. Les aliments préparés, les repas au restaurant, l'alcool et les friandises restent taxables." },
      { q: "Le loyer est-il taxable au Québec?", a: "Non. Le loyer d'un logement résidentiel est exonéré de TPS et de TVQ." },
      { q: "Les médicaments sont-ils taxés?", a: "Les médicaments sur ordonnance sont détaxés (0 %). Les produits de santé en vente libre sont généralement taxables au taux normal de 14,975 %." }
    ]
  },

  {
    url: "/taxable-detaxe-exonere-quebec/",
    short: "Taxable, détaxé ou exonéré",
    title: "Taxable, détaxé ou exonéré : quelle différence au Québec?",
    desc: "Taxable (14,975 %), détaxé (0 %) ou exonéré (sans taxe) : la différence claire entre les trois catégories de fournitures au Québec, avec exemples.",
    h1: "Taxable, détaxé ou exonéré : quelle différence au Québec?",
    intro: "Trois catégories, expliquées avec des exemples concrets.",
    datePublished: "2026-06-12",
    answer:
      "<p>Une fourniture <strong>taxable</strong> porte la TPS et la TVQ au taux normal de <strong>14,975&nbsp;%</strong>. Une fourniture <strong>détaxée</strong> est taxable, mais au taux de <strong>0&nbsp;%</strong> (par exemple l'épicerie de base). Une fourniture <strong>exonérée</strong> n'est pas assujettie aux taxes du tout (par exemple le loyer résidentiel). Pour le client, détaxé et exonéré reviennent à payer aucune taxe.</p>",
    facts: [
      { k: "Taxable", v: "14,975 %" },
      { k: "Détaxée", v: "0 %" },
      { k: "Exonérée", v: "Sans taxe" },
      { k: "Pour le client", v: "Détaxé = exonéré" }
    ],
    cta: postCta("/", "Calculer une fourniture taxable", "Pour un produit taxable, ajoutez la TPS et la TVQ en un clic."),
    sections: `    <h2>Fourniture taxable</h2>
    <p>C'est le cas le plus courant. Le bien ou le service porte <strong>5&nbsp;% de TPS</strong> et <strong>9,975&nbsp;% de TVQ</strong>, soit 14,975&nbsp;% au total. Exemples&nbsp;: vêtements, électronique, restaurant, services professionnels.</p>
    <h2>Fourniture détaxée</h2>
    <p>Une fourniture détaxée est techniquement taxable, mais au taux de <strong>0&nbsp;%</strong>. Le client ne paie donc aucune taxe. Exemples&nbsp;: aliments de base, médicaments sur ordonnance, certaines exportations.</p>
    <h2>Fourniture exonérée</h2>
    <p>Une fourniture exonérée n'entre pas dans le régime des taxes&nbsp;: aucune TPS ni TVQ ne s'applique. Exemples&nbsp;: loyer résidentiel, plusieurs services financiers, certains services de santé et d'enseignement.</p>
    <h2>La vraie différence : détaxé vs exonéré</h2>
    <p>Pour le consommateur, les deux donnent le même résultat&nbsp;: 0&nbsp;$ de taxe. La différence touche l'entreprise. Sur une fourniture <strong>détaxée</strong>, l'entreprise peut récupérer les taxes payées sur ses achats (crédits de taxe). Sur une fourniture <strong>exonérée</strong>, elle ne le peut généralement pas.</p>
    <table class="data-table">
      <thead><tr><th>Catégorie</th><th>Taxe au client</th><th>Crédits pour l'entreprise</th></tr></thead>
      <tbody>
        <tr><td>Taxable</td><td>14,975&nbsp;%</td><td>Oui</td></tr>
        <tr><td>Détaxée</td><td>0&nbsp;%</td><td>Oui</td></tr>
        <tr><td>Exonérée</td><td>Aucune</td><td>Non</td></tr>
      </tbody>
    </table>
    <h2>Erreurs fréquentes</h2>
    <ul>
      <li><strong>Confondre détaxé et exonéré.</strong> Le résultat est identique pour le client, mais pas pour l'entreprise.</li>
      <li><strong>Croire que « sans taxe » veut dire « hors régime ».</strong> Une fourniture détaxée reste dans le régime de la TPS/TVQ.</li>
    </ul>
    <p>Pour voir quels biens entrent dans chaque catégorie, lisez <a href="/produits-sans-taxes-quebec/">quels produits n'ont pas de TPS/TVQ</a>. Pour calculer une fourniture taxable, utilisez la <a href="/">calculatrice TPS TVQ</a>.</p>
    <p class="disclaimer">Information générale seulement. Vérifiez votre situation auprès de Revenu Québec.</p>`,
    faqs: [
      { q: "Quelle est la différence entre détaxé et exonéré?", a: "Pour le client, aucune : les deux donnent 0 $ de taxe. La différence est que l'entreprise peut récupérer les taxes sur ses achats pour une fourniture détaxée, mais pas pour une fourniture exonérée." },
      { q: "Une fourniture détaxée est-elle taxable?", a: "Oui, mais au taux de 0 %. Elle reste dans le régime de la TPS/TVQ, contrairement à une fourniture exonérée." },
      { q: "Le taux normal s'applique à quoi?", a: "À toutes les fournitures taxables ordinaires : 5 % de TPS et 9,975 % de TVQ, soit 14,975 %." }
    ]
  },

  {
    url: "/seuil-inscription-tps-tvq-quebec/",
    short: "Seuil d'inscription TPS/TVQ",
    title: "À partir de combien s'inscrire à la TPS/TVQ au Québec? | Seuil",
    desc: "Le seuil du petit fournisseur est de 30 000 $ de revenus taxables sur quatre trimestres. Au-delà, l'inscription à la TPS et à la TVQ devient obligatoire.",
    h1: "À partir de combien faut-il s'inscrire à la TPS/TVQ?",
    intro: "Le seuil de 30 000 $ et ce qu'il signifie.",
    datePublished: "2026-06-13",
    answer:
      "<p>L'inscription à la TPS et à la TVQ devient obligatoire lorsque vos revenus taxables dépassent <strong>30&nbsp;000&nbsp;$</strong> sur une période de <strong>quatre trimestres civils consécutifs</strong>. En dessous de ce seuil, vous êtes un « petit fournisseur » et l'inscription est facultative.</p>",
    facts: [
      { k: "Seuil", v: "30 000 $" },
      { k: "Période", v: "4 trimestres consécutifs" },
      { k: "Sous le seuil", v: "Petit fournisseur" },
      { k: "Inscription", v: "Gratuite" }
    ],
    cta: postCta("/", "Calculer la TPS et la TVQ à facturer", "Une fois inscrit, ajoutez la TPS et la TVQ à vos factures en un clic."),
    sections: `    <h2>Le seuil du petit fournisseur</h2>
    <p>La règle de base&nbsp;: si le total de vos ventes taxables (et celles de vos associés liés) dépasse <strong>30&nbsp;000&nbsp;$</strong> sur quatre trimestres civils consécutifs, vous devez vous inscrire à la TPS et à la TVQ. Tant que vous restez sous ce seuil, vous êtes considéré comme un <strong>petit fournisseur</strong> et l'inscription reste facultative.</p>
    <h2>Comment compter les 30 000 $</h2>
    <p>On additionne les revenus <strong>taxables et détaxés</strong> à l'échelle mondiale, avant taxes. Les fournitures exonérées ne comptent pas. Le calcul se fait sur une fenêtre glissante de quatre trimestres&nbsp;: dès que le total dépasse 30&nbsp;000&nbsp;$, l'obligation s'enclenche.</p>
    <h2>Faut-il s'inscrire même sous le seuil?</h2>
    <p>C'est parfois avantageux. En vous inscrivant volontairement, vous pouvez réclamer les crédits de taxe sur vos achats d'entreprise. En contrepartie, vous devez facturer la TPS et la TVQ à vos clients et produire des déclarations.</p>
    <table class="data-table">
      <thead><tr><th>Situation</th><th>Inscription</th></tr></thead>
      <tbody>
        <tr><td>Moins de 30 000 $</td><td>Facultative</td></tr>
        <tr><td>Plus de 30 000 $</td><td>Obligatoire</td></tr>
      </tbody>
    </table>
    <h2>Et après l'inscription?</h2>
    <p>Vous devez facturer 5&nbsp;% de TPS et 9,975&nbsp;% de TVQ sur vos fournitures taxables, puis remettre ces montants à Revenu Québec. Pour calculer ce que vous devez ajouter, voyez <a href="/comment-calculer-tps-tvq-quebec/">comment calculer la TPS et la TVQ</a> et le guide <a href="/tps-tvq-travailleur-autonome/">TPS TVQ pour travailleurs autonomes</a>.</p>
    <p class="disclaimer">Information générale seulement, et non un avis fiscal. Confirmez votre obligation d'inscription auprès de Revenu Québec.</p>`,
    faqs: [
      { q: "À partir de combien s'inscrire à la TPS/TVQ?", a: "Dès que vos revenus taxables dépassent 30 000 $ sur quatre trimestres civils consécutifs. L'inscription devient alors obligatoire." },
      { q: "C'est quoi un petit fournisseur?", a: "Une entreprise dont les revenus taxables ne dépassent pas 30 000 $ sur quatre trimestres consécutifs. Elle n'est pas obligée de s'inscrire à la TPS/TVQ." },
      { q: "Peut-on s'inscrire avant d'atteindre 30 000 $?", a: "Oui, l'inscription volontaire est permise. Elle permet de réclamer les crédits de taxe sur les achats, mais oblige à facturer les taxes et à produire des déclarations." }
    ]
  },

  {
    url: "/tps-tvq-travailleur-autonome/",
    short: "TPS TVQ travailleur autonome",
    title: "TPS TVQ pour travailleurs autonomes : guide simple | Québec",
    desc: "Quand s'inscrire, quand facturer la TPS (5 %) et la TVQ (9,975 %) et comment les ajouter à vos factures : guide simple pour les travailleurs autonomes au Québec.",
    h1: "TPS TVQ pour travailleurs autonomes : guide simple",
    intro: "Quand vous inscrire, quand facturer, comment calculer.",
    datePublished: "2026-06-13",
    answer:
      "<p>Comme travailleur autonome au Québec, vous devez vous inscrire à la TPS et à la TVQ dès que vos revenus taxables dépassent <strong>30&nbsp;000&nbsp;$</strong> sur quatre trimestres. Une fois inscrit, vous facturez <strong>5&nbsp;% de TPS</strong> et <strong>9,975&nbsp;% de TVQ</strong> sur vos services taxables, puis vous remettez ces montants à Revenu Québec.</p>",
    facts: [
      { k: "Seuil d'inscription", v: "30 000 $" },
      { k: "TPS à facturer", v: "5 %" },
      { k: "TVQ à facturer", v: "9,975 %" },
      { k: "Total ajouté", v: "14,975 %" }
    ],
    cta: postCta("/", "Calculer les taxes de vos factures", "Ajoutez la TPS et la TVQ à vos honoraires en quelques secondes."),
    sections: `    <h2>1. Devez-vous vous inscrire?</h2>
    <p>Tant que vos revenus taxables restent sous <strong>30&nbsp;000&nbsp;$</strong> sur quatre trimestres civils consécutifs, vous êtes un petit fournisseur et l'inscription est facultative. Au-delà, elle devient obligatoire. Détails dans le guide sur le <a href="/seuil-inscription-tps-tvq-quebec/">seuil d'inscription à la TPS/TVQ</a>.</p>
    <h2>2. Quand facturer les taxes?</h2>
    <p>Dès que vous êtes inscrit, vous ajoutez la TPS et la TVQ à toutes vos fournitures taxables. Vous devez aussi indiquer vos numéros d'inscription sur vos factures.</p>
    <h2>3. Comment calculer ce que vous ajoutez</h2>
    <div class="formula">TPS&nbsp;=&nbsp;honoraires&nbsp;×&nbsp;0,05
TVQ&nbsp;=&nbsp;honoraires&nbsp;×&nbsp;0,09975
Total facturé&nbsp;=&nbsp;honoraires&nbsp;×&nbsp;1,14975</div>
    <h2>Exemple : 1 000 $ d'honoraires</h2>
    <table class="data-table">
      <thead><tr><th>Élément</th><th>Montant</th></tr></thead>
      <tbody>
        <tr><td>Honoraires</td><td>1 000,00&nbsp;$</td></tr>
        <tr><td>TPS (5&nbsp;%)</td><td>50,00&nbsp;$</td></tr>
        <tr><td>TVQ (9,975&nbsp;%)</td><td>99,75&nbsp;$</td></tr>
        <tr><td>Total à facturer</td><td>1 149,75&nbsp;$</td></tr>
      </tbody>
    </table>
    <h2>4. Remettre les taxes</h2>
    <p>Les taxes que vous percevez ne vous appartiennent pas&nbsp;: vous les remettez à Revenu Québec selon la fréquence de vos déclarations. Vous pouvez en déduire les taxes payées sur vos achats d'entreprise (crédits de taxe).</p>
    <p>Pour bâtir une facture complète, voyez <a href="/calcul-taxes-facture-quebec/">comment calculer les taxes sur une facture</a>. Pour ajouter rapidement les taxes, utilisez la <a href="/">calculatrice TPS TVQ</a>.</p>
    <p class="disclaimer">Information générale seulement, et non un avis fiscal ou comptable. Consultez Revenu Québec ou un professionnel pour votre situation.</p>`,
    faqs: [
      { q: "Un travailleur autonome doit-il charger la TPS/TVQ?", a: "Oui, dès qu'il est inscrit. L'inscription est obligatoire au-delà de 30 000 $ de revenus taxables sur quatre trimestres consécutifs." },
      { q: "Comment calculer les taxes à facturer?", a: "Ajoutez 5 % de TPS et 9,975 % de TVQ aux honoraires, ou multipliez le montant par 1,14975 pour obtenir le total à facturer." },
      { q: "Peut-on récupérer les taxes payées sur ses achats?", a: "Oui, une fois inscrit, vous pouvez réclamer des crédits de taxe sur les achats liés à votre entreprise." }
    ]
  },

  {
    url: "/calcul-taxes-facture-quebec/",
    short: "Taxes sur une facture",
    title: "Comment calculer les taxes sur une facture au Québec? | Guide",
    desc: "Calculer la TPS et la TVQ sur une facture au Québec : sous-total, taxes ligne par ligne et total. Méthode et exemple pour freelances et petites entreprises.",
    h1: "Comment calculer les taxes sur une facture au Québec?",
    intro: "Du sous-total au total, étape par étape.",
    datePublished: "2026-06-14",
    answer:
      "<p>Pour calculer les taxes sur une facture au Québec, additionnez d'abord vos articles pour obtenir le <strong>sous-total</strong>, puis ajoutez <strong>5&nbsp;% de TPS</strong> et <strong>9,975&nbsp;% de TVQ</strong> sur ce sous-total. Le total à payer est le sous-total multiplié par <strong>1,14975</strong>.</p>",
    facts: [
      { k: "Étape 1", v: "Sous-total" },
      { k: "Étape 2", v: "+ TPS 5 %" },
      { k: "Étape 3", v: "+ TVQ 9,975 %" },
      { k: "Raccourci total", v: "× 1,14975" }
    ],
    cta: postCta("/", "Calculer les taxes de la facture", "Entrez le sous-total et obtenez la TPS, la TVQ et le total."),
    howto: {
      name: "Calculer les taxes sur une facture au Québec",
      steps: [
        { name: "Faire le sous-total", text: "Additionnez tous les articles ou services avant taxes." },
        { name: "Ajouter la TPS", text: "Multipliez le sous-total par 0,05 (5 %)." },
        { name: "Ajouter la TVQ", text: "Multipliez le sous-total par 0,09975 (9,975 %)." },
        { name: "Faire le total", text: "Additionnez le sous-total, la TPS et la TVQ." }
      ]
    },
    sections: `    <h2>La structure d'une facture</h2>
    <p>Une facture claire affiche les taxes séparément. On calcule la TPS et la TVQ sur le <strong>sous-total avant taxes</strong>, jamais l'une sur l'autre.</p>
    <h2>Exemple : facture de 250 $ + 100 $</h2>
    <table class="data-table">
      <thead><tr><th>Élément</th><th>Montant</th></tr></thead>
      <tbody>
        <tr><td>Service A</td><td>250,00&nbsp;$</td></tr>
        <tr><td>Service B</td><td>100,00&nbsp;$</td></tr>
        <tr><td>Sous-total</td><td>350,00&nbsp;$</td></tr>
        <tr><td>TPS (5&nbsp;%)</td><td>17,50&nbsp;$</td></tr>
        <tr><td>TVQ (9,975&nbsp;%)</td><td>34,91&nbsp;$</td></tr>
        <tr><td>Total à payer</td><td>402,41&nbsp;$</td></tr>
      </tbody>
    </table>
    <p>Vérification rapide&nbsp;: 350&nbsp;$ × 1,14975 = 402,41&nbsp;$.</p>
    <h2>Ce qu'une facture devrait contenir</h2>
    <ul>
      <li>Le sous-total avant taxes&nbsp;;</li>
      <li>La TPS et la TVQ affichées séparément&nbsp;;</li>
      <li>Vos numéros d'inscription à la TPS et à la TVQ&nbsp;;</li>
      <li>Le total à payer.</li>
    </ul>
    <h2>Erreurs fréquentes</h2>
    <ul>
      <li><strong>Calculer la TVQ sur le sous-total + TPS.</strong> Les deux taxes se calculent sur le même sous-total.</li>
      <li><strong>Arrondir chaque ligne.</strong> Faites le sous-total d'abord, puis calculez les taxes une seule fois.</li>
    </ul>
    <p>Pour une seule somme, la <a href="/">calculatrice TPS TVQ</a> suffit. Travailleur autonome&nbsp;? Voyez le <a href="/tps-tvq-travailleur-autonome/">guide TPS TVQ pour travailleurs autonomes</a>.</p>
    <p class="disclaimer">Information générale seulement. Confirmez les exigences de facturation auprès de Revenu Québec.</p>`,
    faqs: [
      { q: "Comment ajouter les taxes à une facture au Québec?", a: "Faites le sous-total des articles, puis ajoutez 5 % de TPS et 9,975 % de TVQ sur ce sous-total. Le total est le sous-total × 1,14975." },
      { q: "La TVQ se calcule-t-elle sur le sous-total avec TPS?", a: "Non. La TPS et la TVQ se calculent toutes les deux sur le sous-total avant taxes." },
      { q: "Faut-il afficher les numéros de taxe sur la facture?", a: "Oui. Une entreprise inscrite doit indiquer ses numéros d'inscription à la TPS et à la TVQ sur ses factures." }
    ]
  },

  {
    url: "/taxes-incluses-vs-taxes-en-sus/",
    short: "Taxes en sus : veut dire quoi?",
    title: "Taxes en sus : veut dire quoi? + 14,975 % (vs taxes incluses)",
    desc: "« Taxes en sus » veut dire taxes en plus : le prix affiché n'inclut pas la TPS ni la TVQ. 100 $ taxes en sus = 114,98 $ à payer. Taxes incluses = prix final. Tableau et formules 2026.",
    h1: "Taxes en sus : qu'est-ce que ça veut dire?",
    intro: "Taxes en sus ou taxes incluses : deux façons d'afficher un prix, un seul total réel.",
    datePublished: "2026-06-15",
    dateModified: "2026-11-19",
    answer:
      "<p><strong>Taxes en sus</strong> veut dire <strong>taxes en plus</strong>&nbsp;: le prix affiché n'inclut pas la TPS ni la TVQ. Au Québec, ajoutez <strong>14,975&nbsp;%</strong>&nbsp;: <strong>100&nbsp;$ taxes en sus = 114,98&nbsp;$</strong> à payer. À l'inverse, un prix <strong>taxes incluses</strong> est déjà le total final (100&nbsp;$ taxes incluses = 86,98&nbsp;$ avant taxes).</p>",
    facts: [
      { k: "En sus", v: "= en plus" },
      { k: "Taxes en sus", v: "Prix avant taxes" },
      { k: "Taxes incluses", v: "Total final" },
      { k: "Ajouter les taxes", v: "× 1,14975" },
      { k: "Retirer les taxes", v: "÷ 1,14975" }
    ],
    cta: postCta("/calcul-taxe-inverse-quebec/", "Calculer un prix taxes incluses", "Entrez un prix taxes incluses pour voir le montant avant taxes."),
    sections: `    <h2>Que veut dire « taxes en sus »?</h2>
    <p>« En sus » est une expression qui veut dire « en plus » ou « en supplément ». « Taxes en sus » (parfois écrit « + taxes », « plus taxes » ou « tx en sus ») veut donc dire que le prix affiché n'inclut pas la TPS ni la TVQ&nbsp;: elles s'ajoutent au moment de payer. C'est l'affichage habituel dans les commerces&nbsp;: le 100&nbsp;$ sur l'étiquette devient 114,98&nbsp;$ à la caisse.</p>
    <p>En anglais, on dit «&nbsp;plus tax&nbsp;» ou «&nbsp;tax extra&nbsp;».</p>
    <h2>Prix taxes en sus : combien à payer?</h2>
    <p>Total à payer pour un prix affiché taxes en sus au Québec (TPS 5&nbsp;% + TVQ 9,975&nbsp;%, arrondies au cent)&nbsp;:</p>
${addTable("fr", [1, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 5000])}
    <h2>Taxes incluses</h2>
    <p>« Taxes incluses » veut dire que le prix affiché est déjà le total à payer. C'est fréquent pour les forfaits, certains services et les prix « tout compris ». Aucun ajout à la caisse.</p>
    <h2>Passer de l'un à l'autre</h2>
    <div class="formula">Taxes en sus → total&nbsp;:&nbsp;prix&nbsp;×&nbsp;1,14975
Taxes incluses → avant taxes&nbsp;:&nbsp;prix&nbsp;÷&nbsp;1,14975</div>
    <h2>Exemple comparatif</h2>
    <table class="data-table">
      <thead><tr><th>Affichage</th><th>Prix affiché</th><th>Total à payer</th></tr></thead>
      <tbody>
        <tr><td>100&nbsp;$ taxes en sus</td><td>100,00&nbsp;$</td><td>114,98&nbsp;$</td></tr>
        <tr><td>100&nbsp;$ taxes incluses</td><td>100,00&nbsp;$</td><td>100,00&nbsp;$</td></tr>
      </tbody>
    </table>
    <p>Dans le deuxième cas, le montant avant taxes est de 100&nbsp;$ ÷ 1,14975 ≈ 86,98&nbsp;$, et les taxes comprises sont d'environ 13,02&nbsp;$.</p>
    <h2>Prix taxes incluses : combien avant taxes?</h2>
${removeTable("fr", [10, 20, 50, 100, 200, 500, 1000])}
    <h2>Pourquoi ça compte</h2>
    <p>Comparer un prix taxes en sus à un prix taxes incluses sans conversion fausse la comparaison. Ramenez toujours les deux à la même base. Pour ajouter les taxes, utilisez la <a href="/">calculatrice TPS TVQ</a>&nbsp;; pour les retirer, le <a href="/calcul-taxe-inverse-quebec/">calcul de taxe inverse</a>.</p>`,
    faqs: [
      { q: "Que veut dire « taxes en sus »?", a: "Que le prix affiché ne comprend pas les taxes. Il faut ajouter 14,975 % (TPS + TVQ) pour obtenir le total à payer." },
      { q: "Taxe en sus veut dire quoi?", a: "« En sus » veut dire « en plus ». Un prix taxe en sus est un prix avant taxes&nbsp;: la TPS (5 %) et la TVQ (9,975 %) s'ajoutent à la caisse. 50&nbsp;$ taxes en sus = 57,49&nbsp;$ à payer." },
      { q: "Comment calculer un prix taxes en sus?", a: "Multipliez le prix par 1,14975. Exemple&nbsp;: 200&nbsp;$ taxes en sus × 1,14975 = 229,95&nbsp;$, dont 10,00&nbsp;$ de TPS et 19,95&nbsp;$ de TVQ." },
      { q: "Quelle est la différence entre « + taxes » et « taxes en sus »?", a: "Aucune. « + taxes », « plus taxes », « tx en sus » et « taxes en sus » veulent tous dire que les taxes ne sont pas comprises dans le prix affiché." },
      { q: "Comment trouver le montant avant taxes d'un prix taxes incluses?", a: "Divisez le prix taxes incluses par 1,14975. Le résultat est le montant avant taxes." },
      { q: "Un prix taxes incluses change-t-il à la caisse?", a: "Non. Un prix taxes incluses est déjà le montant final à payer, sans ajout à la caisse." }
    ]
  },

  {
    url: "/calcul-rabais-taxes-quebec/",
    short: "Rabais et taxes",
    title: "Calculer un rabais avant ou après taxes au Québec | Exemples",
    desc: "Appliquer un rabais avant ou après taxes au Québec : la bonne méthode, la différence sur le total et des exemples chiffrés avec la TPS et la TVQ.",
    h1: "Comment calculer un rabais avant ou après taxes au Québec?",
    intro: "Le rabais s'applique avant les taxes — voici pourquoi et comment.",
    datePublished: "2026-06-16",
    answer:
      "<p>Un rabais s'applique normalement <strong>avant les taxes</strong>&nbsp;: on réduit d'abord le prix, puis on ajoute la TPS et la TVQ sur le montant rabattu. Calculer un rabais après taxes donne pratiquement le même total, car les taxes sont proportionnelles au prix.</p>",
    facts: [
      { k: "Ordre habituel", v: "Rabais, puis taxes" },
      { k: "50 $ − 20 %", v: "40,00 $ net" },
      { k: "+ taxes", v: "45,99 $ total" },
      { k: "Total identique", v: "Avant ou après" }
    ],
    cta: postCta("/", "Calculer les taxes après rabais", "Entrez le prix après rabais et ajoutez la TPS et la TVQ."),
    sections: `    <h2>La règle habituelle : rabais avant taxes</h2>
    <p>Dans la plupart des commerces, le rabais réduit le prix de vente, puis les taxes s'appliquent sur le <strong>montant rabattu</strong>. C'est logique&nbsp;: les taxes portent sur ce que vous payez réellement.</p>
    <h2>Exemple : 50 $ avec 20 % de rabais</h2>
    <table class="data-table">
      <thead><tr><th>Élément</th><th>Montant</th></tr></thead>
      <tbody>
        <tr><td>Prix régulier</td><td>50,00&nbsp;$</td></tr>
        <tr><td>Rabais (20&nbsp;%)</td><td>−10,00&nbsp;$</td></tr>
        <tr><td>Prix après rabais</td><td>40,00&nbsp;$</td></tr>
        <tr><td>TPS (5&nbsp;%)</td><td>2,00&nbsp;$</td></tr>
        <tr><td>TVQ (9,975&nbsp;%)</td><td>3,99&nbsp;$</td></tr>
        <tr><td>Total à payer</td><td>45,99&nbsp;$</td></tr>
      </tbody>
    </table>
    <h2>Et si le rabais s'applique après taxes?</h2>
    <p>Certains coupons s'appliquent sur le total taxes incluses. Le résultat final est presque identique, à un cent près&nbsp;: 50&nbsp;$ × 1,14975 = 57,49&nbsp;$, moins 20&nbsp;% = 45,99&nbsp;$. Les taxes étant proportionnelles, l'ordre change peu le total.</p>
    <h2>Rabais en montant fixe</h2>
    <p>Pour un rabais en dollars (ex. « 10&nbsp;$ de rabais »), soustrayez-le du prix avant taxes, puis appliquez les taxes&nbsp;: (50&nbsp;$ − 10&nbsp;$) × 1,14975 = 45,99&nbsp;$.</p>
    <h2>Erreurs fréquentes</h2>
    <ul>
      <li><strong>Appliquer le rabais sur les taxes seulement.</strong> Le rabais réduit le prix, pas le taux de taxe.</li>
      <li><strong>Calculer les taxes avant le rabais.</strong> Vous paieriez des taxes sur un montant que vous ne payez pas.</li>
    </ul>
    <p>Pour ajouter les taxes au prix rabattu, utilisez la <a href="/">calculatrice TPS TVQ</a>. Pour comprendre l'affichage, voyez <a href="/taxes-incluses-vs-taxes-en-sus/">taxes incluses vs taxes en sus</a>.</p>`,
    faqs: [
      { q: "Le rabais s'applique-t-il avant ou après les taxes?", a: "Habituellement avant les taxes : on réduit le prix, puis on ajoute la TPS et la TVQ sur le montant rabattu." },
      { q: "Le total change-t-il selon l'ordre?", a: "À peine. Comme les taxes sont proportionnelles au prix, appliquer le rabais avant ou après les taxes donne pratiquement le même total, à un cent près." },
      { q: "Comment calculer 50 $ avec 20 % de rabais plus taxes?", a: "50 $ − 20 % = 40 $, puis 40 $ × 1,14975 = 45,99 $ taxes incluses." }
    ]
  },

  {
    url: "/tableau-tps-tvq-quebec/",
    short: "Tableau TPS TVQ",
    title: "Tableau TPS TVQ Québec : montants courants | Référence 2026",
    desc: "Tableau de référence TPS TVQ pour le Québec : TPS, TVQ et total taxes incluses pour les montants courants de 1 $ à 1 000 $, au taux de 14,975 %.",
    h1: "Tableau TPS TVQ Québec : montants courants",
    intro: "TPS, TVQ et total pour les montants les plus fréquents.",
    datePublished: "2026-06-17",
    answer:
      "<p>Ce tableau donne la <strong>TPS (5&nbsp;%)</strong>, la <strong>TVQ (9,975&nbsp;%)</strong> et le <strong>total taxes incluses</strong> pour les montants courants au Québec. Le total correspond toujours au montant avant taxes multiplié par <strong>1,14975</strong>.</p>",
    facts: [
      { k: "TPS", v: "5 %" },
      { k: "TVQ", v: "9,975 %" },
      { k: "Taux combiné", v: "14,975 %" },
      { k: "100 $ → total", v: "114,98 $" }
    ],
    cta: postCta("/", "Calculer un autre montant", "Votre montant n'est pas dans le tableau? La calculatrice le fait au cent près."),
    sections: `    <h2>Tableau de référence (taxes en sus)</h2>
    <p>Montant avant taxes, puis TPS, TVQ et total à payer. Les taxes sont arrondies au cent.</p>
    <table class="data-table">
      <thead><tr><th>Avant taxes</th><th>TPS</th><th>TVQ</th><th>Total</th></tr></thead>
      <tbody>
        <tr><td>1,00&nbsp;$</td><td>0,05&nbsp;$</td><td>0,10&nbsp;$</td><td>1,15&nbsp;$</td></tr>
        <tr><td>2,00&nbsp;$</td><td>0,10&nbsp;$</td><td>0,20&nbsp;$</td><td>2,30&nbsp;$</td></tr>
        <tr><td>5,00&nbsp;$</td><td>0,25&nbsp;$</td><td>0,50&nbsp;$</td><td>5,75&nbsp;$</td></tr>
        <tr><td>10,00&nbsp;$</td><td>0,50&nbsp;$</td><td>1,00&nbsp;$</td><td>11,50&nbsp;$</td></tr>
        <tr><td>15,00&nbsp;$</td><td>0,75&nbsp;$</td><td>1,50&nbsp;$</td><td>17,25&nbsp;$</td></tr>
        <tr><td>20,00&nbsp;$</td><td>1,00&nbsp;$</td><td>2,00&nbsp;$</td><td>23,00&nbsp;$</td></tr>
        <tr><td>25,00&nbsp;$</td><td>1,25&nbsp;$</td><td>2,49&nbsp;$</td><td>28,74&nbsp;$</td></tr>
        <tr><td>50,00&nbsp;$</td><td>2,50&nbsp;$</td><td>4,99&nbsp;$</td><td>57,49&nbsp;$</td></tr>
        <tr><td>75,00&nbsp;$</td><td>3,75&nbsp;$</td><td>7,48&nbsp;$</td><td>86,23&nbsp;$</td></tr>
        <tr><td>100,00&nbsp;$</td><td>5,00&nbsp;$</td><td>9,98&nbsp;$</td><td>114,98&nbsp;$</td></tr>
        <tr><td>150,00&nbsp;$</td><td>7,50&nbsp;$</td><td>14,96&nbsp;$</td><td>172,46&nbsp;$</td></tr>
        <tr><td>200,00&nbsp;$</td><td>10,00&nbsp;$</td><td>19,95&nbsp;$</td><td>229,95&nbsp;$</td></tr>
        <tr><td>250,00&nbsp;$</td><td>12,50&nbsp;$</td><td>24,94&nbsp;$</td><td>287,44&nbsp;$</td></tr>
        <tr><td>500,00&nbsp;$</td><td>25,00&nbsp;$</td><td>49,88&nbsp;$</td><td>574,88&nbsp;$</td></tr>
        <tr><td>750,00&nbsp;$</td><td>37,50&nbsp;$</td><td>74,81&nbsp;$</td><td>862,31&nbsp;$</td></tr>
        <tr><td>1 000,00&nbsp;$</td><td>50,00&nbsp;$</td><td>99,75&nbsp;$</td><td>1 149,75&nbsp;$</td></tr>
      </tbody>
    </table>
    <h2>Comment lire le tableau</h2>
    <p>Chaque ligne part du montant avant taxes. La TPS vaut 5&nbsp;% de ce montant, la TVQ 9,975&nbsp;%, et le total est la somme des trois. Raccourci&nbsp;: montant × 1,14975.</p>
    <h2>Petit écart d'arrondi</h2>
    <p>La TVQ exacte peut comporter une fraction de cent (par exemple 9,975&nbsp;$ sur 100&nbsp;$). Les montants sont arrondis au cent, ce qui peut créer un écart d'un cent selon la méthode.</p>
    <p>Besoin d'un montant absent du tableau&nbsp;? Utilisez la <a href="/">calculatrice TPS TVQ</a>. Pour retirer les taxes d'un total, voyez le <a href="/calcul-taxe-inverse-quebec/">calcul de taxe inverse</a> et les <a href="/taux-tps-tvq-quebec/">taux TPS TVQ au Québec</a>.</p>`,
    faqs: [
      { q: "Quel est le total taxes incluses sur 100 $ au Québec?", a: "114,98 $ : 5,00 $ de TPS plus 9,98 $ de TVQ s'ajoutent au montant de 100 $." },
      { q: "Comment calculer un montant absent du tableau?", a: "Multipliez le montant avant taxes par 1,14975 pour le total, ou par 0,05 et 0,09975 pour la TPS et la TVQ séparément." },
      { q: "Pourquoi un écart d'un cent parfois?", a: "Parce que la TVQ exacte comporte une fraction de cent. Selon qu'on arrondit chaque taxe ou le total, le résultat peut varier d'un cent." }
    ]
  },

  /* EN guide — "what is the tax in quebec" cluster (what is / how much is / what's the tax in quebec,
   * what is the sales tax in quebec, how much tax in quebec … ~2,500 searches/mo, KD 31–56).
   * Pair of the FR post /taxe-quebec-2026/. */
  {
    url: "/what-is-the-tax-in-quebec/",
    lang: "en",
    pair: ["/taxe-quebec-2026/", "/what-is-the-tax-in-quebec/"],
    short: "What is the tax in Quebec?",
    title: "What Is the Tax in Quebec? 14.975% (GST 5% + QST 9.975%) | 2026 Guide",
    desc: "The tax in Quebec is 14.975%: 5% GST plus 9.975% QST, so $100 costs $114.98. What's taxed and what isn't, tipping, tourist refunds, income tax and how Quebec compares.",
    h1: "What is the tax in Quebec?",
    intro: "Sales tax, what it applies to, and the other taxes you'll run into in Quebec in 2026.",
    datePublished: "2026-11-17",
    answer:
      "<p>The sales tax in Quebec is <strong>14.975%</strong>: the <strong>5% GST</strong> (federal) plus the <strong>9.975% QST</strong> (Quebec Sales Tax). Both are calculated on the price before tax, so a $100 item costs <strong>$114.98</strong>. Multiply a price by <strong>1.14975</strong> to get the total; divide a total by 1.14975 to remove the tax.</p>",
    facts: [
      { k: "GST (federal)", v: "5%" },
      { k: "QST (Quebec)", v: "9.975%" },
      { k: "Total sales tax", v: "14.975%" },
      { k: "$100 before tax", v: "$114.98" },
      { k: "Add tax", v: "× 1.14975" },
      { k: "Remove tax", v: "÷ 1.14975" }
    ],
    cta: postCta("/quebec-tax-calculator/", "Open the Quebec tax calculator", "Want the exact amount? The calculator adds or removes GST and QST instantly."),
    howto: {
      name: "Calculate the sales tax in Quebec",
      steps: [
        { name: "Calculate the GST", text: "Multiply the price before tax by 0.05 (5%)." },
        { name: "Calculate the QST", text: "Multiply the same price before tax by 0.09975 (9.975%)." },
        { name: "Add them up", text: "Add the price before tax, the GST and the QST to get the total. Shortcut: price × 1.14975." }
      ]
    },
    sections: `    <h2>The two sales taxes in Quebec</h2>
    <p>Quebec charges two separate sales taxes on most goods and services. The <strong>GST</strong> (Goods and Services Tax) is the 5% federal tax charged across Canada. The <strong>QST</strong> (Quebec Sales Tax, <em>TVQ</em> in French) is the 9.975% provincial tax collected by Revenu Québec. On a receipt they appear as two lines, often labelled TPS and TVQ.</p>
    <p>Both taxes are calculated on the price before tax: the QST is <strong>not</strong> charged on the GST. That's why the combined rate is simply 5% + 9.975% = 14.975%. Quebec does not use HST.</p>
    <h2>How much is tax on common amounts in Quebec?</h2>
${addTable("en", [1, 5, 10, 20, 50, 100, 250, 500, 1000])}
    <p>Each tax is rounded to the cent, so $100 gives $5.00 GST and $9.98 QST. If a price already includes tax, about 13% of it is tax (14.975 ÷ 114.975): use the <a href="/reverse-tax-calculator-quebec/">reverse tax calculator</a> to find the price before tax.</p>
    <h2>What isn't taxed in Quebec?</h2>
    <p>Some items are <strong>zero-rated</strong> (taxable at 0%) or <strong>exempt</strong>, so no GST or QST is added. The most common:</p>
    <ul>
      <li>Basic groceries: fresh fruit and vegetables, meat, milk, bread, eggs (but not snacks, soft drinks, candy or restaurant meals)</li>
      <li>Prescription drugs and many medical devices</li>
      <li>Residential rent and most child care</li>
      <li>Most health care and educational services</li>
      <li>The sale of a used (resale) home</li>
    </ul>
    <h2>Are prices in Quebec shown with tax included?</h2>
    <p>Usually not. Store shelves, menus and online prices are almost always shown <strong>before tax</strong>, and the 14.975% is added at the checkout. Two common exceptions: gasoline prices at the pump and SAQ (liquor store) prices already include tax.</p>
    <h2>Do you tip on the amount before or after tax?</h2>
    <p>In Quebec restaurants, tips of 15% to 20% are customary. Many people tip on the amount before tax. A handy shortcut: the two tax lines on your bill add up to almost exactly 15%, so tipping the same amount as the taxes is a 15% tip.</p>
    <h2>Can tourists get the tax back?</h2>
    <p>No. Canada ended its GST visitor rebate program in 2007, and Quebec does not refund the QST to visitors. Tourists pay the same 14.975% as residents on purchases in Quebec. (Businesses registered for GST/QST can claim input tax credits, which is a different system.)</p>
    <h2>How Quebec sales tax compares with other provinces</h2>
${provinceTable("en")}
    <p>Quebec's 14.975% is one of the highest in Canada, just under the 15% HST in New Brunswick, Newfoundland and Labrador and Prince Edward Island, and about 2 points above Ontario's 13% HST. See the <a href="/canada-sales-tax-calculator/">Canada sales tax calculator</a> to compare any amount.</p>
    <h2>Other taxes in Quebec</h2>
    <ul>
      <li><strong>Income tax:</strong> Quebec has its own income tax, from 14% to 25.75% in 2026, on top of federal tax (reduced by 16.5% for Quebec residents). See the <a href="/quebec-tax-brackets/">2026 Quebec tax brackets</a> or the <a href="/quebec-income-tax-calculator/">income tax calculator</a>.</li>
      <li><strong>Payroll deductions:</strong> QPP, EI and QPIP also come off each paycheque. The <a href="/quebec-paycheck-calculator/">Quebec paycheck calculator</a> shows your take-home pay.</li>
      <li><strong>Welcome tax:</strong> buyers of a home pay transfer duties to the municipality, from 0.5% to 1.5% and more in Montreal. See the <a href="/quebec-welcome-tax-calculator/">welcome tax calculator</a>.</li>
      <li><strong>Specific taxes:</strong> fuel, alcohol and tobacco carry extra taxes that are built into the price, and hotels add a lodging tax.</li>
    </ul>
    <p>Rates unchanged since 2013 (QST 9.975%) and 2008 (GST 5%). Sources: Revenu Québec and the Canada Revenue Agency.</p>`,
    faqs: [
      { q: "What is the tax in Quebec?", a: "14.975% in total: the 5% federal GST plus the 9.975% Quebec Sales Tax (QST), both calculated on the price before tax." },
      { q: "How much is tax on $100 in Quebec?", a: "$14.98: $5.00 of GST and $9.98 of QST, for a total of $114.98." },
      { q: "What is the QST?", a: "The Quebec Sales Tax (TVQ in French), a 9.975% provincial sales tax collected by Revenu Québec on most goods and services, in addition to the 5% GST." },
      { q: "Does Quebec have HST?", a: "No. Quebec charges the GST and the QST separately. HST is used in Ontario and the Atlantic provinces." },
      { q: "Is Quebec sales tax the highest in Canada?", a: "Almost. At 14.975%, Quebec is just below the 15% HST of New Brunswick, Newfoundland and Labrador and Prince Edward Island, and above Ontario (13%), BC and Manitoba (12%), Saskatchewan (11%) and Alberta (5%)." },
      { q: "Do tourists get sales tax back in Quebec?", a: "No. The federal visitor rebate program ended in 2007 and Quebec does not refund the QST to visitors." },
      { q: "Is tax included in prices in Quebec?", a: "Usually not: most prices are shown before tax and the 14.975% is added at checkout. Gas at the pump and SAQ prices include tax." }
    ]
  },
];

/* turn raw posts into renderable page objects */
const MONTHS = {
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
};
function monthName(iso, lang) { return MONTHS[lang === "en" ? "en" : "fr"][Number(iso.split("-")[1]) - 1]; }
const posts = POSTS_RAW.map((p) => {
  const lang = p.lang || "fr";
  // EN guides sit outside the (French) blog index: Home › guide
  const crumbs = lang === "en"
    ? [{ name: "Home", href: "/quebec-tax-calculator/" }, { name: p.short, href: p.url }]
    : [{ name: "Accueil", href: "/" }, { name: "Blogue", href: BLOG }, { name: p.short, href: p.url }];
  const mod = p.dateModified || BUILD_DATE;
  const meta = lang === "en" ? `Updated ${monthName(mod, "en")} ${UPDATED_YEAR}` : `Mis à jour en ${monthName(mod, "fr")} ${UPDATED_YEAR}`;
  const body =
    `  <p class="post-meta">${meta}</p>\n` +
    `  ${answerBox(lang, p.answer)}\n` +
    `  ${keyFacts(lang, p.facts)}\n` +
    `  ${p.cta}\n` +
    `  <article class="prose">\n${p.sections}\n  </article>`;
  return {
    url: p.url,
    out: p.url.replace(/^\//, "").replace(/\/$/, "") + "/index.html",
    lang,
    pair: p.pair,
    showCalc: false,
    title: p.title,
    desc: p.desc,
    h1: p.h1,
    intro: p.intro,
    crumbs,
    faqs: p.faqs,
    body,
    modified: p.dateModified,
    schemaHtml: postSchema({ ...p, crumbs, lang })
  };
});

/* blog index */
const blogIndex = {
  url: BLOG,
  out: "blog/index.html",
  lang: "fr",
  showCalc: false,
  hideLinks: false,
  title: "Blogue — Calcul Taxes Québec | TPS, TVQ et taxe inverse",
  desc: "Guides simples et directs sur les taxes au Québec : calcul de la TPS et de la TVQ, taxe inverse, prix avant taxes et taux en vigueur.",
  h1: "Blogue",
  intro: "Des guides courts et précis sur la TPS, la TVQ et le calcul des taxes au Québec.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Blogue", href: BLOG }],
  faqs: null,
  body:
    `  <div class="post-list">\n` +
    POSTS_RAW.filter((p) => !p.lang || p.lang === "fr").map((p) => `    <a href="${p.url}"><h2>${p.short}</h2><p>${p.desc}</p></a>`).join("\n") +
    `\n  </div>`,
  schemaHtml: jsonLd({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": SITE + "/#website", url: SITE + "/", name: "Calcul Taxes Québec", inLanguage: "fr-CA", publisher: { "@id": SITE + "/#org" } },
      { "@type": "Organization", "@id": SITE + "/#org", name: "Calcul Taxes Québec", url: SITE + "/", logo: { "@type": "ImageObject", url: SITE + "/icons/icon-512.png" } },
      {
        "@type": "Blog",
        "@id": SITE + BLOG + "#blog",
        url: SITE + BLOG,
        name: "Blogue — Calcul Taxes Québec",
        inLanguage: "fr-CA",
        blogPost: POSTS_RAW.filter((p) => !p.lang || p.lang === "fr").map((p) => ({ "@type": "BlogPosting", headline: stripTags(p.h1), url: SITE + p.url, datePublished: p.datePublished, dateModified: BUILD_DATE }))
      },
      {
        "@type": "BreadcrumbList",
        "@id": SITE + BLOG + "#breadcrumb",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: SITE + "/" },
          { "@type": "ListItem", position: 2, name: "Blogue", item: SITE + BLOG }
        ]
      }
    ]
  })
};

/* all blog routes get rendered through the standard layout */
const blogPages = [blogIndex, ...posts];

/* --------------------------------- write ---------------------------------- */

const root = __dirname;
[...pages, ...blogPages].forEach((p) => {
  const html = layout(p);
  const outPath = path.join(root, p.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  console.log("wrote", p.out);
});

/* sitemap.xml */
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  [...pages, ...blogPages]
    .map((p) => {
      let alt = "";
      if (p.pair) {
        alt =
          `\n    <xhtml:link rel="alternate" hreflang="fr-CA" href="${SITE}${p.pair[0]}"/>` +
          `\n    <xhtml:link rel="alternate" hreflang="en-CA" href="${SITE}${p.pair[1]}"/>` +
          `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${p.pair[0]}"/>`;
      } else if (p.url === "/" || p.url === "/quebec-tax-calculator/") {
        alt =
          `\n    <xhtml:link rel="alternate" hreflang="fr-CA" href="${SITE}/"/>` +
          `\n    <xhtml:link rel="alternate" hreflang="en-CA" href="${SITE}/quebec-tax-calculator/"/>` +
          `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>`;
      }
      const priority = p.url === "/" ? "1.0" : p.url.startsWith(BLOG) ? "0.6" : "0.8";
      return `  <url>\n    <loc>${SITE}${p.url}</loc>\n    <lastmod>${p.modified || BUILD_DATE}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>${alt}\n  </url>`;
    })
    .join("\n") +
  `\n</urlset>\n`;
fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap);
console.log("wrote sitemap.xml");

/* llms.txt — concise, quotable summary for AI answer engines (GEO/AEO) */
const llms = `# Calcul Taxes Québec

> Calculatrice gratuite de TPS et TVQ pour le Québec. Ajoute ou retire les taxes
> instantanément, avec calcul de taxe inverse. Aucun compte requis.

## Faits sur les taxes au Québec (${UPDATED_YEAR})
- TPS (taxe fédérale, Canada): 5 %
- TVQ (taxe provinciale, Québec): 9,975 %
- Taux combiné: 14,975 %
- La TVQ se calcule sur le prix avant taxes, pas sur la TPS.
- Ajouter les taxes: total = montant avant taxes × 1,14975
- Retirer les taxes (inverse): montant avant taxes = total ÷ 1,14975
- Exemple: 100,00 $ avant taxes → TPS 5,00 $ + TVQ 9,98 $ = 114,98 $ total.
- Taux inchangés depuis 2013 (TVQ 9,975 %) et 2008 (TPS 5 %).

## Salaire net (paie, ${UPDATED_YEAR})
- Salaire net = salaire brut − impôt fédéral − impôt du Québec − RRQ − assurance-emploi − RQAP.
- RRQ: 6,3 % entre 3 500 $ et 74 600 $, puis 4 % jusqu'à 85 000 $.
- Assurance-emploi (Québec): 1,30 % jusqu'à 68 900 $.
- RQAP: 0,430 % jusqu'à 103 000 $.
- Exemple: 60 000 $ brut ≈ 45 857 $ net/an (~3 821 $/mois), soit ~23,6 % de retenues.

## Taxes de vente au Canada (${UPDATED_YEAR})
${PROV.map((p) => `- ${p.fr}: ${stripTags(provParts(p, "fr"))} = ${stripTags(pct(p.rate, "fr", 3))}`).join("\n")}

## Impôt sur le revenu (${UPDATED_YEAR})
- Tranches du Québec: 14 % jusqu'à ${QC_BR[0][0]} $, 19 % jusqu'à ${QC_BR[1][0]} $, 24 % jusqu'à ${QC_BR[2][0]} $, 25,75 % au-delà.
- Tranches fédérales: ${FED_BR.map(([c, r]) => `${String(Math.round(r * 1000) / 10).replace(".", ",")} %${c === Infinity ? " au-delà" : " jusqu'à " + c + " $"}`).join(", ")}.
- Abattement du Québec: 16,5 % de l'impôt fédéral de base.
- Taux marginal combiné: de ${stripTags(pct(combinedBands()[0].total, "fr"))} à ${stripTags(pct(TOP_COMBINED, "fr"))}.
- Exemple: 60 000 $ de salaire ≈ ${Math.round(S60.tax)} $ d'impôt (fédéral ${Math.round(S60.fed)} $ + Québec ${Math.round(S60.qc)} $), paie nette ≈ ${Math.round(P60.net / 26)} $ aux 2 semaines.

## Calculatrices
- Calcul taxes Québec (accueil): ${SITE}/
- Calcul taxe inverse (retirer): ${SITE}/calcul-taxe-inverse-quebec/
- Calcul salaire net Québec (brut → net): ${SITE}/calcul-salaire-net-quebec/
- Calcul paie net Québec (par paie / taux horaire): ${SITE}/calcul-paie-net-quebec/
- Calcul impôt Québec: ${SITE}/calcul-impot-quebec/
- Tranches d'imposition Québec 2026: ${SITE}/tranches-imposition-quebec/
- Taux TPS TVQ Québec: ${SITE}/taux-tps-tvq-quebec/
- Quebec Tax Calculator (English): ${SITE}/quebec-tax-calculator/
- Quebec Paycheck Calculator (English): ${SITE}/quebec-paycheck-calculator/
- Quebec Tax Brackets 2026 (English): ${SITE}/quebec-tax-brackets/
- Quebec Tax Rate (English): ${SITE}/quebec-tax-rate/
- Calcul taxes Canada (toutes les provinces): ${SITE}/calcul-taxes-canada/
- Canada Sales Tax Calculator (English): ${SITE}/canada-sales-tax-calculator/
- Calcul taxes Ontario (TVH 13 %): ${SITE}/calcul-taxes-ontario/
- Ontario Sales Tax Calculator (English): ${SITE}/ontario-sales-tax-calculator/

## Guides (blogue)
${POSTS_RAW.map((p) => `- ${stripTags(p.h1)}: ${SITE}${p.url}`).join("\n")}

## À propos
Langue principale: français (Québec). Version anglaise disponible.
Montants arrondis au cent près. Information fournie à titre indicatif.
`;
fs.writeFileSync(path.join(root, "llms.txt"), llms);
console.log("wrote llms.txt");

/* robots.txt — explicitly welcomes Bingbot (Bing Webmaster Guidelines) */
const robots = `User-agent: Bingbot
Allow: /

User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
fs.writeFileSync(path.join(root, "robots.txt"), robots);
console.log("wrote robots.txt");
void INDEXNOW_KEY;

console.log("Build complete.");
