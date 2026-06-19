#!/usr/bin/env node
/* Static site generator for calcultaxesquebec.ca
 * Outputs plain HTML (no runtime framework). Run: node build.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const SITE = "https://calcultaxesquebec.ca";
const UPDATED_YEAR = "2026";
const BUILD_DATE = "2026-06-10";
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
    { href: "/calcul-tps-tvq/", label: "Calcul TPS TVQ" },
    { href: "/calcul-taxe-inverse-quebec/", label: "Taxe inverse" },
    { href: "/calcul-salaire-net-quebec/", label: "Salaire net" },
    { href: "/taux-tps-tvq-quebec/", label: "Taux TPS TVQ" },
    { href: "/blog/", label: "Blogue" },
    { href: "/quebec-tax-calculator/", label: "English" }
  ],
  en: [
    { href: "/quebec-tax-calculator/", label: "Home" },
    { href: "/calcul-tps-tvq/", label: "Calcul TPS TVQ" },
    { href: "/calcul-taxe-inverse-quebec/", label: "Taxe inverse" },
    { href: "/calcul-salaire-net-quebec/", label: "Salaire net" },
    { href: "/taux-tps-tvq-quebec/", label: "Taux TPS TVQ" },
    { href: "/blog/", label: "Blogue" }
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
  const all = [
    { href: "/calcul-tps-tvq/", label: "Calcul TPS TVQ", subFr: "Ajouter la TPS et la TVQ", subEn: "Add GST and QST" },
    { href: "/calcul-taxe-inverse-quebec/", label: "Calcul Taxe Inverse Québec", subFr: "Retirer les taxes d'un prix", subEn: "Remove tax from a price" },
    { href: "/calculateur-de-taxes-quebec/", label: "Calculateur de taxes Québec", subFr: "TPS, TVQ et total en un clic", subEn: "GST, QST and total in one click" },
    { href: "/tps-tvq-en-ligne/", label: "TPS TVQ en ligne", subFr: "Calculatrice gratuite et instantanée", subEn: "Free, instant online calculator" },
    { href: "/calcul-salaire-net-quebec/", label: "Calcul salaire net Québec", subFr: "Salaire brut en net (impôts, RRQ…)", subEn: "Gross-to-net pay (tax, QPP…)" },
    { href: "/quebec-tax-calculator/", label: "Quebec Tax Calculator", subFr: "Version anglaise", subEn: "English version" },
    { href: "/taux-tps-tvq-quebec/", label: "Taux TPS TVQ Québec", subFr: "TPS 5 %, TVQ 9,975 %", subEn: "GST 5%, QST 9.975%" }
  ].filter((l) => l.href !== currentPath);
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
  if (page.url === "/" || page.url === "/quebec-tax-calculator/") {
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

/* --------------------------------- pages ---------------------------------- */

const pages = [];

// 1. Home (FR)
pages.push({
  url: "/",
  out: "index.html",
  lang: "fr",
  mode: "add",
  title: "Calcul Taxes Québec 2026 | Calculatrice TPS TVQ Simple",
  desc: "Calculez rapidement la TPS et la TVQ au Québec en 2026. Entrez un montant avant ou avec taxes et obtenez le total instantanément. Taux à jour : TPS 5 %, TVQ 9,975 %.",
  h1: "Calcul Taxes Québec",
  intro:
    "Entrez un montant et voyez instantanément la TPS, la TVQ et le total avec taxes. Simple, rapide et fait pour le Québec.",
  crumbs: [{ name: "Accueil", href: "/" }],
  faqs: FAQ_HOME,
  body:
    TRUST_FR +
    `
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

// 2. /calcul-tps-tvq/ (FR)
pages.push({
  url: "/calcul-tps-tvq/",
  out: "calcul-tps-tvq/index.html",
  lang: "fr",
  mode: "add",
  title: "Calcul TPS TVQ 2026 | Calculatrice Québec Rapide",
  desc: "Calculez la TPS et la TVQ en quelques secondes avec les taux 2026. Entrez un montant et obtenez le sous-total, la TPS, la TVQ et le total avec taxes.",
  h1: "Calcul TPS TVQ",
  intro:
    "Entrez un montant et obtenez le sous-total, la TPS, la TVQ et le total avec taxes. Une calculatrice TPS/TVQ rapide, pensée pour le Québec.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Calcul TPS TVQ", href: "/calcul-tps-tvq/" }],
  faqs: FAQ_TPSTVQ,
  body:
    TRUST_FR +
    `
  <section class="content" aria-labelledby="how-title">
    <h2 id="how-title">Comment calculer la TPS et la TVQ</h2>
    <p>Pour calculer la TPS et la TVQ, multipliez le montant avant taxes par 5&nbsp;% pour la TPS, puis par 9,975&nbsp;% pour la TVQ. Le total avec taxes correspond au montant avant taxes additionné de la TPS et de la TVQ.</p>
    <h3>Exemple sur 100&nbsp;$</h3>
    <p>Sur un montant de 100,00&nbsp;$&nbsp;: la TPS est de 5,00&nbsp;$, la TVQ est de 9,98&nbsp;$ et le total avec taxes est de 114,98&nbsp;$.</p>
    <h2>Ajouter ou retirer les taxes</h2>
    <p>Utilisez «&nbsp;Ajouter les taxes&nbsp;» pour partir d'un prix avant taxes, ou «&nbsp;Retirer les taxes&nbsp;» pour un prix avec taxes incluses. Pour retirer les taxes, voyez le <a href="/calcul-taxe-inverse-quebec/">calcul de taxe inverse</a>.</p>
  </section>`
});

// 3. /calcul-taxe-inverse-quebec/ (FR)
pages.push({
  url: "/calcul-taxe-inverse-quebec/",
  out: "calcul-taxe-inverse-quebec/index.html",
  lang: "fr",
  mode: "remove",
  title: "Calcul Taxe Inverse Québec 2026 | Retirer TPS TVQ",
  desc: "Retirez rapidement la TPS et la TVQ d'un prix avec taxes incluses (taux 2026). Entrez le total et voyez le montant avant taxes.",
  h1: "Calcul Taxe Inverse Québec",
  intro:
    "Vous avez un prix avec taxes incluses? Entrez le total et la calculatrice vous donne le montant avant taxes, la TPS et la TVQ.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Calcul Taxe Inverse Québec", href: "/calcul-taxe-inverse-quebec/" }],
  faqs: FAQ_INVERSE,
  body:
    TRUST_FR +
    `
  <section class="content" aria-labelledby="rev-title">
    <h2 id="rev-title">Retirer les taxes d'un prix</h2>
    <p>Le calcul de taxe inverse part d'un prix avec taxes incluses pour retrouver le montant avant taxes. On divise le total par 1,14975, puis on répartit la TPS (5&nbsp;%) et la TVQ (9,975&nbsp;%).</p>
    <h3>Exemple sur 114,98&nbsp;$</h3>
    <p>Pour un total de 114,98&nbsp;$ avec taxes incluses, le montant avant taxes est d'environ 100,00&nbsp;$, la TPS d'environ 5,00&nbsp;$ et la TVQ d'environ 9,98&nbsp;$.</p>
    <h2>Pourquoi un petit écart est possible</h2>
    <p>Comme les taxes sont arrondies au cent, le montant avant taxes obtenu par calcul inverse peut différer de quelques cents du prix original. Les montants sont arrondis au cent près.</p>
    <h2>Calculer dans l'autre sens</h2>
    <p>Pour ajouter les taxes à un prix avant taxes, utilisez le <a href="/calcul-tps-tvq/">calcul TPS TVQ</a>.</p>
  </section>`
});

// 4. /quebec-tax-calculator/ (EN)
pages.push({
  url: "/quebec-tax-calculator/",
  out: "quebec-tax-calculator/index.html",
  lang: "en",
  mode: "add",
  title: "Quebec Tax Calculator 2026 | GST QST Calculator",
  desc: "Calculate Quebec GST and QST instantly with up-to-date 2026 rates. Enter a price before or after tax and get the subtotal, GST, QST, and total.",
  h1: "Quebec Tax Calculator",
  intro:
    "Enter an amount and instantly calculate Quebec GST, QST, and the total with tax. Simple, fast, and made for Quebec.",
  crumbs: [{ name: "Home", href: "/quebec-tax-calculator/" }],
  faqs: FAQ_EN,
  body:
    TRUST_EN +
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

// 6. /calculateur-de-taxes-quebec/ (FR) — targets "calculateur de taxes" cluster
pages.push({
  url: "/calculateur-de-taxes-quebec/",
  out: "calculateur-de-taxes-quebec/index.html",
  lang: "fr",
  mode: "add",
  title: "Calculateur de Taxes Québec 2026 | TPS TVQ en un clic",
  desc: "Calculateur de taxes pour le Québec : entrez un montant et obtenez la TPS (5 %), la TVQ (9,975 %) et le total. Ajoute ou retire les taxes, taux 2026.",
  h1: "Calculateur de taxes Québec",
  intro:
    "Un calculateur de taxes simple pour le Québec : entrez un montant et obtenez instantanément la TPS, la TVQ et le total avec taxes, ou faites le calcul inverse.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "Calculateur de taxes Québec", href: "/calculateur-de-taxes-quebec/" }],
  faqs: [
    { q: "Comment fonctionne le calculateur de taxes?", a: "Entrez un montant&nbsp;: le calculateur applique 5&nbsp;% de TPS et 9,975&nbsp;% de TVQ sur le prix avant taxes, puis affiche le sous-total, chaque taxe et le total. En mode «&nbsp;Retirer les taxes&nbsp;», il part d'un prix taxes incluses." },
    { q: "Le calculateur de taxes est-il gratuit?", a: "Oui. Le calculateur est entièrement gratuit, sans inscription ni publicité, et fonctionne directement dans le navigateur." },
    { q: "Quel taux de taxe le calculateur utilise-t-il?", a: "Les taux courants du Québec&nbsp;: TPS 5&nbsp;% et TVQ 9,975&nbsp;%, soit un taux combiné de 14,975&nbsp;% sur la plupart des produits et services taxables." },
    { q: "Puis-je calculer le montant avant taxes?", a: "Oui. Choisissez «&nbsp;Retirer les taxes&nbsp;» et entrez le prix taxes incluses&nbsp;: le calculateur divise par 1,14975 pour retrouver le montant avant taxes." }
  ],
  body:
    TRUST_FR +
    `
  <section class="content" aria-labelledby="use-title">
    <h2 id="use-title">Un calculateur de taxes pensé pour le Québec</h2>
    <p>Ce calculateur de taxes additionne la TPS et la TVQ sur n'importe quel montant, sans calcul manuel ni risque d'erreur d'arrondi. Il sépare clairement chaque taxe pour vos factures, devis et dépenses.</p>
    <h2>Table de référence des taxes</h2>
    <table class="data-table">
      <thead><tr><th>Montant avant taxes</th><th>TPS (5&nbsp;%)</th><th>TVQ (9,975&nbsp;%)</th><th>Total avec taxes</th></tr></thead>
      <tbody>
        <tr><td>20,00&nbsp;$</td><td>1,00&nbsp;$</td><td>2,00&nbsp;$</td><td>23,00&nbsp;$</td></tr>
        <tr><td>50,00&nbsp;$</td><td>2,50&nbsp;$</td><td>4,99&nbsp;$</td><td>57,49&nbsp;$</td></tr>
        <tr><td>100,00&nbsp;$</td><td>5,00&nbsp;$</td><td>9,98&nbsp;$</td><td>114,98&nbsp;$</td></tr>
        <tr><td>500,00&nbsp;$</td><td>25,00&nbsp;$</td><td>49,88&nbsp;$</td><td>574,88&nbsp;$</td></tr>
        <tr><td>1 000,00&nbsp;$</td><td>50,00&nbsp;$</td><td>99,75&nbsp;$</td><td>1 149,75&nbsp;$</td></tr>
      </tbody>
    </table>
    <h2>Ajouter ou retirer les taxes</h2>
    <p>Utilisez «&nbsp;Ajouter les taxes&nbsp;» pour partir d'un prix avant taxes, ou «&nbsp;Retirer les taxes&nbsp;» pour un prix taxes incluses. Pour un calcul détaillé pas à pas, voyez <a href="/comment-calculer-tps-tvq-quebec/">comment calculer la TPS et la TVQ</a> ou les <a href="/taux-tps-tvq-quebec/">taux TPS TVQ au Québec</a>.</p>
  </section>`
});

// 7. /tps-tvq-en-ligne/ (FR) — targets "tps tvq en ligne" / online intent
pages.push({
  url: "/tps-tvq-en-ligne/",
  out: "tps-tvq-en-ligne/index.html",
  lang: "fr",
  mode: "add",
  title: "Calculatrice TPS TVQ en ligne 2026 | Gratuite et instantanée",
  desc: "Calculatrice TPS TVQ en ligne, gratuite et instantanée. Calculez les taxes du Québec depuis votre mobile ou ordinateur, sans inscription. Taux 2026.",
  h1: "Calculatrice TPS TVQ en ligne",
  intro:
    "Calculez la TPS et la TVQ en ligne, directement dans votre navigateur. Gratuit, instantané, sans inscription et utilisable sur mobile.",
  crumbs: [{ name: "Accueil", href: "/" }, { name: "TPS TVQ en ligne", href: "/tps-tvq-en-ligne/" }],
  faqs: [
    { q: "La calculatrice TPS TVQ en ligne est-elle gratuite?", a: "Oui. Elle est entièrement gratuite, sans compte ni publicité. Vous entrez un montant et le résultat s'affiche immédiatement." },
    { q: "Faut-il installer une application?", a: "Non. La calculatrice fonctionne directement dans le navigateur. Vous pouvez aussi l'ajouter à votre écran d'accueil pour l'utiliser comme une appli, même hors ligne." },
    { q: "Fonctionne-t-elle sur téléphone mobile?", a: "Oui. L'interface est pensée pour le mobile avec un clavier numérique, des montants rapides et un affichage clair de la TPS, de la TVQ et du total." },
    { q: "Mes montants sont-ils enregistrés?", a: "Non. Le calcul se fait localement dans votre navigateur. Aucun montant n'est envoyé ni conservé." }
  ],
  body:
    TRUST_FR +
    `
  <section class="content" aria-labelledby="online-title">
    <h2 id="online-title">Calculer la TPS et la TVQ en ligne, instantanément</h2>
    <p>Pas besoin d'installer quoi que ce soit&nbsp;: entrez un montant et la calculatrice affiche la TPS (5&nbsp;%), la TVQ (9,975&nbsp;%) et le total pendant que vous tapez. Le calcul se fait dans votre navigateur, sans envoi de données.</p>
    <h2>Sur mobile comme sur ordinateur</h2>
    <ul class="benefits">
      <li>Clavier numérique sur mobile</li>
      <li>Montants rapides en un toucher</li>
      <li>Résultat copiable</li>
      <li>Aucune inscription</li>
      <li>Fonctionne hors ligne une fois ouverte</li>
    </ul>
    <h2>Ajouter ou retirer les taxes en ligne</h2>
    <p>Choisissez «&nbsp;Ajouter les taxes&nbsp;» pour un prix avant taxes, ou «&nbsp;Retirer les taxes&nbsp;» pour un prix taxes incluses. Pour la version dédiée au calcul inverse, voyez le <a href="/calcul-taxe-inverse-quebec/">calcul de taxe inverse</a>, ou le <a href="/calcul-tps-tvq/">calcul TPS TVQ</a> pour ajouter les taxes.</p>
  </section>`
});

// 8. /calcul-salaire-net-quebec/ (FR) — net-pay (brut → net) calculator
pages.push({
  url: "/calcul-salaire-net-quebec/",
  out: "calcul-salaire-net-quebec/index.html",
  lang: "fr",
  showCalc: false,
  extraJs: ["/assets/js/salary.js"],
  featureList: ["Salaire brut en net", "Impôt fédéral et du Québec", "RRQ, assurance-emploi et RQAP", "Net par période de paie"],
  title: "Calcul Salaire Net Québec 2026 | Salaire Brut en Net",
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
    <p>Vous cherchez plutôt à calculer les taxes de vente? Utilisez le <a href="/calcul-tps-tvq/">calcul TPS TVQ</a> ou le <a href="/calculateur-de-taxes-quebec/">calculateur de taxes Québec</a>.</p>
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
    cta: postCta("/calcul-tps-tvq/", "Ouvrir la calculatrice TPS TVQ", "Pas envie de calculer à la main? La calculatrice ajoute la TPS et la TVQ instantanément."),
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
    <p>Pour une facture, un devis ou une dépense, la <a href="/calcul-tps-tvq/">calculatrice TPS TVQ</a> évite les erreurs d'arrondi. Si votre prix inclut déjà les taxes, utilisez plutôt le <a href="/calcul-taxe-inverse-quebec/">calcul de taxe inverse</a>. Pour les taux à jour, voyez les <a href="/taux-tps-tvq-quebec/">taux TPS TVQ au Québec</a>.</p>`,
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
    <p>Pour calculer un montant précis, utilisez la <a href="/calcul-tps-tvq/">calculatrice TPS TVQ</a> ou la page des <a href="/taux-tps-tvq-quebec/">taux TPS TVQ au Québec</a>.</p>`,
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
    cta: postCta("/calcul-tps-tvq/", "Calculer la TPS et la TVQ", "Voyez la TPS et la TVQ séparément sur n'importe quel montant."),
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
    <p>Le Canada est un système à deux paliers&nbsp;: une taxe fédérale (TPS) et une taxe provinciale (la TVQ au Québec). D'autres provinces utilisent une taxe harmonisée (TVH), mais le Québec garde sa TVQ distincte. Pour additionner les deux, utilisez la <a href="/calcul-tps-tvq/">calculatrice TPS TVQ</a>.</p>`,
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
    cta: postCta("/calcul-tps-tvq/", "Calculer la TPS et la TVQ", "Pour un produit taxable, la calculatrice ajoute la TPS et la TVQ instantanément."),
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
    <p>Dans les deux cas, le consommateur ne paie aucune taxe. La différence touche surtout les entreprises&nbsp;: voyez la <a href="/taxable-detaxe-exonere-quebec/">différence entre taxable, détaxé et exonéré</a>. Pour un produit taxable, utilisez la <a href="/calcul-tps-tvq/">calculatrice TPS TVQ</a> ou consultez les <a href="/taux-tps-tvq-quebec/">taux TPS TVQ au Québec</a>.</p>
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
    cta: postCta("/calcul-tps-tvq/", "Calculer une fourniture taxable", "Pour un produit taxable, ajoutez la TPS et la TVQ en un clic."),
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
    <p>Pour voir quels biens entrent dans chaque catégorie, lisez <a href="/produits-sans-taxes-quebec/">quels produits n'ont pas de TPS/TVQ</a>. Pour calculer une fourniture taxable, utilisez la <a href="/calcul-tps-tvq/">calculatrice TPS TVQ</a>.</p>
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
    cta: postCta("/calcul-tps-tvq/", "Calculer la TPS et la TVQ à facturer", "Une fois inscrit, ajoutez la TPS et la TVQ à vos factures en un clic."),
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
    cta: postCta("/calcul-tps-tvq/", "Calculer les taxes de vos factures", "Ajoutez la TPS et la TVQ à vos honoraires en quelques secondes."),
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
    <p>Pour bâtir une facture complète, voyez <a href="/calcul-taxes-facture-quebec/">comment calculer les taxes sur une facture</a>. Pour ajouter rapidement les taxes, utilisez la <a href="/calcul-tps-tvq/">calculatrice TPS TVQ</a>.</p>
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
    cta: postCta("/calcul-tps-tvq/", "Calculer les taxes de la facture", "Entrez le sous-total et obtenez la TPS, la TVQ et le total."),
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
    <p>Pour une seule somme, la <a href="/calcul-tps-tvq/">calculatrice TPS TVQ</a> suffit. Travailleur autonome&nbsp;? Voyez le <a href="/tps-tvq-travailleur-autonome/">guide TPS TVQ pour travailleurs autonomes</a>.</p>
    <p class="disclaimer">Information générale seulement. Confirmez les exigences de facturation auprès de Revenu Québec.</p>`,
    faqs: [
      { q: "Comment ajouter les taxes à une facture au Québec?", a: "Faites le sous-total des articles, puis ajoutez 5 % de TPS et 9,975 % de TVQ sur ce sous-total. Le total est le sous-total × 1,14975." },
      { q: "La TVQ se calcule-t-elle sur le sous-total avec TPS?", a: "Non. La TPS et la TVQ se calculent toutes les deux sur le sous-total avant taxes." },
      { q: "Faut-il afficher les numéros de taxe sur la facture?", a: "Oui. Une entreprise inscrite doit indiquer ses numéros d'inscription à la TPS et à la TVQ sur ses factures." }
    ]
  },

  {
    url: "/taxes-incluses-vs-taxes-en-sus/",
    short: "Taxes incluses ou en sus",
    title: "Taxes incluses vs taxes en sus : comprendre le prix final | Québec",
    desc: "Taxes incluses ou taxes en sus : la différence sur le prix final au Québec, avec la formule pour passer de l'un à l'autre et des exemples chiffrés.",
    h1: "Taxes incluses vs taxes en sus : comprendre le prix final",
    intro: "Deux façons d'afficher un prix, un seul total réel.",
    datePublished: "2026-06-15",
    answer:
      "<p>Un prix <strong>taxes en sus</strong> est affiché avant taxes&nbsp;: il faut ajouter 14,975&nbsp;% pour obtenir le total. Un prix <strong>taxes incluses</strong> contient déjà la TPS et la TVQ&nbsp;: c'est le montant final à payer. Pour passer d'un prix taxes incluses au montant avant taxes, divisez par <strong>1,14975</strong>.</p>",
    facts: [
      { k: "Taxes en sus", v: "Avant taxes" },
      { k: "Taxes incluses", v: "Total final" },
      { k: "Ajouter les taxes", v: "× 1,14975" },
      { k: "Retirer les taxes", v: "÷ 1,14975" }
    ],
    cta: postCta("/calcul-taxe-inverse-quebec/", "Calculer un prix taxes incluses", "Entrez un prix taxes incluses pour voir le montant avant taxes."),
    sections: `    <h2>Taxes en sus</h2>
    <p>« Taxes en sus » veut dire que le prix affiché n'inclut pas la TPS ni la TVQ. C'est l'affichage habituel dans les commerces&nbsp;: le 100&nbsp;$ sur l'étiquette devient 114,98&nbsp;$ à la caisse.</p>
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
    <h2>Pourquoi ça compte</h2>
    <p>Comparer un prix taxes en sus à un prix taxes incluses sans conversion fausse la comparaison. Ramenez toujours les deux à la même base. Pour ajouter les taxes, utilisez la <a href="/calcul-tps-tvq/">calculatrice TPS TVQ</a>&nbsp;; pour les retirer, le <a href="/calcul-taxe-inverse-quebec/">calcul de taxe inverse</a>.</p>`,
    faqs: [
      { q: "Que veut dire « taxes en sus »?", a: "Que le prix affiché ne comprend pas les taxes. Il faut ajouter 14,975 % (TPS + TVQ) pour obtenir le total à payer." },
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
    cta: postCta("/calcul-tps-tvq/", "Calculer les taxes après rabais", "Entrez le prix après rabais et ajoutez la TPS et la TVQ."),
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
    <p>Pour ajouter les taxes au prix rabattu, utilisez la <a href="/calcul-tps-tvq/">calculatrice TPS TVQ</a>. Pour comprendre l'affichage, voyez <a href="/taxes-incluses-vs-taxes-en-sus/">taxes incluses vs taxes en sus</a>.</p>`,
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
    cta: postCta("/calcul-tps-tvq/", "Calculer un autre montant", "Votre montant n'est pas dans le tableau? La calculatrice le fait au cent près."),
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
    <p>Besoin d'un montant absent du tableau&nbsp;? Utilisez la <a href="/calcul-tps-tvq/">calculatrice TPS TVQ</a>. Pour retirer les taxes d'un total, voyez le <a href="/calcul-taxe-inverse-quebec/">calcul de taxe inverse</a> et les <a href="/taux-tps-tvq-quebec/">taux TPS TVQ au Québec</a>.</p>`,
    faqs: [
      { q: "Quel est le total taxes incluses sur 100 $ au Québec?", a: "114,98 $ : 5,00 $ de TPS plus 9,98 $ de TVQ s'ajoutent au montant de 100 $." },
      { q: "Comment calculer un montant absent du tableau?", a: "Multipliez le montant avant taxes par 1,14975 pour le total, ou par 0,05 et 0,09975 pour la TPS et la TVQ séparément." },
      { q: "Pourquoi un écart d'un cent parfois?", a: "Parce que la TVQ exacte comporte une fraction de cent. Selon qu'on arrondit chaque taxe ou le total, le résultat peut varier d'un cent." }
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
      if (p.url === "/" || p.url === "/quebec-tax-calculator/") {
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
- Calcul TPS TVQ (ajouter): ${SITE}/calcul-tps-tvq/
- Calcul taxe inverse (retirer): ${SITE}/calcul-taxe-inverse-quebec/
- Calculateur de taxes Québec: ${SITE}/calculateur-de-taxes-quebec/
- TPS TVQ en ligne: ${SITE}/tps-tvq-en-ligne/
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
