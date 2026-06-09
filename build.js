#!/usr/bin/env node
/* Static site generator for calcultaxesquebec.ca
 * Outputs plain HTML (no runtime framework). Run: node build.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const SITE = "https://calcultaxesquebec.ca";
const UPDATED_YEAR = "2026";
const BUILD_DATE = "2026-06-09";
const DATE_PUBLISHED = "2026-01-01";

/* ----------------------------- shared partials ---------------------------- */

const LOGO_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#fff" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';

const NAV = {
  fr: [
    { href: "/", label: "Accueil" },
    { href: "/calcul-tps-tvq/", label: "Calcul TPS TVQ" },
    { href: "/calcul-taxe-inverse-quebec/", label: "Taxe inverse" },
    { href: "/taux-tps-tvq-quebec/", label: "Taux TPS TVQ" },
    { href: "/blog/", label: "Blogue" },
    { href: "/quebec-tax-calculator/", label: "English" }
  ],
  en: [
    { href: "/quebec-tax-calculator/", label: "Home" },
    { href: "/calcul-tps-tvq/", label: "Calcul TPS TVQ" },
    { href: "/calcul-taxe-inverse-quebec/", label: "Taxe inverse" },
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
      page.lang === "en"
        ? ["Add GST and QST", "Remove tax (reverse)", "Quebec number formatting"]
        : ["Ajouter la TPS et la TVQ", "Retirer les taxes (inverse)", "Format québécois"]
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
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="format-detection" content="telephone=no">

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
<script src="/assets/js/calculator.js" defer></script>
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

## Calculatrices
- Calcul taxes Québec (accueil): ${SITE}/
- Calcul TPS TVQ (ajouter): ${SITE}/calcul-tps-tvq/
- Calcul taxe inverse (retirer): ${SITE}/calcul-taxe-inverse-quebec/
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

/* robots.txt */
const robots = `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
fs.writeFileSync(path.join(root, "robots.txt"), robots);
console.log("wrote robots.txt");

console.log("Build complete.");
