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
const BUILD_DATE = "2026-11-11";
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

function salaryCard(lang) {
  const fr = lang !== "en";
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
  return `<div class="card calc salary" data-salary>
    <div class="field">
      <label for="salary">${L.label}</label>
      <div class="input-money">
        <input id="salary" data-sal-input type="text" inputmode="decimal" autocomplete="off"
               enterkeyhint="done" placeholder="${L.placeholder}">
        <span class="cur" aria-hidden="true">$</span>
      </div>
      <div class="freq">
        <select data-sal-freq aria-label="${L.per}">
          <option value="year" selected>${L.year}</option>
          <option value="month">${L.month}</option>
          <option value="biweek">${L.biweek}</option>
          <option value="week">${L.week}</option>
          <option value="hour">${L.hour}</option>
        </select>
        <label class="hours" data-sal-hourswrap hidden>${L.hours}
          <input data-sal-hours type="text" inputmode="decimal" autocomplete="off" value="40">
        </label>
      </div>
    </div>
    <div class="result" aria-live="polite">
      <div class="total-box">
        <span class="lbl">${L.net}</span>
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
    { href: "/taux-tps-tvq-quebec/", label: "Taux TPS TVQ Québec", sub: "TPS 5 %, TVQ 9,975 %" },
    { href: "/quebec-tax-calculator/", label: "Quebec Tax Calculator", sub: "Version anglaise" }
  ] : [
    { href: "/quebec-tax-calculator/", label: "Quebec Sales Tax Calculator", sub: "Add GST and QST" },
    { href: "/reverse-tax-calculator-quebec/", label: "Reverse Tax Calculator Quebec", sub: "Remove tax from a price" },
    { href: "/quebec-income-tax-calculator/", label: "Quebec Income Tax Calculator", sub: "Salary after tax, 2026" },
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
    dateModified: BUILD_DATE,
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

/* --------------------------------- pages ---------------------------------- */

const pages = [];

// 1. Home (FR)
pages.push({
  url: "/",
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
    <p>Vous avez un prix avec taxes incluses? Choisissez «&nbsp;Retirer les taxes&nbsp;» dans la calculatrice, entrez le total et obtenez le montant avant taxes, la TPS et la TVQ. Pour une page dédiée, consultez le <a href="/calcul-taxe-inverse-quebec/">calcul de taxe inverse</a>.</p>
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
  out: "calcul-taxe-inverse-quebec/index.html",
  pair: ["/calcul-taxe-inverse-quebec/", "/reverse-tax-calculator-quebec/"],
  lang: "fr",
  mode: "remove",
  title: "Calcul Taxe Inverse Québec 2026 : Total ÷ 1,14975",
  desc: "Calcul taxes inversé 2026 : divisez le prix taxes incluses par 1,14975. 114,98 $ = 100 $ avant taxes, 5,00 $ de TPS et 9,98 $ de TVQ. Calculatrice instantanée.",
  h1: "Calcul Taxe Inverse Québec",
  intro:
    "Vous avez un prix avec taxes incluses? Entrez le total et la calculatrice vous donne le montant avant taxes, la TPS et la TVQ.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Calcul Taxe Inverse Québec", href: "/calcul-taxe-inverse-quebec/" }],
  faqs: FAQ_INVERSE.concat([
    { q: "Comment calculer le montant avant taxes de 50 $?", a: "Divisez 50&nbsp;$ par 1,14975&nbsp;: le prix avant taxes est de 43,49&nbsp;$, dont 2,17&nbsp;$ de TPS et 4,34&nbsp;$ de TVQ incluses." },
    { q: "Quel pourcentage de taxes est inclus dans un prix au Québec?", a: "Environ 13,02&nbsp;% d'un prix taxes incluses est constitué de taxes (14,975 ÷ 114,975). Retirer 14,975&nbsp;% du total est une erreur courante&nbsp;: on obtiendrait un montant trop bas." }
  ]),
  body:
    quickAnswer("fr", "<p>Pour retirer les taxes d'un prix au Québec, <b>divisez le total par 1,14975</b>. Exemple&nbsp;: 114,98&nbsp;$ ÷ 1,14975 = <b>100,00&nbsp;$ avant taxes</b>, dont 5,00&nbsp;$ de TPS et 9,98&nbsp;$ de TVQ. Environ 13&nbsp;% d'un prix taxes incluses, c'est des taxes.</p>") +
    TRUST_FR +
    `
  <section class="content" aria-labelledby="rtable-title">
    <h2 id="rtable-title">Prix avant taxes pour les montants courants</h2>
${removeTable("fr", [5, 10, 20, 50, 100, 150, 200, 250, 500, 1000, 1500, 2000, 5000])}
  </section>` +
    `
  <section class="content" aria-labelledby="rev-title">
    <h2 id="rev-title">Retirer les taxes d'un prix</h2>
    <p>Le calcul de taxe inverse part d'un prix avec taxes incluses pour retrouver le montant avant taxes. On divise le total par 1,14975, puis on répartit la TPS (5&nbsp;%) et la TVQ (9,975&nbsp;%).</p>
    <h3>Exemple sur 114,98&nbsp;$</h3>
    <p>Pour un total de 114,98&nbsp;$ avec taxes incluses, le montant avant taxes est d'environ 100,00&nbsp;$, la TPS d'environ 5,00&nbsp;$ et la TVQ d'environ 9,98&nbsp;$.</p>
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
  title: "Taux TPS TVQ Québec 2026 | Taxes au Québec",
  desc: "Consultez les taux TPS et TVQ au Québec. TPS 5%, TVQ 9,975% et taux combiné de 14,975%.",
  h1: "Taux TPS TVQ Québec",
  intro:
    "Consultez les taux courants de TPS et de TVQ au Québec et calculez instantanément les taxes sur un montant.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Taux TPS TVQ Québec", href: "/taux-tps-tvq-quebec/" }],
  faqs: FAQ_TAUX,
  body:
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
    <h2>Calculer un montant</h2>
    <p>Entrez un montant ci-dessus pour voir la TPS, la TVQ et le total. Pour retirer les taxes d'un prix, utilisez le <a href="/calcul-taxe-inverse-quebec/">calcul de taxe inverse</a>.</p>
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
  out: "reverse-tax-calculator-quebec/index.html",
  pair: ["/calcul-taxe-inverse-quebec/", "/reverse-tax-calculator-quebec/"],
  lang: "en",
  mode: "remove",
  title: "Reverse Tax Calculator Quebec 2026: Total ÷ 1.14975",
  desc: "Remove Quebec GST and QST from a tax-included price: divide by 1.14975. $114.98 = $100 before tax, $5.00 GST and $9.98 QST. Free reverse sales tax calculator.",
  h1: "Reverse Tax Calculator Quebec",
  intro: "Enter a price that already includes tax and get the amount before tax, plus the GST and QST it contains.",
  crumbs: [{ name: "Home", href: "/quebec-tax-calculator/" }, { name: "Reverse Tax Calculator Quebec", href: "/reverse-tax-calculator-quebec/" }],
  faqs: [
    { q: "How do you reverse calculate Quebec sales tax?", a: "Divide the tax-included price by 1.14975. The result is the price before tax; 5% of it is the GST and 9.975% of it is the QST." },
    { q: "What is the price before tax of $50 in Quebec?", a: "$50 ÷ 1.14975 = $43.49 before tax, with $2.17 of GST and $4.34 of QST included." },
    { q: "What percentage of a Quebec price is tax?", a: "About 13.02% of a tax-included price is tax (14.975 ÷ 114.975). Taking 14.975% off the total is a common mistake that gives too low a number." },
    { q: "Why is my reverse calculation off by a cent?", a: "Each tax is rounded to the cent on the original bill, so working backwards can differ by a cent or two from the shelf price." },
    { q: "Does the reverse calculator work for HST provinces?", a: "No. It uses Quebec's GST (5%) and QST (9.975%). HST provinces use one harmonized rate, for example 13% in Ontario." }
  ],
  body:
    quickAnswer("en", "<p>To take tax out of a Quebec price, <b>divide the total by 1.14975</b>. Example: $114.98 ÷ 1.14975 = <b>$100.00 before tax</b>, which includes $5.00 GST and $9.98 QST. About 13% of any tax-included Quebec price is tax.</p>") +
    TRUST_EN +
    `
  <section class="content" aria-labelledby="rev-en-table">
    <h2 id="rev-en-table">Price before tax for common Quebec totals</h2>
${removeTable("en", [5, 10, 20, 50, 100, 150, 200, 250, 500, 1000, 1500, 2000, 5000])}
    <h2>Reverse vs forward: which do you need?</h2>
    <p>Use reverse when you have a receipt or a price that already includes tax and need the amount before tax, for an expense report, a bookkeeping entry or an input tax credit claim. To add tax to a price, use the <a href="/quebec-tax-calculator/">Quebec sales tax calculator</a>.</p>
    <h2>Why not just subtract 14.975%?</h2>
    <p>Tax was added on the price before tax, so it must be removed by dividing. On $114.98, subtracting 14.975% gives $97.76, which is $2.24 too low. Dividing by 1.14975 gives the correct $100.00.</p>
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
  }
];

/* turn raw posts into renderable page objects */
const FR_DATE = { "01": "janvier", "06": "juin" };
function frMonth(iso) {
  const [, m] = iso.split("-");
  return FR_DATE[m] || "2026";
}
const posts = POSTS_RAW.map((p) => {
  const crumbs = [
    { name: "Accueil", href: "/" },
    { name: "Blogue", href: BLOG },
    { name: p.short, href: p.url }
  ];
  const meta = `Mis à jour en ${frMonth(BUILD_DATE)} ${UPDATED_YEAR}`;
  const body =
    `  <p class="post-meta">${meta}</p>\n` +
    `  ${answerBox("fr", p.answer)}\n` +
    `  ${keyFacts("fr", p.facts)}\n` +
    `  ${p.cta}\n` +
    `  <article class="prose">\n${p.sections}\n  </article>`;
  return {
    url: p.url,
    out: p.url.replace(/^\//, "").replace(/\/$/, "") + "/index.html",
    lang: "fr",
    showCalc: false,
    title: p.title,
    desc: p.desc,
    h1: p.h1,
    intro: p.intro,
    crumbs,
    faqs: p.faqs,
    body,
    schemaHtml: postSchema({ ...p, crumbs, lang: "fr" })
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
    POSTS_RAW.map((p) => `    <a href="${p.url}"><h2>${p.short}</h2><p>${p.desc}</p></a>`).join("\n") +
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
        blogPost: POSTS_RAW.map((p) => ({ "@type": "BlogPosting", headline: stripTags(p.h1), url: SITE + p.url, datePublished: p.datePublished, dateModified: BUILD_DATE }))
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
      return `  <url>\n    <loc>${SITE}${p.url}</loc>\n    <lastmod>${BUILD_DATE}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>${alt}\n  </url>`;
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

## Calculatrices
- Calcul taxes Québec (accueil): ${SITE}/
- Calcul taxe inverse (retirer): ${SITE}/calcul-taxe-inverse-quebec/
- Calcul salaire net Québec (brut → net): ${SITE}/calcul-salaire-net-quebec/
- Taux TPS TVQ Québec: ${SITE}/taux-tps-tvq-quebec/
- Quebec Tax Calculator (English): ${SITE}/quebec-tax-calculator/

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
